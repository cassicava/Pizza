/**************************************************************
 * 🛠️ Lógica do Editor Manual (v7.3 - Correção de Atualização da Toolbox)
 **************************************************************/

const editorState = {
    editMode: 'employee',
    selectedCell: null,
    focusedEmployeeId: null,
    focusedEmployeeIndex: -1,
    scheduleOrderedFuncs: [],
    selectedShiftBrush: null,
    lastHoveredDate: null,
    animationDirection: 'right',
    enforceRules: true,
    sessionOverride: false,
    selectedCellCoords: { row: -1, col: -1 },
    allConflicts: [], // Agora armazena objetos { employeeId, date, type, message }
};

const toolboxState = {
    isMinimized: false,
    dockPosition: 'bottom',
};

const conflictIcons = {
    rest: '⏸️', // Pausa
    consecutive: '➡️', // Seta direita
    weekend: '📅', // Calendário
    // Adicionar outros tipos se necessário
};

let marqueeObserver = null;

// --- INICIALIZAÇÃO E CONTROLE DE UI ---

function updatePagePaddingForToolbox(reset = false) {
    const activePage = $('.page.active');
    if (!activePage) return;

    const toolboxHeight = 120; // Altura aproximada da toolbox + margens

    activePage.style.paddingTop = '';
    activePage.style.paddingBottom = '';

    if (reset || toolboxState.isMinimized) {
        return;
    }

    if (toolboxState.dockPosition === 'top') {
        activePage.style.paddingTop = `${toolboxHeight}px`;
    } else {
        activePage.style.paddingBottom = `${toolboxHeight}px`;
    }
}

function saveToolboxState() {
    localStorage.setItem('ge_toolbox_state', JSON.stringify({
        isMinimized: toolboxState.isMinimized,
        dockPosition: toolboxState.dockPosition,
        enforceRules: editorState.enforceRules
    }));
}

function loadToolboxState() {
    let savedState = null;
    try {
        savedState = JSON.parse(localStorage.getItem('ge_toolbox_state'));
    } catch (e) { localStorage.removeItem('ge_toolbox_state'); }

    const toolbox = $("#editor-toolbox");
    const fab = $("#editor-toolbox-fab");
    if (!toolbox || !fab) return;

    toolboxState.isMinimized = savedState?.isMinimized || false;
    toolboxState.dockPosition = savedState?.dockPosition || 'bottom';
    editorState.enforceRules = savedState?.enforceRules !== false; // Padrão é true

    toolbox.classList.toggle('is-docked-top', toolboxState.dockPosition === 'top');
    fab.classList.toggle('is-docked-top', toolboxState.dockPosition === 'top');
    toolbox.classList.toggle('override-active', !editorState.enforceRules);

    if (toolboxState.isMinimized) {
        toolbox.classList.add('is-minimized');
        fab.classList.remove('hidden');
    } else {
        toolbox.classList.remove('is-minimized');
        fab.classList.add('hidden');
    }

    const dockBtnSpan = $('#toggle-dock-btn span');
    if(dockBtnSpan) {
        dockBtnSpan.textContent = toolboxState.dockPosition === 'top' ? '🔽' : '🔼';
        dockBtnSpan.parentElement.title = toolboxState.dockPosition === 'top' ? 'Mover para a Base' : 'Mover para o Topo';
        parseEmojisInElement(dockBtnSpan.parentElement); // Parse emoji aqui
    }


    updatePagePaddingForToolbox();
}

function toggleToolboxSize() {
    toolboxState.isMinimized = !toolboxState.isMinimized;
    const toolbox = $("#editor-toolbox");
    const fab = $("#editor-toolbox-fab");

    toolbox.classList.toggle('is-minimized', toolboxState.isMinimized);
    fab.classList.toggle('hidden', !toolboxState.isMinimized);

    updatePagePaddingForToolbox();
    saveToolboxState();
}

function toggleDockPosition() {
    toolboxState.dockPosition = toolboxState.dockPosition === 'bottom' ? 'top' : 'bottom';
    const toolbox = $("#editor-toolbox");
    const fab = $("#editor-toolbox-fab");
    const btnSpan = $('#toggle-dock-btn span');

    toolbox.classList.toggle('is-docked-top', toolboxState.dockPosition === 'top');
    fab.classList.toggle('is-docked-top', toolboxState.dockPosition === 'top');

    if (toolboxState.dockPosition === 'top') {
        btnSpan.textContent = '🔽';
        btnSpan.parentElement.title = 'Mover para a Base';
    } else {
        btnSpan.textContent = '🔼';
        btnSpan.parentElement.title = 'Mover para o Topo';
    }
    parseEmojisInElement(btnSpan.parentElement);

    updatePagePaddingForToolbox();
    saveToolboxState();
}

function cleanupEditor() {
    const toolbox = $("#editor-toolbox");
    const fab = $("#editor-toolbox-fab");
    if (toolbox) toolbox.classList.add("hidden");
    if (fab) fab.classList.add("hidden");
    updatePagePaddingForToolbox(true); // Reseta padding ao limpar
    if (marqueeObserver) {
        marqueeObserver.disconnect();
        marqueeObserver = null;
    }
    // Remove listener de teclado global para evitar conflitos
    document.onkeydown = null;
    // Remove listener de mouseover da tabela se existir
    const tableWrap = $(`#${currentEscala?.owner}-escalaTabelaWrap`); // Usa optional chaining
    if(tableWrap) tableWrap.onmouseover = null;
}


function setupViewTabs(owner) {
    const tabsContainer = $(`#${owner}-view-tabs`);
    if (!tabsContainer) return;

    // Remove listeners antigos para evitar duplicação (caso setup seja chamado mais de uma vez)
    const newTabsContainer = tabsContainer.cloneNode(true);
    tabsContainer.parentNode.replaceChild(newTabsContainer, tabsContainer);

    newTabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.painel-tab-btn');
        if (!btn || btn.classList.contains('active')) return;

        $$('.painel-tab-btn', newTabsContainer).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTab = btn.dataset.tab;
        $$(`#${owner}-escalaView > .painel-tab-content`).forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent === targetTab);
        });

        renderCurrentView(owner); // Chama renderCurrentView que chama initEditor se necessário
    });
}


// --- LÓGICA DE VALIDAÇÃO ---

function findPotentialConflicts(employeeId, turnoId, date, escala) {
    const { turnos, funcionarios } = store.getState();
    const turnosMap = Object.fromEntries([...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)].map(t => [t.id, t])); // Inclui sistêmicos
    const employee = funcionarios.find(f => f.id === employeeId);
    const newShiftTurno = turnosMap[turnoId];
    const conflitos = [];
    if (!employee || !newShiftTurno || newShiftTurno.isSystem) return []; // Não valida turnos de sistema

    const slotsSimulados = JSON.parse(JSON.stringify(escala.slots));
    const existingSlotIndex = slotsSimulados.findIndex(s => s.assigned === employeeId && s.date === date);
    if (existingSlotIndex > -1) slotsSimulados.splice(existingSlotIndex, 1);

    slotsSimulados.push({ id: 'temp', assigned: employeeId, date: date, turnoId: turnoId });

    // 1. Validação de Descanso Obrigatório
    const restViolation = checkMandatoryRestViolation(employee, newShiftTurno, date, slotsSimulados, turnosMap);
    if (restViolation.violation) {
        conflitos.push({ type: 'rest', message: restViolation.message });
    }

    // 2. Validação de Dias Consecutivos
    const maxDias = (escala.regras && escala.regras.maxDiasConsecutivos) ?? 6;
    const diasConsec = calculateFullConsecutiveWorkDays(employeeId, slotsSimulados, date, turnosMap);
    if (diasConsec > maxDias) {
        conflitos.push({ type: 'consecutive', message: `Excede o limite de ${maxDias} dias de trabalho consecutivos (${diasConsec} dias).` });
    }

    // 3. Validação de Folgas Mínimas de Fim de Semana
    const slotDate = new Date(date + 'T12:00:00');
    if (slotDate.getUTCDay() === 6 || slotDate.getUTCDay() === 0) {
        const slotMonth = date.substring(0, 7);
        const { minFolgasSabados, minFolgasDomingos } = escala.regras || { minFolgasSabados: 1, minFolgasDomingos: 1 };

        const workedWeekends = slotsSimulados.filter(s => s.assigned === employeeId && s.date.startsWith(slotMonth))
            .reduce((acc, cur) => {
                const day = new Date(cur.date + 'T12:00:00').getUTCDay();
                if (day === 6) acc.saturdays++;
                if (day === 0) acc.sundays++;
                return acc;
            }, { saturdays: 0, sundays: 0 });

        let totalSaturdays = 0;
        let totalSundays = 0;
        dateRangeInclusive(escala.inicio, escala.fim).forEach(d => {
            if (d.startsWith(slotMonth)) {
                const dayOfWeek = new Date(d + 'T12:00:00').getUTCDay();
                if (dayOfWeek === 6) totalSaturdays++;
                if (dayOfWeek === 0) totalSundays++;
            }
        });

        if (slotDate.getUTCDay() === 6 && totalSaturdays > 0 && (totalSaturdays - workedWeekends.saturdays) < minFolgasSabados) {
            conflitos.push({ type: 'weekend', message: `Viola o mínimo de ${minFolgasSabados} sábado(s) de folga no mês.` });
        }
        if (slotDate.getUTCDay() === 0 && totalSundays > 0 && (totalSundays - workedWeekends.sundays) < minFolgasDomingos) {
            conflitos.push({ type: 'weekend', message: `Viola o mínimo de ${minFolgasDomingos} domingo(s) de folga no mês.` });
        }
    }


    return conflitos; // Retorna array de objetos { type, message }
}


