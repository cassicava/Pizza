/**************************************
 * 📅 Visualização da Escala (v2 - Correções no Rodapé)
 **************************************/

let currentEscala = null;

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
    const { funcionarios, turnos, cargos } = store.getState();
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

    const funcsDaEscala = [...allFuncsInvolved]
        .map(funcId => ({ id: funcId, ...getFuncInfo(funcId) }))
        .filter(f => f.nome)
        .sort((a, b) => {
            const primeiroDia = dateRange[0];
            const slotA = escala.slots.find(s => s.assigned === a.id && s.date === primeiroDia);
            const slotB = escala.slots.find(s => s.assigned === b.id && s.date === primeiroDia);
            const turnoA = slotA ? getTurnoInfo(slotA.turnoId) : null;
            const turnoB = slotB ? getTurnoInfo(slotB.turnoId) : null;
            if (turnoA?.isSystem && !turnoB?.isSystem) return -1;
            if (!turnoA?.isSystem && turnoB?.isSystem) return 1;
            if (turnoA && turnoB && turnoA.inicio && turnoB.inicio) {
                const inicioComparison = turnoA.inicio.localeCompare(turnoB.inicio);
                if (inicioComparison !== 0) return inicioComparison;
            }
            return a.nome.localeCompare(b.nome);
        });
    
    // CORREÇÃO: Define os turnos do rodapé com base nos turnos do cargo, e não apenas os com cobertura > 0.
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
        tableHTML += `<tr data-employee-row-id="${func.id}">${nomeHtml}`;

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
                tableHTML += `<td class="${cellClass}" ${dataAttrs}></td>`;
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
            dateRange.forEach(date => {
                const d = new Date(date + 'T12:00:00');
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
                const isDiaUtil = cargoDiasOperacionais.has(diaSemanaId) && !feriadoFolga;
                if (isDiaUtil) {
                    const coberturaNecessaria = cobertura[turno.id] || 0;
                    const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                    const vagas = coberturaNecessaria - coberturaAtual;
                    if (vagas > 0) {
                        hasVagas = true;
                        rowVagasHTML += `<td style="color: var(--danger); font-weight: bold;">${vagas}</td>`;
                    } else {
                        rowVagasHTML += `<td></td>`;
                    }
                } else {
                    rowVagasHTML += `<td></td>`;
                }
            });
            rowVagasHTML += `</tr>`;
            if (hasVagas) tableHTML += rowVagasHTML;
        });
        tableHTML += `</tfoot>`;
    }
    container.innerHTML = tableHTML;
}

