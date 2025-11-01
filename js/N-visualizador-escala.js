let currentEscala = null;
let focoIndividualState = {
    selectedEmployeeId: null,
    selectedBrushId: null,
    editMode: 'employee',
};

function handleFocoFuncChange(event) {
    focoIndividualState.selectedEmployeeId = event.target.value;
    focoIndividualState.selectedBrushId = null;
    renderFocoIndividualView(currentEscala.owner);
}

function handleFocoModeChange(event) {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    focoIndividualState.editMode = button.dataset.mode;
    renderFocoFerramentasModos(currentEscala.owner);
}

function handleFocoBrushClick(event) {
    const brush = event.target.closest('.shift-brush');
    if (!brush) return;

    const turnoId = brush.dataset.turnoId;
    focoIndividualState.selectedBrushId = focoIndividualState.selectedBrushId === turnoId ? null : turnoId;

    renderFocoFerramentasPinceis(currentEscala.owner);
}

function handleFocoCalendarClick(event) {
    const dayCell = event.target.closest('.calendar-day:not(.empty)');
    if (!dayCell || dayCell.classList.contains('celula-fechada')) return;

    const date = dayCell.dataset.date;
    const employeeId = focoIndividualState.selectedEmployeeId;
    const existingSlot = currentEscala.slots.find(s => s.assigned === employeeId && s.date === date);

    if (focoIndividualState.editMode === 'eraser') {
        if (existingSlot) {
            handleRemoveShiftClick(existingSlot.id);
        }
    }
    else if (focoIndividualState.editMode === 'employee') {
        const brushId = focoIndividualState.selectedBrushId;
        if (!brushId) {
            showToast("Selecione um pincel de turno para começar a editar.");
            return;
        }
        if (existingSlot && existingSlot.turnoId === brushId) {
            handleRemoveShiftClick(existingSlot.id);
        } else {
            handleAddShiftClick(employeeId, brushId, date);
        }
    }
}


function renderEscalaLegend(escala, container) {
    const {
        turnos,
        cargos
    } = store.getState();
    if (!container) return;
    container.innerHTML = '';

    const cargo = cargos.find(c => c.id === escala.cargoId);
    if (!cargo) return;

    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const allLegendItems = [];

    const nonSystemTurnos = allTurnos.filter(t => !t.isSystem && (cargo.turnosIds?.includes(t.id) || t.isSystem));
    const systemTurnosSet = new Set();
    const activeSystemTurnos = new Set(escala.slots.map(s => s.turnoId).filter(id => TURNOS_SISTEMA_AUSENCIA.hasOwnProperty(id)));

    nonSystemTurnos.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(turno => {
        allLegendItems.push(turno);
    });

    Object.values(TURNOS_SISTEMA_AUSENCIA).forEach(turnoSistema => {
        if (activeSystemTurnos.has(turnoSistema.id) && !systemTurnosSet.has(turnoSistema.id)) {
            allLegendItems.push(turnoSistema);
            systemTurnosSet.add(turnoSistema.id);
        }
    });

    const activeTurnos = new Set(escala.slots.map(s => s.turnoId));

    const finalHTML = allLegendItems.map(turno => {
        const isActive = activeTurnos.has(turno.id);
        const classInactive = !isActive ? 'inactive' : '';
        return `
            <div class="legenda-item ${classInactive}" data-tipo="turno" data-id="${turno.id}">
                <span class="color-dot" style="background-color: ${turno.cor || '#e2e8f0'}"></span>
                <strong>${turno.sigla || '??'}</strong> - ${turno.nome}
            </div>
        `;
    }).join('');

    if (finalHTML.length > 0) {
        container.innerHTML = finalHTML;
    }
}