// --- INICIALIZAÇÃO DO EDITOR ---

function initEditor() {
    const toolbox = $("#editor-toolbox");
    if (toolbox && !toolbox.querySelector('.toolbox-layout-wrapper')) { // Previne re-render se já existir
        toolbox.innerHTML = `
            <div class="toolbox-layout-wrapper">
                <div class="toolbox-group-left">
                     <button class="toolbox-mode-btn" data-mode="employee" title="Editar por Funcionário (Pincel)">
                        <span class="toolbox-btn-icon">🎨</span>
                        <span class="toolbox-btn-text">Funcionário</span>
                    </button>
                    <button class="toolbox-mode-btn" data-mode="eraser" title="Apagar Turnos">
                        <span class="toolbox-btn-icon">🗑️</span>
                        <span class="toolbox-btn-text">Apagar</span>
                    </button>
                </div>
                <div class="toolbox-content-wrapper">
                    <div id="toolbox-dynamic-content"></div>
                </div>
                <div class="toolbox-group-right">
                    <div class="toolbox-right-subgroup">
                        <button class="toolbox-tool-btn" data-mode="conflicts" title="Conflitos e Avisos">
                            <span class="toolbox-btn-icon">🚨</span>
                        </button>
                        <button class="toolbox-tool-btn" data-mode="settings" title="Ações e Configurações">
                            <span class="toolbox-btn-icon">⚙️</span>
                        </button>
                    </div>
                    <div class="toolbox-right-subgroup">
                        <button id="toggle-dock-btn" class="toolbox-window-btn" title="Mover para o Topo">
                            <span>🔼</span>
                        </button>
                        <button id="toggle-size-btn" class="toolbox-window-btn" title="Minimizar">
                            <span>—</span>
                        </button>
                    </div>
                </div>
            </div>`;
         // Adiciona listeners aos botões fixos da toolbox AQUI, após o innerHTML
        $$(".toolbox-mode-btn, .toolbox-tool-btn", toolbox).forEach(btn => btn.onclick = () => setEditMode(btn.dataset.mode));
        const dockBtn = $('#toggle-dock-btn', toolbox);
        if (dockBtn) dockBtn.onclick = toggleDockPosition;
        const sizeBtn = $('#toggle-size-btn', toolbox);
        if (sizeBtn) sizeBtn.onclick = toggleToolboxSize;
    }


    Object.assign(editorState, {
        editMode: 'employee', selectedCell: null, focusedEmployeeId: null,
        focusedEmployeeIndex: -1, scheduleOrderedFuncs: [], selectedShiftBrush: null,
        lastHoveredDate: null, selectedCellCoords: { row: -1, col: -1 }, allConflicts: [],
        sessionOverride: false,
    });

    const fab = $("#editor-toolbox-fab");
    // Adiciona listener ao FAB aqui, garantindo que ele exista
    if (fab) fab.onclick = toggleToolboxSize;

    if (!toolbox || !fab) return;

    loadToolboxState(); // Carrega estado (minimizado, doca, regras)

    // Limpa listeners antigos do conteúdo dinâmico
    const dynamicContent = $("#toolbox-dynamic-content");
    const newDynamicContent = dynamicContent.cloneNode(false);
    dynamicContent.parentNode.replaceChild(newDynamicContent, dynamicContent);
    // Readiciona listeners ao conteúdo dinâmico clonado
    newDynamicContent.onclick = handleToolboxClick;
    newDynamicContent.onmouseover = handleToolboxMouseover;
    newDynamicContent.onmouseout = handleToolboxMouseout;
    newDynamicContent.addEventListener('change', (e) => {
        if (e.target.id === 'toolbox-employee-select') {
            handleEmployeeSelectChange(e);
        }
    });

    // Limpa listener antigo da tabela e readiciona ao elemento correto
    document.onkeydown = null; // Remove listener global
    const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
    if (tableWrap) {
        // CORREÇÃO: Remove listeners específicos do elemento antigo antes de clonar
        tableWrap.onclick = null;
        tableWrap.onmouseover = null;

        const newTableWrap = tableWrap.cloneNode(true); // Clona com conteúdo
        tableWrap.parentNode.replaceChild(newTableWrap, tableWrap);

        // Readiciona listeners ao novo elemento da tabela
        newTableWrap.onclick = handleTableClick;
        newTableWrap.onmouseover = handleTableMouseover; // Reassocia o mouseover AQUI
    }


    // Reconfigura o observer
    if (marqueeObserver) {
        marqueeObserver.disconnect();
    } else {
        marqueeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const nameEl = entry.target.querySelector('.brush-name');
                if (nameEl) {
                    const isOverflowing = nameEl.scrollWidth > nameEl.clientWidth;
                    nameEl.classList.toggle('should-marquee', isOverflowing);
                }
            }
        });
    }

    document.onkeydown = handleKeyboardNav; // Readiciona listener de teclado global

    setEditMode('employee'); // Define o modo inicial e renderiza a toolbox
    runAllValidations(); // Roda validações iniciais
    updateAllIndicators(); // CORREÇÃO: Chama para garantir que os indicadores sejam exibidos inicialmente
}

function setEditMode(mode) {
    if (editorState.editMode !== mode) {
        editorState.sessionOverride = false; // Reseta override ao trocar de modo
    }
    editorState.editMode = mode;
    clearCellFocus(); // Remove foco da célula ao trocar de modo

    // Atualiza a lista ordenada de funcionários visíveis na tabela
    const { funcionarios } = store.getState();
    const funcionariosMap = new Map(funcionarios.map(f => [f.id, f]));
    const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
    const orderedIds = $$('tr[data-employee-row-id]', tableWrap).map(row => row.dataset.employeeRowId);
    editorState.scheduleOrderedFuncs = orderedIds.map(id => funcionariosMap.get(id)).filter(Boolean);

    if (mode === 'employee') {
        // Se já havia um funcionário focado, mantém, senão foca o primeiro
        if (editorState.scheduleOrderedFuncs.length > 0) {
            const currentFocusedIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === editorState.focusedEmployeeId);
            editorState.focusedEmployeeIndex = (currentFocusedIndex !== -1) ? currentFocusedIndex : 0;
             // Garante que o índice esteja dentro dos limites válidos
            editorState.focusedEmployeeIndex = Math.max(0, Math.min(editorState.focusedEmployeeIndex, editorState.scheduleOrderedFuncs.length - 1));
            editorState.focusedEmployeeId = editorState.scheduleOrderedFuncs[editorState.focusedEmployeeIndex]?.id || null; // Usa optional chaining
        } else {
            editorState.focusedEmployeeIndex = -1;
            editorState.focusedEmployeeId = null;
        }
    } else {
        // Outros modos não focam funcionário
        editorState.focusedEmployeeId = null;
        editorState.focusedEmployeeIndex = -1;
    }

    highlightEmployeeRow(editorState.focusedEmployeeId); // Destaca a linha do funcionário focado (ou nenhuma)
    // Atualiza estado visual dos botões de modo
    $$(".toolbox-mode-btn, .toolbox-tool-btn").forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

    // Adiciona/Remove classes CSS na tabela para feedback visual do cursor
    const table = $(`#${currentEscala.owner}-escalaTabelaWrap .escala-final-table`); // Seleciona a tabela correta
    if(table) {
        table.classList.remove('employee-paint-mode', 'eraser-mode');
        if (mode === 'employee') table.classList.add('employee-paint-mode');
        if (mode === 'eraser') table.classList.add('eraser-mode');
    }
    updateToolboxView(); // Renderiza o conteúdo dinâmico da toolbox
}

