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
        dateRange.forEach(date => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriadoDoDia = feriados.find(f => f.date === date);
            
            // ALTERAÇÃO: Não cria vagas (slots) em dias de "Folga Geral"
            if (feriadoDoDia && !feriadoDoDia.trabalha) {
                return;
            }

            if (cargo.regras.dias.includes(diaSemanaId)) {
                const turnosDoDia = new Set(Object.keys(cobertura));
                Object.keys(coberturaPorEquipe).forEach(turnoId => turnosDoDia.add(turnoId));

                turnosDoDia.forEach(turnoId => {
                    const coberturaIndividual = cobertura[turnoId] || 0;
                    let coberturaTotalEquipes = 0;
                    if (coberturaPorEquipe[turnoId]) {
                        coberturaPorEquipe[turnoId].forEach(regra => {
                            const equipe = equipesMap[regra.equipeId];
                            if(equipe) coberturaTotalEquipes += equipe.funcionarioIds.length;
                        });
                    }
                    const totalCobertura = coberturaTotalEquipes + coberturaIndividual;
                    for (let i = 0; i < totalCobertura; i++) {
                        slots.push({ date, turnoId, assigned: null, id: uid() });
                    }
                });
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
                    const diaSemanaId = DIAS_SEMANA[new Date(date + 'T12:00:00').getUTCDay()].id;
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
                                    slotsDisponiveis[i].assigned = funcId;
                                    slotsDisponiveis[i].equipeId = equipe.id;
                                    funcsEmEquipesAlocadas.add(funcId);
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
        funcsIndividuais.forEach(f => {
            if (f.medicaoCarga === 'turnos') {
                metaTurnosMap.set(f.id, calcularMetaTurnos(f, inicio, fim));
            } else {
                metaHorasMap.set(f.id, calcularMetaHoras(f, inicio, fim));
            }
        });
        
        postMessage({ type: 'progress', message: 'Ajustando metas para feriados...'});
        feriados.filter(feriado => feriado.descontaMeta && !feriado.trabalha).forEach(feriado => {
            const funcsQueFolgaram = funcsIndividuais.filter(f => 
                !slots.some(s => s.date === feriado.date && s.assigned === f.id) &&
                !excecoesMap[f.id].has(feriado.date)
            );

            funcsQueFolgaram.forEach(f => {
                const medicao = f.medicaoCarga || 'horas';
                
                // ALTERAÇÃO: Adicionado 'else if' para descontar a meta de turnos também.
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
                    if (excecoesMap[f.id].has(slot.date)) return null;
                    if (!f.disponibilidade[turno.id]?.includes(slotDiaSemanaId)) return null;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                    if (checkMandatoryRestViolation(f, turno, slot.date, slots, turnosMap).violation) return null;
                    if ((calculateConsecutiveWorkDays(f.id, slots, addDays(slot.date, -1), turnosMap) + 1) > maxDiasConsecutivos) return null;

                    if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) {
                        const workedWeekends = slots.filter(s => s.assigned === f.id && s.date.startsWith(slotMonth))
                            .reduce((acc, cur) => {
                                const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                                if (day === 6) acc.saturdays++;
                                if (day === 0) acc.sundays++;
                                return acc;
                            }, { saturdays: 0, sundays: 0 });

                        const monthData = weekendDataByMonth[slotMonth];
                        if (slotDate.getUTCDay() === 6 && (monthData.totalSaturdays - workedWeekends.saturdays) <= minFolgasSabados) return null;
                        if (slotDate.getUTCDay() === 0 && (monthData.totalSundays - workedWeekends.sundays) <= minFolgasDomingos) return null;
                    }
                    
                    let score;
                    const medicao = f.medicaoCarga || 'horas';

                    if (medicao === 'turnos') {
                        const turnosAtuais = historico[f.id].turnosTrabalhados;
                        const metaTurnos = metaTurnosMap.get(f.id) || 0;
                        
                        if (!usarHoraExtra && turnosAtuais >= metaTurnos) return null;
                        if (usarHoraExtra && !f.fazHoraExtra) return null;
                        
                        score = (turnosAtuais / (metaTurnos || 1)) * 100;
                    } else { // 'horas'
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
            cobertura,
            regras: { maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos }
        };
        
        postMessage({ type: 'done', escala: escalaFinal });

    } catch (error) {
        console.error("Erro no Worker:", error);
        postMessage({ type: 'error', message: error.message });
    }
};