function renderGenericEscalaTable(escala, container, options = {}) {
    const { isInteractive = false } = options;
    const { funcionarios, turnos, cargos, equipes } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];

    if (!container) {
        console.error("Container para renderizar a tabela não foi encontrado.");
        return;
    }

    const getTurnoInfo = (turnoId) => allTurnos.find(t => t.id === turnoId) || {};
    const getFuncInfo = (funcId) => (escala.snapshot?.funcionarios?.[funcId]) || funcionarios.find(f => f.id === funcId) || {};

    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));

    let cobertura = escala.cobertura || {};

    const allFuncsInvolved = new Set();
    escala.slots.forEach(s => { if (s.assigned) allFuncsInvolved.add(s.assigned) });
    Object.keys(escala.historico || {}).forEach(funcId => allFuncsInvolved.add(funcId));

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);

    const equipesMap = new Map();
    equipes.filter(e => e.cargoId === escala.cargoId).forEach(e => {
        e.funcionarioIds.forEach(funcId => equipesMap.set(funcId, e.id));
    });

    const funcsDaEscala = [...allFuncsInvolved]
        .map(funcId => ({ id: funcId, ...getFuncInfo(funcId), equipeId: equipesMap.get(funcId) }))
        .filter(f => f.nome)
        .sort((a, b) => {
            if (a.equipeId && !b.equipeId) return -1;
            if (!a.equipeId && b.equipeId) return 1;
            if (a.equipeId && b.equipeId && a.equipeId !== b.equipeId) {
                const equipeA = equipes.find(e => e.id === a.equipeId)?.nome || '';
                const equipeB = equipes.find(e => e.id === b.equipeId)?.nome || '';
                return equipeA.localeCompare(equipeB);
            }
            return a.nome.localeCompare(b.nome);
        });

    const turnosDoCargo = cargo
        ? turnos.filter(t => !t.isSystem && cargo.turnosIds.includes(t.id)).sort((a, b) => a.inicio.localeCompare(b.inicio))
        : [];

    let tableHTML = `<table class="escala-final-table" tabindex="0"><thead><tr><th>Funcionário</th>`;
    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const dia = d.getDate();
        const feriado = escala.feriados.find(f => f.date === date);
        const isFeriado = feriado ? 'feriado' : '';
        const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 'weekend' : '';
        const isFolgaGeral = feriado && !feriado.trabalha ? 'feriado-folga' : '';
        tableHTML += `<th class="${isFeriado} ${isWeekend} ${isFolgaGeral}" title="${feriado ? feriado.nome : ''}">${dia}<br>${diaSemana}</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;

    funcsDaEscala.forEach(func => {
        const nomeHtml = `
            <td>
                ${func.nome}
                <br>
                <small class="muted">${func.documento || '---'}</small>
            </td>
        `;
        const equipeClass = func.equipeId ? `equipe-${func.equipeId}` : '';
        tableHTML += `<tr data-employee-row-id="${func.id}" class="${equipeClass}">${nomeHtml}`;

        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
            const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
            const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

            const dataAttrs = isInteractive ? `data-date="${date}" data-employee-id="${func.id}" tabindex="-1"` : '';
            let cellClass = isInteractive ? 'editable-cell' : '';
            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);

            if (slot) {
                const turno = getTurnoInfo(slot.turnoId);
                const slotAttr = isInteractive ? `data-slot-id="${slot.id}" data-turno-id="${slot.turnoId}"` : '';
                const equipeAttr = isInteractive && slot.equipeId ? `data-equipe-id="${slot.equipeId}"` : '';
                const textColor = getContrastingTextColor(turno.cor);
                const extraClass = slot.isExtra ? 'celula-hora-extra' : '';
                tableHTML += `<td class="${cellClass} ${extraClass}" style="background-color:${turno.cor}; color: ${textColor};" ${dataAttrs} ${slotAttr} ${equipeAttr} title="${turno.nome}">${turno.sigla || '?'}</td>`;
            } else if (feriadoFolga) {
                tableHTML += `<td class="celula-feriado-folga" title="${feriadoFolga.nome}">FOLGA</td>`;
            } else if (isCargoDiaNaoUtil) {
                tableHTML += `<td class="celula-fechada" title="O cargo não opera neste dia"></td>`;
            } else {
                const emptyBgStyle = (func.equipeId && isInteractive) ? 'style="background-color: #f0f0f0;"' : '';
                tableHTML += `<td class="${cellClass}" ${dataAttrs} ${emptyBgStyle}></td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody>`;

    if (isInteractive) {
        tableHTML += `<tfoot>`;
        turnosDoCargo.forEach(turno => {
            tableHTML += `<tr class="total-row"><td><strong>Total ${turno.sigla || '??'}</strong></td>`;
            dateRange.forEach(date => {
                const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                tableHTML += `<td>${total}</td>`;
            });
            tableHTML += `</tr>`;
        });

        turnosDoCargo.forEach(turno => {
            let hasVagas = false;
            let rowVagasHTML = `<tr class="vagas-row"><td><strong style="color: var(--danger);">Faltam ${turno.sigla || '??'}</strong></td>`;

            const coberturaTurno = cobertura[turno.id] || {};

            dateRange.forEach(date => {
                const d = new Date(date + 'T12:00:00');
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
                const isDiaUtil = cargoDiasOperacionais.has(diaSemanaId) && !feriadoFolga;

                let vagas = 0;
                if (isDiaUtil) {
                    const coberturaNecessaria = typeof coberturaTurno === 'object'
                        ? (coberturaTurno[diaSemanaId] || 0)
                        : (coberturaTurno || 0);

                    const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                    vagas = coberturaNecessaria - coberturaAtual;

                    if (vagas > 0) {
                        hasVagas = true;
                    }
                }

                rowVagasHTML += `<td ${vagas > 0 ? 'style="color: var(--danger); font-weight: bold;"' : ''}>${vagas > 0 ? vagas : ''}</td>`;
            });
            rowVagasHTML += `</tr>`;
            if (hasVagas) tableHTML += rowVagasHTML;
        });
        tableHTML += `</tfoot>`;
    }
    container.innerHTML = tableHTML;
}


function updateTableFooter(escala) {
    const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
    if (!table) return;

    let tfoot = table.querySelector('tfoot');
    if (!tfoot) {
        tfoot = document.createElement('tfoot');
        table.appendChild(tfoot);
    }

    const { turnos, cargos } = store.getState();
    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));
    const cobertura = escala.cobertura || {};

    const turnosDoCargo = cargo
        ? turnos.filter(t => !t.isSystem && cargo.turnosIds.includes(t.id)).sort((a, b) => a.inicio.localeCompare(b.inicio))
        : [];

    let footerHTML = '';

    turnosDoCargo.forEach(turno => {
        footerHTML += `<tr class="total-row"><td><strong>Total ${turno.sigla || '??'}</strong></td>`;
        dateRange.forEach(date => {
            const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
            footerHTML += `<td>${total}</td>`;
        });
        footerHTML += `</tr>`;
    });

    turnosDoCargo.forEach(turno => {
        let hasVagas = false;
        let rowVagasHTML = `<tr class="vagas-row"><td><strong style="color: var(--danger);">Faltam ${turno.sigla || '??'}</strong></td>`;

        const coberturaTurno = cobertura[turno.id] || {};

        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
            const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
            const isDiaUtil = cargoDiasOperacionais.has(diaSemanaId) && !feriadoFolga;

            let vagas = 0;
            if (isDiaUtil) {
                const coberturaNecessaria = typeof coberturaTurno === 'object'
                    ? (coberturaTurno[diaSemanaId] || 0)
                    : (coberturaTurno || 0);

                const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                vagas = coberturaNecessaria - coberturaAtual;

                if (vagas > 0) {
                    hasVagas = true;
                }
            }

            rowVagasHTML += `<td ${vagas > 0 ? 'style="color: var(--danger); font-weight: bold;"' : ''}>${vagas > 0 ? vagas : ''}</td>`;
        });
        rowVagasHTML += `</tr>`;
        if (hasVagas) {
            footerHTML += rowVagasHTML;
        }
    });

    tfoot.innerHTML = footerHTML;
}


function renderPainelDaEscala(escala) {
    const isGerador = escala.owner === 'gerador';
    const painelContainer = isGerador ? $('#gerador-painel-escala') : $('#salva-painel-escala');
    if (!painelContainer) return;

    const { funcionarios, cargos, turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const funcsDaEscala = funcionarios.filter(f => escala.historico && escala.historico[f.id]).sort((a, b) => a.nome.localeCompare(b.nome));
    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const totalDias = dateRange.length;
    const totalFDS = dateRange.filter(d => [0, 6].includes(new Date(d + 'T12:00:00').getUTCDay())).length;

    let vagas = 0;
    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));
    const coberturaGeral = escala.cobertura || {};
    const turnosDoCargoIds = cargo ? cargo.turnosIds : [];

    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
        const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
        const isDiaUtil = cargoDiasOperacionais.has(diaSemanaId) && !feriadoFolga;

        if (isDiaUtil) {
            turnosDoCargoIds.forEach(turnoId => {
                 const coberturaTurno = coberturaGeral[turnoId] || {};
                 const coberturaNecessaria = typeof coberturaTurno === 'object'
                    ? (coberturaTurno[diaSemanaId] || 0)
                    : (coberturaTurno || 0);

                const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turnoId && s.assigned).length;
                vagas += Math.max(0, coberturaNecessaria - coberturaAtual);
            });
        }
    });

    const totalHorasExtras = funcsDaEscala.reduce((acc, func) => {
        if (func.medicaoCarga === 'horas' || !func.medicaoCarga) {
            const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
            const metaOriginal = calcularMetaHoras(func, escala.inicio, escala.fim);
            const metaConsiderada = (escala.metasOverride && escala.metasOverride[func.id] !== undefined)
                ? parseFloat(escala.metasOverride[func.id])
                : metaOriginal;
            return acc + Math.max(0, horasTrabalhadas - metaConsiderada);
        }
        return acc;
    }, 0);

    const conflitosCount = isGerador ? (editorState?.allConflicts?.length || 0) : 0;
    let saudeStatus = 'ok';
    let saudeIcon = '✅';
    let saudeTitle = 'Escala sem problemas';
    if (conflitosCount > 0) {
        saudeStatus = 'danger';
        saudeIcon = '🚨';
        saudeTitle = `${conflitosCount} conflito(s) de regras detectado(s)`;
    } else if (vagas > 0) {
        saudeStatus = 'warning';
        saudeIcon = '⚠️';
        saudeTitle = `${vagas} turno(s) vago(s)`;
    }

    $('.painel-header .painel-title', painelContainer).innerHTML = `
        <div class="painel-title-main">
            <span class="saude-escala-icon status-${saudeStatus}">${saudeIcon}</span>
            <span>Painel da Escala</span>
        </div>
        <span class="saude-escala-text">${saudeTitle}</span>
    `;
    $('.painel-header .painel-tabs', painelContainer).innerHTML = `
        <div class="toggle-group painel-tabs-toggle-group">
            <button class="painel-tab-btn active" data-tab="resumo">Resumo de Carga</button>
            <button class="painel-tab-btn" data-tab="stats">Estatísticas & Legenda</button>
            <button class="painel-tab-btn" data-tab="observacoes">Observações</button>
        </div>
    `;

    let resumoHorasHTML = '<div class="painel-resumo-horas-list">';
    funcsDaEscala.forEach(func => {
        const medicao = func.medicaoCarga || 'horas';
        let realizado, meta, saldo, unidade, saldoLabel;

        const temOverride = escala.metasOverride && escala.metasOverride[func.id] !== undefined;

        if (medicao === 'turnos') {
            realizado = escala.historico[func.id]?.turnosTrabalhados || 0;
            const { cargos } = store.getState();
            const cargo = cargos.find(c => c.id === escala.cargoId);
            const cargoDiasOperacionais = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
            const metaOriginal = calcularMetaTurnos(func, escala.inicio, escala.fim, cargoDiasOperacionais);
            meta = temOverride ? parseFloat(escala.metasOverride[func.id]) : metaOriginal;

            saldo = realizado - meta;
            unidade = ' turnos';
            saldoLabel = 'Saldo';
            if (saldo > 0) {
                saldoLabel = func.fazHoraExtra ? 'Turnos Extra' : 'Acima da Meta';
            }
        } else {
            realizado = (escala.historico[func.id]?.horasTrabalhadas / 60) || 0;
            const metaOriginal = calcularMetaHoras(func, escala.inicio, escala.fim);
            meta = temOverride ? parseFloat(escala.metasOverride[func.id]) : metaOriginal;
            saldo = realizado - meta;
            unidade = 'h';
            saldoLabel = 'Saldo';
            if (saldo > 0) {
                saldoLabel = func.fazHoraExtra ? 'H. Extra' : 'Acima da Meta';
            }
        }

        let progPrincipal = meta > 0 ? (realizado / meta) * 100 : 0;
        let progExtra = 0;

        if (progPrincipal > 100) {
            progExtra = progPrincipal - 100;
            progPrincipal = 100;
        }

        let barColorClass = 'red';
        if (progPrincipal >= 100) barColorClass = 'green';
        else if (progPrincipal >= 80) barColorClass = 'blue';
        else if (progPrincipal >= 40) barColorClass = 'yellow';

        const realizadoStr = medicao === 'turnos' ? realizado.toFixed(0) : realizado.toFixed(1);
        const metaStr = medicao === 'turnos' ? meta.toFixed(0) : meta.toFixed(1);
        const saldoStr = medicao === 'turnos' ? saldo.toFixed(0) : saldo.toFixed(1);
        const overrideIndicator = temOverride ? '<span class="meta-override-indicator" title="Meta temporária para esta escala.">*</span>' : '';

        resumoHorasHTML += `
            <div class="resumo-func-item" data-func-id="${func.id}">
                <div class="resumo-func-nome">${func.nome}</div>
                <div class="meta-actions">
                    <button class="btn-edit-meta" title="Editar meta para esta escala">✏️</button>
                    <button class="btn-confirm-edit" title="Confirmar">✔️</button>
                    <button class="btn-cancel-edit" title="Cancelar">❌</button>
                </div>
                <div class="resumo-prog-container">
                    <div class="resumo-prog-bar resumo-prog-main ${barColorClass}" style="width: ${progPrincipal.toFixed(2)}%"></div>
                    <div class="resumo-prog-bar resumo-prog-overtime" style="width: ${progExtra.toFixed(2)}%"></div>
                </div>
                <div class="resumo-text-details">
                    <span><strong>Realizado:</strong> ${realizadoStr}${unidade}</span>
                    <span class="meta-container">
                        <span class="meta-text"><strong>Meta:</strong> ${metaStr}${unidade} ${overrideIndicator}</span>
                        <input type="number" class="meta-input" value="${meta}" step="${medicao === 'horas' ? '0.5' : '1'}">
                    </span>
                    <span class="resumo-saldo ${saldo > 0 ? 'positivo' : (saldo < 0 ? 'negativo' : '')}">
                        <strong>${saldoLabel}:</strong> ${saldo > 0 ? '+' : ''}${saldoStr}${unidade}
                    </span>
                </div>
            </div>
        `;
    });
    resumoHorasHTML += '</div>';


    const feriadosNaEscala = escala.feriados || [];
    let feriadosHTML = '';
    if (feriadosNaEscala.length > 0) {
        feriadosHTML = `
            <ul class="painel-feriados-list">
                ${feriadosNaEscala.map(f => {
                    const d = new Date(f.date + 'T12:00:00');
                    const isFolga = !f.trabalha;
                    const statusText = isFolga ? 'Folga Geral' : 'Trabalho Normal';
                    const statusClass = isFolga ? 'feriado-folga' : 'feriado-trabalho';
                    return `<li class="${statusClass}"><span class="feriado-data">${d.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span><span class="feriado-nome">${f.nome}</span><span class="feriado-status">${statusText}</span></li>`;
                }).join('')}
            </ul>
        `;
    }

    const statsHTML = `
        <div class="painel-legendas-container">
            <h5 style="margin-top: 0; margin-bottom: 8px; color: var(--muted);">Legenda de Turnos e Ausências</h5>
            <div class="escala-legenda turnos-legenda"></div>
        </div>

        <fieldset class="regras-fieldset" style="margin-top: 24px;">
            <legend>Estatísticas Resumidas</legend>
            <div class="painel-stats-grid">
                <div class="stat-item"><h5>Duração</h5><p>${totalDias} dias</p></div>
                <div class="stat-item"><h5>Finais de Semana</h5><p>${totalFDS} dias</p></div>
                <div class="stat-item"><h5>Turnos Vagos</h5><p><span class="${vagas > 0 ? 'vagas' : ''}">${vagas}</span></p></div>
                <div class="stat-item"><h5>Total H. Extras</h5><p>${totalHorasExtras.toFixed(1)}h</p></div>
            </div>
        </fieldset>

        <fieldset class="regras-fieldset" style="margin-top: 24px;">
            <legend>Feriados no Período</legend>
            ${feriadosHTML || '<p class="muted" style="text-align:center; padding: 8px 0;">Nenhum feriado cadastrado para esta escala.</p>'}
        </fieldset>
    `;

    const obsTextareaId = `${escala.owner}-escala-observacoes-textarea`;
    const observacoesHTML = `
        <div class="painel-observacoes-content">
            <label for="${obsTextareaId}">Observações da Escala:</label>
            <textarea id="${obsTextareaId}" placeholder="Adicione justificativas, avisos de última hora ou qualquer anotação relevante aqui...">${escala.observacoes || ''}</textarea>
            <p class="muted" style="font-size: 0.85rem;">* O texto preenchido será incluído na exportação da "Escala Completa" (PDF).</p>
        </div>
    `;

    $('.painel-content', painelContainer).innerHTML = `
        <div class="painel-tab-content active" data-tab-content="resumo">${resumoHorasHTML}</div>
        <div class="painel-tab-content" data-tab-content="stats">${statsHTML}</div>
        <div class="painel-tab-content" data-tab-content="observacoes">${observacoesHTML}</div>
    `;

    const obsTextarea = $(`#${obsTextareaId}`, painelContainer);
    if(obsTextarea) {
        obsTextarea.oninput = () => {
            if (currentEscala) {
                currentEscala.observacoes = obsTextarea.value;
                setGeradorFormDirty(true);
            }
        };
    }


    const turnosLegendaContainer = $('.turnos-legenda', painelContainer);
    renderEscalaLegend(escala, turnosLegendaContainer);

    $('.painel-tabs-toggle-group', painelContainer)?.addEventListener('click', (event) => {
        const btn = event.target.closest('.painel-tab-btn');
        if (!btn) return;

        $$('.painel-tabs-toggle-group .painel-tab-btn', painelContainer).forEach(b => b.classList.remove('active'));
        $$('.painel-tab-content', painelContainer).forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetContent = $(`.painel-tab-content[data-tab-content="${btn.dataset.tab}"]`, painelContainer);
        if (targetContent) targetContent.classList.add('active');

        if (btn.dataset.tab === 'observacoes') {
             const obsField = $(`#${obsTextareaId}`, targetContent);
             if(obsField) obsField.focus();
        }
    });

    const legendasWrapper = $('.painel-legendas-container', painelContainer);
    if (legendasWrapper) {
        legendasWrapper.addEventListener('mouseover', (event) => {
            const legendaItem = event.target.closest('.legenda-item');
            if (!legendaItem) return;

            const tipo = legendaItem.dataset.tipo;
            const id = legendaItem.dataset.id;
            const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
            if (!table) return;

            $$('td.highlight', table).forEach(cell => cell.classList.remove('highlight'));

            $$('td', table).forEach(cell => {
                const cellTipo = cell.dataset.tipo;
                const cellId = cell.dataset.id;
                const cellTurnoId = cell.dataset.turnoId;

                if ((cellTipo === tipo && cellId === id) || (tipo === 'turno' && cellTurnoId === id)) {
                    cell.classList.add('highlight');
                }
            });
        });

        legendasWrapper.addEventListener('mouseout', (event) => {
            const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
            if (table) {
                $$('td.highlight', table).forEach(cell => cell.classList.remove('highlight'));
            }
        });
    }

    const resumoList = $('.painel-resumo-horas-list', painelContainer);
    if(resumoList) {
        resumoList.addEventListener('click', (event) => {
            const funcItem = event.target.closest('.resumo-func-item');
            if (!funcItem) return;

            const funcId = funcItem.dataset.funcId;
            if (!currentEscala) return;

            if (event.target.closest('.btn-edit-meta')) {
                const outroEditando = $('.resumo-func-item.is-editing');
                if(outroEditando) outroEditando.classList.remove('is-editing');

                funcItem.classList.add('is-editing');
                const metaInput = $('.meta-input', funcItem);
                if (metaInput) {
                    metaInput.focus();
                    metaInput.select();
                }
            }
            else if (event.target.closest('.btn-cancel-edit')) {
                funcItem.classList.remove('is-editing');
                const func = funcsDaEscala.find(f => f.id === funcId);
                if (func) {
                    const medicao = func.medicaoCarga || 'horas';
                    let metaOriginal;
                     if (medicao === 'turnos') {
                        const { cargos } = store.getState();
                        const cargo = cargos.find(c => c.id === escala.cargoId);
                        const cargoDiasOperacionais = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
                        metaOriginal = calcularMetaTurnos(func, escala.inicio, escala.fim, cargoDiasOperacionais);
                    } else {
                        metaOriginal = calcularMetaHoras(func, escala.inicio, escala.fim);
                    }
                     const metaInput = $('.meta-input', funcItem);
                     if (metaInput) metaInput.value = metaOriginal;
                }
            }
            else if (event.target.closest('.btn-confirm-edit')) {
                const input = $('.meta-input', funcItem);
                if (!input) return;
                const novoValor = parseFloat(input.value);

                if (!isNaN(novoValor) && novoValor >= 0) {
                    if (!currentEscala.metasOverride) currentEscala.metasOverride = {};

                    currentEscala.metasOverride[funcId] = novoValor;
                    setGeradorFormDirty(true);
                    renderPainelDaEscala(currentEscala);
                    showToast("Meta temporária atualizada para esta escala.");
                } else {
                    showToast("Valor da meta inválido.", "error");
                }
            }
        });
    }
     parseEmojisInElement(painelContainer);
}