function updateToolboxView() {
    const { editMode } = editorState;
    const contentEl = $("#toolbox-dynamic-content");
    if(!contentEl) return; // Sai se o container não existir
    let contentHTML = '';

    // Desconecta observer antes de limpar o HTML
    if (marqueeObserver) marqueeObserver.disconnect();

    switch(editMode) {
        case 'employee':
            contentHTML = renderFocusedEmployeeView();
            break;
        case 'eraser':
            contentHTML = '<div class="toolbox-info-text"><span>Modo Borracha Ativo:</span> Clique em um turno na grade para apagar.</div>';
            break;
        case 'conflicts':
            contentHTML = renderConflictsView();
            break;
        case 'settings':
            contentHTML = renderActionsView();
            break;
        default:
             contentHTML = '<div class="toolbox-info-text">Selecione um modo.</div>';
    }

    contentEl.innerHTML = contentHTML;

    // Reconecta o observer se estiver no modo funcionário
    if (editMode === 'employee' && marqueeObserver) {
        $$('.shift-brush').forEach(brush => {
            if (brush.querySelector('.brush-name')) { // Verifica se o elemento existe
                marqueeObserver.observe(brush);
            }
        });
        // CORREÇÃO: Chama updateAllIndicators AQUI também para garantir que ao trocar funcionário, os indicadores sejam atualizados
        updateAllIndicators();
    }


    parseEmojisInElement(contentEl); // Garante que emojis sejam renderizados
}


function renderFocusedEmployeeView() {
    const { focusedEmployeeId, scheduleOrderedFuncs, selectedShiftBrush } = editorState;
    if (!focusedEmployeeId || scheduleOrderedFuncs.length === 0) {
         return `<div class="toolbox-info-text">Nenhum funcionário selecionado ou disponível.</div>`;
    }

    const { turnos } = store.getState();
    const employee = scheduleOrderedFuncs.find(f => f.id === focusedEmployeeId);
    if (!employee) return `<div class="toolbox-info-text">Funcionário não encontrado.</div>`; // Fallback

    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosDeTrabalho = allTurnos.filter(t => !t.isSystem && employee.disponibilidade && employee.disponibilidade[t.id]);
    const turnosDeSistema = Object.values(TURNOS_SISTEMA_AUSENCIA);

    const selectOptions = scheduleOrderedFuncs.map(f => `<option value="${f.id}" ${f.id === focusedEmployeeId ? 'selected' : ''}>${f.nome}</option>`).join('');

    const selectorCard = `
        <div class="toolbox-card employee-selector-card">
            <select id="toolbox-employee-select" title="Trocar de funcionário (Q/E)">${selectOptions}</select>
        </div>`;

    const indicatorsCard = `
        <div class="toolbox-card employee-indicators-card" data-employee-id="${focusedEmployeeId}">
            <div class="workload-summary-compact">
                <span class="indicator-label">Carga:</span>
                <div class="progress-bar-container-compact">
                    <div class="progress-bar progress-bar-main"></div>
                    <div class="progress-bar progress-bar-overtime"></div>
                </div>
                <span class="workload-text-compact">0/0</span>
            </div>
            <div class="consecutive-days-container"></div>
        </div>`;

    // Renderiza os pincéis
    const systemBrushesHTML = turnosDeSistema.map(t => renderBrush(t, selectedShiftBrush)).join('');
    const normalBrushesHTML = turnosDeTrabalho.map(t => renderBrush(t, selectedShiftBrush)).join('');

    const brushesCard = `
        <div class="toolbox-card shift-brushes-card">
            ${systemBrushesHTML}
            ${systemBrushesHTML && normalBrushesHTML ? '<div class="brush-separator"></div>' : ''}
            ${normalBrushesHTML}
        </div>`;

    // CORREÇÃO: Não chama mais updateIndicatorsInCard via setTimeout aqui,
    // pois será chamado pelo updateToolboxView após o innerHTML ser aplicado.

    return `<div class="focused-employee-view">${selectorCard}${indicatorsCard}${brushesCard}</div>`;
}


function renderActionsView() {
    const isEnforced = editorState.enforceRules;
    const isOverride = editorState.sessionOverride; // Pega o estado do override
    return `
        <div class="actions-panel">
            <div class="action-row">
                <div>
                    <label class="form-label">Limpar Alocações</label>
                    <p class="explanation">Remove todos os turnos e ausências da escala deste funcionário ou de todos.</p>
                </div>
                <button class="danger danger-sm" data-action="clear-assignments-focused">Limpar Focado</button>
                <button class="danger" data-action="clear-assignments-all">Limpar Todos</button>
            </div>

            <div class="action-row action-row-card" data-action="show-shortcuts" title="Ver Atalhos de Teclado">
                <label class="form-label">⌨️<br>Atalhos</label>
            </div>

             <div class="action-row">
                <div>
                    <label class="form-label">Forçar Regras ${isOverride ? '<span class="warning-text">(Override Ativo!)</span>' : ''}</label>
                    <p class="explanation">Impede ações que violem as regras (descanso, dias consecutivos, etc.).</p>
                </div>
                <div class="toggle-group">
                    <button class="toggle-btn ${isEnforced ? 'active' : ''}" data-action="toggle-rules" data-value="on">Ligado</button>
                    <button class="toggle-btn ${!isEnforced ? 'active' : ''}" data-action="toggle-rules" data-value="off">Flexível</button>
                </div>
            </div>
        </div>
    `;
}


function renderConflictsView() {
    const conflicts = editorState.allConflicts;
    if (conflicts.length === 0) {
        return `<div class="toolbox-info-text">Nenhum conflito encontrado. Bom trabalho! ✅</div>`;
    }

    const conflictsByEmployee = conflicts.reduce((acc, conflict) => {
        if (!acc[conflict.employeeId]) {
            acc[conflict.employeeId] = {
                employeeName: conflict.employeeName,
                conflicts: []
            };
        }
        acc[conflict.employeeId].conflicts.push(conflict);
        return acc;
    }, {});

    let html = '<div class="conflicts-view-container">';
    for (const employeeId in conflictsByEmployee) {
        const data = conflictsByEmployee[employeeId];
        // Agrupa conflitos por data
        const conflictsByDate = data.conflicts.reduce((grp, c) => {
            if (!grp[c.date]) grp[c.date] = [];
            grp[c.date].push(c);
            return grp;
        }, {});

        const sortedDates = Object.keys(conflictsByDate).sort();

        html += `<div class="conflict-list-item" data-employee-id="${employeeId}">
                    <strong>${data.employeeName}:</strong>`; // Nome do funcionário
        sortedDates.forEach(date => {
            const dateConflicts = conflictsByDate[date];
            const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
            // Cria um tooltip com todas as mensagens para aquela data
            const tooltipMessages = dateConflicts.map(c => `- ${c.message}`).join('\n');
            // Mostra o ícone do PRIMEIRO conflito encontrado para aquela data
            const firstConflictType = dateConflicts[0].type;
            const icon = conflictIcons[firstConflictType] || '⚠️';

            html += `<span class="badge" style="cursor: pointer; margin: 2px;" data-date="${date}" title="${tooltipMessages}">
                        ${icon} ${formattedDate}
                     </span>`;
        });
        html += `</div>`; // Fim conflict-list-item
    }
    html += `</div>`; // Fim conflicts-view-container
    return html;
}


// --- EVENT HANDLERS ---

function handleTableClick(event) {
    const cell = event.target.closest('td');
    // Ignora cliques fora de células, na primeira coluna, ou em células não operacionais
    if (!cell || cell.matches(':first-child') || cell.classList.contains('celula-fechada') || cell.classList.contains('celula-feriado-folga')) return;

    const parentRow = cell.parentElement;
    const employeeId = parentRow.dataset.employeeRowId;
    if (!employeeId) return; // Precisa de um ID de funcionário

    // Calcula coordenadas da célula clicada
    const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
    const rowIndex = allRows.findIndex(row => row === parentRow);
    const colIndex = Array.from(parentRow.children).indexOf(cell) - 1; // -1 para desconsiderar a coluna do nome

    focusCell(rowIndex, colIndex); // Foca a célula clicada

    // Executa a ação correspondente ao modo atual
    if (editorState.editMode === 'employee') handleEmployeePaint(cell);
    else if (editorState.editMode === 'eraser') handleEraseClick(cell);

}

function handleTableMouseover(event) {
    const cell = event.target.closest('.editable-cell');
    if (cell && editorState.editMode === 'employee') { // Só atualiza dias se estiver no modo pincel
        const { date } = cell.dataset;
        if (date && date !== editorState.lastHoveredDate) {
            editorState.lastHoveredDate = date;
            // CORREÇÃO: Busca o card diretamente aqui, garantindo a referência atual
            const card = $("#toolbox-dynamic-content .employee-indicators-card");
            if (card && card.dataset.employeeId === editorState.focusedEmployeeId) { // Garante que é o card do funcionário focado
                updateConsecutiveDaysIndicator(card, date);
            }
        }
    }
}


function handleToolboxClick(event) {
    const target = event.target;
    const shiftBrush = target.closest('.shift-brush');
    const conflictItem = target.closest('.conflict-list-item');
    const actionButton = target.closest('[data-action]');
    const dateBadge = target.closest('.badge[data-date]'); // Badge de data dentro do item de conflito

    // Se clicou num badge de data dentro de um item de conflito
    if (conflictItem && dateBadge) {
        handleConflictPanelClick(event, true); // Passa true para indicar clique no badge
    }
    // Se clicou em qualquer lugar dentro de um item de conflito (mas não no badge)
    else if (conflictItem) {
        handleConflictPanelClick(event, false); // Passa false
    }

    // Se clicou num pincel de turno (e não está desabilitado)
    if (shiftBrush && !shiftBrush.hasAttribute('disabled')) {
        handleSelectShiftBrush(shiftBrush.dataset.turnoId);
    }

    // Se clicou num botão de ação (Limpar, Atalhos, Regras)
    if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === 'toggle-rules') handleToggleRules(actionButton.dataset.value);
        if (action === 'clear-assignments-all') handleClearAssignments(false); // Limpar todos
        if (action === 'clear-assignments-focused') handleClearAssignments(true); // Limpar focado
        if (action === 'show-shortcuts') exibirAtalhosDeTeclado();
    }
}


