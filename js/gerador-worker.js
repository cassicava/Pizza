/**************************************
 * ⚙️ Web Worker para Geração de Escala
 * Este script roda em uma thread separada.
 **************************************/

// Importa as constantes e as funções utilitárias compartilhadas
importScripts('constants.js', 'shared-utils.js');

self.onmessage = function(e) {
    const { geradorState, funcionarios, turnos, cargos, equipes } = e.data;
    
    postMessage({ type: 'progress', message: 'Analisando dados...' });

    try {
        const { cargoId, inicio, fim, cobertura, coberturaPorEquipe, excecoes, maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos, feriados } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) throw new Error("Cargo selecionado não foi encontrado.");

        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
        const equipesMap = Object.fromEntries(equipes.map(eq => [eq.id, eq]));
        const dateRange = dateRangeInclusive(inicio, fim);
        
        postMessage({ type: 'progress', message: 'Preparando alocação...' });

        const todosFuncsDoCargo = funcionarios.filter(f => f.cargoId === cargoId && f.status !== 'arquivado');
        const excecoesMap = {};
        todosFuncsDoCargo.forEach(f => {
            const f_excecoes = excecoes[f.id] || {};
            const ferias_dates = f_excecoes.ferias?.dates || [];
            const afastamento_dates = f_excecoes.afastamento?.dates || [];
            let folgas_dates = [];
            if (Array.isArray(f_excecoes.folgas)) {
                folgas_dates = f_excecoes.folgas.map(folga => folga.date);
            }
            excecoesMap[f.id] = new Set([...ferias_dates, ...afastamento_dates, ...folgas_dates]);
        });

        let slots = [];
        dateRange.forEach(date => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriadoDoDia = feriados.find(f => f.date === date);
            if (feriadoDoDia && !feriadoDoDia.trabalha) return;

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
                equipe.funcionarioIds.forEach(funcId => funcsEmEquipesAlocadas.add(funcId));

                const startIndex = dateRange.indexOf(regra.start);
                if (startIndex === -1) return;

                dateRange.forEach((date, index) => {
                    const ciclo = regra.work + regra.off;
                    const diaNoCiclo = (index - startIndex) % ciclo;

                    if (diaNoCiclo >= 0 && diaNoCiclo < regra.work) {
                        const slotsDisponiveis = slots.filter(s => s.date === date && s.turnoId === turnoId && !s.assigned);
                        if (slotsDisponiveis.length >= equipe.funcionarioIds.length) {
                            equipe.funcionarioIds.forEach((funcId, i) => {
                                if (!excecoesMap[funcId]?.has(date)) {
                                    slotsDisponiveis[i].assigned = funcId;
                                    slotsDisponiveis[i].equipeId = equipe.id;
                                }
                            });
                        }
                    }
                });
            });
        }

        postMessage({ type: 'progress', message: 'Preenchendo vagas restantes...' });
        
        // --- INÍCIO DA REESCRITA COMPLETA DA LÓGICA DE HORAS ---
        
        // O objeto 'historico' é a fonte da verdade e é construído progressivamente.
        let historico = {};
        todosFuncsDoCargo.forEach(f => { historico[f.id] = { horasTrabalhadas: 0 }; });

        // 1. Pré-calcula as horas dos membros de equipe, que já foram alocados.
        slots.filter(s => s.assigned && funcsEmEquipesAlocadas.has(s.assigned)).forEach(s => {
            const turno = turnosMap[s.turnoId];
            if(turno && historico[s.assigned]) {
                historico[s.assigned].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
            }
        });
        
        const funcsIndividuais = todosFuncsDoCargo.filter(f => !funcsEmEquipesAlocadas.has(f.id));
        const metaHorasMap = new Map(funcsIndividuais.map(f => [f.id, calcularMetaHoras(f, inicio, fim)]));
        
        function preencherSlotsIndividuais(usarHoraExtra = false) {
             slots.filter(s => !s.assigned).forEach(slot => {
                const turno = turnosMap[slot.turnoId];
                if (!turno) return;

                const candidatos = funcsIndividuais.map(f => {
                    if (excecoesMap[f.id].has(slot.date)) return null;
                    if (!f.disponibilidade[turno.id]?.includes(DIAS_SEMANA[new Date(slot.date + 'T12:00:00').getUTCDay()].id)) return null;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                    if (checkMandatoryRestViolation(f, turno, slot.date, slots, turnosMap).violation) return null;
                    if ((calculateConsecutiveWorkDays(f.id, slots, addDays(slot.date, -1), turnosMap) + 1) > maxDiasConsecutivos) return null;

                    const horasAtuais = historico[f.id].horasTrabalhadas;
                    const maxHoras = metaHorasMap.get(f.id) || 0;
                    
                    if (!usarHoraExtra && (horasAtuais / 60) >= maxHoras) return null;
                    if (usarHoraExtra && !f.fazHoraExtra) return null;
                    
                    let score = (horasAtuais / 60) / (maxHoras || 1) * 100;
                    return { func: f, score };
                }).filter(Boolean).sort((a, b) => a.score - b.score);

                if (candidatos.length > 0) {
                    const escolhido = candidatos[0].func;
                    slot.assigned = escolhido.id;
                    if (usarHoraExtra) slot.isExtra = true;
                    // 2. Acumula as horas dos individuais no mesmo objeto 'historico'.
                    historico[escolhido.id].horasTrabalhadas += calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                }
            });
        }
        
        preencherSlotsIndividuais(false);
        postMessage({ type: 'progress', message: 'Otimizando com horas extras...' });
        preencherSlotsIndividuais(true);
        
        // 3. Aplica descontos de feriados no objeto 'historico' já consolidado.
        postMessage({ type: 'progress', message: 'Ajustando feriados...'});
        feriados.filter(f => f.descontaHoras).forEach(feriado => {
            const funcsQueFolgaram = todosFuncsDoCargo.filter(f => 
                !slots.some(s => s.date === feriado.date && s.assigned === f.id) &&
                !excecoesMap[f.id].has(feriado.date)
            );
            funcsQueFolgaram.forEach(f => {
                if (historico[f.id]) {
                    historico[f.id].horasTrabalhadas -= (feriado.horasDesconto * 60);
                }
            });
        });
        // --- FIM DA REESCRITA COMPLETA ---

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