function renderEscalaTable(escala) {
    currentEscala = escala;

    const funcsDaEscala = store.getState().funcionarios.filter(f => escala.historico && escala.historico[f.id]);
    focoIndividualState.selectedEmployeeId = funcsDaEscala.length > 0 ? funcsDaEscala[0].id : null;
    focoIndividualState.selectedBrushId = null;
    focoIndividualState.editMode = 'employee';

    const owner = escala.owner || 'gerador';
    escala.owner = owner;

    const wizardContainer = $(`#${owner}-wizard-container`);
    if(wizardContainer) wizardContainer.classList.add('hidden');

    const escalaView = $(`#${owner}-escalaView`);
    if(escalaView) escalaView.classList.remove('hidden');

    const titleTextEl = $(`#${owner}-escalaViewTitle`);
    const titleInputEl = $(`#${owner}-escalaViewTitleInput`);
    if (titleTextEl) titleTextEl.textContent = escala.nome;
    if (titleInputEl) titleInputEl.value = escala.nome;

    renderCurrentView(owner);
    setupViewTabs(owner);

    if (typeof initEditor === 'function' && owner === 'gerador') {
        initEditor();
    }
}


function renderCurrentView(owner) {
    const tabsContainer = $(`#${owner}-view-tabs`);
    const activeTab = tabsContainer ? $('.painel-tab-btn.active', tabsContainer)?.dataset.tab : 'geral';

    const toolbox = $("#editor-toolbox");
    const fab = $("#editor-toolbox-fab");

    if (activeTab === 'geral') {
        renderEscalaGeralView(owner);
        if (owner === 'gerador' && toolbox) {
            toolbox.classList.remove('hidden');
            loadToolboxState();
            if (typeof updateAllIndicators === 'function') {
                updateAllIndicators();
            }
        } else {
             if (toolbox) toolbox.classList.add('hidden');
             if (fab) fab.classList.add('hidden');
             updatePagePaddingForToolbox(true);
        }
    } else if (activeTab === 'individual') {
        renderFocoIndividualView(owner);
        if (toolbox) toolbox.classList.add('hidden');
        if (fab) fab.classList.add('hidden');
        updatePagePaddingForToolbox(true);
    }
}

