/**************************************
 * 📅 Lógica do Gerador de Escalas (v2 - Aprimorada)
 **************************************/

async function gerarEscala() {
    showLoader("Analisando dados...");
    await new Promise(res => setTimeout(res, 50));

    try {
        const { cargos, funcionarios, turnos } = store.getState();
        const { cargoId, inicio, fim, cobertura, excecoes, maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos, feriados, otimizarFolgas } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) {
            showToast("Erro: O cargo selecionado para a escala não foi encontrado. Por favor, reinicie.");
            hideLoader();
            return;
        }

        const funcs = funcionarios.filter(f => f.cargoId === cargoId);
        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

        const excecoesMap = {};
        funcs.forEach(f => {
            const funcExcecoes = excecoes[f.id];
            const datasInvalidas = new Set([...funcExcecoes.ferias.dates, ...funcExcecoes.afastamento.dates, ...funcExcecoes.folgas.map(folga => folga.date)]);
            excecoesMap[f.id] = datasInvalidas;
        });

        let historico = {};
        funcs.forEach(f => {
            historico[f.id] = { horasTrabalhadas: 0, ultimoTurnoFim: null };
        });

        const dateRange = dateRangeInclusive(inicio, fim);

        const metaHorasMap = new Map();
        funcs.forEach(f => {
            const metaHoras = calcularMetaHoras(f, inicio, fim);
            metaHorasMap.set(f.id, metaHoras);
        });

        // Contagem de Sábados e Domingos por mês no período
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

        // Estrutura para rastrear Sábados/Domingos trabalhados por funcionário, por mês
        const monthlyWorkCounts = {};
        funcs.forEach(f => {
            monthlyWorkCounts[f.id] = {};
            for (const month in monthlyDayCounts) {
                monthlyWorkCounts[f.id][month] = { workedSaturdays: 0, workedSundays: 0 };
            }
        });

        let slots = [];
        dateRange.forEach(date => {
            const diaSemana = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[diaSemana.getUTCDay()].id;
            const feriado = feriados.find(f => f.date === date);
            if (feriado && !feriado.trabalha) return;
            if (cargo.regras.dias.includes(diaSemanaId)) {
                for (const turnoId in cobertura) {
                    if (cobertura[turnoId] > 0) {
                        for (let i = 0; i < cobertura[turnoId]; i++) {
                            slots.push({ date, turnoId, assigned: null, id: uid() });
                        }
                    }
                }
            }
        });

        async function tentarPreencher(slotsParaTentar, usarHoraExtra = false) {
            for (const slot of slotsParaTentar) {
                if (slot.assigned) continue;
                await new Promise(res => setTimeout(res, 0));

                const turno = turnosMap[slot.turnoId];
                const d = new Date(slot.date + 'T12:00:00');
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const month = slot.date.substring(0, 7);

                const candidatos = funcs.map(f => {
                    if (excecoesMap[f.id].has(slot.date)) return null;
                    if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return null;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;
                    
                    const diasConsecutivosAnteriores = calculateConsecutiveWorkDays(f.id, slots, addDays(slot.date, -1), turnosMap);
                    if ((diasConsecutivosAnteriores + 1) > maxDiasConsecutivos) {
                        return null;
                    }
                    
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

                    // Nova validação de folgas de fim de semana por mês
                    if (d.getUTCDay() === 6) { // Sábado
                        const maxSaturdaysToWork = monthlyDayCounts[month].totalSaturdays - minFolgasSabados;
                        if (monthlyWorkCounts[f.id][month].workedSaturdays >= maxSaturdaysToWork) return null;
                    }
                    if (d.getUTCDay() === 0) { // Domingo
                        const maxSundaysToWork = monthlyDayCounts[month].totalSundays - minFolgasDomingos;
                        if (monthlyWorkCounts[f.id][month].workedSundays >= maxSundaysToWork) return null;
                    }

                    // --- SCORING APRIMORADO ---
                    let score = (historico[f.id].horasTrabalhadas / 60) / (maxHoras || 1) * 100;
                    score += (diasConsecutivosAnteriores / maxDiasConsecutivos) * 25;
                    if (d.getUTCDay() === 6) score += monthlyWorkCounts[f.id][month].workedSaturdays * 20;
                    if (d.getUTCDay() === 0) score += monthlyWorkCounts[f.id][month].workedSundays * 20;
                    if (otimizarFolgas && diasConsecutivosAnteriores > 0) score += 15;

                    return { func: f, score };
                }).filter(Boolean).sort((a, b) => {
                    if (a.score !== b.score) {
                        return a.score - b.score;
                    }
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

        showLoader("Preenchendo turnos...");
        await tentarPreencher(slots.filter(s => !s.assigned), false);
        showLoader("Otimizando com horas extras...");
        await tentarPreencher(slots.filter(s => !s.assigned), true);

        showLoader("Ajustando feriados...");
        feriados.filter(f => f.descontaHoras).forEach(feriado => {
            const funcsNaoTrabalharamNoFeriado = funcs.filter(f => !slots.some(s => s.date === feriado.date && s.assigned === f.id));
            funcsNaoTrabalharamNoFeriado.forEach(f => {
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
        
        if (typeof initEditor === 'function') {
            initEditor();
        }

    } catch (error) {
        console.error("Ocorreu um erro ao gerar a escala:", error);
        showToast("Ocorreu um erro inesperado. Verifique os dados e tente novamente.");
    } finally {
        hideLoader();
    }
}