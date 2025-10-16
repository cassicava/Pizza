/**************************************
 * ⚙️ Web Worker para Geração de Escala
 * Este script roda em uma thread separada.
 **************************************/

importScripts('constants.js', 'shared-utils.js');

self.onmessage = function(e) {
    if (e.data.type === 'cancel') {
        self.close(); 
        return;
    }
    
    const { geradorState, funcionarios, turnos, cargos, equipes } = e.data;
    
    postMessage({ type: 'progress', message: 'Analisando dados...' });

    try {
        const { cargoId, inicio, fim, cobertura, coberturaPorEquipe, excecoes, maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos, feriados } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) throw new Error("Cargo selecionado não foi encontrado.");
        
        const cargoDiasOperacionais = cargo.regras.dias || DIAS_SEMANA.map(d => d.id);

        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
        const equipesMap = Object.fromEntries(equipes.map(eq => [eq.id, eq]));
        const funcionariosMap = new Map(funcionarios.map(f => [f.id, f]));
        const dateRange = dateRangeInclusive(inicio, fim);
        
        postMessage({ type: 'progress', message: 'Preparando alocação...' });

        const todosFuncsDoCargo = funcionarios.filter(f => f.cargoId === cargoId && f.status !== 'arquivado');
        const excecoesMap = {};
        todosFuncsDoCargo.forEach(f => {
            const funcExcecoes = excecoes[f.id] || {};
            let allAusencias = [];
            for (const tipoId in funcExcecoes) {
                if(Array.isArray(funcExcecoes[tipoId])) {
                    allAusencias = allAusencias.concat(funcExcecoes[tipoId]);
                }
            }
            excecoesMap[f.id] = new Set(allAusencias);
        });

        let slots = [];
        const turnosDoCargoSet = new Set(Object.keys(cobertura));
        Object.keys(coberturaPorEquipe).forEach(turnoId => turnosDoCargoSet.add(turnoId));

        // LÓGICA DE CRIAÇÃO DE SLOTS CORRIGIDA
        dateRange.forEach((date, dateIndex) => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriadoDoDia = feriados.find(f => f.date === date);

            if ((feriadoDoDia && !feriadoDoDia.trabalha) || !cargo.regras.dias.includes(diaSemanaId)) {
                return; // Pula dia de folga geral ou dia que o cargo não opera
            }

            turnosDoCargoSet.forEach(turnoId => {
                // 1. Adiciona slots para cobertura individual/complementar
                const coberturaIndividual = cobertura[turnoId] || 0;
                for (let i = 0; i < coberturaIndividual; i++) {
                    slots.push({ date, turnoId, assigned: null, id: uid() });
                }

                // 2. Adiciona slots para equipes que trabalham neste dia
                if (coberturaPorEquipe[turnoId]) {
                    coberturaPorEquipe[turnoId].forEach(regra => {
                        const equipe = equipesMap[regra.equipeId];
                        if (!equipe) return;

                        const startIndex = dateRange.indexOf(regra.start);
                        if (startIndex === -1) return;

                        const ciclo = regra.work + regra.off;
                        const diaNoCiclo = (dateIndex - startIndex) % ciclo;

                        // Se a equipe está no período de trabalho do ciclo
                        if (diaNoCiclo >= 0 && diaNoCiclo < regra.work) {
                            for (let i = 0; i < equipe.funcionarioIds.length; i++) {
                                slots.push({ date, turnoId, assigned: null, id: uid() });
                            }
                        }
                    });
                }
            });
        });
        
        postMessage({ type: 'progress', message: 'Agendando ausências...' });
        
        todosFuncsDoCargo.forEach(func => {
            if (excecoes[func.id]) {
                for (const tipoId in excecoes[func.id]) {
                    const datasAusencia = excecoes[func.id][tipoId];
                    if (datasAusencia && datasAusencia.length > 0) {
                        datasAusencia.forEach(data => {
                            // Adiciona slot de ausência apenas se não houver um turno já alocado para essa pessoa no dia
                            const hasExistingShift = slots.some(s => s.assigned === func.id && s.date === data);
                            if (!hasExistingShift) {
                                slots.push({ id: uid(), date: data, turnoId: tipoId, assigned: func.id });
                            }
                        });
                    }
                }
            }
        });
        
        postMessage({ type: 'progress', message: 'Alocando equipes fixas...' });
        const funcsEmEquipesAlocadas = new Set();

        for (const turnoId in coberturaPorEquipe) {
            coberturaPorEquipe[turnoId].forEach(regra => {
                const equipe = equipesMap[regra.equipeId];
                if (!equipe) return;
                
                const startIndex = dateRange.indexOf(regra.start);
                if (startIndex === -1) return;

                dateRange.forEach((date, index) => {
                    const diaSemana = new Date(date + 'T12:00:00');
                    const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
                    const ciclo = regra.work + regra.off;
                    const diaNoCiclo = (index - startIndex) % ciclo;

                    if (diaNoCiclo >= 0 && diaNoCiclo < regra.work) {
                        const todosMembrosDisponiveis = equipe.funcionarioIds.every(funcId => {
                            const func = funcionariosMap.get(funcId);
                            return func && 
                                   !excecoesMap[funcId]?.has(date) &&
                                   func.disponibilidade?.[turnoId]?.includes(diaSemanaId);
                        });

                        if (todosMembrosDisponiveis) {
                            const slotsDisponiveis = slots.filter(s => s.date === date && s.turnoId === turnoId && !s.assigned);
                            if (slotsDisponiveis.length >= equipe.funcionarioIds.length) {
                                equipe.funcionarioIds.forEach((funcId, i) => {
                                    if(slotsDisponiveis[i]) {
                                        slotsDisponiveis[i].assigned = funcId;
                                        slotsDisponiveis[i].equipeId = equipe.id;
                                        funcsEmEquipesAlocadas.add(funcId);
                                    }
                                });
                            }
                        }
                    }
                });
            });
        }

        postMessage({ type: 'progress', message: 'Preenchendo vagas restantes...' });
        
        let historico = {};
        todosFuncsDoCargo.forEach(f => {
            historico[f.id] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
        });

        slots.filter(s => s.assigned).forEach(s => {
            const turno = turnosMap[s.turnoId];
            if(turno && !turno.isSystem && historico[s.assigned]) {
                historico[s.assigned].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                historico[s.assigned].turnosTrabalhados += 1;
            }
        });
        
        const funcsIndividuais = todosFuncsDoCargo.filter(f => !funcsEmEquipesAlocadas.has(f.id));
        
        const metaHorasMap = new Map();
        const metaTurnosMap = new Map();
        
        todosFuncsDoCargo.forEach(f => {
            if (f.medicaoCarga === 'turnos') {
                metaTurnosMap.set(f.id, calcularMetaTurnos(f, inicio, fim, cargoDiasOperacionais));
            } else {
                metaHorasMap.set(f.id, calcularMetaHoras(f, inicio, fim));
            }
        });
        
        postMessage({ type: 'progress', message: 'Ajustando metas para feriados...'});
        feriados.filter(feriado => feriado.descontaMeta && !feriado.trabalha).forEach(feriado => {
            const funcsQueFolgaram = todosFuncsDoCargo.filter(f => 
                !slots.some(s => s.date === feriado.date && s.assigned === f.id) &&
                !excecoesMap[f.id].has(feriado.date)
            );

            funcsQueFolgaram.forEach(f => {
                const medicao = f.medicaoCarga || 'horas';
                
                if (medicao === 'horas' && metaHorasMap.has(f.id)) {
                    const metaAtual = metaHorasMap.get(f.id);
                    metaHorasMap.set(f.id, Math.max(0, metaAtual - (feriado.desconto.horas || 0)));
                } else if (medicao === 'turnos' && metaTurnosMap.has(f.id)) {
                    const metaAtual = metaTurnosMap.get(f.id);
                    metaTurnosMap.set(f.id, Math.max(0, metaAtual - (feriado.desconto.turnos || 0)));
                }
            });
        });
        
        const weekendDataByMonth = {};
        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            const month = date.substring(0, 7);
            if (!weekendDataByMonth[month]) {
                weekendDataByMonth[month] = { totalSaturdays: 0, totalSundays: 0 };
            }
            if (d.getUTCDay() === 6) weekendDataByMonth[month].totalSaturdays++;
            if (d.getUTCDay() === 0) weekendDataByMonth[month].totalSundays++;
        });
        
        function preencherSlotsIndividuais(usarHoraExtra = false) {
             slots.filter(s => !s.assigned).forEach(slot => {
                const turno = turnosMap[slot.turnoId];
                if (!turno) return;

                const slotDate = new Date(slot.date + 'T12:00:00');
                const slotDiaSemanaId = DIAS_SEMANA[slotDate.getUTCDay()].id;
                const slotMonth = slot.date.substring(0, 7);

                const candidatos = funcsIndividuais.map(f => {
                    const tempSlots = [...slots, { date: slot.date, turnoId: slot.turnoId, assigned: f.id }];

                    if (excecoesMap[f.id].has(slot.date)) return null;
                    if (!f.disponibilidade[turno.id]?.includes(slotDiaSemanaId)) return null;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                    
                    if (checkMandatoryRestViolation(f, turno, slot.date, tempSlots, turnosMap).violation) return null;
                    if (calculateFullConsecutiveWorkDays(f.id, tempSlots, slot.date, turnosMap) > maxDiasConsecutivos) return null;

                    if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) {
                        const workedWeekends = slots.filter(s => s.assigned === f.id && s.date.startsWith(slotMonth))
                            .reduce((acc, cur) => {
                                const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                                if (day === 6) acc.saturdays++;
                                if (day === 0) acc.sundays++;
                                return acc;
                            }, { saturdays: 0, sundays: 0 });

                        const monthData = weekendDataByMonth[slotMonth];
                        
                        if (slotDate.getUTCDay() === 6 && (monthData.totalSaturdays - (workedWeekends.saturdays + 1)) < minFolgasSabados) return null;
                        if (slotDate.getUTCDay() === 0 && (monthData.totalSundays - (workedWeekends.sundays + 1)) < minFolgasDomingos) return null;
                    }
                    
                    let score;
                    const medicao = f.medicaoCarga || 'horas';

                    if (medicao === 'turnos') {
                        const turnosAtuais = historico[f.id].turnosTrabalhados;
                        const metaTurnos = metaTurnosMap.get(f.id) || 0;
                        
                        if (!usarHoraExtra && turnosAtuais >= metaTurnos) return null;
                        if (usarHoraExtra && !f.fazHoraExtra) return null;
                        
                        score = (turnosAtuais / (metaTurnos || 1)) * 100;
                    } else {
                        const horasAtuais = historico[f.id].horasTrabalhadas;
                        const metaHoras = metaHorasMap.get(f.id) || 0;
                        
                        if (!usarHoraExtra && (horasAtuais / 60) >= metaHoras) return null;
                        if (usarHoraExtra && !f.fazHoraExtra) return null;
                        
                        score = (horasAtuais / 60) / (metaHoras || 1) * 100;
                    }

                    if (f.preferencias?.[turno.id]?.includes(slotDiaSemanaId)) {
                        score -= 10;
                    }

                    return { func: f, score };
                }).filter(Boolean).sort((a, b) => a.score - b.score);

                if (candidatos.length > 0) {
                    const escolhido = candidatos[0].func;
                    slot.assigned = escolhido.id;
                    if (usarHoraExtra) slot.isExtra = true;
                    if (!turno.isSystem) {
                        historico[escolhido.id].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                        historico[escolhido.id].turnosTrabalhados += 1;
                    }
                }
            });
        }
        
        preencherSlotsIndividuais(false);
        postMessage({ type: 'progress', message: 'Otimizando com horas extras...' });
        preencherSlotsIndividuais(true);
        
        postMessage({ type: 'progress', message: 'Finalizando escala...' });

        const nomeEscala = generateEscalaNome(cargo.nome, inicio, fim);
        const escalaFinal = {
            id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico,
            excecoes: JSON.parse(JSON.stringify(excecoes)),
            feriados: [...geradorState.feriados],
            cobertura: { ...cobertura },
            regras: { maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos },
            observacoes: '',
        };
        
        postMessage({ type: 'done', escala: escalaFinal });

    } catch (error) {
        console.error("Erro no Worker:", error);
        postMessage({ type: 'error', message: error.message });
    }
};