function renderEscalaGeralView(owner) {
    const container = $(`#${owner}-escalaTabelaWrap`);
    renderGenericEscalaTable(currentEscala, container, { isInteractive: owner === 'gerador' });
    renderPainelDaEscala(currentEscala);
}

function renderFocoIndividualView(owner) {
    const container = $(`#gerador-foco-individual-container`);
    if (!container || owner !== 'gerador') return;

    container.innerHTML = `
        <div class="foco-coluna-ferramentas">
            <div id="foco-ferramentas-selecao"></div>
            <fieldset>
                <legend>Ferramentas de Edição</legend>
                <div id="foco-ferramentas-modos"></div>
                <div id="foco-ferramentas-metricas"></div>
                <div id="foco-ferramentas-pinceis"></div>
            </fieldset>
        </div>
        <div class="foco-coluna-calendario">
            <div id="gerador-foco-calendario"></div>
        </div>
    `;

    renderFocoFerramentasSelecao(owner);
    renderFocoFerramentasModos(owner);
    renderFocoFerramentasMetricas(owner);
    renderFocoFerramentasPinceis(owner);
    renderFocoIndividualCalendar(owner);
}

function renderFocoFerramentasSelecao(owner) {
    const container = $(`#foco-ferramentas-selecao`);
    if (!container) return;

    const { funcionarios } = store.getState();
    const funcsDaEscala = funcionarios
        .filter(f => currentEscala.historico && currentEscala.historico[f.id])
        .sort((a,b) => a.nome.localeCompare(b.nome));

    if (!focoIndividualState.selectedEmployeeId && funcsDaEscala.length > 0) {
        focoIndividualState.selectedEmployeeId = funcsDaEscala[0].id;
    }

    const selectOptions = funcsDaEscala.map(f => `<option value="${f.id}" ${f.id === focoIndividualState.selectedEmployeeId ? 'selected' : ''}>${f.nome}</option>`).join('');

    container.innerHTML = `
        <label for="${owner}-foco-select-func" class="form-label">Selecionar Funcionário:</label>
        <select id="${owner}-foco-select-func">${selectOptions}</select>
    `;
    const select = $(`#${owner}-foco-select-func`);
    if (select) select.onchange = handleFocoFuncChange;
}

