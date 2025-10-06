/**************************************
 * ⚙️ Web Worker para Geração de Escala
 * Este script roda em uma thread separada.
 **************************************/

// Importa as constantes e as funções utilitárias compartilhadas
importScripts('constants.js', 'shared-utils.js');

self.onmessage = function(e) {
    const { geradorState, funcionarios, turnos, cargos } = e.data;
    
    postMessage({ type: 'progress', message: 'Analisando dados...' });

    try {
        const { cargoId, inicio, fim, cobertura, excecoes, maxDiasConsecutivos, minFolgasSabados, minFolgasDomingos, feriados, otimizarFolgas } = geradorState;

        const cargo = cargos.find(c => c.id === cargoId);
        if (!cargo) throw new Error("Cargo selecionado não foi encontrado.");

        const funcs = funcionarios.filter(f => f.cargoId === cargoId && f.status !== 'arquivado');
        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

        const excecoesMap = {};
        funcs.forEach(f => {
            const funcExcecoes = excecoes[f.id] || { ferias: { dates: [] }, afastamento: { dates: [] }, folgas: [] };
            const datasInvalidas = new Set([...funcExcecoes.ferias.dates, ...funcExcecoes.afastamento.dates, ...funcExcecoes.folgas.map(folga => folga.date)]);
            excecoesMap[f.id] = datasInvalidas;
        });

        let historico = {};
        funcs.forEach(f => {
            historico[f.id] = { horasTrabalhadas: 0 };
        });

        const dateRange = dateRangeInclusive(inicio, fim);
        const metaHorasMap = new Map(funcs.map(f => [f.id, calcularMetaHoras(f, inicio, fim)]));

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
                            slots.push({ date, turnoId, assigned: null, id: 'slot_' + Math.random().toString(36).slice(2, 10) });
                        }
                    }
                }
            }
        });

        function preencherSlots(slotsParaTentar, usarHoraExtra = false) {
            for (const slot of slotsParaTentar) {
                if (slot.assigned) continue;

                const turno = turnosMap[slot.turnoId];
                const d = new Date(slot.date + 'T12:00:00');
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const month = slot.date.substring(0, 7);

                const candidatos = funcs.map(f => {
                    if (excecoesMap[f.id].has(slot.date)) return null;
                    if (!f.disponibilidade[turno.id]?.includes(diaSemanaId)) return null;
                    if (slots.some(s => s.assigned === f.id && s.date === slot.date)) return null;

                    const diasConsecutivosAnteriores = calculateConsecutiveWorkDays(f.id, slots, addDays(slot.date, -1), turnosMap);
                    if ((diasConsecutivosAnteriores + 1) > maxDiasConsecutivos) return null;

                    const restViolation = checkMandatoryRestViolation(f, turno, slot.date, slots, turnosMap);
                    if (restViolation.violation) return null;

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
                    if (f.preferencias && f.preferencias[turno.id]?.includes(diaSemanaId)) score -= 10;
                    if (d.getUTCDay() === 6) score += monthlyWorkCounts[f.id][month].workedSaturdays * 20;
                    if (d.getUTCDay() === 0) score += monthlyWorkCounts[f.id][month].workedSundays * 20;
                    if (otimizarFolgas && diasConsecutivosAnteriores > 0) score += 15;

                    return { func: f, score };
                }).filter(Boolean).sort((a, b) => a.score - b.score);

                if (candidatos.length > 0) {
                    const escolhido = candidatos[0].func;
                    slot.assigned = escolhido.id;
                    if (usarHoraExtra) slot.isExtra = true;
                    historico[escolhido.id].horasTrabalhadas += turno.cargaMin;
                    if (d.getUTCDay() === 6) monthlyWorkCounts[escolhido.id][month].workedSaturdays++;
                    if (d.getUTCDay() === 0) monthlyWorkCounts[escolhido.id][month].workedSundays++;
                }
            }
        }

        postMessage({ type: 'progress', message: 'Preenchendo turnos...' });
        preencherSlots(slots.filter(s => !s.assigned), false);

        postMessage({ type: 'progress', message: 'Otimizando com horas extras...' });
        preencherSlots(slots.filter(s => !s.assigned), true);

        postMessage({ type: 'progress', message: 'Ajustando feriados...' });
        feriados.filter(f => f.descontaHoras).forEach(feriado => {
            const funcsNaoTrabalharamNoFeriado = funcs.filter(f => !slots.some(s => s.date === feriado.date && s.assigned === f.id));
            funcsNaoTrabalharamNoFeriado.forEach(f => {
                if (historico[f.id]) {
                    historico[f.id].horasTrabalhadas -= (feriado.horasDesconto * 60);
                }
            });
        });

        const nomeEscala = generateEscalaNome(cargo.nome, inicio, fim);
        const escalaFinal = {
            id: 'escala_' + Math.random().toString(36).slice(2, 10), nome: nomeEscala, cargoId, inicio, fim, slots, historico,
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