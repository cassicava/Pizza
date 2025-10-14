/**************************************************************
 * 🛠️ Lógica do Editor Manual (v5.8 - Correção de Drag&Drop e 'isExtra')
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
    allConflicts: [],
};

const toolboxState = {
    isMinimized: false,
    dockPosition: 'bottom', // 'top' or 'bottom'
};

let marqueeObserver = null;

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
    editorState.enforceRules = savedState?.enforceRules !== false;

    toolbox.classList.toggle('is-docked-top', toolboxState.dockPosition === 'top');
    toolbox.classList.toggle('override-active', !editorState.enforceRules);

    if (toolboxState.isMinimized) {
        toolbox.classList.add('is-minimized');
        fab.classList.remove('hidden');
    } else {
        toolbox.classList.remove('is-minimized');
        fab.classList.add('hidden');
    }

    const sizeBtnSpan = $('#toggle-size-btn span');
    if (sizeBtnSpan) sizeBtnSpan.textContent = '—';
    
    const dockBtnSpan = $('#toggle-dock-btn span');
    if(dockBtnSpan) {
        dockBtnSpan.textContent = toolboxState.dockPosition === 'top' ? '🔽' : '🔼';
        dockBtnSpan.parentElement.title = toolboxState.dockPosition === 'top' ? 'Mover para a Base' : 'Mover para o Topo';
    }
    parseEmojisInElement(toolbox);
}

function toggleToolboxSize() {
    toolboxState.isMinimized = !toolboxState.isMinimized;
    const toolbox = $("#editor-toolbox");
    const fab = $("#editor-toolbox-fab");

    toolbox.classList.toggle('is-minimized', toolboxState.isMinimized);
    fab.classList.toggle('hidden', !toolboxState.isMinimized);
    
    saveToolboxState();
}

function toggleDockPosition() {
    toolboxState.dockPosition = toolboxState.dockPosition === 'bottom' ? 'top' : 'bottom';
    const toolbox = $("#editor-toolbox");
    const btnSpan = $('#toggle-dock-btn span');
    
    toolbox.classList.toggle('is-docked-top', toolboxState.dockPosition === 'top');

    if (toolboxState.dockPosition === 'top') {
        btnSpan.textContent = '🔽';
        btnSpan.parentElement.title = 'Mover para a Base';
    } else {
        btnSpan.textContent = '🔼';
        btnSpan.parentElement.title = 'Mover para o Topo';
    }
    parseEmojisInElement(btnSpan.parentElement);
    saveToolboxState();
}

function findPotentialConflicts(employeeId, turnoId, date, escala) {
    const { turnos, funcionarios } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    const newShiftTurno = turnosMap[turnoId];
    const conflitos = [];
    if (!employee || !newShiftTurno || newShiftTurno.isSystem) return [];

    const slotsSimulados = JSON.parse(JSON.stringify(escala.slots));
    const existingSlotIndex = slotsSimulados.findIndex(s => s.assigned === employeeId && s.date === date);
    if (existingSlotIndex > -1) slotsSimulados.splice(existingSlotIndex, 1);
    
    slotsSimulados.push({ id: 'temp', assigned: employeeId, date: date, turnoId: turnoId });

    const restViolation = checkMandatoryRestViolation(employee, newShiftTurno, date, slotsSimulados, turnosMap);
    if (restViolation.violation) conflitos.push(restViolation.message);

    const maxDias = (escala.regras && escala.regras.maxDiasConsecutivos) || 6;
    const diasConsec = calculateFullConsecutiveWorkDays(employeeId, slotsSimulados, date, turnosMap);
    if (diasConsec > maxDias) conflitos.push(`Excede o limite de ${maxDias} dias de trabalho consecutivos.`);

    return conflitos;
}

function initEditor() {
    const toolbox = $("#editor-toolbox");
    if (toolbox) {
        toolbox.innerHTML = `
            <div class="toolbox-layout-wrapper">
                <div class="toolbox-group-left">
                     <button class="toolbox-mode-btn" data-mode="employee" title="Editar por Funcionário">
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
    }

    Object.assign(editorState, {
        editMode: 'employee', selectedCell: null, focusedEmployeeId: null,
        focusedEmployeeIndex: -1, scheduleOrderedFuncs: [], selectedShiftBrush: null,
        lastHoveredDate: null, selectedCellCoords: { row: -1, col: -1 }, allConflicts: [],
        sessionOverride: false, 
    });
    
    const fab = $("#editor-toolbox-fab");
    if (!toolbox || !fab) return;

    toolbox.classList.remove("hidden");
    loadToolboxState();

    $$(".toolbox-mode-btn, .toolbox-tool-btn, .toolbox-window-btn, #editor-toolbox-fab").forEach(btn => btn.onclick = null);
    $("#toolbox-dynamic-content").innerHTML = '';
    document.onkeydown = null;
    const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
    if (tableWrap) {
        tableWrap.onclick = null; tableWrap.onmouseover = null; tableWrap.ondragstart = null;
        tableWrap.ondragover = null; tableWrap.ondragleave = null; tableWrap.ondrop = null;
    }

    if (marqueeObserver) {
        marqueeObserver.disconnect();
    }
    marqueeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const nameEl = entry.target.querySelector('.brush-name');
            if (nameEl) {
                const isOverflowing = nameEl.scrollWidth > nameEl.clientWidth;
                nameEl.classList.toggle('should-marquee', isOverflowing);
            }
        }
    });

    $$(".toolbox-mode-btn, .toolbox-tool-btn").forEach(btn => btn.onclick = () => setEditMode(btn.dataset.mode));
    $('#toggle-dock-btn').onclick = toggleDockPosition;
    $('#toggle-size-btn').onclick = toggleToolboxSize;
    fab.onclick = toggleToolboxSize;
    
    if (tableWrap) {
        tableWrap.onclick = handleTableClick; 
        tableWrap.onmouseover = handleTableMouseover;
        tableWrap.ondragstart = handleDragStart; 
        tableWrap.ondragover = throttle(handleDragOver, 100); 
        tableWrap.ondragleave = handleDragLeave; 
        tableWrap.ondrop = handleDrop;
    }

    $("#toolbox-dynamic-content").onclick = handleToolboxClick;
    document.onkeydown = handleKeyboardNav;

    setEditMode('employee');
    runAllValidations();
}


function setEditMode(mode) {
    if (editorState.editMode !== mode) {
        editorState.sessionOverride = false;
    }
    editorState.editMode = mode;
    clearCellFocus();

    if (mode === 'employee') {
        const { funcionarios } = store.getState();
        const funcionariosMap = new Map(funcionarios.map(f => [f.id, f]));
        const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
        const orderedIds = $$('tr[data-employee-row-id]', tableWrap).map(row => row.dataset.employeeRowId);
        editorState.scheduleOrderedFuncs = orderedIds.map(id => funcionariosMap.get(id)).filter(Boolean);

        if (editorState.scheduleOrderedFuncs.length > 0) {
            const currentFocusedIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === editorState.focusedEmployeeId);
            editorState.focusedEmployeeIndex = (currentFocusedIndex !== -1) ? currentFocusedIndex : 0;
            editorState.focusedEmployeeId = editorState.scheduleOrderedFuncs[editorState.focusedEmployeeIndex].id;
        } else {
            editorState.focusedEmployeeIndex = -1;
            editorState.focusedEmployeeId = null;
        }
    } else {
        editorState.focusedEmployeeId = null;
        editorState.focusedEmployeeIndex = -1;
    }

    highlightEmployeeRow(editorState.focusedEmployeeId);
    $$(".toolbox-mode-btn, .toolbox-tool-btn").forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    
    const table = $(".escala-final-table");
    if(table) {
        table.classList.remove('employee-paint-mode', 'eraser-mode');
        if (mode === 'employee') table.classList.add('employee-paint-mode');
        if (mode === 'eraser') table.classList.add('eraser-mode');
    }
    updateToolboxView();
}

function updateToolboxView() {
    const { editMode } = editorState;
    const contentEl = $("#toolbox-dynamic-content");
    let contentHTML = '';

    switch(editMode) {
        case 'employee':
            contentHTML = renderFocusedEmployeeView();
            break;
        case 'eraser':
            contentHTML = '<div class="toolbox-info-text"><span>Modo Borracha Ativo:</span> Clique em um turno para apagar.</div>';
            break;
        case 'conflicts':
            contentHTML = renderConflictsView();
            break;
        case 'settings':
            contentHTML = renderActionsView();
            break;
    }
    
    contentEl.innerHTML = contentHTML;
    
    if (editMode === 'employee' && marqueeObserver) {
        $$('.shift-brush').forEach(brush => {
            marqueeObserver.observe(brush);
        });
    }

    parseEmojisInElement(contentEl);
}


function renderFocusedEmployeeView() {
    const { focusedEmployeeId, scheduleOrderedFuncs } = editorState;
    if (!focusedEmployeeId) return `<div class="toolbox-info-text">Nenhum funcionário para editar nesta escala.</div>`;

    const employee = scheduleOrderedFuncs.find(f => f.id === focusedEmployeeId);
    if (!employee) return `<div class="toolbox-info-text">Funcionário não encontrado.</div>`;
    
    const { turnos } = store.getState();
    const turnosDeTrabalho = turnos.filter(t => !t.isSystem && employee.disponibilidade && employee.disponibilidade[t.id]);
    const turnosDeSistema = Object.values(TURNOS_SISTEMA_AUSENCIA);
    
    const selectorCard = `
        <div class="toolbox-card employee-selector-card">
            <button id="prev-employee-btn" class="nav-arrow" title="Anterior (Q)">◀</button>
            <h5>${employee.nome}</h5>
            <button id="next-employee-btn" class="nav-arrow" title="Próximo (E)">▶</button>
        </div>`;

    const indicatorsCard = `
        <div class="toolbox-card employee-indicators-card" data-employee-id="${employee.id}">
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

    const brushesCard = `
        <div class="toolbox-card shift-brushes-card">
            ${turnosDeSistema.map(t => renderBrush(t, employee)).join('')}
            <div class="brush-separator"></div>
            ${turnosDeTrabalho.map(t => renderBrush(t, employee)).join('')}
        </div>`;

    setTimeout(() => {
        const card = $('.employee-indicators-card');
        if (card) updateIndicatorsInCard(card);
    }, 0);

    return `<div class="focused-employee-view">${selectorCard}${indicatorsCard}${brushesCard}</div>`;
}

function renderBrush(turno, employee) {
    const isSelected = editorState.selectedShiftBrush === turno.id;
    const textColor = getContrastingTextColor(turno.cor);
    const isDisabled = !turno.isSystem && (!employee.disponibilidade || !employee.disponibilidade[turno.id]);

    return `
        <div class="shift-brush ${isSelected ? 'selected' : ''}" data-turno-id="${turno.id}" title="${turno.nome}" ${isDisabled ? 'disabled' : ''}>
            <div class="brush-icon" style="background-color: ${turno.cor}; color: ${textColor}">${turno.sigla}</div>
            <span class="brush-name">${turno.nome}</span>
        </div>`;
}

function renderActionsView() {
    const isEnforced = editorState.enforceRules;
    return `
        <div class="actions-panel">
            <div class="action-row">
                <div>
                    <label class="form-label">Limpar Alocações</label>
                    <p class="explanation">Remove todos os turnos e ausências.</p>
                </div>
                <button class="danger" data-action="clear-assignments">Limpar</button>
            </div>

            <div class="action-row action-row-card" data-action="show-shortcuts">
                <label class="form-label">🖱️<br>Atalhos</label>
            </div>

             <div class="action-row">
                <div>
                    <label class="form-label">Forçar Regras</label>
                    <p class="explanation">Impede ações que violem as regras.</p>
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
    let html = '<div class="conflicts-view-container">';
    conflicts.forEach(conflict => {
        html += `<div class="conflict-list-item" data-employee-id="${conflict.employeeId}" data-date="${conflict.date}">
                    <strong>${conflict.employeeName.split(' ')[0]} em ${new Date(conflict.date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}:</strong> ${conflict.message}
                 </div>`;
    });
    html += `</div>`;
    return html;
}

function handleTableClick(event) {
    const cell = event.target.closest('td');
    if (!cell || cell.classList.contains('celula-fechada') || cell.classList.contains('celula-feriado-folga')) return;

    const parentRow = cell.parentElement;
    const employeeId = parentRow.dataset.employeeRowId;
    if (!employeeId) return;

    const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
    const rowIndex = allRows.findIndex(row => row === parentRow);
    const colIndex = Array.from(parentRow.children).indexOf(cell) - 1;

    if (cell.matches(':first-child')) {
        const newIndex = editorState.scheduleOrderedFuncs.findIndex(f => f.id === employeeId);
        if (newIndex !== -1 && newIndex !== editorState.focusedEmployeeIndex) {
            editorState.focusedEmployeeIndex = newIndex;
            updateFocusedEmployee(false); 
        }
    }
    else if (cell.classList.contains('editable-cell')) {
        focusCell(rowIndex, colIndex); 
        if (editorState.editMode === 'employee') handleEmployeePaint(cell);
        else if (editorState.editMode === 'eraser') handleEraseClick(cell);
    }
}

function handleTableMouseover(event) {
    const cell = event.target.closest('.editable-cell');
    if (cell && editorState.editMode === 'employee') {
        const { date } = cell.dataset;
        if (date && date !== editorState.lastHoveredDate) {
            editorState.lastHoveredDate = date;
            const card = $(".employee-indicators-card");
            if (card) updateConsecutiveDaysIndicator(card, date);
        }
    }
}

function handleToolboxClick(event) {
    const target = event.target;
    const shiftBrush = target.closest('.shift-brush');
    const navArrow = target.closest('.nav-arrow');
    const conflictItem = target.closest('.conflict-list-item');
    const actionButton = target.closest('[data-action]');

    if (conflictItem) handleConflictPanelClick(event);
    if (shiftBrush && !shiftBrush.hasAttribute('disabled')) handleSelectShiftBrush(shiftBrush.dataset.turnoId);
    if (navArrow) {
        if (navArrow.id === 'next-employee-btn') showNextEmployee(true);
        if (navArrow.id === 'prev-employee-btn') showPrevEmployee(true);
    }
    if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === 'toggle-rules') handleToggleRules(actionButton.dataset.value);
        if (action === 'clear-assignments') handleClearAssignments();
        if (action === 'show-shortcuts') exibirAtalhosDeTeclado();
    }
}

function handleKeyboardNav(event) {
    const toolbox = $("#editor-toolbox");
    if (!toolbox || toolbox.classList.contains('hidden') || toolboxState.isMinimized) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    const key = event.key;
    let { row, col } = editorState.selectedCellCoords;

    if (key.toLowerCase() === 'q') { event.preventDefault(); showPrevEmployee(true); return; }
    if (key.toLowerCase() === 'e') { event.preventDefault(); showNextEmployee(true); return; }

    if (!isNaN(key) && key >= 1 && key <= 9) {
        event.preventDefault();
        const brushes = $$('.shift-brush:not([disabled])');
        const index = parseInt(key, 10) - 1;
        if (brushes[index]) handleSelectShiftBrush(brushes[index].dataset.turnoId);
        return;
    }

    const focusedCell = getCellByCoords(row, col);
    if (focusedCell) {
        if (key === 'Delete' || key === 'Backspace') { event.preventDefault(); handleEraseClick(focusedCell); }
        if (key === 'Enter') { event.preventDefault(); handleEmployeePaint(focusedCell); }
    }

    if (key.startsWith('Arrow')) {
        event.preventDefault();
        const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
        if (allRows.length === 0) return;

        if (row === -1) { focusCell(0, 0); return; }

        const maxRows = allRows.length - 1;
        const maxCols = allRows[0].children.length - 2;

        switch (key) {
            case 'ArrowUp': row = Math.max(0, row - 1); break;
            case 'ArrowDown': row = Math.min(maxRows, row + 1); break;
            case 'ArrowLeft': col = Math.max(0, col - 1); break;
            case 'ArrowRight': col = Math.min(maxCols, col + 1); break;
        }
        focusCell(row, col);
    }
}

function updateAllIndicators() { const card = $(".employee-indicators-card"); if (card) updateIndicatorsInCard(card); }

function updateIndicatorsInCard(card) {
    const employeeId = card.dataset.employeeId;
    const employee = store.getState().funcionarios.find(f => f.id === employeeId);
    if (!employee) return;
    const medicao = employee.medicaoCarga || 'horas';
    let progresso, meta, unidade, mainPercentage = 0, overtimePercentage = 0;
    if (medicao === 'turnos') {
        progresso = currentEscala.historico[employee.id]?.turnosTrabalhados || 0;
        meta = calcularMetaTurnos(employee, currentEscala.inicio, currentEscala.fim);
        unidade = ' turnos';
        mainPercentage = meta > 0 ? (progresso / meta) * 100 : 0;
    } else { 
        progresso = (currentEscala.historico[employee.id]?.horasTrabalhadas / 60) || 0;
        meta = calcularMetaHoras(employee, currentEscala.inicio, currentEscala.fim);
        unidade = 'h';
        mainPercentage = meta > 0 ? (progresso / meta) * 100 : 0;
    }
    if (mainPercentage > 100) { overtimePercentage = mainPercentage - 100; mainPercentage = 100; }
    
    let barColorClass = 'progress-bar-red';
    if (mainPercentage >= 100) barColorClass = 'progress-bar-green';
    else if (mainPercentage >= 80) barColorClass = 'progress-bar-blue';
    else if (mainPercentage >= 40) barColorClass = 'progress-bar-yellow';

    const workloadText = $('.workload-text-compact', card);
    if (workloadText) { workloadText.textContent = medicao === 'turnos' ? `${progresso.toFixed(0)}/${meta.toFixed(0)}${unidade}` : `${progresso.toFixed(1)}${unidade}/${meta.toFixed(1)}${unidade}`; }
    
    const mainBar = $('.progress-bar-main', card);
    if (mainBar) { mainBar.className = `progress-bar progress-bar-main ${barColorClass}`; mainBar.style.width = `${mainPercentage.toFixed(2)}%`; }
    
    const overtimeBar = $('.progress-bar-overtime', card);
    if (overtimeBar) { overtimeBar.style.width = `${overtimePercentage.toFixed(2)}%`; }
    
    const targetDate = editorState.lastHoveredDate || currentEscala.fim;
    updateConsecutiveDaysIndicator(card, targetDate);
}

function updateConsecutiveDaysIndicator(card, targetDate) {
    const employeeId = card.dataset.employeeId;
    const container = $('.consecutive-days-container', card);
    if (employeeId && container) {
        const { turnos } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
        const turnosMap = Object.fromEntries(allTurnos.map(t => [t.id, t]));
        const slotsSimulados = [...currentEscala.slots];
        if (editorState.selectedShiftBrush && !slotsSimulados.some(s => s.assigned === employeeId && s.date === targetDate)) {
            const turnoSelecionado = allTurnos.find(t => t.id === editorState.selectedShiftBrush);
            if(turnoSelecionado && !turnoSelecionado.isSystem) { slotsSimulados.push({ assigned: employeeId, date: targetDate, turnoId: editorState.selectedShiftBrush }); }
        }
        const diasConsecutivos = calculateConsecutiveWorkDays(employeeId, slotsSimulados, targetDate, turnosMap);
        const maxDias = (currentEscala.regras && currentEscala.regras.maxDiasConsecutivos) || 6;
        
        let dotsHTML = '';
        for (let i = 1; i <= maxDias; i++) {
            const isFilled = i <= diasConsecutivos;
            let dotClass = '';
            if (isFilled) {
                if (diasConsecutivos > maxDias) {
                    dotClass = 'filled limit'; // Acima do limite
                } else if (i === maxDias && diasConsecutivos === maxDias) {
                    dotClass = 'filled completed'; // Dia exato do limite
                } else {
                    dotClass = 'filled'; // Normal
                }
            }
            dotsHTML += `<div class="day-dot ${dotClass}" title="${diasConsecutivos}/${maxDias} dias"></div>`;
        }

        const isOverLimit = diasConsecutivos > maxDias;
        container.innerHTML = `<span class="indicator-label">Dias:</span> ${dotsHTML} ${isOverLimit ? '<span class="limit-alert">!</span>' : ''}`;
    }
}


async function handleAddShiftClick(employeeId, turnoId, date) {
    const conflitos = findPotentialConflicts(employeeId, turnoId, date, currentEscala);
    if (conflitos.length > 0) {
        if (editorState.enforceRules) {
            showToast(`Ação bloqueada: ${conflitos.join(' ')}`);
            return;
        } 
        if (!editorState.sessionOverride) {
            const result = await showConfirm({
                title: "Confirmar Ação com Conflito?",
                message: `Atenção: Esta alocação viola a(s) seguinte(s) regra(s): <br><strong>- ${conflitos.join('<br>- ')}</strong>.<br><br> Deseja continuar mesmo assim?`,
                confirmText: "Sim, Continuar",
                checkbox: { label: "Permitir todos os próximos conflitos nesta sessão" }
            });

            if (!result.confirmed) return;
            if (result.checkboxChecked) {
                editorState.sessionOverride = true;
                showToast("Modo de substituição de regras ativado para esta sessão.");
            }
        }
    }
    
    const { turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turno = allTurnos.find(t => t.id === turnoId);
    if (!turno) return;
    
    if (!currentEscala.historico[employeeId]) {
        currentEscala.historico[employeeId] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
    }
    
    const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
    const existingSlotIndex = currentEscala.slots.findIndex(s => s.date === date && s.assigned === employeeId);
    
    if (existingSlotIndex > -1) {
        const slotAntigo = currentEscala.slots[existingSlotIndex];
        const turnoAntigo = allTurnos.find(t => t.id === slotAntigo.turnoId);
        if (turnoAntigo && !turnoAntigo.isSystem) {
            const cargaAntiga = calcCarga(turnoAntigo.inicio, turnoAntigo.fim, turnoAntigo.almocoMin, turnoAntigo.diasDeDiferenca);
            currentEscala.historico[employeeId].horasTrabalhadas -= cargaAntiga;
            currentEscala.historico[employeeId].turnosTrabalhados -= 1;
        }
        currentEscala.slots.splice(existingSlotIndex, 1);
    }
    
    // CORREÇÃO: Turnos adicionados manualmente NUNCA são 'extra'.
    const novoSlot = { date, turnoId, assigned: employeeId, id: uid(), isExtra: false };
    currentEscala.slots.push(novoSlot);
    
    if (!turno.isSystem) {
        currentEscala.historico[employeeId].horasTrabalhadas += cargaReal;
        currentEscala.historico[employeeId].turnosTrabalhados += 1;
    }

    setGeradorFormDirty(true);
    updateTableAfterEdit(currentEscala);
    updateAllIndicators();
    runSurgicalValidation([employeeId]);
    highlightEmployeeRow(employeeId);
}


function handleRemoveShiftClick(slotId) {
    const slotIndex = currentEscala.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return;
    
    const slot = currentEscala.slots[slotIndex];
    if (!slot.assigned) return;
    
    const { turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turno = allTurnos.find(t => t.id === slot.turnoId);
    const employeeId = slot.assigned;

    if (turno && !turno.isSystem && currentEscala.historico[employeeId]) {
        const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
        currentEscala.historico[employeeId].horasTrabalhadas -= cargaReal;
        currentEscala.historico[employeeId].turnosTrabalhados -= 1;
    }
    
    const isGeradaAutomaticamente = !currentEscala.isManual;
    const hasCoberturaDefinida = isGeradaAutomaticamente && (currentEscala.cobertura[slot.turnoId] || 0) > 0;
    
    if (hasCoberturaDefinida) {
        slot.assigned = null;
        delete slot.equipeId;
    } else {
        currentEscala.slots.splice(slotIndex, 1);
    }
    
    setGeradorFormDirty(true);
    updateTableAfterEdit(currentEscala);
    updateAllIndicators();
    runSurgicalValidation([employeeId]);
    highlightEmployeeRow(employeeId);
}

function handleEmployeePaint(cell) { if (!editorState.focusedEmployeeId || !editorState.selectedShiftBrush) { showToast("Selecione um turno na Barra de Ferramentas para começar a pintar."); return; } const { date, employeeId: cellEmployeeId, turnoId: cellTurnoId, slotId } = cell.dataset; if (cellEmployeeId !== editorState.focusedEmployeeId) { showToast("Você só pode pintar turnos na linha do funcionário selecionado."); return; } if (cellTurnoId === editorState.selectedShiftBrush) { handleRemoveShiftClick(slotId); } else { handleAddShiftClick(editorState.focusedEmployeeId, editorState.selectedShiftBrush, date); } }

async function handleEraseClick(cell) { const { slotId } = cell.dataset; if (slotId) { handleRemoveShiftClick(slotId); } }

async function handleClearAssignments() {
    const { confirmed } = await showConfirm({
        title: "Limpar Todas as Alocações?",
        message: "Esta ação removerá todos os turnos e ausências da escala atual. Deseja continuar?",
        confirmText: "Sim, Limpar Tudo"
    });

    if (confirmed && currentEscala) {
        currentEscala.slots = [];
        for (const empId in currentEscala.historico) {
            currentEscala.historico[empId] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
        }
        setGeradorFormDirty(true);
        updateTableAfterEdit(currentEscala);
        updateAllIndicators();
        runAllValidations();
        showToast("Todas as alocações foram removidas.");
    }
}


function showNextEmployee(animate = false) { if (editorState.scheduleOrderedFuncs.length === 0) return; editorState.focusedEmployeeIndex = (editorState.focusedEmployeeIndex + 1) % editorState.scheduleOrderedFuncs.length; editorState.animationDirection = 'right'; updateFocusedEmployee(animate); }

function showPrevEmployee(animate = false) { if (editorState.scheduleOrderedFuncs.length === 0) return; editorState.focusedEmployeeIndex = (editorState.focusedEmployeeIndex - 1 + editorState.scheduleOrderedFuncs.length) % editorState.scheduleOrderedFuncs.length; editorState.animationDirection = 'left'; updateFocusedEmployee(animate); }

function updateFocusedEmployee(animate = false) {
    editorState.focusedEmployeeId = editorState.scheduleOrderedFuncs[editorState.focusedEmployeeIndex].id;
    highlightEmployeeRow(editorState.focusedEmployeeId);
    const contentEl = $("#toolbox-dynamic-content");
    const currentView = $(".focused-employee-view", contentEl);
    if (animate && currentView) {
        const outClass = editorState.animationDirection === 'right' ? 'card-slide-out-left' : 'card-slide-out-right';
        currentView.classList.add(outClass);
        setTimeout(() => updateToolboxView(), 200);
    } else {
        updateToolboxView();
    }
}

function handleToggleRules(value) { 
    editorState.enforceRules = value === 'on'; 
    if (editorState.enforceRules) {
        editorState.sessionOverride = false;
    }
    const toolbox = $("#editor-toolbox"); 
    toolbox.classList.toggle('override-active', !editorState.enforceRules); 
    showToast(editorState.enforceRules ? "Modo de regras estritas ATIVADO." : "Modo de flexibilização ATIVADO."); 
    saveToolboxState(); 
    updateToolboxView(); 
}

function getCellByCoords(row, col) { if (row < 0 || col < 0) return null; const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`); const targetRow = allRows[row]; if (!targetRow) return null; return targetRow.children[col + 1]; }

function focusCell(row, col) { 
    clearCellFocus(); 
    const cell = getCellByCoords(row, col); 
    if (cell) { 
        cell.classList.add('cell-focused'); 
        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); 
        editorState.selectedCellCoords = { row, col }; 
        cell.focus(); // Foco programático para acessibilidade
    } 
}

function clearCellFocus() { const focused = $('.cell-focused'); if (focused) focused.classList.remove('cell-focused'); editorState.selectedCellCoords = { row: -1, col: -1 }; }

function handleDragStart(e) { const cell = e.target.closest('.editable-cell[draggable="true"]'); if (!cell) return; e.dataTransfer.effectAllowed = 'move'; const sourceData = { slotId: cell.dataset.slotId }; e.dataTransfer.setData('application/json', JSON.stringify(sourceData)); setTimeout(() => cell.classList.add('dragging'), 0); }

async function handleDrop(e) {
    e.preventDefault();
    const targetCell = e.target.closest('.editable-cell');
    $$('.dragging').forEach(el => el.classList.remove('dragging'));
    if (!targetCell || targetCell.classList.contains('celula-fechada') || targetCell.classList.contains('celula-feriado-folga')) {
        handleDragLeave(e);
        return;
    }
    
    targetCell.classList.remove('drop-target', 'drop-invalid');
    const sourceData = JSON.parse(e.dataTransfer.getData('application/json'));
    const sourceSlot = currentEscala.slots.find(s => s.id === sourceData.slotId);
    if (!sourceSlot) return;

    const targetEmployeeId = targetCell.dataset.employeeId;
    const targetDate = targetCell.dataset.date;
    const targetSlotId = targetCell.dataset.slotId;

    if (sourceSlot.assigned === targetEmployeeId && sourceSlot.date === targetDate) return;

    const performAction = async (actionFn, ...args) => {
        const conflitos = await actionFn(...args, true); 
        if (conflitos.length > 0) {
            if (editorState.enforceRules) {
                showToast(`Ação bloqueada: ${conflitos.join('; ')}`);
                return;
            }
            if (!editorState.sessionOverride) {
                const result = await showConfirm({
                    title: "Confirmar Ação com Conflito?",
                    message: `Esta ação viola a(s) seguinte(s) regra(s):<br><strong>- ${conflitos.join('<br>- ')}</strong>.<br><br>Deseja continuar?`,
                    confirmText: "Sim, Continuar",
                    checkbox: { label: "Permitir todos os próximos conflitos nesta sessão" }
                });
                if (!result.confirmed) return;
                if (result.checkboxChecked) {
                    editorState.sessionOverride = true;
                    showToast("Modo de substituição de regras ativado para esta sessão.");
                }
            }
        }
        await actionFn(...args, false); 
    };

    if (targetSlotId && sourceSlot.assigned !== targetEmployeeId) {
        await performAction(handleSwapShiftClick, sourceData.slotId, targetSlotId);
    } else {
        await performAction(handleMoveShiftClick, sourceSlot, targetEmployeeId, targetDate);
    }
}


function handleDragOver(e) {
    e.preventDefault();
    const targetCell = e.target.closest('.editable-cell');
    if (!targetCell || targetCell.classList.contains('celula-fechada') || targetCell.classList.contains('celula-feriado-folga')) {
        return;
    }
    targetCell.classList.add('drop-target');
}

function handleDragLeave(e) { const cell = e.target.closest('.editable-cell'); if (cell) cell.classList.remove('drop-target', 'drop-invalid'); }

async function handleMoveShiftClick(sourceSlot, targetEmployeeId, targetDate, dryRun = false) {
    const conflitos = findPotentialConflicts(targetEmployeeId, sourceSlot.turnoId, targetDate, currentEscala);
    if (dryRun) return conflitos;

    const oldEmployeeId = sourceSlot.assigned;
    const { turnos } = store.getState();
    const turno = turnos.find(t => t.id === sourceSlot.turnoId);

    if (turno && !turno.isSystem) {
        const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
        currentEscala.historico[oldEmployeeId].horasTrabalhadas -= cargaReal;
        currentEscala.historico[oldEmployeeId].turnosTrabalhados -= 1;
        if (!currentEscala.historico[targetEmployeeId]) {
            currentEscala.historico[targetEmployeeId] = { horasTrabalhadas: 0, turnosTrabalhados: 0 };
        }
        currentEscala.historico[targetEmployeeId].horasTrabalhadas += cargaReal;
        currentEscala.historico[targetEmployeeId].turnosTrabalhados += 1;
    }

    const targetCell = $(`td[data-employee-id="${targetEmployeeId}"][data-date="${targetDate}"]`);
    if (targetCell && targetCell.dataset.slotId) {
        await handleRemoveShiftClick(targetCell.dataset.slotId);
    }
    
    sourceSlot.assigned = targetEmployeeId;
    sourceSlot.date = targetDate;
    // CORREÇÃO: Turnos movidos manualmente NUNCA são 'extra'.
    sourceSlot.isExtra = false;

    setGeradorFormDirty(true);
    updateTableAfterEdit(currentEscala);
    runSurgicalValidation([oldEmployeeId, targetEmployeeId]);
    updateAllIndicators();
    highlightEmployeeRow(targetEmployeeId);
}


async function handleSwapShiftClick(slot1Id, slot2Id, dryRun = false) {
    const { funcionarios, turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMap = Object.fromEntries(allTurnos.map(t => [t.id, t]));
    const maxDias = currentEscala.regras?.maxDiasConsecutivos || 6;
    
    const slot1 = currentEscala.slots.find(s => s.id === slot1Id);
    const slot2 = currentEscala.slots.find(s => s.id === slot2Id);
    if (!slot1 || !slot2) return dryRun ? ["Slots inválidos para troca."] : showToast("Erro: slots inválidos para troca.");

    const func1 = funcionarios.find(f => f.id === slot1.assigned);
    const func2 = funcionarios.find(f => f.id === slot2.assigned);
    const turno1 = turnosMap[slot1.turnoId];
    const turno2 = turnosMap[slot2.turnoId];
    if (!func1 || !func2 || !turno1 || !turno2 || turno1.isSystem || turno2.isSystem) {
        return dryRun ? ["Não é possível trocar turnos de ausência."] : showToast("Não é possível trocar turnos de ausência ou inválidos.");
    }

    const tempSlots = JSON.parse(JSON.stringify(currentEscala.slots));
    const tempSlotInArray1 = tempSlots.find(s => s.id === slot1Id);
    const tempSlotInArray2 = tempSlots.find(s => s.id === slot2Id);
    tempSlotInArray1.assigned = func2.id;
    tempSlotInArray2.assigned = func1.id;
    
    let todosConflitos = [];
    const restV1 = checkMandatoryRestViolation(func1, turno2, slot2.date, tempSlots, turnosMap);
    if (restV1.violation) todosConflitos.push(restV1.message);
    if (calculateFullConsecutiveWorkDays(func1.id, tempSlots, slot2.date, turnosMap) > maxDias) todosConflitos.push(`Dias consecutivos de ${func1.nome.split(' ')[0]} excedidos.`);
    const restV2 = checkMandatoryRestViolation(func2, turno1, slot1.date, tempSlots, turnosMap);
    if (restV2.violation) todosConflitos.push(restV2.message);
    if (calculateFullConsecutiveWorkDays(func2.id, tempSlots, slot1.date, turnosMap) > maxDias) todosConflitos.push(`Dias consecutivos de ${func2.nome.split(' ')[0]} excedidos.`);
    
    if (dryRun) return [...new Set(todosConflitos)];

    const carga1 = calcCarga(turno1.inicio, turno1.fim, turno1.almocoMin, turno1.diasDeDiferenca);
    const carga2 = calcCarga(turno2.inicio, turno2.fim, turno2.almocoMin, turno2.diasDeDiferenca);
    currentEscala.historico[func1.id].horasTrabalhadas += (carga2 - carga1);
    currentEscala.historico[func2.id].horasTrabalhadas += (carga1 - carga2);
    
    slot1.assigned = func2.id;
    slot2.assigned = func1.id;
    
    // CORREÇÃO: Turnos trocados manualmente NUNCA são 'extra'.
    slot1.isExtra = false;
    slot2.isExtra = false;

    setGeradorFormDirty(true);
    updateTableAfterEdit(currentEscala);
    runSurgicalValidation([func1.id, func2.id]);
    updateAllIndicators();
    highlightEmployeeRow(editorState.focusedEmployeeId);
}


function handleSelectShiftBrush(turnoId) {
    editorState.selectedShiftBrush = (editorState.selectedShiftBrush === turnoId) ? null : turnoId;
    updateToolboxView();
}

function highlightEmployeeRow(employeeId) {
    if (!currentEscala || !currentEscala.owner) return;
    $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr`).forEach(row => {
        row.classList.remove('employee-row-highlight');
    });
    if (employeeId) {
        const row = $(`#${currentEscala.owner}-escalaTabelaWrap tr[data-employee-row-id="${employeeId}"]`);
        if (row) {
            row.classList.add('employee-row-highlight');
        }
    }
}

function runSurgicalValidation(employeeIdsToUpdate) {
    const { funcionarios } = store.getState();
    const existingConflicts = editorState.allConflicts.filter(c => !employeeIdsToUpdate.includes(c.employeeId));
    let newConflicts = [];
    employeeIdsToUpdate.forEach(funcId => {
        $$(`#${currentEscala.owner}-escalaTabelaWrap .editable-cell.has-conflict[data-employee-id="${funcId}"]`).forEach(cell => {
            cell.classList.remove('has-conflict');
            $('.conflict-marker', cell)?.remove();
            $('.conflict-marker-tooltip', cell)?.remove();
        });
        const conflitosDoFunc = validateEmployeeSchedule(funcId, currentEscala);
        conflitosDoFunc.forEach(conflito => {
            const func = funcionarios.find(f => f.id === funcId);
            newConflicts.push({ ...conflito, employeeName: func?.nome || 'Desconhecido' });
        });
    });
    editorState.allConflicts = [...existingConflicts, ...newConflicts].sort((a, b) => a.date.localeCompare(b.date));
    newConflicts.forEach(conflito => {
        const cell = $(`#${currentEscala.owner}-escalaTabelaWrap td[data-employee-id="${conflito.employeeId}"][data-date="${conflito.date}"]`);
        if (cell) {
            cell.classList.add('has-conflict');
            if (!$('.conflict-marker', cell)) {
                const marker = document.createElement('div'); marker.className = 'conflict-marker';
                const tooltip = document.createElement('div'); tooltip.className = 'conflict-marker-tooltip';
                tooltip.textContent = conflito.message;
                cell.appendChild(marker); cell.appendChild(tooltip);
            } else {
                const tooltip = $('.conflict-marker-tooltip', cell);
                if (!tooltip.textContent.includes(conflito.message)) tooltip.textContent += `\n${conflito.message}`;
            }
        }
    });
    updateConflictTabBadge();
    if (editorState.editMode === 'conflicts') updateToolboxView();
}

function runAllValidations() {
    const { funcionarios } = store.getState();
    const funcsDaEscala = funcionarios.filter(f => currentEscala.historico && currentEscala.historico[f.id]);
    runSurgicalValidation(funcsDaEscala.map(f => f.id));
}

function updateConflictTabBadge() {
    const conflictBtn = $('.toolbox-tool-btn[data-mode="conflicts"]');
    if (!conflictBtn) return;
    let badge = $('.conflict-count-badge', conflictBtn);
    if (badge) badge.remove();
    const count = editorState.allConflicts.length;
    if (count > 0) {
        badge = document.createElement('span'); badge.className = 'conflict-count-badge';
        badge.textContent = count;
        conflictBtn.appendChild(badge);
    }
}

function handleConflictPanelClick(event) {
    const item = event.target.closest('.conflict-list-item');
    if (!item) return;
    const { employeeId, date } = item.dataset;
    const cell = $(`#${currentEscala.owner}-escalaTabelaWrap td[data-employee-id="${employeeId}"][data-date="${date}"]`);
    if (cell) {
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        cell.classList.remove('cell-highlight-animation');
        void cell.offsetWidth;
        cell.classList.add('cell-highlight-animation');
    }
}

function validateEmployeeSchedule(employeeId, escala) {
    const { turnos, funcionarios } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMap = Object.fromEntries(allTurnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    const maxDias = (escala.regras && escala.regras.maxDiasConsecutivos) || 6;
    const conflitos = [];
    const turnosDoFunc = escala.slots.filter(s => s.assigned === employeeId).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < turnosDoFunc.length; i++) {
        const turnoAtual = turnosDoFunc[i];
        const turnoAtualInfo = turnosMap[turnoAtual.turnoId];
        if (!turnoAtualInfo || turnoAtualInfo.isSystem) continue;
        const restValidation = checkMandatoryRestViolation(employee, turnoAtualInfo, turnoAtual.date, escala.slots, turnosMap);
        if (restValidation.violation) conflitos.push({ employeeId, date: turnoAtual.date, message: restValidation.message });
        
        const dias = calculateFullConsecutiveWorkDays(employeeId, escala.slots, turnoAtual.date, turnosMap);
        if (dias > maxDias) {
            if (!conflitos.some(c => c.date === turnoAtual.date && c.message.includes('consecutivos'))) {
                conflitos.push({ employeeId, date: turnoAtual.date, message: `Excede ${maxDias} dias consecutivos.` });
            }
        }
    }
    return conflitos;
}