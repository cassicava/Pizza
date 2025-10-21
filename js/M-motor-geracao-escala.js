/**************************************
 * ⚙️ Web Worker para Geração de Escala (v2 - Lógica Bifásica)
 * Este script roda em uma thread separada.
 **************************************/

importScripts('E-constantes.js', 'D-utilitarios-compartilhados.js');

self.onmessage = function(e) {
    if (e.data.type === 'cancel') {
        self.close();
        return;
    }

    const { geradorState, funcionarios, turnos, cargos, equipes } = e.data;

    postMessage({ type: 'progress', message: 'Analisando dados...' });

    try {
        const { cargoId, inicio, fim, cobertura, coberturaPorEquipe, excecoes, feriados } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) throw new Error("Cargo selecionado não foi encontrado.");

        // As regras agora vêm do objeto do cargo
        const { maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos } = cargo.regras;

        const cargoDiasOperacionais = cargo.regras.dias || DIAS_SEMANA.map(d => d.id); // Dias em que o cargo opera

        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
        const equipesMap = Object.fromEntries(equipes.map(eq => [eq.id, eq]));
        const funcionariosMap = new Map(funcionarios.map(f => [f.id, f]));
        const dateRange = dateRangeInclusive(inicio, fim);

        postMessage({ type: 'progress', message: 'Preparando alocação...' });

        const todosFuncsDoCargo = funcionarios.filter(f => f.cargoId === cargoId && f.status !== 'arquivado');
        const excecoesMap = {}; // Mapeia funcId -> Set de datas com ausência
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

        // --- FASE 1: Cobertura Mínima Essencial ---

        postMessage({ type: 'progress', message: 'Fase 1: Criando slots mínimos...' });

        let slots = []; // Array principal de slots da escala
        const turnosDoCargoSet = new Set(); // Guarda todos os turnos relevantes para este cargo
        Object.keys(cobertura).forEach(turnoId => turnosDoCargoSet.add(turnoId));
        Object.keys(coberturaPorEquipe).forEach(turnoId => turnosDoCargoSet.add(turnoId));

        // 1. Criação de Slots MÍNIMOS
        dateRange.forEach((date, dateIndex) => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriadoDoDia = feriados.find(f => f.date === date);

            // Pula dia se o cargo não opera ou é folga geral
            if ((feriadoDoDia && !feriadoDoDia.trabalha) || !cargoDiasOperacionais.includes(diaSemanaId)) {
                return;
            }

            turnosDoCargoSet.forEach(turnoId => {
                // 1a. Slots para cobertura individual/complementar mínima do dia
                const coberturaDiaria = cobertura[turnoId] || {};
                const coberturaIndividualMinima = coberturaDiaria[diaSemanaId] || 0;

                for (let i = 0; i < coberturaIndividualMinima; i++) {
                    slots.push({ date, turnoId, assigned: null, id: uid(), isMandatory: true, phase: 1 }); // Marca como obrigatório
                }

                // 1b. Slots MÍNIMOS baseados em equipes que trabalham neste dia
                if (coberturaPorEquipe[turnoId]) {
                    coberturaPorEquipe[turnoId].forEach(regra => {
                        const equipe = equipesMap[regra.equipeId];
                        if (!equipe) return;

                        const startIndex = dateRange.indexOf(regra.start);
                        if (startIndex === -1) return;

                        const ciclo = regra.work + regra.off;
                        const diaNoCiclo = (dateIndex - startIndex) % ciclo;

                        // Se a equipe trabalha neste dia do ciclo, cria slots para seus membros
                        if (diaNoCiclo >= 0 && diaNoCiclo < regra.work) {
                            for (let i = 0; i < equipe.funcionarioIds.length; i++) {
                                slots.push({ date, turnoId, assigned: null, id: uid(), isMandatory: true, phase: 1 }); // Marca como obrigatório
                            }
                        }
                    });
                }
            });
        });

        postMessage({ type: 'progress', message: 'Fase 1: Agendando ausências...' });

        // 2. Pré-alocação de Ausências (Férias, Folgas, Afastamentos)
        todosFuncsDoCargo.forEach(func => {
            if (excecoes[func.id]) {
                for (const tipoId in excecoes[func.id]) {
                    const datasAusencia = excecoes[func.id][tipoId];
                    if (datasAusencia && datasAusencia.length > 0) {
                        datasAusencia.forEach(data => {
                            // Verifica se já existe um slot mínimo para esse dia/turno (evita duplicar)
                            const existingSlot = slots.find(s => s.date === data && s.isMandatory);
                            if (!existingSlot) {
                                // Se não houver slot mínimo, cria um slot específico para a ausência
                                slots.push({ id: uid(), date: data, turnoId: tipoId, assigned: func.id, isMandatory: false, phase: 1 }); // Ausência não é 'mandatory coverage'
                            } else {
                                // Se já existe slot mínimo, tenta atribuir a ausência a ele se estiver vago
                                // (Isso é mais complexo e pode ser ajustado, por ora, priorizamos criar um slot novo se não houver conflito)
                                // A lógica atual de apenas criar um novo slot para ausência é mais simples.
                                // A verificação `hasExistingShift` foi removida para permitir o registro da ausência mesmo se outro turno for alocado depois.
                                slots.push({ id: uid(), date: data, turnoId: tipoId, assigned: func.id, isMandatory: false, phase: 1 });
                            }
                        });
                    }
                }
            }
        });

        postMessage({ type: 'progress', message: 'Fase 1: Alocando equipes fixas...' });

        // 3. Alocação de Equipes nos Slots Mínimos
        const funcsEmEquipesAlocadas = new Set(); // Guarda IDs de funcionários que já foram alocados via equipe

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

                    // Se a equipe trabalha neste dia do ciclo
                    if (diaNoCiclo >= 0 && diaNoCiclo < regra.work) {
                        // Verifica se todos os membros estão disponíveis (não ausentes e com disponibilidade)
                        const todosMembrosDisponiveis = equipe.funcionarioIds.every(funcId => {
                            const func = funcionariosMap.get(funcId);
                            return func &&
                                   !excecoesMap[funcId]?.has(date) && // Verifica ausência
                                   func.disponibilidade?.[turnoId]?.includes(diaSemanaId); // Verifica disponibilidade
                        });

                        if (todosMembrosDisponiveis) {
                            // Encontra slots mínimos vagos para este dia/turno
                            const slotsDisponiveis = slots.filter(s => s.date === date && s.turnoId === turnoId && s.isMandatory && !s.assigned);
                            // Se houver slots suficientes para a equipe
                            if (slotsDisponiveis.length >= equipe.funcionarioIds.length) {
                                // Aloca cada membro da equipe a um slot
                                equipe.funcionarioIds.forEach((funcId, i) => {
                                    if(slotsDisponiveis[i]) {
                                        slotsDisponiveis[i].assigned = funcId;
                                        slotsDisponiveis[i].equipeId = equipe.id; // Marca o slot como preenchido por equipe
                                        funcsEmEquipesAlocadas.add(funcId);
                                    }
                                });
                            }
                            // TODO: Adicionar tratamento se não houver slots suficientes (registrar como vaga?)
                        }
                    }
                });
            });
        }

        postMessage({ type: 'progress', message: 'Fase 1: Preenchendo vagas mínimas...' });

        // Inicializa histórico de trabalho
        let historico = {};
        todosFuncsDoCargo.forEach(f => {
            historico[f.id] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
        });

        // Atualiza histórico com base nas equipes já alocadas e ausências
        slots.filter(s => s.assigned).forEach(s => {
            const turno = turnosMap[s.turnoId];
            // Só contabiliza turnos reais de trabalho no histórico inicial
            if(turno && !turno.isSystem && historico[s.assigned]) {
                historico[s.assigned].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                historico[s.assigned].turnosTrabalhados += 1;
            }
        });

        // Calcula metas individuais (considerando descontos de feriados)
        const metaHorasMap = new Map();
        const metaTurnosMap = new Map();

        todosFuncsDoCargo.forEach(f => {
            if (f.medicaoCarga === 'turnos') {
                metaTurnosMap.set(f.id, calcularMetaTurnos(f, inicio, fim, cargoDiasOperacionais));
            } else {
                metaHorasMap.set(f.id, calcularMetaHoras(f, inicio, fim));
            }
        });

        // Aplica descontos de feriados às metas
        feriados.filter(feriado => feriado.descontaMeta && !feriado.trabalha).forEach(feriado => {
            const funcsQueFolgaram = todosFuncsDoCargo.filter(f =>
                !slots.some(s => s.date === feriado.date && s.assigned === f.id) && // Não trabalhou
                !excecoesMap[f.id]?.has(feriado.date) // Não estava de ausência programada
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


        // Dados auxiliares para regras de FDS
        const weekendDataByMonth = {}; // { 'YYYY-MM': { totalSaturdays: N, totalSundays: N } }
        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            const month = date.substring(0, 7);
            if (!weekendDataByMonth[month]) {
                weekendDataByMonth[month] = { totalSaturdays: 0, totalSundays: 0 };
            }
            if (d.getUTCDay() === 6) weekendDataByMonth[month].totalSaturdays++;
            if (d.getUTCDay() === 0) weekendDataByMonth[month].totalSundays++;
        });

        // 4. Alocação Individual para Slots Mínimos Restantes (Priorizando quem está mais longe da meta)
        const funcsIndividuais = todosFuncsDoCargo.filter(f => !funcsEmEquipesAlocadas.has(f.id));

        // Ordena os slots mínimos vagos (pode ajudar na consistência, opcional)
        const slotsMinimosVagos = slots.filter(s => s.isMandatory && !s.assigned).sort((a,b) => a.date.localeCompare(b.date));

        slotsMinimosVagos.forEach(slot => {
            const turno = turnosMap[slot.turnoId];
            if (!turno || turno.isSystem) return; // Não aloca indivíduos em turnos de sistema

            const slotDate = new Date(slot.date + 'T12:00:00');
            const slotDiaSemanaId = DIAS_SEMANA[slotDate.getUTCDay()].id;
            const slotMonth = slot.date.substring(0, 7);

            // Filtra e ordena candidatos para este slot específico
            const candidatos = funcsIndividuais.map(f => {
                // Simula a adição deste slot para validação
                const tempSlots = [...slots.filter(s => s.id !== slot.id), { ...slot, assigned: f.id }];

                // --- Validações ---
                if (excecoesMap[f.id]?.has(slot.date)) return null; // Ausente
                if (!f.disponibilidade?.[turno.id]?.includes(slotDiaSemanaId)) return null; // Indisponível
                if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null; // Já tem turno no dia

                // Valida descanso obrigatório
                if (checkMandatoryRestViolation(f, turno, slot.date, tempSlots, turnosMap).violation) return null;
                // Valida dias consecutivos
                if (calculateFullConsecutiveWorkDays(f.id, tempSlots, slot.date, turnosMap) > maxDiasConsecutivos) return null;

                // Valida folgas mínimas de FDS
                if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) { // Se o slot for num Sábado ou Domingo
                    // Conta quantos FDS já trabalhou no mês atual (considerando o slot atual)
                    const workedWeekends = tempSlots.filter(s => s.assigned === f.id && s.date.startsWith(slotMonth))
                        .reduce((acc, cur) => {
                            const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                            if (day === 6) acc.saturdays++;
                            if (day === 0) acc.sundays++;
                            return acc;
                        }, { saturdays: 0, sundays: 0 });

                    const monthData = weekendDataByMonth[slotMonth];

                    // Verifica se alocar neste FDS violaria a regra de folgas mínimas
                    if (slotDate.getUTCDay() === 6 && (monthData.totalSaturdays - workedWeekends.saturdays) < minFolgasSabados) return null;
                    if (slotDate.getUTCDay() === 0 && (monthData.totalSundays - workedWeekends.sundays) < minFolgasDomingos) return null;
                }

                // Calcula o "score" (quão longe da meta o funcionário está)
                let score;
                const medicao = f.medicaoCarga || 'horas';

                if (medicao === 'turnos') {
                    const turnosAtuais = historico[f.id].turnosTrabalhados;
                    const metaTurnos = metaTurnosMap.get(f.id) || 0;
                    // Se já atingiu ou ultrapassou a meta, penaliza (score maior)
                    score = metaTurnos > 0 ? (turnosAtuais / metaTurnos) * 100 : (turnosAtuais > 0 ? 1000 : 0);
                } else { // Horas
                    const horasAtuais = historico[f.id].horasTrabalhadas / 60;
                    const metaHoras = metaHorasMap.get(f.id) || 0;
                    score = metaHoras > 0 ? (horasAtuais / metaHoras) * 100 : (horasAtuais > 0 ? 1000 : 0);
                }

                // Reduz o score (prioriza) se for um dia/turno preferencial
                if (f.preferencias?.[turno.id]?.includes(slotDiaSemanaId)) {
                    score -= 10; // Ajuste de prioridade
                }

                return { func: f, score };
            }).filter(Boolean).sort((a, b) => a.score - b.score); // Ordena pelo score (menor = mais prioritário)

            // Aloca o melhor candidato (se houver)
            if (candidatos.length > 0) {
                const escolhido = candidatos[0].func;
                const slotOriginalIndex = slots.findIndex(s => s.id === slot.id);
                if (slotOriginalIndex > -1) {
                    slots[slotOriginalIndex].assigned = escolhido.id; // Atribui ao slot original
                    // Atualiza histórico do funcionário escolhido
                    historico[escolhido.id].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                    historico[escolhido.id].turnosTrabalhados += 1;
                }
            }
            // Se não houver candidatos, o slot continua vago (será tratado como vaga)
        });


        // --- FASE 2: Adicionar Turnos Opcionais para Atingir Metas ---

        postMessage({ type: 'progress', message: 'Fase 2: Otimizando metas...' });

        let alocouAlgoNaIteracao = true;
        let maxIteracoes = todosFuncsDoCargo.length * dateRange.length; // Limite de segurança
        let iteracoes = 0;

        while(alocouAlgoNaIteracao && iteracoes < maxIteracoes) {
            alocouAlgoNaIteracao = false;
            iteracoes++;

            // 1. Identificar funcionários sub-alocados e priorizar
            const funcionariosSubAlocados = funcsIndividuais // Prioriza individuais primeiro
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
                .filter(item => item.percentualMeta < 100) // Filtra quem está abaixo da meta
                .sort((a, b) => a.percentualMeta - b.percentualMeta); // Ordena (menor percentual primeiro)

            if (funcionariosSubAlocados.length === 0) break; // Sai se todos atingiram a meta

            // 2. Iterar e tentar alocar UM turno opcional por funcionário sub-alocado por vez
            for (const item of funcionariosSubAlocados) {
                const f = item.func;
                let alocouParaEsteFunc = false;

                // 3. Procurar Oportunidades Válidas (data, turnoId)
                // Iterar por datas e depois por turnos pode ser mais eficiente
                for (const date of dateRange) {
                    if (alocouParaEsteFunc) break; // Já alocou um turno para este funcionário nesta iteração

                    const slotDate = new Date(date + 'T12:00:00');
                    const slotDiaSemanaId = DIAS_SEMANA[slotDate.getUTCDay()].id;
                    const slotMonth = date.substring(0, 7);
                    const feriadoDoDia = feriados.find(fer => fer.date === date);

                    // Pula se for dia de folga geral ou se o cargo não opera
                    if ((feriadoDoDia && !feriadoDoDia.trabalha) || !cargoDiasOperacionais.includes(slotDiaSemanaId)) {
                        continue;
                    }

                    // Itera pelos turnos possíveis para este cargo
                    const turnosPossiveis = turnos.filter(t => !t.isSystem && cargo.turnosIds.includes(t.id));

                    for (const turno of turnosPossiveis) {
                        // Simula a adição do slot opcional
                        const tempSlots = [...slots, { date: date, turnoId: turno.id, assigned: f.id }];

                        // --- Validação Completa ---
                        if (excecoesMap[f.id]?.has(date)) continue; // Ausente
                        if (!f.disponibilidade?.[turno.id]?.includes(slotDiaSemanaId)) continue; // Indisponível
                        if (slots.some(s => s.assigned === f.id && s.date === date)) continue; // Já tem turno no dia

                        // Valida descanso, consecutivos, FDS (reutiliza lógica da Fase 1)
                        if (checkMandatoryRestViolation(f, turno, date, tempSlots, turnosMap).violation) continue;
                        if (calculateFullConsecutiveWorkDays(f.id, tempSlots, date, turnosMap) > maxDiasConsecutivos) continue;
                        if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) {
                            const workedWeekends = tempSlots.filter(s => s.assigned === f.id && s.date.startsWith(slotMonth))
                                .reduce((acc, cur) => { /* ... (lógica FDS igual Fase 1) ... */
                                     const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                                     if (day === 6) acc.saturdays++;
                                     if (day === 0) acc.sundays++;
                                     return acc;
                                }, { saturdays: 0, sundays: 0 });
                             const monthData = weekendDataByMonth[slotMonth];
                             if (slotDate.getUTCDay() === 6 && (monthData.totalSaturdays - workedWeekends.saturdays) < minFolgasSabados) continue;
                             if (slotDate.getUTCDay() === 0 && (monthData.totalSundays - workedWeekends.sundays) < minFolgasDomingos) continue;
                        }

                        // Valida Hora Extra
                        const medicao = f.medicaoCarga || 'horas';
                        let ultrapassaMeta = false;
                        if (medicao === 'turnos') {
                            ultrapassaMeta = (historico[f.id].turnosTrabalhados + 1) > (metaTurnosMap.get(f.id) || 0);
                        } else {
                            const cargaTurno = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                            ultrapassaMeta = ((historico[f.id].horasTrabalhadas + cargaTurno) / 60) > (metaHorasMap.get(f.id) || 0);
                        }
                        if (ultrapassaMeta && !f.fazHoraExtra) continue; // Não aloca se ultrapassa e não faz extra

                        // Se passou todas as validações, aloca!
                        const novoSlot = {
                            date,
                            turnoId: turno.id,
                            assigned: f.id,
                            id: uid(),
                            isMandatory: false, // Marca como opcional
                            phase: 2,
                            isExtra: ultrapassaMeta // Marca se é hora extra
                        };
                        slots.push(novoSlot);

                        // Atualiza histórico
                        historico[f.id].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                        historico[f.id].turnosTrabalhados += 1;

                        alocouAlgoNaIteracao = true;
                        alocouParaEsteFunc = true;
                        break; // Sai do loop de turnos para este dia
                    } // Fim loop turnos
                } // Fim loop datas
            } // Fim loop funcionários sub-alocados
        } // Fim while

        postMessage({ type: 'progress', message: 'Finalizando escala...' });

        // --- FINALIZAÇÃO ---
        const nomeEscala = generateEscalaNome(cargo.nome, inicio, fim);
        const escalaFinal = {
            id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico,
            excecoes: JSON.parse(JSON.stringify(excecoes)), // Salva cópia das exceções usadas
            feriados: [...geradorState.feriados], // Salva cópia dos feriados usados
            cobertura: { ...geradorState.cobertura }, // Salva a estrutura de cobertura completa usada
            coberturaPorEquipe: JSON.parse(JSON.stringify(coberturaPorEquipe)), // Salva cópia
            regras: { maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos }, // Salva regras do cargo usadas
            metasOverride: {}, // Inicializa vazio, pode ser preenchido na UI
            observacoes: '',
        };

        postMessage({ type: 'done', escala: escalaFinal });

    } catch (error) {
        console.error("Erro no Worker:", error);
        postMessage({ type: 'error', message: error.message });
    }
};