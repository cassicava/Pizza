/**************************************
 * 📅 Visualização da Escala
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
    const turnosDoCargo = allTurnos.filter(t => cargo.turnosIds?.includes(t.id) || t.isSystem)
        .sort((a,b) => {
            if (a.isSystem && !b.isSystem) return -1;
            if (!a.isSystem && b.isSystem) return 1;
            return a.nome.localeCompare(b.nome);
        });
        
    turnosDoCargo.forEach(turno => {
        allLegendItems.push({
            id: turno.id,
            html: `<div class="legenda-item" data-tipo="turno" data-id="${turno.id}"><span class="color-dot" style="background-color: ${turno.cor}"></span><strong>${turno.sigla}</strong> - ${turno.nome}</div>`,
        });
    });

    const activeTurnos = new Set(escala.slots.map(s => s.turnoId));
    
    // Adiciona os turnos de sistema se houverem na escala.
    if(activeTurnos.has(TURNO_FERIAS_ID)) {
        const turno = TURNOS_SISTEMA_AUSENCIA[TURNO_FERIAS_ID];
        allLegendItems.push({
            id: turno.id,
            html: `<div class="legenda-item" data-tipo="turno" data-id="${turno.id}"><span class="color-dot" style="background-color: ${turno.cor}"></span><strong>${turno.sigla}</strong> - ${turno.nome}</div>`,
        });
    }
    if(activeTurnos.has(TURNO_FOLGA_ID)) {
        const turno = TURNOS_SISTEMA_AUSENCIA[TURNO_FOLGA_ID];
        allLegendItems.push({
            id: turno.id,
            html: `<div class="legenda-item" data-tipo="turno" data-id="${turno.id}"><span class="color-dot" style="background-color: ${turno.cor}"></span><strong>${turno.sigla}</strong> - ${turno.nome}</div>`,
        });
    }
    if(activeTurnos.has(TURNO_AFASTAMENTO_ID)) {
        const turno = TURNOS_SISTEMA_AUSENCIA[TURNO_AFASTAMENTO_ID];
        allLegendItems.push({
            id: turno.id,
            html: `<div class="legenda-item" data-tipo="turno" data-id="${turno.id}"><span class="color-dot" style="background-color: ${turno.cor}"></span><strong>${turno.sigla}</strong> - ${turno.nome}</div>`,
        });
    }

    const finalHTML = allLegendItems.map(item => {
        const isActive = activeTurnos.has(item.id);
        const classInactive = !isActive ? 'inactive' : '';
        return item.html.replace('class="legenda-item"', `class="legenda-item ${classInactive}"`);
    }).join('');

    if (finalHTML.length > 0) {
        container.innerHTML = finalHTML;
    }
}


function renderGenericEscalaTable(escala, container, options = {}) {
    const {
        isInteractive = false
    } = options;
    const {
        funcionarios,
        turnos,
        cargos
    } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];

    if (!container) {
        console.error("Container para renderizar a tabela não foi encontrado.");
        return;
    }

    const getTurnoInfo = (turnoId) => allTurnos.find(t => t.id === turnoId) || {};
    const getFuncInfo = (funcId) => (escala.snapshot?.funcionarios?.[funcId]) || funcionarios.find(f => f.id === funcId) || {};

    let cobertura = escala.cobertura || {};
    if (escala.isManual) {
        const cargo = cargos.find(c => c.id === escala.cargoId);
        if (cargo) {
            cargo.turnosIds.forEach(turnoId => {
                if (!cobertura[turnoId]) {
                    cobertura[turnoId] = 0;
                }
            });
        }
    }

    const allFuncsInvolved = new Set();
    escala.slots.forEach(s => {
        if (s.assigned) allFuncsInvolved.add(s.assigned)
    });
    Object.keys(escala.historico || {}).forEach(funcId => allFuncsInvolved.add(funcId));

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);

    const funcsDaEscala = [...allFuncsInvolved]
        .map(funcId => ({
            id: funcId,
            ...getFuncInfo(funcId)
        }))
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

    const turnosDoCargo = turnos.filter(t => cobertura.hasOwnProperty(t.id)).sort((a, b) => a.inicio.localeCompare(b.inicio));

    let tableHTML = `<table class="escala-final-table"><thead><tr><th>Funcionário</th>`;
    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', {
            weekday: 'short'
        }).replace('.', '');
        const dia = d.getDate();
        const feriado = escala.feriados.find(f => f.date === date);
        const isFeriado = feriado ? 'feriado' : '';
        const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 'weekend' : '';
        // ALTERAÇÃO: Adiciona a classe 'feriado-folga' se o feriado for de folga geral.
        const isFolgaGeral = feriado && !feriado.trabalha ? 'feriado-folga' : '';
        tableHTML += `<th class="${isFeriado} ${isWeekend} ${isFolgaGeral}" title="${feriado ? feriado.nome : ''}">${dia}<br>${diaSemana}</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;

    funcsDaEscala.forEach(func => {
        const horasTrabalhadas = (escala.historico[func.id]?.horasTrabalhadas / 60) || 0;
        const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);
        const percentual = metaHoras > 0 ? (horasTrabalhadas / metaHoras) * 100 : 0;

        let indicatorClass = '';
        let indicatorTitle = `Carga Horária: ${horasTrabalhadas.toFixed(1)}h de ${metaHoras.toFixed(1)}h (${percentual.toFixed(0)}%)`;

        if (percentual >= 100) {
            indicatorClass = 'workload-ok';
        } else if (percentual >= 80) {
            indicatorClass = 'workload-good';
        } else if (percentual >= 40) {
            indicatorClass = 'workload-warning';
        } else if (horasTrabalhadas > 0) {
            indicatorClass = 'workload-danger';
        }

        const indicatorHTML = `<span class="workload-indicator ${indicatorClass}" title="${indicatorTitle}"></span>`;

        const nomeHtml = `
            <td>
                ${indicatorHTML} ${func.nome}
                <br>
                <small class="muted">${func.documento || '---'}</small>
            </td>
        `;
        tableHTML += `<tr data-employee-row-id="${func.id}">${nomeHtml}`;
        dateRange.forEach(date => {
            const dataAttrs = isInteractive ? `data-date="${date}" data-employee-id="${func.id}"` : '';
            let cellClass = isInteractive ? 'editable-cell' : '';

            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);

            if (slot) {
                const turno = getTurnoInfo(slot.turnoId);
                const slotAttr = isInteractive ? `data-slot-id="${slot.id}" data-turno-id="${slot.turnoId}"` : '';
                const equipeAttr = isInteractive && slot.equipeId ? `data-equipe-id="${slot.equipeId}"` : '';
                const draggableAttr = isInteractive ? `draggable="true"` : '';
                const textColor = getContrastingTextColor(turno.cor);
                const extraClass = slot.isExtra ? 'celula-hora-extra' : '';
                tableHTML += `<td class="${cellClass} ${extraClass}" style="background-color:${turno.cor}; color: ${textColor};" ${dataAttrs} ${slotAttr} ${equipeAttr} ${draggableAttr} title="${turno.nome}">${turno.sigla || '?'}</td>`;
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
            tableHTML += `<tr class="total-row"><td><strong>Total ${turno.sigla}</strong></td>`;
            dateRange.forEach(date => {
                const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                tableHTML += `<td>${total}</td>`;
            });
            tableHTML += `</tr>`;
        });

        turnosDoCargo.forEach(turno => {
            let hasVagas = false;
            let rowVagasHTML = `<tr class="vagas-row"><td><strong style="color: var(--danger);">Faltam ${turno.sigla}</strong></td>`;

            dateRange.forEach(date => {
                const coberturaNecessaria = cobertura[turno.id] || 0;
                const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                const vagas = coberturaNecessaria - coberturaAtual;

                if (vagas > 0) {
                    hasVagas = true;
                    rowVagasHTML += `<td style="color: var(--danger); font-weight: bold;">${vagas}</td>`;
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
        const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
        const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);
        return acc + Math.max(0, horasTrabalhadas - metaHoras);
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
        <button class="painel-tab-btn active" data-tab="resumo">Resumo de Horas</button>
        <button class="painel-tab-btn" data-tab="stats">Estatísticas & Legenda</button>
    `;

    let resumoHorasHTML = '<div class="painel-resumo-horas-list">';
    funcsDaEscala.forEach(func => {
        const horasTrabalhadas = (escala.historico[func.id]?.horasTrabalhadas / 60) || 0;
        const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);
        const saldo = horasTrabalhadas - metaHoras;
        const fazHoraExtra = func.fazHoraExtra;

        let progPrincipal = metaHoras > 0 ? (horasTrabalhadas / metaHoras) * 100 : 0;
        let progExtra = 0;

        if (progPrincipal > 100) {
            progExtra = progPrincipal - 100;
            progPrincipal = 100;
        }

        let saldoLabel = 'Saldo';
        if (saldo > 0) {
            saldoLabel = fazHoraExtra ? 'H. Extra' : 'Acima da Meta';
        }

        let barColorClass = 'blue';
        if (progPrincipal < 40) barColorClass = 'red';
        else if (progPrincipal < 80) barColorClass = 'yellow';

        resumoHorasHTML += `
            <div class="resumo-func-item">
                <div class="resumo-func-nome" title="${func.nome}">${func.nome}</div>
                <div class="resumo-prog-container">
                    <div class="resumo-prog-bar resumo-prog-main ${barColorClass}" style="width: ${progPrincipal.toFixed(2)}%"></div>
                    <div class="resumo-prog-bar resumo-prog-overtime" style="width: ${progExtra.toFixed(2)}%"></div>
                </div>
                <div class="resumo-text-details">
                    <span><strong>Realizado:</strong> ${horasTrabalhadas.toFixed(1)}h</span>
                    <span><strong>Meta:</strong> ${metaHoras.toFixed(1)}h</span>
                    <span class="resumo-saldo ${saldo > 0 ? 'positivo' : (saldo < 0 ? 'negativo' : '')}">
                        <strong>${saldoLabel}:</strong> ${saldo > 0 ? '+' : ''}${saldo.toFixed(1)}h
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
                ${feriadosNaEscala.map(f => `
                    <li>
                        <div>
                            <span class="feriado-data">${new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                            - <span class="feriado-nome">${f.nome}</span>
                        </div>
                        <span class="tag">${f.trabalha ? 'Trabalho Normal' : 'Folga Geral'}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    const statsHTML = `
        <div class="painel-stats-grid">
            <div class="stat-item"><h5>Duração</h5><p>${totalDias} dias</p></div>
            <div class="stat-item"><h5>Finais de Semana</h5><p>${totalFDS} dias</p></div>
            <div class="stat-item"><h5>Turnos Vagos</h5><p><span class="${vagas > 0 ? 'vagas' : ''}">${vagas}</span></p></div>
            <div class="stat-item"><h5>Total H. Extras</h5><p>${totalHorasExtras.toFixed(1)}h</p></div>
        </div>
        
        <fieldset class="regras-fieldset" style="margin-top: 24px;">
            <legend>Feriados no Período</legend>
            ${feriadosHTML || '<p class="muted" style="text-align:center; padding: 8px 0;">Nenhum feriado cadastrado para esta escala.</p>'}
        </fieldset>

        <div class="painel-legendas-container">
            <h5 style="margin-top: 24px; margin-bottom: 8px; color: var(--muted);">Legenda de Turnos e Ausências</h5>
            <div class="escala-legenda turnos-legenda"></div>
            <h5 style="margin-top: 16px; margin-bottom: 8px; color: var(--muted);">Legenda de Status do Funcionário</h5>
            <div class="escala-legenda status-legenda"></div>
        </div>
    `;

    $('.painel-content', painelContainer).innerHTML = `
        <div class="painel-tab-content active" data-tab-content="resumo">${resumoHorasHTML}</div>
        <div class="painel-tab-content" data-tab-content="stats">${statsHTML}</div>
    `;

    const turnosLegendaContainer = $('.turnos-legenda', painelContainer);
    renderEscalaLegend(escala, turnosLegendaContainer);

    const statusLegendaContainer = $('.status-legenda', painelContainer);
    const legendaStatusHTML = `
        <div class="legenda-item" data-tipo="workload" data-id="workload-danger" title="Carga horária muito abaixo da meta (<40%)">
            <span class="workload-indicator workload-danger"></span>
            <span>Abaixo da Meta</span>
        </div>
        <div class="legenda-item" data-tipo="workload" data-id="workload-warning" title="Carga horária se aproximando da meta (40% a 79%)">
            <span class="workload-indicator workload-warning"></span>
            <span>Em Progresso</span>
        </div>
        <div class="legenda-item" data-tipo="workload" data-id="workload-good" title="Carga horária adequada (80% a 99%)">
            <span class="workload-indicator workload-good"></span>
            <span>Meta Próxima</span>
        </div>
        <div class="legenda-item" data-tipo="workload" data-id="workload-ok" title="Carga horária atingida ou excedida (≥100%)">
            <span class="workload-indicator workload-ok"></span>
            <span>Meta Atingida</span>
        </div>
    `;
    if (statusLegendaContainer) {
        statusLegendaContainer.innerHTML = legendaStatusHTML;
    }

    $$('.painel-tab-btn', painelContainer).forEach(btn => {
        btn.onclick = () => {
            $$('.painel-tab-btn', painelContainer).forEach(b => b.classList.remove('active'));
            $$('.painel-tab-content', painelContainer).forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            $(`.painel-tab-content[data-tab-content="${btn.dataset.tab}"]`, painelContainer).classList.add('active');
        };
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

            if (tipo === 'workload') {
                const statusClass = id;
                $$(`tr[data-employee-row-id]`, table).forEach(row => {
                    if ($(`.workload-indicator.${statusClass}`, row)) {
                        row.querySelectorAll('td').forEach(cell => cell.classList.add('highlight'));
                    }
                });
            } else {
                $$('td', table).forEach(cell => {
                    const cellTipo = cell.dataset.tipo;
                    const cellId = cell.dataset.id;
                    const cellTurnoId = cell.dataset.turnoId;

                    if ((cellTipo === tipo && cellId === id) || (tipo === 'turno' && cellTurnoId === id)) {
                        cell.classList.add('highlight');
                    }
                });
            }
        });

        legendasWrapper.addEventListener('mouseout', (event) => {
            const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
            if (table) {
                $$('td.highlight', table).forEach(cell => cell.classList.remove('highlight'));
            }
        });
    }
}

function renderEscalaTable(escala) {
    currentEscala = escala;
    // Alterado para chamar a função de renderização completa na primeira vez
    const container = $(`#${escala.owner}-escalaTabelaWrap`);
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

// Renomeada para clareza
function updateTableAfterEdit(escala) {
    updateTableCells(escala);
    renderPainelDaEscala(escala);
}

// NOVA FUNÇÃO: Atualiza apenas as células necessárias
function updateTableCells(escala) {
    const table = $(`#${escala.owner}-escalaTabelaWrap .escala-final-table`);
    if (!table) return;

    const {
        turnos
    } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const getTurnoInfo = (turnoId) => allTurnos.find(t => t.id === turnoId) || {};

    // 1. Mapeia o estado atual da tabela para comparação
    const currentTableState = new Map();
    $$('tbody tr[data-employee-row-id]', table).forEach(row => {
        const employeeId = row.dataset.employeeRowId;
        $$('td.editable-cell', row).forEach(cell => {
            const date = cell.dataset.date;
            currentTableState.set(`${employeeId}-${date}`, cell.innerHTML);
        });
    });

    // 2. Itera sobre os dados da escala e atualiza o DOM apenas onde houver mudança
    $$('tbody tr[data-employee-row-id]', table).forEach(row => {
        const funcId = row.dataset.employeeRowId;
        $$('td.editable-cell', row).forEach(cell => {
            const date = cell.dataset.date;

            // Lógica para gerar o conteúdo esperado da célula (similar à renderGenericEscalaTable)
            const slot = escala.slots.find(s => s.date === date && s.assigned === funcId);

            // Limpa a célula antes de adicionar novo conteúdo
            cell.innerHTML = '';
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.className = 'editable-cell'; // Reseta classes
            Object.keys(cell.dataset).forEach(key => {
                if (key !== 'date' && key !== 'employeeId') {
                    delete cell.dataset[key];
                }
            });

            if (slot) {
                const turno = getTurnoInfo(slot.turnoId);
                cell.dataset.slotId = slot.id;
                cell.dataset.turnoId = slot.turnoId;
                if (slot.equipeId) cell.dataset.equipeId = slot.equipeId;
                cell.draggable = true;
                cell.style.backgroundColor = turno.cor;
                cell.style.color = getContrastingTextColor(turno.cor);
                cell.title = turno.nome;
                cell.textContent = turno.sigla || '?';
                if (slot.isExtra) cell.classList.add('celula-hora-extra');
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
        const funcsInvolvedIds = new Set(Object.keys(currentEscala.historico || {}));
        const turnosInvolvedIds = new Set(currentEscala.slots.map(s => s.turnoId));

        currentEscala.snapshot = {
            funcionarios: {},
            turnos: {}
        };

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