function handleToolboxMouseover(event) {
    const badge = event.target.closest('.badge[data-date]');
    const conflictItem = event.target.closest('.conflict-list-item');
    // Só ativa se o mouse estiver sobre um badge DENTRO de um item de conflito
    if (badge && conflictItem) {
        const employeeId = conflictItem.dataset.employeeId;
        const date = badge.dataset.date;
        const cell = $(`#${currentEscala.owner}-escalaTabelaWrap td[data-employee-id="${employeeId}"][data-date="${date}"]`);
        if (cell) {
            // Remove highlight de outra célula se houver
            const currentlyHighlighted = $('.cell-hover-highlight');
            if (currentlyHighlighted && currentlyHighlighted !== cell) {
                currentlyHighlighted.classList.remove('cell-hover-highlight');
            }
            cell.classList.add('cell-hover-highlight'); // Adiciona classe de destaque
        }
    }
}

function handleToolboxMouseout(event) {
    const badge = event.target.closest('.badge[data-date]');
    // Remove o highlight ao sair do badge
    if (badge) {
        const highlightedCell = $('.cell-hover-highlight');
        if (highlightedCell) {
            highlightedCell.classList.remove('cell-hover-highlight');
        }
    }
}

function handleKeyboardNav(event) {
    const focusedElement = document.activeElement;
    // Ignora atalhos se o foco estiver em inputs, selects ou textareas
    if (focusedElement && (focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'SELECT' || focusedElement.tagName === 'TEXTAREA')) {
        return;
    }

    const toolbox = $("#editor-toolbox");
    // Ignora se a toolbox estiver oculta ou minimizada
    if (!toolbox || toolbox.classList.contains('hidden') || toolboxState.isMinimized) return;

    const key = event.key;
    let { row, col } = editorState.selectedCellCoords; // Coordenadas da célula atualmente focada

    // Atalhos Q/E para trocar funcionário focado
    if (key.toLowerCase() === 'q') { event.preventDefault(); showPrevEmployee(false); return; }
    if (key.toLowerCase() === 'e') { event.preventDefault(); showNextEmployee(false); return; }

    // Atalhos numéricos (1-9) para selecionar pincel
    if (!isNaN(key) && key >= 1 && key <= 9) {
        event.preventDefault();
        const brushes = $$('#toolbox-dynamic-content .shift-brush:not([disabled])'); // Seleciona pincéis visíveis
        const index = parseInt(key, 10) - 1;
        if (brushes[index]) handleSelectShiftBrush(brushes[index].dataset.turnoId);
        return;
    }

    const focusedCell = getCellByCoords(row, col);
    if (focusedCell) {
        // Atalho Delete/Backspace para apagar turno
        if (key === 'Delete' || key === 'Backspace') { event.preventDefault(); handleEraseClick(focusedCell); }
        // Atalho Enter para pintar com pincel selecionado
        if (key === 'Enter') { event.preventDefault(); handleEmployeePaint(focusedCell); }
    }

    // Atalhos de Setas para navegar na grade
    if (key.startsWith('Arrow')) {
        event.preventDefault();
        const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
        if (allRows.length === 0) return; // Não faz nada se não houver linhas

        // Se nenhuma célula estiver focada, foca a primeira (0, 0)
        if (row === -1 || col === -1) {
             focusCell(0, 0);
             // Atualiza funcionário focado se necessário
             const firstEmployeeId = allRows[0]?.dataset.employeeRowId;
             if (firstEmployeeId && firstEmployeeId !== editorState.focusedEmployeeId) {
                const newIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === firstEmployeeId);
                 if (newIndex !== -1) {
                    editorState.focusedEmployeeIndex = newIndex;
                    updateFocusedEmployee(false);
                 }
             }
             return;
        }


        const maxRows = allRows.length - 1;
        // Calcula maxCols baseado na linha atual (pode variar se houver colspan, embora não haja aqui)
        const maxCols = (allRows[row]?.children.length - 2) ?? 0; // -2 para nome e índice 0

        // Calcula novas coordenadas
        switch (key) {
            case 'ArrowUp': row = Math.max(0, row - 1); break;
            case 'ArrowDown': row = Math.min(maxRows, row + 1); break;
            case 'ArrowLeft': col = Math.max(0, col - 1); break;
            case 'ArrowRight': col = Math.min(maxCols, col + 1); break;
        }

        // Se moveu para cima ou para baixo, atualiza o funcionário focado na toolbox
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            const newEmployeeId = allRows[row]?.dataset.employeeRowId; // Usa optional chaining
             if (newEmployeeId && newEmployeeId !== editorState.focusedEmployeeId) { // Verifica se mudou
                const newIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === newEmployeeId);
                if (newIndex !== -1) {
                    editorState.focusedEmployeeIndex = newIndex;
                    updateFocusedEmployee(false); // Atualiza toolbox sem animação
                }
             }
        }

        focusCell(row, col); // Foca a nova célula
    }
}


function handleEmployeeSelectChange(event) {
    const newEmployeeId = event.target.value;
    const newIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === newEmployeeId);

    if (newIndex !== -1 && newIndex !== editorState.focusedEmployeeIndex) {
        editorState.focusedEmployeeIndex = newIndex;
        updateFocusedEmployee(false); // Não animar na troca pelo select
        highlightEmployeeRow(newEmployeeId); // Garante que a linha correta seja destacada
    }
}


// --- LÓGICA DE EDIÇÃO (AÇÕES) ---

// Atualiza todos os indicadores (carga, dias consecutivos) para o funcionário focado
function updateAllIndicators() {
    // CORREÇÃO: Busca o card dentro da toolbox dinâmica AQUI
    const card = $("#toolbox-dynamic-content .employee-indicators-card");
     // Garante que só atualize se o card existir e pertencer ao funcionário focado
     if (card && card.dataset.employeeId === editorState.focusedEmployeeId) {
         updateIndicatorsInCard(card);
     } else if (card && !editorState.focusedEmployeeId) {
         // Se nenhum funcionário está focado (ex: modo borracha), limpa os indicadores
         updateIndicatorsInCard(card, true); // Passa true para forçar limpeza
     }
}


function updateIndicatorsInCard(card, forceClear = false) {
    const employeeId = card.dataset.employeeId;
    // CORREÇÃO: Lê o employee do store
    const employee = store.getState().funcionarios.find(f => f.id === employeeId);

    // Limpa indicadores se forceClear for true ou se não houver dados
    if (forceClear || !employee || !currentEscala || !currentEscala.historico || !currentEscala.historico[employeeId]) {
         const workloadText = $('.workload-text-compact', card);
         if (workloadText) workloadText.textContent = '-/-';
         const mainBar = $('.progress-bar-main', card);
         if (mainBar) mainBar.style.width = '0%';
         const overtimeBar = $('.progress-bar-overtime', card);
         if (overtimeBar) overtimeBar.style.width = '0%';
         const consecutiveContainer = $('.consecutive-days-container', card);
         if (consecutiveContainer) consecutiveContainer.innerHTML = '<span class="indicator-label">Dias:</span> -';
         return;
    };


    const medicao = employee.medicaoCarga || 'horas';
    let progresso, meta, unidade, mainPercentage = 0, overtimePercentage = 0;
    const historicoFunc = currentEscala.historico[employeeId];

    // Calcula Meta considerando overrides
    let metaOriginal;
    const temOverride = currentEscala.metasOverride && currentEscala.metasOverride[employeeId] !== undefined;
    if (medicao === 'turnos') {
        const { cargos } = store.getState();
        const cargo = cargos.find(c => c.id === employee.cargoId); // Usa employee do store
        const diasOp = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
        metaOriginal = calcularMetaTurnos(employee, currentEscala.inicio, currentEscala.fim, diasOp); // Usa employee do store
        meta = temOverride ? parseFloat(currentEscala.metasOverride[employeeId]) : metaOriginal;
        progresso = historicoFunc.turnosTrabalhados || 0;
        unidade = ' turnos';
        mainPercentage = meta > 0 ? (progresso / meta) * 100 : (progresso > 0 ? 1000 : 0);
    } else { // Horas
        metaOriginal = calcularMetaHoras(employee, currentEscala.inicio, currentEscala.fim); // Usa employee do store
        meta = temOverride ? parseFloat(currentEscala.metasOverride[employeeId]) : metaOriginal;
        progresso = (historicoFunc.horasTrabalhadas / 60) || 0;
        unidade = 'h';
        mainPercentage = meta > 0 ? (progresso / meta) * 100 : (progresso > 0 ? 1000 : 0);
    }

    if (mainPercentage > 100) { overtimePercentage = mainPercentage - 100; mainPercentage = 100; }

    let barColorClass = 'progress-bar-red';
    if (mainPercentage >= 100) barColorClass = 'progress-bar-green';
    else if (mainPercentage >= 80) barColorClass = 'progress-bar-blue';
    else if (mainPercentage >= 40) barColorClass = 'progress-bar-yellow';

    const workloadText = $('.workload-text-compact', card);
    const metaStr = medicao === 'turnos' ? meta.toFixed(0) : meta.toFixed(1);
    const progStr = medicao === 'turnos' ? progresso.toFixed(0) : progresso.toFixed(1);
    if (workloadText) { workloadText.textContent = `${progStr}/${metaStr}${unidade}`; }

    const mainBar = $('.progress-bar-main', card);
    if (mainBar) { mainBar.className = `progress-bar progress-bar-main ${barColorClass}`; mainBar.style.width = `${Math.min(100, mainPercentage).toFixed(2)}%`; } // Garante que não passe de 100%

    const overtimeBar = $('.progress-bar-overtime', card);
    if (overtimeBar) { overtimeBar.style.width = `${overtimePercentage.toFixed(2)}%`; }

    // Atualiza dias consecutivos usando a data do último hover ou fim da escala
    const targetDate = editorState.lastHoveredDate && editorState.lastHoveredDate >= currentEscala.inicio && editorState.lastHoveredDate <= currentEscala.fim
        ? editorState.lastHoveredDate
        : currentEscala.fim; // Usa fim da escala como padrão
    updateConsecutiveDaysIndicator(card, targetDate);
}


