/**************************************
 * 🛠️ Lógica do Editor Manual v4.1 (UI Final)
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
    allConflicts: [], // Armazena todos os conflitos atuais
};

// NOVO: Objeto para controlar o estado da caixa de ferramentas
const toolboxState = {
    isMinimized: false,
    isDragging: false,
    pos: { top: null, left: null },
    offset: { x: 0, y: 0 },
    ticking: false // Para o requestAnimationFrame
};


let lastEditedEmployeeId = null;


// --- FUNÇÕES DE CONTROLE DA CAIXA DE FERRAMENTAS ---

function saveToolboxState() {
    sessionStorage.setItem('ge_toolbox_state', JSON.stringify({
        isMinimized: toolboxState.isMinimized,
        pos: toolboxState.pos
    }));
}

function loadToolboxState() {
    let savedState = null;
    try {
        const savedStateJSON = sessionStorage.getItem('ge_toolbox_state');
        if (savedStateJSON) {
            savedState = JSON.parse(savedStateJSON);
        }
    } catch (e) {
        console.error("Erro ao carregar o estado da caixa de ferramentas:", e);
        sessionStorage.removeItem('ge_toolbox_state');
    }

    const toolbox = $("#editor-toolbox");
    if (!toolbox) return;

    // Aplica o estado de minimização primeiro, pois afeta a altura
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
        // Usa posicionamento padrão via CSS (bottom/right)
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
    
    // Calcula o offset do mouse em relação ao canto superior esquerdo da caixa
    toolboxState.offset.x = e.clientX - toolbox.offsetLeft;
    toolboxState.offset.y = e.clientY - toolbox.offsetTop;

    // Remove posicionamento via bottom/right para controle total via JS
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
    
    // Salva a posição final
    toolboxState.pos.top = toolbox.offsetTop;
    toolboxState.pos.left = toolbox.offsetLeft;
    
    document.removeEventListener('mousemove', elementDrag);
    saveToolboxState();
}


// --- FUNÇÕES AUXILIARES E DE VALIDAÇÃO ---

function checkPotentialConflicts(employeeId, turnoId, date, escala) {
    const { turnos, funcionarios } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const employee = funcionarios.find(f => f.id === employeeId);
    const conflitos = [];

    const maxDias = geradorState.maxDiasConsecutivos || 6;
    
    const slotsSimulados = [...escala.slots];
    if (!slotsSimulados.some(s => s.assigned === employeeId && s.date === date)) {
        slotsSimulados.push({ assigned: employeeId, date: date, turnoId: turnoId });
    }
    const diasFuturos = calculateConsecutiveWorkDays(employeeId, slotsSimulados, date, turnosMap);

    if (diasFuturos > maxDias) {
        conflitos.push(`Excede o limite de ${maxDias} dias de trabalho consecutivos.`);
    }

    if (employee.tipoContrato === 'clt') {
        const turnosDoFunc = escala.slots.filter(s => s.assigned === employeeId).sort((a, b) => a.date.localeCompare(b.date));
        const turnoAnterior = turnosDoFunc.filter(s => s.date < date).pop();
        if (turnoAnterior) {
            const infoTurnoAnterior = turnosMap[turnoAnterior.turnoId];
            if (infoTurnoAnterior.descansoObrigatorioHoras) {
                const fimTurnoAnterior = new Date(`${turnoAnterior.date}T${infoTurnoAnterior.fim}`);
                if (infoTurnoAnterior.fim < infoTurnoAnterior.inicio) fimTurnoAnterior.setDate(fimTurnoAnterior.getDate() + 1);

                const inicioTurnoAtual = new Date(`${date}T${turnosMap[turnoId].inicio}`);
                const diffHoras = (inicioTurnoAtual - fimTurnoAnterior) / (1000 * 60 * 60);

                if (diffHoras < infoTurnoAnterior.descansoObrigatorioHoras) {
                    conflitos.push(`Viola descanso obrigatório de ${infoTurnoAnterior.descansoObrigatorioHoras}h.`);
                }
            }
        }
    }
    return conflitos;
}


// --- INICIALIZAÇÃO E CONTROLE DE MODO ---
function initEditor() {
    Object.assign(editorState, {
        editMode: 'employee', selectedCell: null, focusedEmployeeId: null,
        focusedEmployeeIndex: -1, alphabetizedFuncs: [],
        selectedShiftBrush: null, lastHoveredDate: null,
        enforceRules: true,
        selectedCellCoords: { row: -1, col: -1 },
        allConflicts: [],
    });
    const toolbox = $("#editor-toolbox");
    if(!toolbox) return;
    
    toolbox.classList.remove('override-active');
    toolbox.classList.remove("hidden");
    
    loadToolboxState();

    $$(".toolbox-mode-btn").forEach(btn => btn.addEventListener('click', () => setEditMode(btn.dataset.mode)));
    
    $('#toolbox-drag-handle').addEventListener('mousedown', dragMouseDown);
    $('#toggle-toolbox-size-btn').addEventListener('click', toggleToolboxSize);
    $('#show-shortcuts-btn').addEventListener('click', exibirAtalhosDeTeclado);


    const tableWrap = $("#escalaTabelaWrap");
    tableWrap.removeEventListener('dragstart', handleDragStart);
    tableWrap.addEventListener('dragstart', handleDragStart);
    tableWrap.removeEventListener('dragover', handleDragOver);
    tableWrap.addEventListener('dragover', handleDragOver);
    tableWrap.removeEventListener('dragleave', handleDragLeave);
    tableWrap.addEventListener('dragleave', handleDragLeave);
    tableWrap.removeEventListener('drop', handleDrop);
    tableWrap.addEventListener('drop', handleDrop);
    
    tableWrap.removeEventListener('click', handleTableClick);
    tableWrap.addEventListener('click', handleTableClick);
    tableWrap.removeEventListener('mouseover', handleTableMouseover);
    tableWrap.addEventListener('mouseover', handleTableMouseover);

    const toolboxContent = $(".toolbox-content");
    toolboxContent.removeEventListener('click', handleToolboxClick);
    toolboxContent.addEventListener('click', handleToolboxClick);

    document.removeEventListener('keydown', handleKeyboardNav);
    document.addEventListener('keydown', handleKeyboardNav);

    setEditMode('employee'); 
}

function setEditMode(mode) {
    editorState.editMode = mode;
    clearCellFocus();
    
    if (mode === 'employee') {
        const { funcionarios } = store.getState();
        editorState.alphabetizedFuncs = funcionarios
            .filter(f => f.cargoId === currentEscala.cargoId)
            .sort((a, b) => a.nome.localeCompare(b.nome));
        
        if (editorState.alphabetizedFuncs.length > 0) {
            const currentFocusedIndex = editorState.alphabetizedFuncs.findIndex(f => f.id === editorState.focusedEmployeeId);
            if (currentFocusedIndex !== -1) {
                editorState.focusedEmployeeIndex = currentFocusedIndex;
            } else {
                editorState.focusedEmployeeIndex = 0;
                editorState.focusedEmployeeId = editorState.alphabetizedFuncs[0].id;
            }
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
        table.classList.toggle('eraser-mode', mode === 'eraser');
    }

    $$('.editable-cell.selected').forEach(c => c.classList.remove('selected'));
    updateToolboxView();
}

function handleTableClick(event) {
    const cell = event.target.closest('.editable-cell');
    if (!cell) return;

    const allRows = $$('#escalaTabelaWrap tbody tr[data-employee-row-id]');
    const rowIndex = allRows.findIndex(row => row.contains(cell));
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell) - 1;
    focusCell(rowIndex, colIndex);

    if (editorState.editMode === 'employee') handleEmployeePaint(cell);
    else if (editorState.editMode === 'eraser') handleEraseClick(cell);
}

function handleTableMouseover(event) {
    const cell = event.target.closest('.editable-cell');
    if (!cell) return;

    if (editorState.editMode === 'employee') {
        const targetDate = cell.dataset.date;
        const employeeId = editorState.focusedEmployeeId;
        const turnoId = editorState.selectedShiftBrush;

        $$('.proactive-conflict-tooltip').forEach(el => el.remove());

        if (targetDate && targetDate !== editorState.lastHoveredDate) {
            editorState.lastHoveredDate = targetDate;
            const card = $(".focused-employee-card");
            if(card) updateConsecutiveDaysIndicator(card, targetDate);
        }

        if (employeeId && turnoId && targetDate) {
            const conflitos = checkPotentialConflicts(employeeId, turnoId, targetDate, currentEscala);
            if (conflitos.length > 0) {
                cell.title = conflitos.join('\n');
            } else {
                cell.title = store.getState().turnos.find(t => t.id === turnoId)?.nome || '';
            }
        }
    }
}


// --- LÓGICA DE ATUALIZAÇÃO "CIRÚRGICA" ---
function updateAllIndicators() {
    if(editorState.editMode === 'employee' || editorState.editMode === 'settings') {
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
        if (!slotsSimulados.some(s => s.assigned === employeeId && s.date === targetDate)) {
             slotsSimulados.push({ assigned: employeeId, date: targetDate, turnoId: editorState.selectedShiftBrush });
        }

        const diasConsecutivos = calculateConsecutiveWorkDays(employeeId, slotsSimulados, targetDate, turnosMap);
        const maxDias = geradorState.maxDiasConsecutivos || 6;
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


// --- LÓGICA DOS MODOS DE EDIÇÃO ---
function handleEmployeePaint(cell) {
    if (!editorState.focusedEmployeeId || !editorState.selectedShiftBrush) {
        showToast("Selecione um turno para começar a pintar.");
        return;
    }
    const { date, employeeId: cellEmployeeId } = cell.dataset;
    if (cellEmployeeId !== editorState.focusedEmployeeId) {
        showToast("Você só pode adicionar turnos na linha do funcionário selecionado.");
        return;
    }
    // ALTERAÇÃO: Chama a nova função principal de ação
    handlePaintAction(editorState.focusedEmployeeId, editorState.selectedShiftBrush, date);
}

function handleEraseClick(cell) {
    const { slotId } = cell.dataset;
    if (slotId) {
        handleRemoveShiftClick(slotId);
    }
}

// --- NAVEGAÇÃO E ATUALIZAÇÃO DA VIEW ---

function handleKeyboardNav(event){
    const toolbox = $("#editor-toolbox");
    if(!toolbox || toolbox.classList.contains('hidden')) return;
    if(event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    const key = event.key;
    let { row, col } = editorState.selectedCellCoords;

    if (key.toLowerCase() === 'q') {
        event.preventDefault();
        showPrevEmployee(true);
        return;
    }
    if (key.toLowerCase() === 'e') {
        event.preventDefault();
        showNextEmployee(true);
        return;
    }
    
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
            if (focusedCell.dataset.slotId) {
                handleRemoveShiftClick(focusedCell.dataset.slotId);
            }
        }
        if (key === 'Enter') {
            event.preventDefault();
            handleEmployeePaint(focusedCell);
        }
    }
    
    if (key.startsWith('Arrow')) {
        event.preventDefault();
        const allRows = $$('#escalaTabelaWrap tbody tr[data-employee-row-id]');
        if (allRows.length === 0) return;
        
        if (row === -1) {
            focusCell(0, 0);
            return;
        }

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
    const employeeCard = target.closest('.employee-card');
    const toggleBtn = target.closest('.toggle-btn');
    const conflictItem = event.target.closest('.conflict-list-item');

    if(conflictItem) handleConflictPanelClick(event);
    if (shiftBrush) handleSelectShiftBrush(shiftBrush.dataset.turnoId);
    if (navArrow) {
        if(navArrow.id === 'next-employee-btn') showNextEmployee(true);
        if(navArrow.id === 'prev-employee-btn') showPrevEmployee(true);
    }
    if (employeeCard && typeof employeeCard.onclick === 'function') {
        employeeCard.onclick();
    }
    if (toggleBtn && toggleBtn.dataset.action === 'toggle-rules') {
        handleToggleRules(toggleBtn.dataset.value);
    }
}

function showNextEmployee(animate = false){
    if(editorState.focusedEmployeeIndex < editorState.alphabetizedFuncs.length - 1) editorState.focusedEmployeeIndex++;
    else editorState.focusedEmployeeIndex = 0;
    editorState.animationDirection = 'right';
    updateFocusedEmployee(animate);
}
function showPrevEmployee(animate = false){
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
    } else if (editMode === 'eraser') {
        title.textContent = 'Modo Borracha';
        subtitle.textContent = 'Clique em um turno na escala para apagá-lo.';
        contentEl.innerHTML = '';
    } else if (editMode === 'conflicts') {
        title.textContent = 'Conflitos e Avisos';
        subtitle.textContent = 'Lista de regras violadas na escala atual.';
        contentEl.innerHTML = renderConflictsView();
    }
    else if (editMode === 'settings') {
        title.textContent = 'Regras do Editor';
        subtitle.textContent = 'Controle como o editor lida com as regras da escala.';
        contentEl.innerHTML = renderToolboxForSettings();
    }
}

// --- RENDERIZAÇÃO DE CONTEÚDO PARA TOOLBOX ---

function renderToolboxForSettings() {
    const isEnforced = editorState.enforceRules;
    return `
        <div class="settings-panel">
            <div class="settings-row">
                <label class="form-label">Forçar Cumprimento de Regras</label>
                <div class="toggle-group">
                    <button class="toggle-btn ${!isEnforced ? 'active' : ''}" data-action="toggle-rules" data-value="off">Desligado</button>
                    <button class="toggle-btn ${isEnforced ? 'active' : ''}" data-action="toggle-rules" data-value="on">Ligado</button>
                </div>
            </div>
            <div class="explanation-box" style="margin: 0;">
                Quando <b>Ligado</b>, o sistema impede ações que violem as regras de descanso e dias consecutivos. Quando <b>Desligado</b>, permite a alocação forçada, mas sinaliza os conflitos gerados.
            </div>
        </div>
    `;
}

function renderFocusedEmployeeView(animate = false) {
    const { focusedEmployeeId, alphabetizedFuncs, focusedEmployeeIndex } = editorState;
    if (!focusedEmployeeId) return `<div class="focused-employee-view"><p class="muted">Nenhum funcionário neste cargo.</p></div>`;

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

// --- AÇÕES E MANIPULADORES DE EVENTOS ---
function surgicallyUpdateCell(employeeId, date, turno, slotId) {
    const cell = $(`td[data-employee-id="${employeeId}"][data-date="${date}"]`);
    if (!cell) return;

    cell.style.backgroundColor = '';
    cell.style.color = '';
    cell.textContent = '';
    cell.title = '';
    cell.dataset.slotId = slotId || '';
    cell.draggable = !!turno;
    cell.style.backgroundImage = ''; // Limpa o efeito listrado

    if (turno) {
        cell.style.backgroundColor = turno.cor;
        cell.style.color = getContrastingTextColor(turno.cor);
        cell.textContent = turno.sigla;
        cell.title = turno.nome;
    }
}

// NOVA FUNÇÃO: Lógica central para adicionar, remover ou trocar turnos.
async function handlePaintAction(employeeId, newTurnoId, date) {
    const { turnos } = store.getState();
    const newTurno = turnos.find(t => t.id === newTurnoId);
    if (!newTurno) return;

    const existingSlot = currentEscala.slots.find(s => s.date === date && s.assigned === employeeId);

    // CASO 1: A célula está vazia, ADICIONA o turno.
    if (!existingSlot) {
        const conflitos = checkPotentialConflicts(employeeId, newTurnoId, date, currentEscala);
        if (conflitos.length > 0) {
            if (editorState.enforceRules) {
                showToast(`Ação bloqueada: ${conflitos.join(' ')}`);
                return;
            } else {
                const confirmado = await showConfirm({
                    title: "Confirmar Ação com Conflito?",
                    message: `Atenção: Esta alocação viola a seguinte regra: <br><strong>${conflitos.join('; ')}</strong>.<br><br> Deseja continuar e registrar esta exceção?`,
                    confirmText: "Sim, Continuar",
                    cancelText: "Cancelar"
                });
                if (!confirmado) return;
            }
        }
        
        const slotParaPreencher = { date, turnoId: newTurnoId, assigned: employeeId, id: uid() };
        currentEscala.slots.push(slotParaPreencher);

        if (!currentEscala.historico[employeeId]) currentEscala.historico[employeeId] = { horasTrabalhadas: 0 };
        currentEscala.historico[employeeId].horasTrabalhadas += newTurno.cargaMin;
        
        surgicallyUpdateCell(employeeId, date, newTurno, slotParaPreencher.id);
    
    // CASO 2: A célula NÃO está vazia.
    } else {
        // SUB-CASO 2A: O turno é o MESMO, então REMOVE (toggle).
        if (existingSlot.turnoId === newTurnoId) {
            handleRemoveShiftClick(existingSlot.id);
            return; // A função de remover já atualiza tudo, então paramos aqui.
        } 
        
        // SUB-CASO 2B: O turno é DIFERENTE, então pergunta se quer TROCAR.
        else {
            const oldTurno = turnos.find(t => t.id === existingSlot.turnoId);
            const confirmado = await showConfirm({
                title: "Trocar Turno?",
                message: `Deseja substituir o turno "${oldTurno.nome}" pelo turno "${newTurno.nome}" neste dia?`
            });

            if (!confirmado) return;

            // Lógica da troca
            currentEscala.historico[employeeId].horasTrabalhadas -= oldTurno.cargaMin;
            currentEscala.historico[employeeId].horasTrabalhadas += newTurno.cargaMin;
            existingSlot.turnoId = newTurnoId;

            surgicallyUpdateCell(employeeId, date, newTurno, existingSlot.id);
        }
    }

    // Atualizações que rodam para ADIÇÃO e TROCA
    runSurgicalValidation([employeeId]);
    updateAllIndicators();
    renderResumoDetalhado(currentEscala);
}


function handleToggleRules(value) {
    editorState.enforceRules = value === 'on';
    const toolbox = $("#editor-toolbox");
    toolbox.classList.toggle('override-active', !editorState.enforceRules);
    
    if (editorState.enforceRules) {
        showToast("Modo de regras estritas ATIVADO.");
    } else {
        showToast("Modo de flexibilização ATIVADO.");
    }
    updateToolboxView();
}

function handleSelectShiftBrush(turnoId) {
    if (editorState.selectedShiftBrush === turnoId) {
        editorState.selectedShiftBrush = null;
    } else {
        editorState.selectedShiftBrush = turnoId;
    }
    const cardContent = renderFocusedEmployeeView();
    $(".toolbox-content").innerHTML = cardContent;
}

function handleRemoveShiftClick(slotId) {
    const slotIndex = currentEscala.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return;
    
    const slot = currentEscala.slots[slotIndex];
    if (!slot || !slot.assigned) return;

    const turno = store.getState().turnos.find(t => t.id === slot.turnoId);
    const employeeId = slot.assigned;

    currentEscala.historico[employeeId].horasTrabalhadas -= turno.cargaMin;
    
    currentEscala.slots.splice(slotIndex, 1);
    surgicallyUpdateCell(employeeId, slot.date, null, null);
    
    runSurgicalValidation([employeeId]);
    updateAllIndicators();
    renderResumoDetalhado(currentEscala);
}

function highlightEmployeeRow(employeeId) {
    $$('.escala-final-table tbody tr').forEach(row => row.classList.remove('employee-row-highlight'));
    if (employeeId) {
        const row = $(`#escalaTabelaWrap tr[data-employee-row-id="${employeeId}"]`);
        if (row) row.classList.add('employee-row-highlight');
    }
}


// --- MOTOR DE VALIDAÇÃO E PAINEL DE CONFLITOS ---

function runSurgicalValidation(employeeIdsToUpdate) {
    const { funcionarios } = store.getState();
    const existingConflicts = editorState.allConflicts.filter(c => !employeeIdsToUpdate.includes(c.employeeId));
    let newConflicts = [];

    employeeIdsToUpdate.forEach(funcId => {
        // Limpa marcadores visuais antigos para este funcionário
        $$(`.editable-cell.has-conflict[data-employee-id="${funcId}"]`).forEach(cell => {
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
    
    // Atualiza apenas os marcadores visuais para os novos conflitos
    newConflicts.forEach(conflito => {
        const cell = $(`td[data-employee-id="${conflito.employeeId}"][data-date="${conflito.date}"]`);
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
                tooltip.textContent += `\n${conflito.message}`;
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
    const cell = $(`td[data-employee-id="${employeeId}"][data-date="${date}"]`);
    
    if (cell) {
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        cell.classList.remove('cell-highlight-animation');
        void cell.offsetWidth;
        cell.classList.add('cell-highlight-animation');
    }
}

function validateEmployeeSchedule(employeeId, escala) {
    const { turnos } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const maxDias = geradorState.maxDiasConsecutivos || 6;
    const conflitos = [];

    const turnosDoFunc = escala.slots
        .filter(s => s.assigned === employeeId)
        .sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 1; i < turnosDoFunc.length; i++) {
        const turnoAtual = turnosDoFunc[i];
        const turnoAnterior = turnosDoFunc[i - 1];
        
        const infoTurnoAnterior = turnosMap[turnoAnterior.turnoId];
        if (!infoTurnoAnterior || !infoTurnoAnterior.descansoObrigatorioHoras) continue;

        const fimTurnoAnterior = new Date(`${turnoAnterior.date}T${infoTurnoAnterior.fim}`);
        if(infoTurnoAnterior.fim < infoTurnoAnterior.inicio) fimTurnoAnterior.setDate(fimTurnoAnterior.getDate() + 1);

        const inicioTurnoAtual = new Date(`${turnoAtual.date}T${turnosMap[turnoAtual.turnoId].inicio}`);
        const diffHoras = (inicioTurnoAtual - fimTurnoAnterior) / (1000 * 60 * 60);

        if (diffHoras < infoTurnoAnterior.descansoObrigatorioHoras) {
            conflitos.push({
                employeeId,
                date: turnoAtual.date,
                message: `Descanso insuficiente (${diffHoras.toFixed(1)}h).`
            });
        }
    }

    turnosDoFunc.forEach(turno => {
        const dias = calculateConsecutiveWorkDays(employeeId, escala.slots, turno.date, turnosMap);
        if (dias > maxDias) {
            if (!conflitos.some(c => c.date === turno.date && c.message.includes('consecutivos'))) {
                conflitos.push({
                    employeeId,
                    date: turno.date,
                    message: `Excede ${maxDias} dias consecutivos.`
                });
            }
        }
    });
    
    return conflitos;
}

// --- FUNÇÕES DE FOCO POR TECLADO ---
function getCellByCoords(row, col) {
    if (row < 0 || col < 0) return null;
    const allRows = $$('#escalaTabelaWrap tbody tr[data-employee-row-id]');
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


// --- LÓGICA DE ARRASTAR E SOLTAR (DRAG AND DROP) ---
function handleDragStart(e) {
    const cell = e.target.closest('.editable-cell[draggable="true"]');
    if (!cell) return;

    e.dataTransfer.effectAllowed = 'move';
    const sourceData = {
        slotId: cell.dataset.slotId,
        employeeId: cell.dataset.employeeId,
        date: cell.dataset.date,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(sourceData));
    setTimeout(() => cell.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    const cell = e.target.closest('.editable-cell');
    if (cell) {
        cell.classList.add('drop-target');
    }
}

function handleDragLeave(e) {
    const cell = e.target.closest('.editable-cell');
    if (cell) {
        cell.classList.remove('drop-target');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    const targetCell = e.target.closest('.editable-cell');
    if (!targetCell) return;

    targetCell.classList.remove('drop-target');
    $$('.dragging').forEach(el => el.classList.remove('dragging'));

    const sourceData = JSON.parse(e.dataTransfer.getData('application/json'));
    const targetData = {
        slotId: targetCell.dataset.slotId,
        employeeId: targetCell.dataset.employeeId,
        date: targetCell.dataset.date
    };

    if (sourceData.slotId === targetData.slotId) return;

    if (targetData.slotId) {
        await handleSwapShiftClick(sourceData.slotId, targetData.slotId);
    } 
    else {
        const sourceSlot = currentEscala.slots.find(s => s.id === sourceData.slotId);
        if (!sourceSlot) return;

        const conflitos = checkPotentialConflicts(targetData.employeeId, sourceSlot.turnoId, targetData.date, currentEscala);
        if (editorState.enforceRules && conflitos.length > 0) {
            showToast(`Movimento inválido: ${conflitos.join(' ')}`);
            return;
        }

        const oldEmployeeId = sourceSlot.assigned;
        const newEmployeeId = targetData.employeeId;
        const turno = store.getState().turnos.find(t => t.id === sourceSlot.turnoId);

        currentEscala.historico[oldEmployeeId].horasTrabalhadas -= turno.cargaMin;
        if (!currentEscala.historico[newEmployeeId]) currentEscala.historico[newEmployeeId] = { horasTrabalhadas: 0 };
        currentEscala.historico[newEmployeeId].horasTrabalhadas += turno.cargaMin;
        
        sourceSlot.assigned = newEmployeeId;
        sourceSlot.date = targetData.date;

        renderEscalaTable(currentEscala);
        runSurgicalValidation([oldEmployeeId, newEmployeeId]);
        updateAllIndicators();
        renderResumoDetalhado(currentEscala, [oldEmployeeId, newEmployeeId]);
    }
}

async function handleSwapShiftClick(slot1Id, slot2Id) {
    const slot1 = currentEscala.slots.find(s => s.id === slot1Id);
    const slot2 = currentEscala.slots.find(s => s.id === slot2Id);
    if (!slot1 || !slot2) return;

    const conflitosParaFunc1 = checkPotentialConflicts(slot1.assigned, slot2.turnoId, slot1.date, currentEscala);
    const conflitosParaFunc2 = checkPotentialConflicts(slot2.assigned, slot1.turnoId, slot2.date, currentEscala);
    const todosConflitos = [...new Set([...conflitosParaFunc1, ...conflitosParaFunc2])];
    
    if (todosConflitos.length > 0 && editorState.enforceRules) {
        showToast(`Troca inválida: ${todosConflitos.join('; ')}`);
        return;
    }
    
    const { turnos } = store.getState();
    const turno1 = turnos.find(t => t.id === slot1.turnoId);
    const turno2 = turnos.find(t => t.id === slot2.turnoId);
    const func1Id = slot1.assigned;
    const func2Id = slot2.assigned;

    currentEscala.historico[func1Id].horasTrabalhadas += (turno2.cargaMin - turno1.cargaMin);
    currentEscala.historico[func2Id].horasTrabalhadas += (turno1.cargaMin - turno2.cargaMin);

    slot1.assigned = func2Id;
    slot2.assigned = func1Id;

    renderEscalaTable(currentEscala);
    runSurgicalValidation([func1Id, func2Id]);
    updateAllIndicators();
    renderResumoDetalhado(currentEscala, [func1Id, func2Id]);
}