/**************************************
 * 🛠️ Lógica do Editor Manual v4.2 (Com Ações e Ausências)
 **************************************/

const editorState = {
    editMode: 'employee',
    selectedCell: null,
    focusedEmployeeId: null,
    focusedEmployeeIndex: -1,
    alphabetizedFuncs: [],
    selectedShiftBrush: null,
    lastHoveredDate: null, 
    animationDirection: 'right',
    enforceRules: true, 
    selectedCellCoords: { row: -1, col: -1 }, 
    allConflicts: [],
    selectedAbsenceBrush: 'ferias',
    selectedFolgaReason: 'Folga Normal',
    selectedAfastamentoReason: 'Atestado Médico',
    isPaintingAbsence: false,
    absencePaintStartCell: null,
};

const toolboxState = {
    isMinimized: false,
    isDragging: false,
    pos: { top: null, left: null },
    offset: { x: 0, y: 0 },
    ticking: false
};

let currentEscala = null;
let lastEditedEmployeeId = null;


function saveToolboxState() {
    sessionStorage.setItem('ge_toolbox_state', JSON.stringify({
        isMinimized: toolboxState.isMinimized,
        pos: toolboxState.pos,
        enforceRules: editorState.enforceRules
    }));
}

function loadToolboxState() {
    let savedState = null;
    try {
        savedState = JSON.parse(sessionStorage.getItem('ge_toolbox_state'));
    } catch (e) {
        sessionStorage.removeItem('ge_toolbox_state');
    }

    const toolbox = $("#editor-toolbox");
    if (!toolbox) return;
    
    editorState.enforceRules = savedState?.enforceRules !== false;
    toolbox.classList.toggle('override-active', !editorState.enforceRules);

    const btn = $('#toggle-toolbox-size-btn');
    if (savedState?.isMinimized) {
        toolboxState.isMinimized = true;
        toolbox.classList.add('minimized');
        btn.textContent = '＋';
        btn.title = 'Maximizar';
    } else {
        toolboxState.isMinimized = false;
        toolbox.classList.remove('minimized');
        btn.textContent = '—';
        btn.title = 'Minimizar';
    }

    if (savedState && savedState.pos && savedState.pos.top !== null && savedState.pos.left !== null) {
        toolboxState.pos = savedState.pos;
        toolbox.style.right = 'auto';
        toolbox.style.bottom = 'auto';
        const boundaryPadding = 24;
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width-collapsed'), 10);
        const minHeight = toolboxState.isMinimized ? 48 : 300;
        let top = Math.max(boundaryPadding, Math.min(toolboxState.pos.top, window.innerHeight - minHeight - boundaryPadding));
        let left = Math.max(sidebarWidth + boundaryPadding, Math.min(toolboxState.pos.left, window.innerWidth - toolbox.offsetWidth - boundaryPadding));
        toolbox.style.top = `${top}px`;
        toolbox.style.left = `${left}px`;
    } else {
        toolbox.style.top = null;
        toolbox.style.left = null;
        toolbox.style.right = '24px';
        toolbox.style.bottom = '24px';
    }
}


function toggleToolboxSize() {
    toolboxState.isMinimized = !toolboxState.isMinimized;
    const toolbox = $("#editor-toolbox");
    const btn = $('#toggle-toolbox-size-btn');
    toolbox.classList.toggle('minimized', toolboxState.isMinimized);
    if(toolboxState.isMinimized) {
        btn.textContent = '＋';
        btn.title = 'Maximizar';
    } else {
        btn.textContent = '—';
        btn.title = 'Minimizar';
    }
    saveToolboxState();
}

function dragMouseDown(e) {
    e.preventDefault();
    const toolbox = $("#editor-toolbox");
    toolboxState.offset.x = e.clientX - toolbox.offsetLeft;
    toolboxState.offset.y = e.clientY - toolbox.offsetTop;
    if(toolbox.style.bottom || toolbox.style.right) {
        const rect = toolbox.getBoundingClientRect();
        toolbox.style.top = `${rect.top}px`;
        toolbox.style.left = `${rect.left}px`;
        toolbox.style.right = 'auto';
        toolbox.style.bottom = 'auto';
    }
    document.addEventListener('mousemove', elementDrag);
    document.addEventListener('mouseup', closeDragElement, { once: true });
    toolbox.classList.add('dragging');
}

function elementDrag(e) {
    e.preventDefault();
    toolboxState.pos.left = e.clientX - toolboxState.offset.x;
    toolboxState.pos.top = e.clientY - toolboxState.offset.y;
    if (!toolboxState.ticking) {
        window.requestAnimationFrame(() => {
            const toolbox = $("#editor-toolbox");
            const boundaryPadding = 24;
            const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width-collapsed'), 10);
            const leftBoundary = sidebarWidth + boundaryPadding;
            const topBoundary = boundaryPadding;
            const rightBoundary = window.innerWidth - toolbox.offsetWidth - boundaryPadding;
            const bottomBoundary = window.innerHeight - toolbox.offsetHeight - boundaryPadding;
            let newLeft = Math.max(leftBoundary, Math.min(toolboxState.pos.left, rightBoundary));
            let newTop = Math.max(topBoundary, Math.min(toolboxState.pos.top, bottomBoundary));
            toolbox.style.left = `${newLeft}px`;
            toolbox.style.top = `${newTop}px`;
            toolboxState.ticking = false;
        });
        toolboxState.ticking = true;
    }
}

function closeDragElement() {
    const toolbox = $("#editor-toolbox");
    toolbox.classList.remove('dragging');
    toolboxState.pos.top = toolbox.offsetTop;
    toolboxState.pos.left = toolbox.offsetLeft;
    document.removeEventListener('mousemove', elementDrag);
    saveToolboxState();
}