function renderFocoFerramentasModos(owner) {
    const container = $(`#foco-ferramentas-modos`);
    if (!container) return;

    container.innerHTML = `
        <div class="toggle-group">
            <button class="toolbox-mode-btn ${focoIndividualState.editMode === 'employee' ? 'active' : ''}" data-mode="employee" title="Pincel de Turnos">🎨 Pincel</button>
            <button class="toolbox-mode-btn ${focoIndividualState.editMode === 'eraser' ? 'active' : ''}" data-mode="eraser" title="Apagar Turnos">🗑️ Apagar</button>
        </div>
    `;
    const modeToggle = $('.toggle-group', container);
    if(modeToggle) modeToggle.onclick = handleFocoModeChange;
    parseEmojisInElement(container);
}

function renderFocoFerramentasMetricas(owner) {
    const container = $(`#foco-ferramentas-metricas`);
    if (!container) return;

    const employeeId = focoIndividualState.selectedEmployeeId;
    if(!employeeId) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="toolbox-card employee-indicators-card" data-employee-id="${employeeId}" style="margin-top: 16px;">
            <div class="workload-summary-compact">
                <span class="indicator-label">Carga:</span>
                <div class="progress-bar-container-compact">
                    <div class="progress-bar progress-bar-main"></div>
                    <div class="progress-bar progress-bar-overtime"></div>
                </div>
                <span class="workload-text-compact">0/0</span>
            </div>
            <div class="consecutive-days-container"></div>
        </div>
    `;
    const card = $('.employee-indicators-card', container);
    if (card && currentEscala) updateIndicatorsInCard(card);
}


function renderFocoFerramentasPinceis(owner) {
    const container = $(`#foco-ferramentas-pinceis`);
    if(!container) return;

    const selectedFunc = store.getState().funcionarios.find(f => f.id === focoIndividualState.selectedEmployeeId);
    let systemBrushesHTML = '';
    let normalBrushesHTML = '';

    if (selectedFunc) {
        const { turnos } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
        const turnosDeTrabalho = allTurnos.filter(t => !t.isSystem && selectedFunc.disponibilidade && selectedFunc.disponibilidade[t.id]);
        const turnosDeSistema = Object.values(TURNOS_SISTEMA_AUSENCIA);

        systemBrushesHTML = turnosDeSistema.map(t => renderBrush(t, focoIndividualState.selectedBrushId)).join('');
        normalBrushesHTML = turnosDeTrabalho.map(t => renderBrush(t, focoIndividualState.selectedBrushId)).join('');
    }

    container.innerHTML = `
        <div class="pinceis-container" style="margin-top: 16px;">
            <div class="pinceis-row-sistema">${systemBrushesHTML}</div>
            <div class="brush-separator"></div>
            <div class="pinceis-row-normal">${normalBrushesHTML}</div>
        </div>
    `;
    container.onclick = handleFocoBrushClick;
     parseEmojisInElement(container);
}

