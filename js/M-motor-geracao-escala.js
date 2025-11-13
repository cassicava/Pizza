importScripts('E-constantes.js', 'D-utilitarios-compartilhados.js');

self.onmessage = function(e) {
    if (e.data.type === 'cancel') {
        self.close();
        return;
    }

    const { geradorState, funcionarios, turnos, cargos, equipes } = e.data;

    postMessage({ type: 'progress', message: 'Analisando dados...' });

    try {
        const { cargoId, inicio, fim, cobertura, coberturaPorEquipe, excecoes, feriados, metasOverride } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) throw new Error("Cargo selecionado não foi encontrado.");

        const { maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos } = cargo.regras;

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

        postMessage({ type: 'progress', message: 'Fase 1: Criando slots mínimos...' });

        let slots = []; 
        const turnosDoCargoSet = new Set(); 
        Object.keys(cobertura).forEach(turnoId => turnosDoCargoSet.add(turnoId));
        Object.keys(coberturaPorEquipe).forEach(turnoId => turnosDoCargoSet.add(turnoId));

        dateRange.forEach((date, dateIndex) => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriadoDoDia = feriados.find(f => f.date === date);

            if ((feriadoDoDia && !feriadoDoDia.trabalha) || !cargoDiasOperacionais.includes(diaSemanaId)) {
                return;
            }

            turnosDoCargoSet.forEach(turnoId => {
                const coberturaDiaria = cobertura[turnoId] || {};
                const coberturaIndividualMinima = coberturaDiaria[diaSemanaId] || 0;

                for (let i = 0; i < coberturaIndividualMinima; i++) {
                    slots.push({ date, turnoId, assigned: null, id: uid(), isMandatory: true, phase: 1 }); 
                }

                if (coberturaPorEquipe[turnoId]) {
                    coberturaPorEquipe[turnoId].forEach(regra => {
                        const equipe = equipesMap[regra.equipeId];
                        if (!equipe) return;

                        const startIndex = dateRange.indexOf(regra.start);
                        if (startIndex === -1) return;

                        const ciclo = regra.work + regra.off;
                        const diaNoCiclo = (dateIndex - startIndex) % ciclo;

                        if (diaNoCiclo >= 0 && diaNoCiclo < regra.work) {
                            for (let i = 0; i < equipe.funcionarioIds.length; i++) {
                                slots.push({ date, turnoId, assigned: null, id: uid(), isMandatory: true, phase: 1 }); 
                            }
                        }
                    });
                }
            });
        });

        postMessage({ type: 'progress', message: 'Fase 1: Agendando ausências...' });

        todosFuncsDoCargo.forEach(func => {
            if (excecoes[func.id]) {
                for (const tipoId in excecoes[func.id]) {
                    const datasAusencia = excecoes[func.id][tipoId];
                    if (datasAusencia && datasAusencia.length > 0) {
                        datasAusencia.forEach(data => {
                            const existingSlot = slots.find(s => s.date === data && s.isMandatory);
                            if (!existingSlot) {
                                slots.push({ id: uid(), date: data, turnoId: tipoId, assigned: func.id, isMandatory: false, phase: 1 }); 
                            } else {
                                slots.push({ id: uid(), date: data, turnoId: tipoId, assigned: func.id, isMandatory: false, phase: 1 });
                            }
                        });
                    }
                }
            }
        });

        postMessage({ type: 'progress', message: 'Fase 1: Alocando equipes fixas...' });

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
                            const slotsDisponiveis = slots.filter(s => s.date === date && s.turnoId === turnoId && s.isMandatory && !s.assigned);
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

        postMessage({ type: 'progress', message: 'Fase 1: Preenchendo vagas mínimas...' });

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

        const metaHorasMap = new Map();
        const metaTurnosMap = new Map();

        todosFuncsDoCargo.forEach(f => {
            const overrideMeta = metasOverride[f.id];

            if (f.medicaoCarga === 'turnos') {
                let metaIndividual = calcularMetaTurnos(f, inicio, fim, cargoDiasOperacionais);
                if (overrideMeta !== undefined) {
                    metaIndividual = overrideMeta;
                }
                metaTurnosMap.set(f.id, metaIndividual);
            } else {
                let metaIndividual = calcularMetaHoras(f, inicio, fim);
                if (overrideMeta !== undefined) {
                    metaIndividual = overrideMeta;
                }
                metaHorasMap.set(f.id, metaIndividual);
            }
        });

        feriados.filter(feriado => feriado.descontaMeta && !feriado.trabalha).forEach(feriado => {
            const funcsQueFolgaram = todosFuncsDoCargo.filter(f =>
                !slots.some(s => s.date === feriado.date && s.assigned === f.id) && 
                !excecoesMap[f.id]?.has(feriado.date) 
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

        const funcsIndividuais = todosFuncsDoCargo.filter(f => !funcsEmEquipesAlocadas.has(f.id));

        const slotsMinimosVagos = slots.filter(s => s.isMandatory && !s.assigned).sort((a,b) => a.date.localeCompare(b.date));

        slotsMinimosVagos.forEach(slot => {
            const turno = turnosMap[slot.turnoId];
            if (!turno || turno.isSystem) return; 

            const slotDate = new Date(slot.date + 'T12:00:00');
            const slotDiaSemanaId = DIAS_SEMANA[slotDate.getUTCDay()].id;
            const slotMonth = slot.date.substring(0, 7);

            const candidatos = funcsIndividuais.map(f => {
                const tempSlots = [...slots.filter(s => s.id !== slot.id), { ...slot, assigned: f.id }];

                if (excecoesMap[f.id]?.has(slot.date)) return null; 
                if (!f.disponibilidade?.[turno.id]?.includes(slotDiaSemanaId)) return null; 
                if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null; 

                if (checkMandatoryRestViolation(f, turno, slot.date, tempSlots, turnosMap).violation) return null;
                if (calculateFullConsecutiveWorkDays(f.id, tempSlots, slot.date, turnosMap) > maxDiasConsecutivos) return null;

                if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) { 
                    const workedWeekends = tempSlots.filter(s => s.assigned === f.id && s.date.startsWith(slotMonth))
                        .reduce((acc, cur) => {
                            const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                            if (day === 6) acc.saturdays++;
                            if (day === 0) acc.sundays++;
                            return acc;
                        }, { saturdays: 0, sundays: 0 });

                    const monthData = weekendDataByMonth[slotMonth];

                    if (slotDate.getUTCDay() === 6 && (monthData.totalSaturdays - workedWeekends.saturdays) < minFolgasSabados) return null;
                    if (slotDate.getUTCDay() === 0 && (monthData.totalSundays - workedWeekends.sundays) < minFolgasDomingos) return null;
                }

                let score;
                const medicao = f.medicaoCarga || 'horas';

                if (medicao === 'turnos') {
                    const turnosAtuais = historico[f.id].turnosTrabalhados;
                    const metaTurnos = metaTurnosMap.get(f.id) || 0;
                    score = metaTurnos > 0 ? (turnosAtuais / metaTurnos) * 100 : (turnosAtuais > 0 ? 1000 : 0);
                } else { 
                    const horasAtuais = historico[f.id].horasTrabalhadas / 60;
                    const metaHoras = metaHorasMap.get(f.id) || 0;
                    score = metaHoras > 0 ? (horasAtuais / metaHoras) * 100 : (horasAtuais > 0 ? 1000 : 0);
                }

                if (f.preferencias?.[turno.id]?.includes(slotDiaSemanaId)) {
                    score -= 10; 
                }

                return { func: f, score };
            }).filter(Boolean).sort((a, b) => a.score - b.score); 

            if (candidatos.length > 0) {
                const escolhido = candidatos[0].func;
                const slotOriginalIndex = slots.findIndex(s => s.id === slot.id);
                if (slotOriginalIndex > -1) {
                    slots[slotOriginalIndex].assigned = escolhido.id; 
                    historico[escolhido.id].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                    historico[escolhido.id].turnosTrabalhados += 1;
                }
            }
        });

        postMessage({ type: 'progress', message: 'Fase 2: Otimizando metas...' });

        let alocouAlgoNaIteracao = true;
        let maxIteracoes = todosFuncsDoCargo.length * dateRange.length; 
        let iteracoes = 0;

        while(alocouAlgoNaIteracao && iteracoes < maxIteracoes) {
            alocouAlgoNaIteracao = false;
            iteracoes++;

            const funcionariosSubAlocados = funcsIndividuais 
                .map(f => {
                    const medicao = f.medicaoCarga || 'horas';
                    let progresso, meta;
                    if (medicao === 'turnos') {
                        progresso = historico[f.id].turnosTrabalhados;
                        meta = metaTurnosMap.get(f.id) || 0;
                    } else {
                        progresso = historico[f.id].horasTrabalhadas / 60;
                        meta = metaHorasMap.get(f.id) || 0;
                    }
                    const percentualMeta = meta > 0 ? (progresso / meta) * 100 : (progresso > 0 ? 1000 : 0);
                    return { func: f, percentualMeta };
                })
                .filter(item => item.percentualMeta < 100) 
                .sort((a, b) => a.percentualMeta - b.percentualMeta); 

            if (funcionariosSubAlocados.length === 0) break; 

            for (const item of funcionariosSubAlocados) {
                const f = item.func;
                let alocouParaEsteFunc = false;

                for (const date of dateRange) {
                    if (alocouParaEsteFunc) break; 

                    const slotDate = new Date(date + 'T12:00:00');
                    const slotDiaSemanaId = DIAS_SEMANA[slotDate.getUTCDay()].id;
                    const slotMonth = date.substring(0, 7);
                    const feriadoDoDia = feriados.find(fer => fer.date === date);

                    if ((feriadoDoDia && !feriadoDoDia.trabalha) || !cargoDiasOperacionais.includes(slotDiaSemanaId)) {
                        continue;
                    }

                    const turnosPossiveis = turnos.filter(t => !t.isSystem && cargo.turnosIds.includes(t.id));

                    for (const turno of turnosPossiveis) {
                        const tempSlots = [...slots, { date: date, turnoId: turno.id, assigned: f.id }];

                        if (excecoesMap[f.id]?.has(date)) continue; 
                        if (!f.disponibilidade?.[turno.id]?.includes(slotDiaSemanaId)) continue; 
                        if (slots.some(s => s.assigned === f.id && s.date === date)) continue; 

                        if (checkMandatoryRestViolation(f, turno, date, tempSlots, turnosMap).violation) continue;
                        if (calculateFullConsecutiveWorkDays(f.id, tempSlots, date, turnosMap) > maxDiasConsecutivos) continue;
                        if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) {
                            const workedWeekends = tempSlots.filter(s => s.assigned === f.id && s.date.startsWith(slotMonth))
                                .reduce((acc, cur) => { 
                                     const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                                     if (day === 6) acc.saturdays++;
                                     if (day === 0) acc.sundays++;
                                     return acc;
                                }, { saturdays: 0, sundays: 0 });
                             const monthData = weekendDataByMonth[slotMonth];
                             if (slotDate.getUTCDay() === 6 && (monthData.totalSaturdays - workedWeekends.saturdays) < minFolgasSabados) continue;
                             if (slotDate.getUTCDay() === 0 && (monthData.totalSundays - workedWeekends.sundays) < minFolgasDomingos) continue;
                        }

                        const medicao = f.medicaoCarga || 'horas';
                        let ultrapassaMeta = false;
                        if (medicao === 'turnos') {
                            ultrapassaMeta = (historico[f.id].turnosTrabalhados + 1) > (metaTurnosMap.get(f.id) || 0);
                        } else {
                            const cargaTurno = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                            ultrapassaMeta = ((historico[f.id].horasTrabalhadas + cargaTurno) / 60) > (metaHorasMap.get(f.id) || 0);
                        }
                        if (ultrapassaMeta && !f.fazHoraExtra) continue; 

                        const novoSlot = {
                            date,
                            turnoId: turno.id,
                            assigned: f.id,
                            id: uid(),
                            isMandatory: false, 
                            phase: 2,
                            isExtra: ultrapassaMeta 
                        };
                        slots.push(novoSlot);

                        historico[f.id].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                        historico[f.id].turnosTrabalhados += 1;

                        alocouAlgoNaIteracao = true;
                        alocouParaEsteFunc = true;
                        break; 
                    } 
                } 
            } 
        } 

        postMessage({ type: 'progress', message: 'Finalizando escala...' });

        const nomeEscala = generateEscalaNome(cargo.nome, inicio, fim);
        const escalaFinal = {
            id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico,
            excecoes: JSON.parse(JSON.stringify(excecoes)), 
            feriados: [...geradorState.feriados], 
            cobertura: { ...geradorState.cobertura }, 
            coberturaPorEquipe: JSON.parse(JSON.stringify(coberturaPorEquipe)), 
            regras: { maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos }, 
            metasOverride: { ...geradorState.metasOverride }, 
            observacoes: '',
        };

        postMessage({ type: 'done', escala: escalaFinal });

    } catch (error) {
        console.error("Erro no Worker:", error);
        postMessage({ type: 'error', message: error.message });
    }
};