function findPotentialConflicts(employeeId, turnoId, date, escala) {
    const { turnos, funcionarios } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    const newShiftTurno = turnosMap[turnoId];
    const conflitos = [];
    if (!employee || !newShiftTurno) return [];

    const slotsSimulados = JSON.parse(JSON.stringify(escala.slots));
    const existingSlotIndex = slotsSimulados.findIndex(s => s.assigned === employeeId && s.date === date);
    if (existingSlotIndex > -1) {
        slotsSimulados.splice(existingSlotIndex, 1);
    }
    slotsSimulados.push({ id: 'temp', assigned: employeeId, date: date, turnoId: turnoId });
    
    const restViolation = checkMandatoryRestViolation(employee, newShiftTurno, date, slotsSimulados, turnosMap);
    if (restViolation.violation) {
        conflitos.push(restViolation.message);
    }
    
    const maxDias = (escala.regras && escala.regras.maxDiasConsecutivos) || 6;
    const diasFuturos = calculateConsecutiveWorkDays(employeeId, slotsSimulados, date, turnosMap);
    if (diasFuturos > maxDias) {
        conflitos.push(`Excede o limite de ${maxDias} dias de trabalho consecutivos.`);
    }

    return conflitos;
}


function initEditor() {
    Object.assign(editorState, {
        editMode: 'employee', selectedCell: null, focusedEmployeeId: null,
        focusedEmployeeIndex: -1, alphabetizedFuncs: [], selectedShiftBrush: null,
        lastHoveredDate: null, selectedCellCoords: { row: -1, col: -1 },
        allConflicts: [], selectedAbsenceBrush: 'ferias', 
        selectedFolgaReason: 'Folga Normal', selectedAfastamentoReason: 'Atestado Médico',
        isPaintingAbsence: false, absencePaintStartCell: null,
    });
    const toolbox = $("#editor-toolbox");
    if(!toolbox) return;
    
    toolbox.classList.remove("hidden");
    loadToolboxState();

    $$(".toolbox-mode-btn").forEach(btn => btn.onclick = null);
    $('#toolbox-drag-handle').onmousedown = null;
    $('#toggle-toolbox-size-btn').onclick = null;
    $('#show-shortcuts-btn').onclick = null;
    $(".toolbox-content").onclick = null;
    $(".toolbox-content").onchange = null;
    document.onkeydown = null;
    const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
    if(tableWrap) {
        tableWrap.onclick = null;
        tableWrap.onmouseover = null;
        tableWrap.ondragstart = null;
        tableWrap.ondragover = null;
        tableWrap.ondragleave = null;
        tableWrap.ondrop = null;
        tableWrap.onmousedown = null;
        tableWrap.onmouseup = null;
    }

    $$(".toolbox-mode-btn").forEach(btn => btn.onclick = () => setEditMode(btn.dataset.mode));
    $('#toolbox-drag-handle').onmousedown = dragMouseDown;
    $('#toggle-toolbox-size-btn').onclick = toggleToolboxSize;
    $('#show-shortcuts-btn').onclick = exibirAtalhosDeTeclado;

    if(tableWrap) {
        tableWrap.onclick = handleTableClick;
        tableWrap.onmouseover = handleTableMouseover;
        tableWrap.ondragstart = handleDragStart;
        tableWrap.ondragover = handleDragOver;
        tableWrap.ondragleave = handleDragLeave;
        tableWrap.ondrop = handleDrop;
        tableWrap.onmousedown = handleAbsenceMouseDown;
        tableWrap.onmouseup = handleAbsenceMouseUp;
    }
    
    $(".toolbox-content").onclick = handleToolboxClick;
    $(".toolbox-content").onchange = handleToolboxChange;
    document.onkeydown = handleKeyboardNav;

    setEditMode('employee');
    runAllValidations();
}

function setEditMode(mode) {
    editorState.editMode = mode;
    clearCellFocus();
    
    if (mode === 'employee') {
        const { funcionarios } = store.getState();
        editorState.alphabetizedFuncs = funcionarios
            .filter(f => currentEscala.historico.hasOwnProperty(f.id) && f.status !== 'arquivado')
            .sort((a, b) => a.nome.localeCompare(b.nome));
        
        if (editorState.alphabetizedFuncs.length > 0) {
            const currentFocusedIndex = editorState.alphabetizedFuncs.findIndex(f => f.id === editorState.focusedEmployeeId);
            editorState.focusedEmployeeIndex = (currentFocusedIndex !== -1) ? currentFocusedIndex : 0;
            editorState.focusedEmployeeId = editorState.alphabetizedFuncs[editorState.focusedEmployeeIndex].id;
        } else {
             editorState.focusedEmployeeIndex = -1;
             editorState.focusedEmployeeId = null;
        }
    } else {
        editorState.focusedEmployeeId = null;
        editorState.focusedEmployeeIndex = -1;
    }

    highlightEmployeeRow(editorState.focusedEmployeeId);
    $$(".toolbox-mode-btn").forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    
    const table = $(".escala-final-table");
    if (table) {
        table.classList.toggle('employee-paint-mode', mode === 'employee');
        table.classList.toggle('absence-paint-mode', mode === 'absences');
        table.classList.toggle('eraser-mode', mode === 'eraser');
    }
    updateToolboxView();
}

function handleTableClick(event) {
    const cell = event.target.closest('.editable-cell');
    if (!cell) return;
    const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
    const rowIndex = allRows.findIndex(row => row.contains(cell));
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell) - 1;
    focusCell(rowIndex, colIndex);
    if (editorState.editMode === 'employee') handleEmployeePaint(cell);
    else if (editorState.editMode === 'eraser') handleEraseClick(cell);
    else if (editorState.editMode === 'absences' && !editorState.isPaintingAbsence) applyAbsenceToCell(cell);
}

function handleTableMouseover(event) {
    if (editorState.isPaintingAbsence) {
        handleAbsenceMouseOver(event);
        return;
    }

    const cell = event.target.closest('.editable-cell');
    if (cell && editorState.editMode === 'employee') {
        const { date, employeeId } = cell.dataset;
        const turnoId = editorState.selectedShiftBrush;
        if (date && date !== editorState.lastHoveredDate) {
            editorState.lastHoveredDate = date;
            const card = $(".focused-employee-card");
            if(card) updateConsecutiveDaysIndicator(card, date);
        }
        if (employeeId === editorState.focusedEmployeeId && turnoId && date) {
            const conflitos = findPotentialConflicts(employeeId, turnoId, date, currentEscala);
            cell.title = conflitos.length > 0 ? conflitos.join('\n') : (store.getState().turnos.find(t => t.id === turnoId)?.nome || '');
        }
    }
}

function updateAllIndicators() {
    if(editorState.editMode === 'employee') {
        const card = $(".focused-employee-card");
        if(card) updateIndicatorsInCard(card);
    }
}