function updateConsecutiveDaysIndicator(card, targetDate) {
    const employeeId = card.dataset.employeeId;
    // CORREÇÃO: Busca o container DENTRO do card fornecido
    const container = $('.consecutive-days-container', card);
    if (employeeId && container && currentEscala) { // Verifica se currentEscala existe
        const { turnos } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
        const turnosMap = Object.fromEntries(allTurnos.map(t => [t.id, t]));

        // Simula adição do pincel selecionado na data alvo, se aplicável
        const slotsSimulados = [...currentEscala.slots];
        if (editorState.selectedShiftBrush && !slotsSimulados.some(s => s.assigned === employeeId && s.date === targetDate)) {
            const turnoSelecionado = allTurnos.find(t => t.id === editorState.selectedShiftBrush);
            if(turnoSelecionado && !turnoSelecionado.isSystem) {
                 // Verifica se o funcionário está disponível para este turno/dia antes de simular
                 const employee = store.getState().funcionarios.find(f => f.id === employeeId);
                 const slotDate = new Date(targetDate + 'T12:00:00');
                 const slotDiaSemanaId = DIAS_SEMANA[slotDate.getUTCDay()].id;
                 if (employee?.disponibilidade?.[turnoSelecionado.id]?.includes(slotDiaSemanaId)) {
                    slotsSimulados.push({ assigned: employeeId, date: targetDate, turnoId: editorState.selectedShiftBrush });
                 }
            }
        }

        const diasConsecutivos = calculateFullConsecutiveWorkDays(employeeId, slotsSimulados, targetDate, turnosMap);
        const maxDias = (currentEscala.regras && currentEscala.regras.maxDiasConsecutivos) ?? 6;

        let dotsHTML = '';
        for (let i = 1; i <= maxDias; i++) {
            const isFilled = i <= diasConsecutivos;
            let dotClass = '';
            if (isFilled) {
                if (diasConsecutivos > maxDias) {
                    dotClass = 'filled limit'; // Excedeu o limite
                } else if (i === maxDias && diasConsecutivos === maxDias) {
                    dotClass = 'filled completed'; // Atingiu o limite exato
                } else {
                    dotClass = 'filled'; // Dentro do limite
                }
            }
            // Tooltip mostra dias atuais vs limite
            dotsHTML += `<div class="day-dot ${dotClass}" title="${diasConsecutivos} / ${maxDias} dias"></div>`;
        }

        const isOverLimit = diasConsecutivos > maxDias;
        // Adiciona um alerta visual (!) se exceder o limite
        container.innerHTML = `<span class="indicator-label">Dias:</span> ${dotsHTML} ${isOverLimit ? '<span class="limit-alert" title="Limite de dias consecutivos excedido!">⚠️</span>' : ''}`;
        parseEmojisInElement(container); // Garante que o emoji seja renderizado
    }
}


async function handleAddShiftClick(employeeId, turnoId, date) {
    const conflitos = findPotentialConflicts(employeeId, turnoId, date, currentEscala);

    // 1. Verifica se as regras estão forçadas E se há conflitos
    if (editorState.enforceRules && conflitos.length > 0) {
        const primeiroConflito = conflitos[0]; // Pega o primeiro conflito encontrado
        const icon = conflictIcons[primeiroConflito.type] || '⚠️';
        // Mostra toast específico do conflito que bloqueou
        showToast(`${icon} Ação bloqueada: ${primeiroConflito.message}`, 'error');
        return; // Bloqueia a ação
    }

    // 2. Se as regras não estão forçadas OU não há conflitos, mas há conflitos e o override não está ativo
    if (conflitos.length > 0 && !editorState.sessionOverride && !editorState.enforceRules) {
        const conflitosFormatados = conflitos.map(c => `- ${conflictIcons[c.type] || '⚠️'} ${c.message}`).join('<br>');
        const result = await showConfirm({
            title: "Confirmar Ação com Conflito?",
            message: `Atenção: Esta alocação viola a(s) seguinte(s) regra(s): <br>${conflitosFormatados}<br><br> Deseja continuar mesmo assim (modo Flexível)?`,
            confirmText: "Sim, Continuar",
            checkbox: { label: "Permitir todos os próximos conflitos nesta sessão" }
        });

        if (!result.confirmed) return; // Cancela se o usuário não confirmar
        if (result.checkboxChecked) {
            editorState.sessionOverride = true; // Ativa o override para a sessão
            showToast("Modo de substituição de regras ativado para esta sessão.");
        }
    }

    // 3. Procede com a adição/modificação do turno
    const { turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turno = allTurnos.find(t => t.id === turnoId);
    if (!turno) return; // Turno inválido

    // Garante que o histórico exista
    if (!currentEscala.historico[employeeId]) {
        currentEscala.historico[employeeId] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
    }

    const cargaReal = !turno.isSystem ? calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca) : 0;
    const existingSlotIndex = currentEscala.slots.findIndex(s => s.date === date && s.assigned === employeeId);

    // Se já existe um slot para este funcionário neste dia, remove o antigo antes de adicionar o novo
    if (existingSlotIndex > -1) {
        const slotAntigo = currentEscala.slots[existingSlotIndex];
        const turnoAntigo = allTurnos.find(t => t.id === slotAntigo.turnoId);
        // Desconta do histórico apenas se o turno antigo era de trabalho
        if (turnoAntigo && !turnoAntigo.isSystem) {
            const cargaAntiga = calcCarga(turnoAntigo.inicio, turnoAntigo.fim, turnoAntigo.almocoMin, turnoAntigo.diasDeDiferenca);
            currentEscala.historico[employeeId].horasTrabalhadas = Math.max(0, currentEscala.historico[employeeId].horasTrabalhadas - cargaAntiga);
            currentEscala.historico[employeeId].turnosTrabalhados = Math.max(0, currentEscala.historico[employeeId].turnosTrabalhados - 1);
        }
        currentEscala.slots.splice(existingSlotIndex, 1); // Remove o slot antigo
    }

    // Adiciona o novo slot
    const novoSlot = { date, turnoId, assigned: employeeId, id: uid(), isExtra: false }; // isExtra será recalculado depois se necessário
    currentEscala.slots.push(novoSlot);

    // Adiciona ao histórico apenas se for um turno de trabalho
    if (!turno.isSystem) {
        currentEscala.historico[employeeId].horasTrabalhadas += cargaReal;
        currentEscala.historico[employeeId].turnosTrabalhados += 1;
    }

    // Recalcula se o turno é extra APÓS atualizar o histórico
    const funcionario = store.getState().funcionarios.find(f => f.id === employeeId); // Pega dados do funcionário
    if (funcionario) { // Verifica se funcionário existe
        const medicao = funcionario.medicaoCarga || 'horas';
        let meta;
        const temOverride = currentEscala.metasOverride && currentEscala.metasOverride[employeeId] !== undefined;

        if (medicao === 'turnos') {
            const { cargos } = store.getState();
            const cargo = cargos.find(c => c.id === currentEscala.cargoId);
            const diasOp = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
            const metaOriginal = calcularMetaTurnos(funcionario, currentEscala.inicio, currentEscala.fim, diasOp);
            meta = temOverride ? parseFloat(currentEscala.metasOverride[employeeId]) : metaOriginal;
            novoSlot.isExtra = currentEscala.historico[employeeId].turnosTrabalhados > meta;
        } else {
            const metaOriginal = calcularMetaHoras(funcionario, currentEscala.inicio, currentEscala.fim);
            meta = temOverride ? parseFloat(currentEscala.metasOverride[employeeId]) : metaOriginal;
            novoSlot.isExtra = (currentEscala.historico[employeeId].horasTrabalhadas / 60) > meta;
        }
    }


    setGeradorFormDirty(true); // Marca que houve alterações
    updateTableAfterEdit(currentEscala); // Atualiza a tabela e o painel
    // CORREÇÃO: updateAllIndicators é chamado por updateTableAfterEdit, removido daqui
    runSurgicalValidation([employeeId]); // Revalida apenas o funcionário modificado
    highlightEmployeeRow(employeeId); // Garante que a linha continue destacada
}


