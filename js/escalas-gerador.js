/**************************************
 * 📅 Lógica do Gerador de Escalas (v2 - Aprimorada)
 **************************************/

async function gerarEscala() {
    showLoader("Analisando dados...");
    await new Promise(res => setTimeout(res, 50));

    try {
        const { cargos, funcionarios, turnos, equipes } = store.getState();
        const { cargoId, inicio, fim, cobertura, excecoes, maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos, feriados, otimizarFolgas } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) {
            showToast("Erro: O cargo selecionado para a escala não foi encontrado. Por favor, reinicie.");
            hideLoader();
            return;
        }

        const funcsDoCargo = funcionarios.filter(f => f.cargoId === cargoId);
        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
        const equipesMap = Object.fromEntries(equipes.map(e => [e.id, e]));

        const excecoesMap = {};
        funcsDoCargo.forEach(f => {
            const funcExcecoes = excecoes[f.id] || { ferias: { dates: [] }, afastamento: { dates: [] }, folgas: [] };
            const datasInvalidas = new Set([...funcExcecoes.ferias.dates, ...funcExcecoes.afastamento.dates, ...funcExcecoes.folgas.map(folga => folga.date)]);
            excecoesMap[f.id] = datasInvalidas;
        });

        let historico = {};
        funcsDoCargo.forEach(f => {
            historico[f.id] = { horasTrabalhadas: 0, ultimoTurnoFim: null };
        });

        const dateRange = dateRangeInclusive(inicio, fim);
        const slots = [];
        const funcionariosPreAlocados = new Set();

        // --- FASE 1: PRÉ-ALOCAÇÃO DE EQUIPES ---
        showLoader("Alocando equipes fixas...");
        await new Promise(res => setTimeout(res, 20));

        for (const turnoId in cobertura) {
            const config = cobertura[turnoId];
            if (config.mode !== 'equipe') continue;

            const equipeImpar = config.imparId ? equipesMap[config.imparId] : null;
            const equipePar = config.parId ? equipesMap[config.parId] : null;
            
            dateRange.forEach((date, index) => {
                const isImpar = (index % 2 === 0); // Dia 1 é index 0
                const equipeDoDia = isImpar ? equipeImpar : equipePar;

                if (equipeDoDia) {
                    equipeDoDia.membros.forEach(membroId => {
                        if (!excecoesMap[membroId] || !excecoesMap[membroId].has(date)) {
                             slots.push({ date, turnoId, assigned: membroId, id: uid() });
                             funcionariosPreAlocados.add(membroId);
                             const turno = turnosMap[turnoId];
                             if(turno) historico[membroId].horasTrabalhadas += turno.cargaMin;
                        }
                    });
                }
            });
        }
        
        // --- FASE 2: ALOCAÇÃO INDIVIDUAL ---
        showLoader("Distribuindo funcionários individuais...");
        await new Promise(res => setTimeout(res, 20));

        // Cria os slots vazios para o modo individual
        for (const turnoId in cobertura) {
            const config = cobertura[turnoId];
            if (config.mode === 'individual' && config.count > 0) {
                dateRange.forEach(date => {
                    for (let i = 0; i < config.count; i++) {
                        slots.push({ date, turnoId, assigned: null, id: uid() });
                    }
                });
            }
        }
        
        // Filtra funcionários que não foram pré-alocados em equipes
        const funcsIndividuais = funcsDoCargo.filter(f => !funcionariosPreAlocados.has(f.id));

        const metaHorasMap = new Map();
        funcsIndividuais.forEach(f => {
            const metaHoras = calcularMetaHoras(f, inicio, fim);
            metaHorasMap.set(f.id, metaHoras);
        });

        const monthlyDayCounts = {};
        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            const month = date.substring(0, 7);
            if (!monthlyDayCounts[month]) {
                monthlyDayCounts[month] = { totalSaturdays: 0, totalSundays: 0 };
            }
            if (d.getUTCDay() === 6) monthlyDayCounts[month].totalSaturdays++;
            if (d.getUTCDay() === 0) monthlyDayCounts[month].totalSundays++;
        });

        const monthlyWorkCounts = {};
        funcsIndividuais.forEach(f => {
            monthlyWorkCounts[f.id] = {};
            for (const month in monthlyDayCounts) {
                monthlyWorkCounts[f.id][month] = { workedSaturdays: 0, workedSundays: 0 };
            }
        });
        
        const slotsParaPreencher = slots.filter(s => s.assigned === null);

        async function tentarPreencher(slotsParaTentar, usarHoraExtra = false) {
            for (const slot of slotsParaTentar) {
                if (slot.assigned) continue;
                await new Promise(res => setTimeout(res, 0));

                const turno = turnosMap[slot.turnoId];
                const d = new Date(slot.date + 'T12:00:00');
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const month = slot.date.substring(0, 7);

                const candidatos = funcsIndividuais.map(f => {
                    if (excecoesMap[f.id].has(slot.date)) return null;

                    const preferencia = f.disponibilidade?.[turno.id]?.[diaSemanaId];
                    if (preferencia !== 'disponivel' && preferencia !== 'preferencial') return null;
                    
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                    
                    const diasConsecutivosAnteriores = calculateConsecutiveWorkDays(f.id, slots, addDays(slot.date, -1), turnosMap);
                    if ((diasConsecutivosAnteriores + 1) > maxDiasConsecutivos) return null;
                    
                    const ultimoFim = historico[f.id].ultimoTurnoFim;
                    if (f.tipoContrato === 'clt' && ultimoFim) {
                        const descansoMin = (turnosMap[ultimoFim.turnoId]?.descansoObrigatorioHoras || 0) * 60;
                        const proximoInicio = new Date(`${slot.date}T${turno.inicio}`);
                        const diffMin = (proximoInicio - ultimoFim.data) / (1000 * 60);
                        if (diffMin < descansoMin) return null;
                    }

                    const maxHoras = metaHorasMap.get(f.id) || 0;
                    if (!usarHoraExtra && (historico[f.id].horasTrabalhadas / 60) >= maxHoras) return null;
                    if (usarHoraExtra && !f.fazHoraExtra) return null;

                    if (d.getUTCDay() === 6) { 
                        const maxSaturdaysToWork = monthlyDayCounts[month].totalSaturdays - minFolgasSabados;
                        if (monthlyWorkCounts[f.id][month].workedSaturdays >= maxSaturdaysToWork) return null;
                    }
                    if (d.getUTCDay() === 0) {
                        const maxSundaysToWork = monthlyDayCounts[month].totalSundays - minFolgasDomingos;
                        if (monthlyWorkCounts[f.id][month].workedSundays >= maxSundaysToWork) return null;
                    }

                    let score = (historico[f.id].horasTrabalhadas / 60) / (maxHoras || 1) * 100;
                    score += (diasConsecutivosAnteriores / maxDiasConsecutivos) * 25;
                    if (d.getUTCDay() === 6) score += monthlyWorkCounts[f.id][month].workedSaturdays * 20;
                    if (d.getUTCDay() === 0) score += monthlyWorkCounts[f.id][month].workedSundays * 20;
                    if (otimizarFolgas && diasConsecutivosAnteriores > 0) score += 15;
                    if (preferencia === 'preferencial') score -= 50;

                    return { func: f, score };
                }).filter(Boolean).sort((a, b) => {
                    if (a.score !== b.score) return a.score - b.score;
                    return a.func.nome.localeCompare(b.func.nome);
                });

                if (candidatos.length > 0) {
                    const escolhido = candidatos[0].func;
                    slot.assigned = escolhido.id;
                    historico[escolhido.id].horasTrabalhadas += turno.cargaMin;
                    let dataFimTurno = new Date(`${slot.date}T${turno.fim}`);
                    if (turno.diasDeDiferenca > 0) dataFimTurno.setUTCDate(dataFimTurno.getUTCDate() + turno.diasDeDiferenca);
                    historico[escolhido.id].ultimoTurnoFim = { data: dataFimTurno, turnoId: turno.id };
                    
                    if (d.getUTCDay() === 6) monthlyWorkCounts[escolhido.id][month].workedSaturdays++;
                    if (d.getUTCDay() === 0) monthlyWorkCounts[escolhido.id][month].workedSundays++;
                }
            }
        }
        
        await tentarPreencher(slotsParaPreencher, false);
        await tentarPreencher(slotsParaPreencher, true);

        showLoader("Ajustando feriados...");
        feriados.filter(f => f.descontaHoras).forEach(feriado => {
            const funcsQueFolgaram = funcsDoCargo.filter(f => !slots.some(s => s.date === feriado.date && s.assigned === f.id));
            funcsQueFolgaram.forEach(f => {
                if (historico[f.id]) {
                    historico[f.id].horasTrabalhadas -= (feriado.horasDesconto * 60);
                }
            });
        });

        const nomeEscala = generateEscalaNome(cargo.nome, inicio, fim);
        currentEscala = { id: uid(), nome: nomeEscala, cargoId, inicio, fim, slots, historico, excecoes: JSON.parse(JSON.stringify(excecoes)), feriados: [...geradorState.feriados], cobertura };

        showLoader("Renderizando visualização...");
        await new Promise(res => setTimeout(res, 20));
        renderEscalaTable(currentEscala);
        
    } catch (error) {
        console.error("Ocorreu um erro ao gerar a escala:", error);
        showToast("Ocorreu um erro inesperado. Verifique os dados e tente novamente.");
    } finally {
        hideLoader();
    }
}