function updateIndicatorsInCard(card) {
    const employeeId = card.dataset.employeeId;
    const employee = store.getState().funcionarios.find(f => f.id === employeeId);
    if (!employee) return;
    
    const metaHoras = calcularMetaHoras(employee, currentEscala.inicio, currentEscala.fim);
    const horasTrabalhadas = (currentEscala.historico[employee.id]?.horasTrabalhadas / 60) || 0;
    let mainPercentage = metaHoras > 0 ? (horasTrabalhadas / metaHoras) * 100 : 0;
    let overtimePercentage = 0;
    if (mainPercentage > 100) {
        overtimePercentage = mainPercentage - 100;
        mainPercentage = 100;
    }
    let barColorClass = 'progress-bar-blue';
    if (mainPercentage >= 105) barColorClass = 'progress-bar-green';
    else if (mainPercentage > 80) barColorClass = 'progress-bar-yellow';

    const workloadText = $('.workload-text-compact', card);
    if (workloadText) {
        workloadText.innerHTML = `${horasTrabalhadas.toFixed(1)}h / ${metaHoras.toFixed(1)}h`;
    }
    const mainBar = $('.progress-bar-main', card);
    if (mainBar) {
        mainBar.className = `progress-bar progress-bar-main ${barColorClass}`;
        mainBar.style.width = `${mainPercentage.toFixed(2)}%`;
    }
    const overtimeBar = $('.progress-bar-overtime', card);
    if (overtimeBar) {
        overtimeBar.style.width = `${overtimePercentage.toFixed(2)}%`;
    }
    
    const targetDate = editorState.lastHoveredDate || currentEscala.fim;
    updateConsecutiveDaysIndicator(card, targetDate);
}

function updateConsecutiveDaysIndicator(card, targetDate) {
    const employeeId = card.dataset.employeeId;
    const container = $('.consecutive-days-container', card);
    if (employeeId && container) {
        const { turnos } = store.getState();
        const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
        
        const slotsSimulados = [...currentEscala.slots];
        if (editorState.selectedShiftBrush && !slotsSimulados.some(s => s.assigned === employeeId && s.date === targetDate)) {
             slotsSimulados.push({ assigned: employeeId, date: targetDate, turnoId: editorState.selectedShiftBrush });
        }

        const diasConsecutivos = calculateConsecutiveWorkDays(employeeId, slotsSimulados, targetDate, turnosMap);
        const maxDias = (currentEscala.regras && currentEscala.regras.maxDiasConsecutivos) || 6;
        let dotsHTML = '';
        for (let i = 1; i <= maxDias; i++) {
            const isFilled = i <= diasConsecutivos;
            const isLimit = isFilled && diasConsecutivos >= maxDias;
            dotsHTML += `<div class="day-dot ${isFilled ? 'filled' : ''} ${isLimit ? 'limit' : ''}" title="${diasConsecutivos}/${maxDias} dias"></div>`;
        }
        const isMaxDias = diasConsecutivos >= maxDias;
        container.innerHTML = `${dotsHTML} ${isMaxDias ? '<span class="limit-alert">!</span>' : ''}`;
    }
}


async function handleAddShiftClick(employeeId, turnoId, date) {
    const conflitos = findPotentialConflicts(employeeId, turnoId, date, currentEscala);
    if (conflitos.length > 0) {
        if (editorState.enforceRules) {
            showToast(`Ação bloqueada: ${conflitos.join(' ')}`);
            return;
        } else {
            const confirmado = await showConfirm({
                title: "Confirmar Ação com Conflito?",
                message: `Atenção: Esta alocação viola a(s) seguinte(s) regra(s): <br><strong>- ${conflitos.join('<br>- ')}</strong>.<br><br> Deseja continuar mesmo assim?`,
                confirmText: "Sim, Continuar"
            });
            if (!confirmado) return;
        }
    }

    const turno = store.getState().turnos.find(t => t.id === turnoId);
    if (!turno) return;

    const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
    
    const existingSlotIndex = currentEscala.slots.findIndex(s => s.date === date && s.assigned === employeeId);
    if (existingSlotIndex > -1) {
        const slotAntigo = currentEscala.slots[existingSlotIndex];
        const turnoAntigo = store.getState().turnos.find(t => t.id === slotAntigo.turnoId);
        if (turnoAntigo) {
            const cargaAntiga = calcCarga(turnoAntigo.inicio, turnoAntigo.fim, turnoAntigo.almocoMin, turnoAntigo.diasDeDiferenca);
            currentEscala.historico[employeeId].horasTrabalhadas -= cargaAntiga;
        }
        currentEscala.slots.splice(existingSlotIndex, 1);
    }
    
    const novoSlot = { date, turnoId, assigned: employeeId, id: uid(), isExtra: currentEscala.isManual };
    currentEscala.slots.push(novoSlot);

    if (!currentEscala.historico[employeeId]) currentEscala.historico[employeeId] = { horasTrabalhadas: 0 };
    currentEscala.historico[employeeId].horasTrabalhadas += cargaReal;
    
    surgicallyRerenderTable(currentEscala);
    updateAllIndicators();
    runSurgicalValidation([employeeId]);
    highlightEmployeeRow(employeeId);
}

function handleRemoveShiftClick(slotId) {
    const slotIndex = currentEscala.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return;

    const slot = currentEscala.slots[slotIndex];
    if (!slot.assigned) return;
    
    const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
    const employeeId = slot.assigned;

    if (turno) {
        const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
        currentEscala.historico[employeeId].horasTrabalhadas -= cargaReal;
    }
    
    const isGeradaAutomaticamente = !currentEscala.isManual;
    const hasCoberturaDefinida = isGeradaAutomaticamente && (currentEscala.cobertura[slot.turnoId] || 0) > 0;
    const isExtra = slot.isExtra === true;

    if (hasCoberturaDefinida && !isExtra) {
        slot.assigned = null;
        delete slot.equipeId;
    } else {
        currentEscala.slots.splice(slotIndex, 1);
    }
    
    surgicallyRerenderTable(currentEscala);
    updateAllIndicators();
    runSurgicalValidation([employeeId]);
    highlightEmployeeRow(employeeId);
}