function handleRemoveShiftClick(slotId) {
    const slotIndex = currentEscala.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return; // Slot não encontrado

    const slot = currentEscala.slots[slotIndex];
    if (!slot.assigned) return; // Slot já está vazio

    const { turnos, funcionarios, cargos } = store.getState(); // Adiciona funcionarios e cargos
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turno = allTurnos.find(t => t.id === slot.turnoId);
    const employeeId = slot.assigned;
    const funcionario = funcionarios.find(f => f.id === employeeId); // Pega dados do funcionário

    // Desconta do histórico apenas se for um turno de trabalho
    if (turno && !turno.isSystem && currentEscala.historico[employeeId]) {
        const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
        currentEscala.historico[employeeId].horasTrabalhadas = Math.max(0, currentEscala.historico[employeeId].horasTrabalhadas - cargaReal);
        currentEscala.historico[employeeId].turnosTrabalhados = Math.max(0, currentEscala.historico[employeeId].turnosTrabalhados - 1);
    }

    // Verifica se o slot foi originalmente criado para cobertura mínima ou por equipe
    const isSlotMandatorioOriginal = slot.isMandatory || slot.equipeId;

    // Se for mandatório ou de equipe, apenas limpa a atribuição
    if (isSlotMandatorioOriginal) {
        slot.assigned = null;
        delete slot.equipeId; // Remove marcação de equipe se houver
        delete slot.isExtra; // Remove marcação de extra se houver
    } else {
        // Se NÃO for mandatório (foi adicionado na Fase 2 ou era uma ausência), remove o slot completamente
        currentEscala.slots.splice(slotIndex, 1);
    }

    // --- CORREÇÃO: Recalcular isExtra para os turnos restantes ---
    if (funcionario) { // Só recalcula se o funcionário existe
        const medicao = funcionario.medicaoCarga || 'horas';
        let meta;
        const temOverride = currentEscala.metasOverride && currentEscala.metasOverride[employeeId] !== undefined;

        // Calcula a meta (igual à lógica de adicionar)
        if (medicao === 'turnos') {
            const cargo = cargos.find(c => c.id === currentEscala.cargoId);
            const diasOp = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
            const metaOriginal = calcularMetaTurnos(funcionario, currentEscala.inicio, currentEscala.fim, diasOp);
            meta = temOverride ? parseFloat(currentEscala.metasOverride[employeeId]) : metaOriginal;
        } else {
            const metaOriginal = calcularMetaHoras(funcionario, currentEscala.inicio, currentEscala.fim);
            meta = temOverride ? parseFloat(currentEscala.metasOverride[employeeId]) : metaOriginal;
        }

        // Itera pelos slots restantes do funcionário e atualiza isExtra
        let currentTotalHoras = 0;
        let currentTotalTurnos = 0;
        // Ordena por data para recalcular corretamente com base no acumulado
        const slotsDoFuncRestantes = currentEscala.slots
            .filter(s => s.assigned === employeeId)
            .sort((a,b) => a.date.localeCompare(b.date));

        slotsDoFuncRestantes.forEach(s => {
            const tInfo = allTurnos.find(t => t.id === s.turnoId);
            if(tInfo && !tInfo.isSystem) { // Só considera turnos de trabalho
                if(medicao === 'turnos') {
                    currentTotalTurnos++; // Acumula turnos ANTES de verificar
                    s.isExtra = currentTotalTurnos > meta;
                } else {
                    const cargaTurno = calcCarga(tInfo.inicio, tInfo.fim, tInfo.almocoMin, tInfo.diasDeDiferenca);
                    currentTotalHoras += cargaTurno; // Acumula horas ANTES de verificar
                    s.isExtra = (currentTotalHoras / 60) > meta;
                }
            } else {
                delete s.isExtra; // Remove flag de turnos de sistema
            }
        });
    }
    // --- FIM DA CORREÇÃO ---


    setGeradorFormDirty(true); // Marca alterações
    updateTableAfterEdit(currentEscala); // Atualiza UI
    // CORREÇÃO: updateAllIndicators é chamado por updateTableAfterEdit, removido daqui
    runSurgicalValidation([employeeId]); // Revalida funcionário
    highlightEmployeeRow(employeeId); // Mantém destaque
}


function handleEmployeePaint(cell) {
    const { date, employeeId, turnoId: cellTurnoId, slotId } = cell.dataset;

    // Verifica se o clique foi na linha do funcionário focado
    if (employeeId !== editorState.focusedEmployeeId) {
        showToast("Você só pode pintar turnos na linha do funcionário atualmente focado.");
        return;
    }
    // Verifica se um pincel foi selecionado
    if (!editorState.selectedShiftBrush) {
        showToast("Selecione um turno na Barra de Ferramentas para pintar.");
        return;
    }

    // Se a célula já tem o turno do pincel, remove (ação de toggle)
    if (cellTurnoId === editorState.selectedShiftBrush) {
        handleRemoveShiftClick(slotId);
    } else {
        // Senão, adiciona/substitui pelo turno do pincel
        handleAddShiftClick(editorState.focusedEmployeeId, editorState.selectedShiftBrush, date);
    }
}


async function handleEraseClick(cell) {
    const { slotId } = cell.dataset;
    if (slotId) {
        handleRemoveShiftClick(slotId); // Chama a função de remoção
    }
}

async function handleClearAssignments(onlyFocused = false) {
    let title = "Limpar Todas as Alocações?";
    let message = "Esta ação removerá todos os turnos e ausências da escala atual para TODOS os funcionários. Deseja continuar?";
    let targetEmployees = Object.keys(currentEscala?.historico || {}); // Adiciona verificação para currentEscala

    if (onlyFocused && editorState.focusedEmployeeId) {
        const focusedName = editorState.scheduleOrderedFuncs.find(f => f.id === editorState.focusedEmployeeId)?.nome || "Funcionário Focado";
        title = `Limpar Alocações de ${focusedName}?`;
        message = `Esta ação removerá todos os turnos e ausências apenas de <strong>${focusedName}</strong> na escala atual. Deseja continuar?`;
        targetEmployees = [editorState.focusedEmployeeId];
    } else if (onlyFocused && !editorState.focusedEmployeeId) {
        showToast("Nenhum funcionário focado para limpar.");
        return;
    }

    const { confirmed } = await showConfirm({
        title: title,
        message: message,
        confirmText: "Sim, Limpar"
    });

    if (confirmed && currentEscala && targetEmployees.length > 0) { // Verifica currentEscala novamente
        // Filtra os slots mantendo apenas os que NÃO pertencem aos funcionários alvo
        // E também preserva slots mandatórios/de equipe que ficaram vagos
        currentEscala.slots = currentEscala.slots.filter(slot => {
             if (targetEmployees.includes(slot.assigned)) {
                 // Se o slot pertence ao func alvo E é mandatório/equipe, limpa assign
                 if (slot.isMandatory || slot.equipeId) {
                     slot.assigned = null;
                     delete slot.equipeId;
                     delete slot.isExtra;
                     return true; // Mantém o slot vago
                 } else {
                     return false; // Remove slot opcional/ausência
                 }
             }
             return true; // Mantém slots de outros funcionários
        });


        // Zera o histórico dos funcionários alvo
        targetEmployees.forEach(empId => {
            if (currentEscala.historico[empId]) {
                currentEscala.historico[empId] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
            }
        });

        setGeradorFormDirty(true); // Marca alterações
        updateTableAfterEdit(currentEscala); // Atualiza UI
        // CORREÇÃO: updateAllIndicators é chamado por updateTableAfterEdit, removido daqui
        runSurgicalValidation(targetEmployees); // Revalida os funcionários afetados
        showToast(`Alocações removidas ${onlyFocused ? 'do funcionário focado' : 'de todos os funcionários'}.`);
    }
}


// --- NAVEGAÇÃO E FOCO ---

function showNextEmployee(animate = true) {
    if (!editorState.scheduleOrderedFuncs || editorState.scheduleOrderedFuncs.length === 0) return;
    editorState.focusedEmployeeIndex = (editorState.focusedEmployeeIndex + 1) % editorState.scheduleOrderedFuncs.length;
    editorState.animationDirection = 'right';
    updateFocusedEmployee(animate);
}