function renderFocoIndividualCalendar(owner) {
    const container = $(`#gerador-foco-calendario`);
    if (!container) return;

    const { turnos, cargos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const getTurnoInfo = (turnoId) => allTurnos.find(t => t.id === turnoId) || {};
    const funcId = focoIndividualState.selectedEmployeeId;
    const today = new Date().toISOString().slice(0, 10);
    const cargo = cargos.find(c => c.id === currentEscala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));

    const rangeSet = new Set(dateRangeInclusive(currentEscala.inicio, currentEscala.fim));
    const months = {};
    rangeSet.forEach(date => {
        const monthKey = date.substring(0, 7);
        if (!months[monthKey]) months[monthKey] = true;
    });

    let html = '';
    const sortedMonthKeys = Object.keys(months).sort();
    for (const monthKey of sortedMonthKeys) {
        const [year, month] = monthKey.split('-').map(Number);
        const monthName = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        html += `<div class="calendar-instance"><h4 class="month-title">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h4><div class="calendar-grid">${DIAS_SEMANA.map(d => `<div class="calendar-header ${['dom', 'sab'].includes(d.id) ? 'weekend-header' : ''}">${d.abrev}</div>`).join('')}${Array(firstDayOfMonth).fill('<div class="calendar-day empty"></div>').join('')}`;

        for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            if (!rangeSet.has(date)) {
                html += '<div class="calendar-day empty"></div>';
                continue;
            }

            const slot = currentEscala.slots.find(s => s.date === date && s.assigned === funcId);
            const turno = slot ? getTurnoInfo(slot.turnoId) : null;
            const d = new Date(date + 'T12:00:00');
            const dayOfWeek = d.getUTCDay();
            const diaSemanaId = DIAS_SEMANA[dayOfWeek].id;

            let classes = 'calendar-day';
            if ([0, 6].includes(dayOfWeek)) classes += ' weekend';
            if (date === today) classes += ' day-today';

            const feriadoFolga = currentEscala.feriados.find(f => f.date === date && !f.trabalha);
            const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

            if (feriadoFolga || isCargoDiaNaoUtil) {
                classes += ' celula-fechada';
            }

            let shiftHTML = '<div class="day-shift-info"></div>';
            if (turno) {
                const textColor = getContrastingTextColor(turno.cor);
                shiftHTML = `<div class="day-shift-info" style="background-color: ${turno.cor};">
                                <span class="day-shift-sigla" style="color: ${textColor};">${turno.sigla}</span>
                             </div>`;
            }

            html += `<div class="${classes}" data-date="${date}">
                        <span class="day-number">${dayNumber}</span>
                        ${shiftHTML}
                     </div>`;
        }
        html += '</div></div>';
    }
    container.innerHTML = html;

    const calendarGrid = $('.calendar-grid', container);
    if(calendarGrid) calendarGrid.onclick = handleFocoCalendarClick;
}