function handleEmployeePaint(cell) {
    if (cell.dataset.equipeId) {
        showToast("Turnos de equipe não podem ser modificados individualmente.");
        return;
    }

    if (!editorState.focusedEmployeeId || !editorState.selectedShiftBrush) {
        showToast("Selecione um turno para começar a pintar.");
        return;
    }
    const { date, employeeId: cellEmployeeId } = cell.dataset;
    if (cellEmployeeId !== editorState.focusedEmployeeId) {
        showToast("Você só pode adicionar turnos na linha do funcionário selecionado.");
        return;
    }
    handleAddShiftClick(editorState.focusedEmployeeId, editorState.selectedShiftBrush, date);
}

async function handleEraseClick(cell) {
    const { slotId, equipeId, date } = cell.dataset;

    if (equipeId) {
        const { equipes } = store.getState();
        const equipe = equipes.find(e => e.id === equipeId);
        const confirmado = await showConfirm({
            title: "Remover Alocação de Equipe?",
            message: `Este turno faz parte da equipe "${equipe.nome}". Deseja remover a equipe inteira apenas para este dia (${new Date(date+'T12:00:00').toLocaleDateString()})?`,
            confirmText: "Sim, Remover Equipe do Dia"
        });
        if (confirmado) {
            handleRemoveTeamFromDay(equipeId, date);
        }
    } else if (slotId) {
        handleRemoveShiftClick(slotId);
    }
}

async function handleRemoveTeamFromDay(equipeId, date) {
    const { equipes, turnos } = store.getState();
    const equipe = equipes.find(e => e.id === equipeId);
    if (!equipe) return;
    
    const affectedEmployeeIds = [];

    equipe.funcionarioIds.forEach(funcId => {
        const slotIndex = currentEscala.slots.findIndex(s => s.date === date && s.assigned === funcId && s.equipeId === equipeId);
        if (slotIndex > -1) {
            const slot = currentEscala.slots[slotIndex];
            const turno = turnos.find(t => t.id === slot.turnoId);
            
            if (currentEscala.historico[funcId] && turno) {
                const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
                currentEscala.historico[funcId].horasTrabalhadas -= cargaReal;
                affectedEmployeeIds.push(funcId);
            }

            slot.assigned = null;
            delete slot.equipeId;
        }
    });

    if (affectedEmployeeIds.length > 0) {
        surgicallyRerenderTable(currentEscala);
        updateAllIndicators();
        runSurgicalValidation(affectedEmployeeIds);
        showToast(`Equipe "${equipe.nome}" removida do dia ${new Date(date+'T12:00:00').toLocaleDateString()}.`);
    }
}