function showPrevEmployee(animate = true) {
    if (!editorState.scheduleOrderedFuncs || editorState.scheduleOrderedFuncs.length === 0) return;
    editorState.focusedEmployeeIndex = (editorState.focusedEmployeeIndex - 1 + editorState.scheduleOrderedFuncs.length) % editorState.scheduleOrderedFuncs.length;
    editorState.animationDirection = 'left';
    updateFocusedEmployee(animate);
}


function updateFocusedEmployee(animate = false) {
    // Garante que scheduleOrderedFuncs existe e tem itens
    if (!editorState.scheduleOrderedFuncs || editorState.scheduleOrderedFuncs.length === 0) {
        editorState.focusedEmployeeId = null;
        editorState.focusedEmployeeIndex = -1;
        highlightEmployeeRow(null);
        updateToolboxView(); // Renderiza a toolbox vazia ou com mensagem
        return;
    }
     // Garante que o índice esteja dentro dos limites
     editorState.focusedEmployeeIndex = Math.max(0, Math.min(editorState.focusedEmployeeIndex, editorState.scheduleOrderedFuncs.length - 1));

    editorState.focusedEmployeeId = editorState.scheduleOrderedFuncs[editorState.focusedEmployeeIndex]?.id || null; // Usa optional chaining
    highlightEmployeeRow(editorState.focusedEmployeeId); // Destaca a linha

    const contentEl = $("#toolbox-dynamic-content");
    const currentView = $(".focused-employee-view", contentEl);

    // Anima a troca do card de funcionário se solicitado e a view existir
    if (animate && currentView) {
        const outClass = editorState.animationDirection === 'right' ? 'card-slide-out-left' : 'card-slide-out-right';
        currentView.classList.add(outClass);
        // Atualiza a toolbox DEPOIS que a animação de saída terminar
        setTimeout(() => {
             updateToolboxView();
             // Foca o select após a atualização, se ele existir
            const select = $('#toolbox-employee-select');
            if (select) select.focus({ preventScroll: true }); // Evita scroll ao focar
        }, 200); // Tempo da animação CSS
    } else {
        updateToolboxView(); // Atualiza imediatamente sem animar
        // Foca o select após a atualização, se ele existir
        const select = $('#toolbox-employee-select');
        if (select) select.focus({ preventScroll: true }); // Evita scroll ao focar
    }
}


function handleToggleRules(value) {
    editorState.enforceRules = value === 'on';
    if (editorState.enforceRules) {
        editorState.sessionOverride = false; // Desativa override ao voltar para modo estrito
    }
    const toolbox = $("#editor-toolbox");
    if(toolbox) toolbox.classList.toggle('override-active', !editorState.enforceRules || editorState.sessionOverride); // Atualiza visual do override
    showToast(editorState.enforceRules ? "Modo de regras estritas ATIVADO." : "Modo flexível ATIVADO.");
    saveToolboxState(); // Salva a preferência
    updateToolboxView(); // Re-renderiza a toolbox para mostrar/esconder aviso de override
}

function getCellByCoords(row, col) {
     if (row < 0 || col < 0) return null;
     const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
     const targetRow = allRows[row];
     if (!targetRow) return null;
     // Retorna a célula na coluna correta (col + 1 por causa da coluna do nome)
     return targetRow.children[col + 1] || null; // Adiciona fallback null
}

function focusCell(row, col) {
    clearCellFocus(); // Limpa foco anterior
    const cell = getCellByCoords(row, col);
    // Só foca células editáveis (não fechadas/feriado)
    if (cell && !cell.classList.contains('celula-fechada') && !cell.classList.contains('celula-feriado-folga')) {
        cell.classList.add('cell-focused'); // Adiciona classe de foco visual
        // Rola a célula para a vista, se necessário
        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        editorState.selectedCellCoords = { row, col }; // Atualiza coordenadas focadas
        cell.focus({ preventScroll: true }); // Define o foco do navegador na célula (sem rolar de novo)

        // Atualiza indicador de dias consecutivos para a data da célula focada
        const card = $("#toolbox-dynamic-content .employee-indicators-card"); // Busca dentro da toolbox
        if (card && cell.dataset.date) {
             editorState.lastHoveredDate = cell.dataset.date; // Atualiza lastHoveredDate
             updateConsecutiveDaysIndicator(card, cell.dataset.date);
        }

    } else {
         // Se a célula não é focável, mantém as coordenadas antigas ou reseta
         // Isso evita perder a posição ao navegar para uma célula não editável
         // editorState.selectedCellCoords = { row: -1, col: -1 }; // Decide se quer resetar ou manter a última válida
         // Tentar focar a próxima/anterior célula válida pode ser uma opção mais avançada
    }
}


function clearCellFocus() {
    const focused = $('.cell-focused');
    if (focused) focused.classList.remove('cell-focused'); // Remove classe visual
}


function handleSelectShiftBrush(turnoId) {
    // Se clicar no pincel já selecionado, deseleciona. Senão, seleciona o novo.
    editorState.selectedShiftBrush = (editorState.selectedShiftBrush === turnoId) ? null : turnoId;
    updateToolboxView(); // Re-renderiza a toolbox para atualizar o visual dos pincéis
}