/**
 * NOVA FUNÇÃO: Atualiza apenas o rodapé da tabela.
 * @param {object} escala - O objeto da escala atual.
 */
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

    // Gera as linhas de "Total"
    turnosDoCargo.forEach(turno => {
        footerHTML += `<tr class="total-row"><td><strong>Total ${turno.sigla || '??'}</strong></td>`;
        dateRange.forEach(date => {
            const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
            footerHTML += `<td>${total}</td>`;
        });
        footerHTML += `</tr>`;
    });

    // Gera as linhas de "Faltam"
    turnosDoCargo.forEach(turno => {
        let hasVagas = false;
        let rowVagasHTML = `<tr class="vagas-row"><td><strong style="color: var(--danger);">Faltam ${turno.sigla || '??'}</strong></td>`;
        dateRange.forEach(date => {
            const d = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
            const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
            const isDiaUtil = cargoDiasOperacionais.has(diaSemanaId) && !feriadoFolga;
            
            if (isDiaUtil) {
                const coberturaNecessaria = cobertura[turno.id] || 0;
                const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                const vagas = coberturaNecessaria - coberturaAtual;
                
                if (vagas > 0) {
                    hasVagas = true;
                    rowVagasHTML += `<td style="color: var(--danger); font-weight: bold;">${vagas}</td>`;
                } else {
                    rowVagasHTML += `<td></td>`;
                }
            } else {
                rowVagasHTML += `<td></td>`;
            }
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

    const {
        funcionarios
    } = store.getState();
    const funcsDaEscala = funcionarios.filter(f => escala.historico && escala.historico[f.id]).sort((a, b) => a.nome.localeCompare(b.nome));
    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const totalDias = dateRange.length;
    const totalFDS = dateRange.filter(d => [0, 6].includes(new Date(d + 'T12:00:00').getUTCDay())).length;
    const vagas = escala.slots.filter(s => !s.assigned).length;
    const totalHorasExtras = funcsDaEscala.reduce((acc, func) => {
        if (func.medicaoCarga === 'horas' || !func.medicaoCarga) {
            const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
            const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);
            return acc + Math.max(0, horasTrabalhadas - metaHoras);
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
        } else { // Padrão 'horas'
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
            currentEscala.observacoes = obsTextarea.value;
            setGeradorFormDirty(true);
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
        targetContent.classList.add('active');

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

            if (event.target.closest('.btn-edit-meta')) {
                const outroEditando = $('.resumo-func-item.is-editing');
                if(outroEditando) outroEditando.classList.remove('is-editing');
                
                funcItem.classList.add('is-editing');
                $('.meta-input', funcItem).focus();
            } 
            else if (event.target.closest('.btn-cancel-edit')) {
                funcItem.classList.remove('is-editing');
            }
            else if (event.target.closest('.btn-confirm-edit')) {
                const input = $('.meta-input', funcItem);
                const novoValor = parseFloat(input.value);

                if (!isNaN(novoValor) && novoValor >= 0) {
                    if (!currentEscala.metasOverride) currentEscala.metasOverride = {};
                    
                    currentEscala.metasOverride[funcId] = novoValor;
                    setGeradorFormDirty(true);
                    renderPainelDaEscala(currentEscala); // Re-renderiza tudo para recalcular e sair do modo de edição
                    showToast("Meta temporária atualizada para esta escala.");
                } else {
                    showToast("Valor da meta inválido.", "error");
                }
            }
        });
    }
}

function renderEscalaTable(escala) {
    currentEscala = escala;
    const container = $(`#${escala.owner}-escalaTabelaWrap`);

    const cardPai = container.closest('.card');
    if (cardPai) {
        cardPai.classList.add('card-table-container');
    }

    renderGenericEscalaTable(escala, container, {
        isInteractive: true
    });
    renderPainelDaEscala(escala);


    $(`#${escala.owner}-wizard-container`).classList.add('hidden');
    $(`#${escala.owner}-escalaView`).classList.remove('hidden');

    const titleTextEl = $(`#${escala.owner}-escalaViewTitle`);
    const titleInputEl = $(`#${escala.owner}-escalaViewTitleInput`);
    if (titleTextEl) titleTextEl.textContent = escala.nome;
    if (titleInputEl) titleInputEl.value = escala.nome;

    if (typeof initEditor === 'function') {
        initEditor();
    }
}

function updateTableAfterEdit(escala) {
    updateTableCells(escala);
    // ADIÇÃO: Chama a nova função para atualizar o rodapé
    updateTableFooter(escala);
    renderPainelDaEscala(escala);
}

function updateTableCells(escala) {
    const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
    if (!table) return;

    const { turnos, cargos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const getTurnoInfo = (turnoId) => allTurnos.find(t => t.id === turnoId) || {};
    
    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));

    $$('tbody tr[data-employee-row-id]', table).forEach(row => {
        const funcId = row.dataset.employeeRowId;
        $$('td:not(:first-child)', row).forEach((cell, index) => {
            const date = dateRangeInclusive(escala.inicio, escala.fim)[index];
            if(!date) return;

            const d = new Date(date + 'T12:00:00');
            const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
            const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
            const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);
            
            const slot = escala.slots.find(s => s.date === date && s.assigned === funcId);

            cell.innerHTML = '';
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.className = '';
            cell.title = '';
            Object.keys(cell.dataset).forEach(key => delete cell.dataset[key]);
            
            cell.dataset.date = date;
            cell.dataset.employeeId = funcId;
            cell.tabIndex = -1;

            if (slot) {
                const turno = getTurnoInfo(slot.turnoId);
                cell.classList.add('editable-cell');
                if (slot.isExtra) cell.classList.add('celula-hora-extra');
                cell.dataset.slotId = slot.id;
                cell.dataset.turnoId = slot.turnoId;
                if (slot.equipeId) cell.dataset.equipeId = slot.equipeId;
                cell.style.backgroundColor = turno.cor;
                cell.style.color = getContrastingTextColor(turno.cor);
                cell.title = turno.nome;
                cell.textContent = turno.sigla || '?';
            } else if (feriadoFolga) {
                cell.classList.add('celula-feriado-folga');
                cell.title = feriadoFolga.nome;
                cell.textContent = 'FOLGA';
            } else if (isCargoDiaNaoUtil) {
                cell.classList.add('celula-fechada');
                cell.title = 'O cargo não opera neste dia';
            } else {
                cell.classList.add('editable-cell');
            }
        });
    });
}


async function salvarEscalaAtual(options = {}) {
    const {
        showToast: shouldShowToast = true
    } = options;
    if (currentEscala) {
        const {
            funcionarios,
            turnos
        } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
        
        const allSlotsToSnapshot = currentEscala.slots.filter(s => s.assigned).map(s => {
            const turno = allTurnos.find(t => t.id === s.turnoId);
            if(turno && turno.isSystem) { }
            return s;
        });

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