function renderBrush(turno, selectedBrushId) {
    const isSelected = selectedBrushId === turno.id;
    const textColor = getContrastingTextColor(turno.cor);

    return `
        <div class="shift-brush ${isSelected ? 'selected' : ''}" data-turno-id="${turno.id}" title="${turno.nome}">
            <div class="brush-icon" style="background-color: ${turno.cor}; color: ${textColor}">${turno.sigla}</div>
            <span class="brush-name">${turno.nome}</span>
        </div>`;
}

function updateTableAfterEdit(escala) {
    const owner = escala.owner;
    updateTableCells(escala);
    updateTableFooter(escala);
    renderPainelDaEscala(escala);

    const tabsContainer = $(`#${owner}-view-tabs`);
    const activeTab = tabsContainer ? $('.painel-tab-btn.active', tabsContainer)?.dataset.tab : 'geral';
    if (activeTab === 'individual') {
        renderFocoIndividualView(owner);
    }
     if (typeof updateAllIndicators === 'function') {
        updateAllIndicators();
    }
}


function updateTableCells(escala) {
    const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
    if (!table) return;

    const { turnos, cargos, equipes } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const getTurnoInfo = (turnoId) => allTurnos.find(t => t.id === turnoId) || {};

    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));

    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const allFuncsInvolved = new Set();
    escala.slots.forEach(s => { if (s.assigned) allFuncsInvolved.add(s.assigned) });
    Object.keys(escala.historico || {}).forEach(funcId => allFuncsInvolved.add(funcId));

    const equipesMap = new Map();
    equipes.filter(e => e.cargoId === escala.cargoId).forEach(e => {
        e.funcionarioIds.forEach(funcId => equipesMap.set(funcId, e.id));
    });

    const funcsDaEscala = [...allFuncsInvolved]
        .map(funcId => ({ id: funcId, ...store.getState().funcionarios.find(f => f.id === funcId), equipeId: equipesMap.get(funcId) }))
        .filter(f => f.nome)
        .sort((a, b) => {
            if (a.equipeId && !b.equipeId) return -1;
            if (!a.equipeId && b.equipeId) return 1;
            if (a.equipeId && b.equipeId && a.equipeId !== b.equipeId) {
                const equipeA = equipes.find(e => e.id === a.equipeId)?.nome || '';
                const equipeB = equipes.find(e => e.id === b.equipeId)?.nome || '';
                return equipeA.localeCompare(equipeB);
            }
            return a.nome.localeCompare(b.nome);
        });

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);

    funcsDaEscala.forEach(func => {
        const row = document.createElement('tr');
        row.dataset.employeeRowId = func.id;
        const equipeClass = func.equipeId ? `equipe-${func.equipeId}` : '';
        row.className = equipeClass;

        const nomeHtml = `
            <td>
                ${func.nome}
                <br>
                <small class="muted">${func.documento || '---'}</small>
            </td>
        `;
        row.innerHTML = nomeHtml;

        dateRange.forEach(date => {
            const cell = document.createElement('td');
            const d = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
            const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
            const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

            cell.dataset.date = date;
            cell.dataset.employeeId = func.id;
            cell.tabIndex = -1;
            cell.classList.add('editable-cell');

            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);

            if (slot) {
                const turno = getTurnoInfo(slot.turnoId);
                if (slot.isExtra) cell.classList.add('celula-hora-extra');
                else cell.classList.remove('celula-hora-extra');
                cell.dataset.slotId = slot.id;
                cell.dataset.turnoId = slot.turnoId;
                if (slot.equipeId) cell.dataset.equipeId = slot.equipeId;
                cell.style.backgroundColor = turno.cor;
                cell.style.color = getContrastingTextColor(turno.cor);
                cell.title = turno.nome;
                cell.textContent = turno.sigla || '?';
            } else if (feriadoFolga) {
                cell.classList.remove('editable-cell');
                cell.classList.add('celula-feriado-folga');
                cell.title = feriadoFolga.nome;
                cell.textContent = 'FOLGA';
            } else if (isCargoDiaNaoUtil) {
                 cell.classList.remove('editable-cell');
                cell.classList.add('celula-fechada');
                cell.title = 'O cargo não opera neste dia';
            } else {
                 if (func.equipeId) cell.style.backgroundColor = '#f0f0f0';
                 cell.textContent = '';
                 cell.style.backgroundColor = '';
                 cell.style.color = '';
                 cell.title = '';
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}


async function salvarEscalaAtual(options = {}) {
    const {
        showToast: shouldShowToast = true
    } = options;
    if (currentEscala) {
        currentEscala.lastModified = new Date().toISOString();

        const {
            funcionarios,
            turnos
        } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];

        const allSlotsToSnapshot = currentEscala.slots.filter(s => s.assigned);

        const funcsInvolvedIds = new Set(allSlotsToSnapshot.map(s => s.assigned));
        const turnosInvolvedIds = new Set(allSlotsToSnapshot.map(s => s.turnoId));

        currentEscala.snapshot = {
            funcionarios: {},
            turnos: {}
        };

        const obsTextareaId = `${currentEscala.owner}-escala-observacoes-textarea`;
        const obsTextarea = $(`#${obsTextareaId}`);
        if(obsTextarea) {
             currentEscala.observacoes = obsTextarea.value.trim();
        } else if (!currentEscala.observacoes) {
            currentEscala.observacoes = '';
        }


        funcsInvolvedIds.forEach(id => {
            const func = funcionarios.find(f => f.id === id);
            if (func) {
                currentEscala.snapshot.funcionarios[id] = {
                    nome: func.nome,
                    documento: func.documento,
                    cargaHoraria: func.cargaHoraria,
                    periodoHoras: func.periodoHoras,
                    medicaoCarga: func.medicaoCarga
                };
            }
        });

        turnosInvolvedIds.forEach(id => {
            const turno = allTurnos.find(t => t.id === id);
            if (turno) {
                currentEscala.snapshot.turnos[id] = {
                    nome: turno.nome,
                    sigla: turno.sigla,
                    cor: turno.cor,
                    inicio: turno.inicio,
                    fim: turno.fim
                };
            }
        });

        store.dispatch('SAVE_ESCALA', currentEscala);
        if (shouldShowToast) {
            showToast("Alterações salvas com sucesso!");
        }
    }
}