function highlightEmployeeRow(employeeId) {
    if (!currentEscala || !currentEscala.owner) return;
    const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
    if (!tableWrap) return;

    // Remove destaque de todas as linhas primeiro
    $$('tbody tr', tableWrap).forEach(row => {
        row.classList.remove('employee-row-highlight');
    });
    // Adiciona destaque à linha do funcionário selecionado, se houver
    if (employeeId) {
        const row = $(`tr[data-employee-row-id="${employeeId}"]`, tableWrap);
        if (row) {
            row.classList.add('employee-row-highlight');
             // Opcional: Rola a linha destacada para a vista se ela não estiver visível
             // row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// --- LÓGICA DE VALIDAÇÃO (EXECUTADA APÓS EDIÇÕES) ---

// Revalida apenas os funcionários especificados
function runSurgicalValidation(employeeIdsToUpdate) {
    const { funcionarios } = store.getState();
    // Mantém conflitos de funcionários não afetados
    const existingConflicts = editorState.allConflicts.filter(c => !employeeIdsToUpdate.includes(c.employeeId));
    let newConflicts = []; // Armazena novos conflitos encontrados

    // Limpa marcadores visuais APENAS dos funcionários sendo revalidados
    employeeIdsToUpdate.forEach(funcId => {
        $$(`#${currentEscala.owner}-escalaTabelaWrap .editable-cell[data-employee-id="${funcId}"]`).forEach(cell => {
            cell.classList.remove('has-conflict');
            const marker = $('.conflict-marker', cell);
            if (marker) marker.remove();
            const tooltip = $('.conflict-marker-tooltip', cell);
            if (tooltip) tooltip.remove();
        });
    });

    // Revalida cada funcionário
    employeeIdsToUpdate.forEach(funcId => {
        const conflitosDoFunc = validateEmployeeSchedule(funcId, currentEscala); // Encontra conflitos
        conflitosDoFunc.forEach(conflito => {
            const func = funcionarios.find(f => f.id === funcId);
            // Adiciona informações extras ao objeto de conflito
            newConflicts.push({ ...conflito, employeeName: func?.nome || 'Desconhecido' });
        });
    });

    // Atualiza a lista global de conflitos
    editorState.allConflicts = [...existingConflicts, ...newConflicts].sort((a, b) => a.date.localeCompare(b.date));

    // Adiciona marcador visual e tooltip detalhado
    editorState.allConflicts.forEach(conflito => {
        const cell = $(`#${currentEscala.owner}-escalaTabelaWrap td[data-employee-id="${conflito.employeeId}"][data-date="${conflito.date}"]`);
        if (cell) {
            cell.classList.add('has-conflict'); // Marca a célula visualmente

            let marker = $('.conflict-marker', cell);
            let tooltip = $('.conflict-marker-tooltip', cell);

            // Se não houver marcador/tooltip, cria novos
            if (!marker) {
                marker = document.createElement('div'); marker.className = 'conflict-marker';
                tooltip = document.createElement('div'); tooltip.className = 'conflict-marker-tooltip';
                cell.appendChild(marker); cell.appendChild(tooltip);
                tooltip.textContent = `${conflictIcons[conflito.type] || '⚠️'} ${conflito.message}`; // Adiciona ícone e mensagem inicial
            } else {
                // Se já existe tooltip, verifica se a mensagem já está lá para evitar duplicação
                 const fullMessage = `${conflictIcons[conflito.type] || '⚠️'} ${conflito.message}`;
                if (!tooltip.textContent.includes(conflito.message)) { // Verifica pela mensagem base
                     tooltip.textContent += `\n${fullMessage}`; // Adiciona nova mensagem com ícone
                }
            }
             parseEmojisInElement(tooltip); // Garante renderização do emoji
        }
    });

    updateConflictTabBadge(); // Atualiza o número no badge da aba de conflitos
    // Se a aba de conflitos estiver ativa, re-renderiza seu conteúdo
    if (editorState.editMode === 'conflicts') updateToolboxView();
}


// Valida todos os funcionários presentes na escala
function runAllValidations() {
    const funcsDaEscalaIds = Object.keys(currentEscala?.historico || {}); // Pega IDs do histórico
    runSurgicalValidation(funcsDaEscalaIds); // Chama a validação cirúrgica para todos
}


function updateConflictTabBadge() {
    const conflictBtn = $('.toolbox-tool-btn[data-mode="conflicts"]');
    if (!conflictBtn) return;

    // Remove badge antigo se existir
    let badge = $('.conflict-count-badge', conflictBtn);
    if (badge) badge.remove();

    const count = editorState.allConflicts.length;
    // Adiciona novo badge apenas se houver conflitos
    if (count > 0) {
        badge = document.createElement('span');
        badge.className = 'conflict-count-badge';
        badge.textContent = count > 9 ? '9+' : count.toString(); // Limita a exibição
        badge.title = `${count} conflito(s) encontrado(s)`; // Tooltip com número exato
        conflictBtn.appendChild(badge);
    }
}


function handleConflictPanelClick(event, isDateBadge) {
    const item = event.target.closest('.conflict-list-item');
    if (!item) return;

    const { employeeId } = item.dataset;
    let date = null;

    // Se clicou diretamente no badge de data
    if (isDateBadge) {
        const badge = event.target.closest('.badge[data-date]');
        if (badge) date = badge.dataset.date;
    }

    // Se uma data foi identificada (pelo badge), foca a célula específica
    if (date) {
        const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
        const rowIndex = allRows.findIndex(row => row.dataset.employeeRowId === employeeId);
        const cell = $(`#${currentEscala.owner}-escalaTabelaWrap td[data-employee-id="${employeeId}"][data-date="${date}"]`);

        if (cell && rowIndex !== -1) {
            const colIndex = Array.from(allRows[rowIndex].children).indexOf(cell) - 1;
            focusCell(rowIndex, colIndex); // Foca a célula do conflito
            // Animação de destaque
            cell.classList.remove('cell-highlight-animation');
            void cell.offsetWidth; // Força reflow
            cell.classList.add('cell-highlight-animation');
        }
    }
    // Se clicou no item mas não numa data específica, apenas foca a linha do funcionário
    else {
        const row = $(`#${currentEscala.owner}-escalaTabelaWrap tr[data-employee-row-id="${employeeId}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
            if (!row.classList.contains('employee-row-highlight')) {
                 // Atualiza funcionário focado se não for o atual
                const newIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === employeeId);
                if (newIndex !== -1 && newIndex !== editorState.focusedEmployeeIndex) {
                    editorState.focusedEmployeeIndex = newIndex;
                    updateFocusedEmployee(false); // Atualiza toolbox sem animação
                } else {
                    highlightEmployeeRow(employeeId); // Apenas destaca se já for o focado
                }
            }
        }
    }
}


// Valida todas as regras para um funcionário específico
function validateEmployeeSchedule(employeeId, escala) {
    const { turnos, funcionarios } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMap = Object.fromEntries(allTurnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    if (!employee) return []; // Retorna vazio se funcionário não existe

    const maxDias = (escala.regras && escala.regras.maxDiasConsecutivos) ?? 6;
    const { minFolgasSabados, minFolgasDomingos } = escala.regras || { minFolgasSabados: 1, minFolgasDomingos: 1 };

    const conflitos = []; // Armazena os conflitos encontrados

    // Filtra e ordena os turnos do funcionário na escala
    const turnosDoFunc = escala.slots
        .filter(s => s.assigned === employeeId)
        .sort((a, b) => a.date.localeCompare(b.date));

    // Mapa para contagem de FDS trabalhados por mês
    const fdsTrabalhadosPorMes = {}; // { 'YYYY-MM': { saturdays: N, sundays: N } }
    // Mapa para total de FDS no mês (dentro do período da escala)
    const totalFdsPorMes = {}; // { 'YYYY-MM': { totalSaturdays: N, totalSundays: N } }

     // Pré-calcula totais de FDS nos meses da escala
     dateRangeInclusive(escala.inicio, escala.fim).forEach(date => {
        const month = date.substring(0, 7);
        if (!totalFdsPorMes[month]) {
            totalFdsPorMes[month] = { totalSaturdays: 0, totalSundays: 0 };
        }
        const dayOfWeek = new Date(date + 'T12:00:00').getUTCDay();
        if (dayOfWeek === 6) totalFdsPorMes[month].totalSaturdays++;
        if (dayOfWeek === 0) totalFdsPorMes[month].totalSundays++;
     });


    // Itera por cada turno alocado ao funcionário
    for (let i = 0; i < turnosDoFunc.length; i++) {
        const turnoAtual = turnosDoFunc[i];
        const turnoAtualInfo = turnosMap[turnoAtual.turnoId];

        // Ignora turnos de sistema (folga, férias, etc.) para validações de trabalho
        if (!turnoAtualInfo || turnoAtualInfo.isSystem) continue;

        // --- Validação 1: Descanso Obrigatório ---
        const restValidation = checkMandatoryRestViolation(employee, turnoAtualInfo, turnoAtual.date, escala.slots, turnosMap);
        if (restValidation.violation) {
            // Evita adicionar mensagens duplicadas para o mesmo dia
            if (!conflitos.some(c => c.date === turnoAtual.date && c.type === 'rest')) {
                conflitos.push({ employeeId, date: turnoAtual.date, type: 'rest', message: restValidation.message });
            }
        }

        // --- Validação 2: Dias Consecutivos ---
        const dias = calculateFullConsecutiveWorkDays(employeeId, escala.slots, turnoAtual.date, turnosMap);
        if (dias > maxDias) {
            const msg = `Excede ${maxDias} dias consecutivos (${dias} dias).`;
             // Evita adicionar mensagens duplicadas para o mesmo dia
            if (!conflitos.some(c => c.date === turnoAtual.date && c.type === 'consecutive')) {
                conflitos.push({ employeeId, date: turnoAtual.date, type: 'consecutive', message: msg });
            }
        }

         // --- Contagem para Validação 3: Folgas Mínimas de Fim de Semana (contagem por mês) ---
         const slotDate = new Date(turnoAtual.date + 'T12:00:00');
         const dayOfWeek = slotDate.getUTCDay();
         const month = turnoAtual.date.substring(0, 7);

         if (dayOfWeek === 6 || dayOfWeek === 0) { // Se for Sábado ou Domingo
            if (!fdsTrabalhadosPorMes[month]) fdsTrabalhadosPorMes[month] = { saturdays: 0, sundays: 0 };
            if (dayOfWeek === 6) fdsTrabalhadosPorMes[month].saturdays++;
            if (dayOfWeek === 0) fdsTrabalhadosPorMes[month].sundays++;
         }
    }

     // --- Validação 3: Verifica a regra de FDS após contar todos os turnos do mês ---
     for (const month in fdsTrabalhadosPorMes) {
        const trabalhados = fdsTrabalhadosPorMes[month];
        const totais = totalFdsPorMes[month];
        const monthName = new Date(month+'-02T12:00:00').toLocaleString('default', { month: 'long' }); // Nome do mês para a mensagem

        // Verifica Sábados
        if (totais.totalSaturdays > 0 && (totais.totalSaturdays - trabalhados.saturdays) < minFolgasSabados) {
             // Encontra o primeiro sábado trabalhado no mês para anexar o erro
             const firstSatWorked = turnosDoFunc.find(t => t.date.startsWith(month) && new Date(t.date + 'T12:00:00').getUTCDay() === 6);
             if (firstSatWorked && !conflitos.some(c => c.date === firstSatWorked.date && c.type === 'weekend' && c.message.includes('sábado'))) { // Evita duplicar erro de sábado
                 conflitos.push({ employeeId, date: firstSatWorked.date, type: 'weekend', message: `Viola o mínimo de ${minFolgasSabados} sábado(s) de folga em ${monthName}.` });
             }
        }
        // Verifica Domingos
        if (totais.totalSundays > 0 && (totais.totalSundays - trabalhados.sundays) < minFolgasDomingos) {
             // Encontra o primeiro domingo trabalhado no mês para anexar o erro
             const firstSunWorked = turnosDoFunc.find(t => t.date.startsWith(month) && new Date(t.date + 'T12:00:00').getUTCDay() === 0);
             if (firstSunWorked && !conflitos.some(c => c.date === firstSunWorked.date && c.type === 'weekend' && c.message.includes('domingo'))) { // Evita duplicar erro de domingo
                 conflitos.push({ employeeId, date: firstSunWorked.date, type: 'weekend', message: `Viola o mínimo de ${minFolgasDomingos} domingo(s) de folga em ${monthName}.` });
             }
        }
     }


    return conflitos; // Retorna a lista de conflitos encontrados para este funcionário
}