function handleKeyboardNav(event){
    const toolbox = $("#editor-toolbox");
    if(!toolbox || toolbox.classList.contains('hidden') || toolbox.classList.contains('minimized')) return;
    if(event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    const key = event.key;
    let { row, col } = editorState.selectedCellCoords;

    if (key.toLowerCase() === 'q') { event.preventDefault(); showPrevEmployee(true); return; }
    if (key.toLowerCase() === 'e') { event.preventDefault(); showNextEmployee(true); return; }
    
    if (!isNaN(key) && key >= 1 && key <= 9) {
        event.preventDefault();
        const brushes = $$('.shift-brush');
        const index = parseInt(key, 10) - 1;
        if (brushes[index]) {
            handleSelectShiftBrush(brushes[index].dataset.turnoId);
        }
        return;
    }

    const focusedCell = getCellByCoords(row, col);
    if (focusedCell) {
        if (key === 'Delete' || key === 'Backspace') {
            event.preventDefault();
            handleEraseClick(focusedCell);
        }
        if (key === 'Enter') {
            event.preventDefault();
            handleEmployeePaint(focusedCell);
        }
    }
    
    if (key.startsWith('Arrow')) {
        event.preventDefault();
        const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
        if (allRows.length === 0) return;
        
        if (row === -1) { focusCell(0, 0); return; }

        const maxRows = allRows.length - 1;
        const maxCols = allRows[0].children.length - 2;

        switch(key) {
            case 'ArrowUp': row = Math.max(0, row - 1); break;
            case 'ArrowDown': row = Math.min(maxRows, row + 1); break;
            case 'ArrowLeft': col = Math.max(0, col - 1); break;
            case 'ArrowRight': col = Math.min(maxCols, col + 1); break;
        }
        focusCell(row, col);
    }
}

function handleToolboxClick(event) {
    const target = event.target;
    const shiftBrush = target.closest('.shift-brush');
    const navArrow = target.closest('.nav-arrow');
    const toggleBtn = target.closest('.toggle-btn');
    const conflictItem = event.target.closest('.conflict-list-item');
    const actionButton = target.closest('button[data-action]');
    const absenceBtn = target.closest('.absence-selector-btn');

    if (conflictItem) handleConflictPanelClick(event);
    if (shiftBrush) handleSelectShiftBrush(shiftBrush.dataset.turnoId);
    if (navArrow) {
        if(navArrow.id === 'next-employee-btn') showNextEmployee(true);
        if(navArrow.id === 'prev-employee-btn') showPrevEmployee(true);
    }
    if (toggleBtn && toggleBtn.dataset.action === 'toggle-rules') {
        handleToggleRules(toggleBtn.dataset.value);
    }
    if (actionButton) {
        switch(actionButton.dataset.action) {
            case 'clear-assignments': handleClearAssignments(); break;
        }
    }
    if (absenceBtn) {
        editorState.selectedAbsenceBrush = absenceBtn.dataset.value;
        updateToolboxView();
    }
}

function handleToolboxChange(event) {
    const target = event.target;
    if (target.id === 'absence-reason-select') {
        editorState.selectedAfastamentoReason = target.value;
    }
    if (target.id === 'folga-reason-select') {
        editorState.selectedFolgaReason = target.value;
    }
}

function showNextEmployee(animate = false){
    if (editorState.alphabetizedFuncs.length === 0) return;
    if(editorState.focusedEmployeeIndex < editorState.alphabetizedFuncs.length - 1) editorState.focusedEmployeeIndex++;
    else editorState.focusedEmployeeIndex = 0;
    editorState.animationDirection = 'right';
    updateFocusedEmployee(animate);
}
function showPrevEmployee(animate = false){
    if (editorState.alphabetizedFuncs.length === 0) return;
    if(editorState.focusedEmployeeIndex > 0) editorState.focusedEmployeeIndex--;
    else editorState.focusedEmployeeIndex = editorState.alphabetizedFuncs.length - 1;
    editorState.animationDirection = 'left';
    updateFocusedEmployee(animate);
}

function updateFocusedEmployee(animate = false){
    editorState.focusedEmployeeId = editorState.alphabetizedFuncs[editorState.focusedEmployeeIndex].id;
    editorState.selectedShiftBrush = null;
    highlightEmployeeRow(editorState.focusedEmployeeId);
    
    const contentEl = $(".toolbox-content");
    const currentCard = $(".focused-employee-view", contentEl);

    if (animate && currentCard) {
        const outClass = editorState.animationDirection === 'right' ? 'card-slide-out-left' : 'card-slide-out-right';
        currentCard.classList.add(outClass);
        setTimeout(() => {
            updateToolboxView();
        }, 300);
    } else {
        updateToolboxView();
    }
}

function updateToolboxView() {
    const { editMode } = editorState;
    const contentEl = $(".toolbox-content");
    const subtitle = $('#toolbox-dynamic-subtitle');
    const title = $('#toolbox-dynamic-title');

    if (editMode === 'employee') {
        title.textContent = 'Editar por Funcionário';
        subtitle.textContent = 'Use os pincéis de turno ou arraste os turnos na grade.';
        contentEl.innerHTML = renderFocusedEmployeeView(true);
    } else if (editMode === 'absences') {
        title.textContent = 'Adicionar Ausências';
        subtitle.textContent = 'Clique ou arraste na grade para aplicar ou remover.';
        contentEl.innerHTML = renderAbsencesView();
    } else if (editMode === 'eraser') {
        title.textContent = 'Modo Borracha';
        subtitle.textContent = 'Clique em um turno na escala para apagá-lo.';
        contentEl.innerHTML = '<div class="explanation-box" style="margin: 16px;"><div>Clique em qualquer turno alocado na tabela para removê-lo. Turnos de equipe serão removidos por completo no dia selecionado.</div></div>';
    } else if (editMode === 'conflicts') {
        title.textContent = 'Conflitos e Avisos';
        subtitle.textContent = 'Lista de regras violadas na escala atual.';
        contentEl.innerHTML = renderConflictsView();
    } else if (editMode === 'settings') {
        title.textContent = 'Ações e Ferramentas';
        subtitle.textContent = 'Execute ações em massa ou ajuste as regras do editor.';
        contentEl.innerHTML = renderActionsView();
    }
}

function renderActionsView() {
    const isEnforced = editorState.enforceRules;
    return `
        <div class="actions-panel">
            <div class="action-row">
                <div>
                    <label class="form-label">Limpar Alocações de Turno</label>
                    <p class="explanation">Remove todos os turnos da escala, preservando férias e afastamentos.</p>
                </div>
                <button class="danger" data-action="clear-assignments">Limpar Escala</button>
            </div>
            <div class="action-row">
                <div>
                    <label class="form-label">Forçar Cumprimento de Regras</label>
                    <p class="explanation">Impede ações que violem as regras de descanso e dias consecutivos.</p>
                </div>
                <div class="toggle-group">
                    <button class="toggle-btn ${!isEnforced ? 'active' : ''}" data-action="toggle-rules" data-value="off">Desligado</button>
                    <button class="toggle-btn ${isEnforced ? 'active' : ''}" data-action="toggle-rules" data-value="on">Ligado</button>
                </div>
            </div>
        </div>
    `;
}

async function handleClearAssignments() {
    const confirmado = await showPromptConfirm({
        title: "Limpar Todas as Alocações?",
        message: "Esta ação removerá todos os turnos alocados na escala. Férias, afastamentos e folgas avulsas serão mantidos. Esta ação não pode ser desfeita.",
        promptLabel: "Para confirmar, digite a palavra \"LIMPAR\":",
        requiredWord: "LIMPAR",
        confirmText: "Confirmar Limpeza"
    });

    if (!confirmado) return;

    const employeeIdsToUpdate = Object.keys(currentEscala.historico);

    for (const funcId in currentEscala.historico) {
        currentEscala.historico[funcId].horasTrabalhadas = 0;
    }

    if (currentEscala.isManual) {
        currentEscala.slots = [];
    } else {
        currentEscala.slots.forEach(slot => {
            slot.assigned = null;
            delete slot.equipeId; 
        });
    }

    surgicallyRerenderTable(currentEscala);
    runSurgicalValidation(employeeIdsToUpdate);
    updateAllIndicators();
    highlightEmployeeRow(editorState.focusedEmployeeId);
    showToast("Alocações da escala foram limpas.");
}

function renderAbsencesView() {
    const { selectedAbsenceBrush, selectedAfastamentoReason, selectedFolgaReason } = editorState;
    
    const tiposAfastamentoOpts = TIPOS_AFASTAMENTO.map(t => 
        `<option value="${t.nome}" ${selectedAfastamentoReason === t.nome ? 'selected' : ''}>${t.nome}</option>`
    ).join('');

    const tiposFolgaOpts = TIPOS_FOLGA.map(t => 
        `<option value="${t.nome}" ${selectedFolgaReason === t.nome ? 'selected' : ''}>${t.nome}</option>`
    ).join('');

    let reasonSelectorHTML = '';
    if (selectedAbsenceBrush === 'afastamento') {
        reasonSelectorHTML = `
            <div class="absence-reason-selector">
                <select id="absence-reason-select">${tiposAfastamentoOpts}</select>
            </div>
        `;
    } else if (selectedAbsenceBrush === 'folga') {
        reasonSelectorHTML = `
            <div class="absence-reason-selector">
                <select id="folga-reason-select">${tiposFolgaOpts}</select>
            </div>
        `;
    }

    return `
        <div class="absences-panel">
            <div class="absences-grid-container">
                <div class="toolbox-mode-buttons">
                    <button class="toolbox-mode-btn absence-selector-btn ${selectedAbsenceBrush === 'ferias' ? 'active' : ''}" data-value="ferias">🏖️ Férias</button>
                    <button class="toolbox-mode-btn absence-selector-btn ${selectedAbsenceBrush === 'folga' ? 'active' : ''}" data-value="folga">📝 Folga</button>
                    <button class="toolbox-mode-btn absence-selector-btn ${selectedAbsenceBrush === 'afastamento' ? 'active' : ''}" data-value="afastamento">🩺 Afastamento</button>
                </div>
                <div>${reasonSelectorHTML}</div>
            </div>
            <div class="explanation-box" style="margin-top: 16px;">
                <div>Selecione o tipo de ausência e depois clique em uma célula para aplicar ou remover. Você também pode clicar e arrastar sobre vários dias.</div>
            </div>
        </div>
    `;
}

function renderFocusedEmployeeView(animate = false) {
    const { focusedEmployeeId, alphabetizedFuncs, focusedEmployeeIndex } = editorState;
    if (!focusedEmployeeId) return `<div class="focused-employee-view"><p class="muted" style="text-align: center; padding: 2rem;">Nenhum funcionário para editar nesta escala.</p></div>`;

    const employee = alphabetizedFuncs[focusedEmployeeIndex];
    const { turnos } = store.getState();
    const turnosDisponiveis = turnos.filter(t => employee.disponibilidade && employee.disponibilidade[t.id]);
    
    const cardHTML = `<div class="focused-employee-card" data-employee-id="${employee.id}">
            <div class="focused-employee-header">
                <div class="employee-info">
                    <h5>${employee.nome}</h5>
                    <div class="employee-stats muted">${employee.documento || ''}</div>
                </div>
                <div class="shift-brushes-container">
                    ${turnosDisponiveis.map(turno => {
                        const isSelected = editorState.selectedShiftBrush === turno.id;
                        return `<div class="shift-brush ${isSelected ? 'selected' : ''}" data-turno-id="${turno.id}" style="background-color: ${turno.cor}; color: ${getContrastingTextColor(turno.cor)}" title="${turno.nome}">${turno.sigla}</div>`
                    }).join('')}
                </div>
            </div>
            <div class="employee-indicators">
                <span class="indicator-label">Carga Horária</span>
                <div class="workload-summary-compact">
                    <div class="progress-bar-container-compact">
                        <div class="progress-bar progress-bar-main"></div>
                        <div class="progress-bar progress-bar-overtime"></div>
                    </div>
                    <span class="workload-text-compact">0.0h / 0.0h</span>
                </div>
                <span class="indicator-label">Dias Consecutivos</span>
                <div class="consecutive-days-container"></div>
            </div>
        </div>`;

    let dotsHTML = '';
    alphabetizedFuncs.forEach((_, index) => {
        dotsHTML += `<div class="employee-dot ${index === focusedEmployeeIndex ? 'active' : ''}"></div>`;
    });

    const animationClass = animate ? (editorState.animationDirection === 'left' ? 'card-slide-in-left' : 'card-slide-in-right') : '';

    const fullHTML = `<div class="focused-employee-view ${animationClass}">
        <button id="prev-employee-btn" class="nav-arrow" title="Anterior (Q)">◀</button>
        ${cardHTML}
        <button id="next-employee-btn" class="nav-arrow" title="Próximo (E)">▶</button>
    </div>
    <div class="employee-progress-indicator">${dotsHTML}</div>`;
    
    setTimeout(() => {
        const card = $('.focused-employee-card');
        if (card) updateIndicatorsInCard(card);
    }, 0);

    return fullHTML;
}

function handleToggleRules(value) {
    editorState.enforceRules = value === 'on';
    const toolbox = $("#editor-toolbox");
    toolbox.classList.toggle('override-active', !editorState.enforceRules);
    showToast(editorState.enforceRules ? "Modo de regras estritas ATIVADO." : "Modo de flexibilização ATIVADO.");
    saveToolboxState();
    updateToolboxView();
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

function applyAbsenceToCell(cell) {
    const { employeeId, date, equipeId } = cell.dataset;
    if (!employeeId || !date) return;
    
    if (equipeId) {
        showToast("Não é possível adicionar uma ausência sobre um turno de equipe. Remova a equipe do dia primeiro.");
        return;
    }

    const { turnos } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

    if (!currentEscala.excecoes[employeeId]) {
        currentEscala.excecoes[employeeId] = { ferias: { dates: [] }, afastamento: { dates: [], motivo: '' }, folgas: [] };
    }
    
    const excecoesFunc = currentEscala.excecoes[employeeId];
    const emFerias = excecoesFunc.ferias.dates.includes(date);
    const afastado = excecoesFunc.afastamento.dates.includes(date);
    const folgaIndex = excecoesFunc.folgas.findIndex(f => f.date === date);

    const removerTurnoExistente = () => {
        const existingSlotIndex = currentEscala.slots.findIndex(s => s.assigned === employeeId && s.date === date);
        if (existingSlotIndex > -1) {
            const turnoRemovido = turnosMap[currentEscala.slots[existingSlotIndex].turnoId];
            if (turnoRemovido) {
                const cargaAntiga = calcCarga(turnoRemovido.inicio, turnoRemovido.fim, turnoRemovido.almocoMin, turnoRemovido.diasDeDiferenca);
                currentEscala.historico[employeeId].horasTrabalhadas -= cargaAntiga;
            }
            if (currentEscala.isManual) {
                currentEscala.slots.splice(existingSlotIndex, 1);
            } else {
                currentEscala.slots[existingSlotIndex].assigned = null;
            }
        }
    };

    if (editorState.selectedAbsenceBrush === 'ferias') {
        if (emFerias) {
            excecoesFunc.ferias.dates = excecoesFunc.ferias.dates.filter(d => d !== date);
        } else {
            removerTurnoExistente();
            if (!excecoesFunc.ferias.dates.includes(date)) excecoesFunc.ferias.dates.push(date);
            excecoesFunc.ferias.dates.sort();
        }
    } else if (editorState.selectedAbsenceBrush === 'afastamento') {
        if (afastado) {
            excecoesFunc.afastamento.dates = excecoesFunc.afastamento.dates.filter(d => d !== date);
        } else {
            removerTurnoExistente();
            if (!excecoesFunc.afastamento.dates.includes(date)) excecoesFunc.afastamento.dates.push(date);
            excecoesFunc.afastamento.motivo = editorState.selectedAfastamentoReason;
            excecoesFunc.afastamento.dates.sort();
        }
    } else if (editorState.selectedAbsenceBrush === 'folga') {
        if (folgaIndex > -1) {
            excecoesFunc.folgas.splice(folgaIndex, 1);
        } else {
            removerTurnoExistente();
            excecoesFunc.folgas.push({ date, tipo: editorState.selectedFolgaReason });
            excecoesFunc.folgas.sort((a,b) => a.date.localeCompare(b.date));
        }
    }
    
    surgicallyRerenderTable(currentEscala);
    updateAllIndicators();
    runSurgicalValidation([employeeId]);
    highlightEmployeeRow(employeeId);
}


function handleAbsenceMouseDown(event) {
    if (editorState.editMode !== 'absences') return;
    const cell = event.target.closest('.editable-cell');
    if (cell) {
        event.preventDefault();
        editorState.isPaintingAbsence = true;
        editorState.absencePaintStartCell = cell;
        
        const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
        tableWrap.addEventListener('mouseover', handleAbsenceMouseOver);
    }
}

function handleAbsenceMouseOver(event) {
    if (!editorState.isPaintingAbsence) return;
    const cell = event.target.closest('.editable-cell');
    
    $$('.editable-cell.paint-preview').forEach(c => c.classList.remove('paint-preview'));

    if (cell && editorState.absencePaintStartCell) {
        const startCell = editorState.absencePaintStartCell;
        const employeeId = startCell.dataset.employeeId;
        
        if (cell.dataset.employeeId === employeeId) {
            const row = startCell.parentElement;
            const allCells = Array.from(row.children).filter(c => c.classList.contains('editable-cell'));
            const startIndex = allCells.indexOf(startCell);
            const currentIndex = allCells.indexOf(cell);
            
            const [min, max] = [Math.min(startIndex, currentIndex), Math.max(startIndex, currentIndex)];

            for(let i = min; i <= max; i++) {
                allCells[i].classList.add('paint-preview');
            }
        }
    }
}

function handleAbsenceMouseUp(event) {
    if (!editorState.isPaintingAbsence) return;
    
    const tableWrap = $(`#${currentEscala.owner}-escalaTabelaWrap`);
    tableWrap.removeEventListener('mouseover', handleAbsenceMouseOver);
     $$('.editable-cell.paint-preview').forEach(c => c.classList.remove('paint-preview'));
    
    const endCell = event.target.closest('.editable-cell');
    const startCell = editorState.absencePaintStartCell;

    if (startCell && endCell && startCell.dataset.employeeId === endCell.dataset.employeeId) {
        const employeeId = startCell.dataset.employeeId;
        const row = startCell.parentElement;
        const allCells = Array.from(row.children).filter(c => c.classList.contains('editable-cell'));
        const startIndex = allCells.indexOf(startCell);
        const endIndex = allCells.indexOf(endCell);

        const [minIdx, maxIdx] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
        
        for (let i = minIdx; i <= maxIdx; i++) {
            applyAbsenceToCell(allCells[i]);
        }
    } else if (startCell && !endCell) { 
        applyAbsenceToCell(startCell);
    }
    
    editorState.isPaintingAbsence = false;
    editorState.absencePaintStartCell = null;
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

    editorState.allConflicts = [...existingConflicts, ...newConflicts].sort((a,b) => a.date.localeCompare(b.date));
    
    newConflicts.forEach(conflito => {
        const cell = $(`#${currentEscala.owner}-escalaTabelaWrap td[data-employee-id="${conflito.employeeId}"][data-date="${conflito.date}"]`);
        if (cell) {
            cell.classList.add('has-conflict');
            if (!$('.conflict-marker', cell)) {
                const marker = document.createElement('div');
                marker.className = 'conflict-marker';
                const tooltip = document.createElement('div');
                tooltip.className = 'conflict-marker-tooltip';
                tooltip.textContent = conflito.message;
                cell.appendChild(marker);
                cell.appendChild(tooltip);
            } else {
                const tooltip = $('.conflict-marker-tooltip', cell);
                if (!tooltip.textContent.includes(conflito.message)) {
                    tooltip.textContent += `\n${conflito.message}`;
                }
            }
        }
    });

    updateConflictTabBadge();
    if (editorState.editMode === 'conflicts') {
        updateToolboxView();
    }
}

function runAllValidations() {
    const { funcionarios } = store.getState();
    const funcsDaEscala = funcionarios.filter(f => currentEscala.historico && currentEscala.historico[f.id]);
    runSurgicalValidation(funcsDaEscala.map(f => f.id));
}

function updateConflictTabBadge() {
    const conflictBtn = $('.toolbox-mode-btn[data-mode="conflicts"]');
    if (!conflictBtn) return;
    
    let badge = $('.conflict-count-badge', conflictBtn);
    if(badge) badge.remove();

    const count = editorState.allConflicts.length;
    if (count > 0) {
        badge = document.createElement('span');
        badge.className = 'conflict-count-badge';
        badge.textContent = count;
        conflictBtn.appendChild(badge);
    }
}

function renderConflictsView() {
    const conflicts = editorState.allConflicts;
    if (conflicts.length === 0) {
        return `<div class="conflicts-view-container"><p class="muted" style="padding: 16px; text-align:center;">Nenhum conflito encontrado. Bom trabalho!</p></div>`;
    }

    const groupedByEmployee = conflicts.reduce((acc, conflict) => {
        if (!acc[conflict.employeeId]) {
            acc[conflict.employeeId] = { name: conflict.employeeName, conflicts: [] };
        }
        acc[conflict.employeeId].conflicts.push(conflict);
        return acc;
    }, {});

    let html = '<div class="conflicts-view-container">';
    for(const employeeId in groupedByEmployee) {
        const group = groupedByEmployee[employeeId];
        html += `<div class="conflict-group">
                    <div class="conflict-group-employee">${group.name}</div>`;
        group.conflicts.forEach(conflict => {
            html += `<div class="conflict-list-item" data-employee-id="${conflict.employeeId}" data-date="${conflict.date}">
                        <strong>${new Date(conflict.date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}:</strong> ${conflict.message}
                     </div>`;
        });
        html += `</div>`;
    }
    html += '</div>';

    return html;
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
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    const maxDias = (escala.regras && escala.regras.maxDiasConsecutivos) || 6;
    const conflitos = [];

    const turnosDoFunc = escala.slots
        .filter(s => s.assigned === employeeId)
        .sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < turnosDoFunc.length; i++) {
        const turnoAtual = turnosDoFunc[i];
        const turnoAtualInfo = turnosMap[turnoAtual.turnoId];
        if (!turnoAtualInfo) continue;
        
        const restValidation = checkMandatoryRestViolation(employee, turnoAtualInfo, turnoAtual.date, escala.slots, turnosMap);
        if (restValidation.violation) {
            conflitos.push({
                employeeId, date: turnoAtual.date,
                message: restValidation.message
            });
        }

        const dias = calculateConsecutiveWorkDays(employeeId, escala.slots, turnoAtual.date, turnosMap);
        if (dias > maxDias) {
            if (!conflitos.some(c => c.date === turnoAtual.date && c.message.includes('consecutivos'))) {
                conflitos.push({ employeeId, date: turnoAtual.date, message: `Excede ${maxDias} dias consecutivos.` });
            }
        }
    }
    
    return conflitos;
}

function getCellByCoords(row, col) {
    if (row < 0 || col < 0) return null;
    const allRows = $$(`#${currentEscala.owner}-escalaTabelaWrap tbody tr[data-employee-row-id]`);
    const targetRow = allRows[row];
    if (!targetRow) return null;
    return targetRow.children[col + 1];
}

function focusCell(row, col) {
    clearCellFocus();
    const cell = getCellByCoords(row, col);
    if (cell) {
        cell.classList.add('cell-focused');
        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        editorState.selectedCellCoords = { row, col };
    }
}

function clearCellFocus() {
    const focused = $('.cell-focused');
    if (focused) focused.classList.remove('cell-focused');
    editorState.selectedCellCoords = { row: -1, col: -1 };
}

function handleDragStart(e) {
    const cell = e.target.closest('.editable-cell[draggable="true"]');
    if (!cell) return;

    if (cell.dataset.equipeId) {
        showToast("Turnos de equipe não podem ser movidos.");
        e.preventDefault();
        return;
    }

    e.dataTransfer.effectAllowed = 'move';
    const sourceData = { slotId: cell.dataset.slotId };
    e.dataTransfer.setData('application/json', JSON.stringify(sourceData));
    setTimeout(() => cell.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    const cell = e.target.closest('.editable-cell');
    if (cell) cell.classList.add('drop-target');
}

function handleDragLeave(e) {
    const cell = e.target.closest('.editable-cell');
    if (cell) cell.classList.remove('drop-target');
}

async function handleDrop(e) {
    e.preventDefault();
    const targetCell = e.target.closest('.editable-cell');
    if (!targetCell) return;

    targetCell.classList.remove('drop-target');
    $$('.dragging').forEach(el => el.classList.remove('dragging'));

    if (targetCell.dataset.equipeId) {
        showToast("Não é possível mover um turno para uma célula ocupada por uma equipe.");
        return;
    }

    const sourceData = JSON.parse(e.dataTransfer.getData('application/json'));
    const sourceSlot = currentEscala.slots.find(s => s.id === sourceData.slotId);
    if (!sourceSlot) return;

    const targetEmployeeId = targetCell.dataset.employeeId;
    const targetDate = targetCell.dataset.date;
    const targetSlotId = targetCell.dataset.slotId;

    if (sourceSlot.assigned === targetEmployeeId && sourceSlot.date === targetDate) return;

    if (targetSlotId) {
        await handleSwapShiftClick(sourceData.slotId, targetSlotId);
    } else {
        const conflitos = findPotentialConflicts(targetEmployeeId, sourceSlot.turnoId, targetDate, currentEscala);
        if (editorState.enforceRules && conflitos.length > 0) {
            showToast(`Movimento inválido: ${conflitos.join(' ')}`);
            return;
        }

        const oldEmployeeId = sourceSlot.assigned;
        const turno = store.getState().turnos.find(t => t.id === sourceSlot.turnoId);

        if (turno) {
            const cargaReal = calcCarga(turno.inicio, turno.fim, turno.almocoMin, turno.diasDeDiferenca);
            currentEscala.historico[oldEmployeeId].horasTrabalhadas -= cargaReal;
            if (!currentEscala.historico[targetEmployeeId]) currentEscala.historico[targetEmployeeId] = { horasTrabalhadas: 0 };
            currentEscala.historico[targetEmployeeId].horasTrabalhadas += cargaReal;
        }
        
        sourceSlot.assigned = targetEmployeeId;
        sourceSlot.date = targetDate;

        surgicallyRerenderTable(currentEscala);
        runSurgicalValidation([oldEmployeeId, targetEmployeeId]);
        updateAllIndicators();
        highlightEmployeeRow(targetEmployeeId);
    }
}

async function handleSwapShiftClick(slot1Id, slot2Id) {
    const slot1 = currentEscala.slots.find(s => s.id === slot1Id);
    const slot2 = currentEscala.slots.find(s => s.id === slot2Id);
    if (!slot1 || !slot2) return;

    const func1Id = slot1.assigned;
    const func2Id = slot2.assigned;
    const turno1 = store.getState().turnos.find(t => t.id === slot1.turnoId);
    const turno2 = store.getState().turnos.find(t => t.id === slot2.turnoId);
    if(!turno1 || !turno2) return;

    const tempEscala = JSON.parse(JSON.stringify(currentEscala));
    const tempSlot1 = tempEscala.slots.find(s => s.id === slot1Id);
    const tempSlot2 = tempEscala.slots.find(s => s.id === slot2Id);
    tempSlot1.assigned = func2Id;
    tempSlot2.assigned = func1Id;

    const conflitos1 = findPotentialConflicts(func2Id, tempSlot1.turnoId, tempSlot1.date, tempEscala);
    const conflitos2 = findPotentialConflicts(func1Id, tempSlot2.turnoId, tempSlot2.date, tempEscala);
    const todosConflitos = [...new Set([...conflitos1, ...conflitos2])];
    
    if (todosConflitos.length > 0 && editorState.enforceRules) {
        showToast(`Troca inválida: ${todosConflitos.join('; ')}`);
        return;
    }
    
    const carga1 = calcCarga(turno1.inicio, turno1.fim, turno1.almocoMin, turno1.diasDeDiferenca);
    const carga2 = calcCarga(turno2.inicio, turno2.fim, turno2.almocoMin, turno2.diasDeDiferenca);

    currentEscala.historico[func1Id].horasTrabalhadas += (carga2 - carga1);
    currentEscala.historico[func2Id].horasTrabalhadas += (carga1 - carga2);

    slot1.assigned = func2Id;
    slot2.assigned = func1Id;

    surgicallyRerenderTable(currentEscala);
    runSurgicalValidation([func1Id, func2Id]);
    updateAllIndicators();
    highlightEmployeeRow(editorState.focusedEmployeeId);
}