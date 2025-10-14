/**************************************
 * ✨ Assistente de Geração Automática (Versão Final Completa)
 **************************************/

// Estado global do assistente
let geradorState = {};
// Estado temporário para o editor de feriados
let tempHolidayData = {};
// Estado temporário para o editor de ausências
let tempAusencia = {
    tipo: TURNO_FERIAS_ID,
    funcionarios: new Set(),
    start: null,
    end: null,
};
// Gerenciador do estado do wizard (passos)
let wizardManager = null;

function setGeradorFormDirty(isDirty) {
    dirtyForms['gerar-escala'] = isDirty;
}

function resetGeradorWizard() {
    geradorState = {
        cargoId: null,
        inicio: null,
        fim: null,
        excecoes: {},
        feriados: [],
        selectedDate: null,
        maxDiasConsecutivos: 6,
        minFolgasSabados: 1,
        minFolgasDomingos: 1,
        cobertura: {},
        coberturaPorEquipe: {},
    };
    currentEscala = null;
    tempHolidayData = {};
    tempAusencia = {
        tipo: TURNO_FERIAS_ID,
        funcionarios: new Set(),
        start: null,
        end: null,
    };

    const wizardContainer = $("#gerador-wizard-container");
    if (wizardContainer) wizardContainer.classList.remove('hidden');
    
    const escalaView = $("#gerador-escalaView");
    if (escalaView) escalaView.classList.add('hidden');
    
    if ($("#gerar-escCargo")) $("#gerar-escCargo").value = '';
    if ($("#gerar-escIni")) $("#gerar-escIni").value = '';
    if ($("#gerar-escFim")) $("#gerar-escFim").value = '';
    const fimInput = $('#gerar-escFim');
    if (fimInput) fimInput.disabled = true;

    updateGeradorResumoDias();

    if ($("#holiday-calendars-container")) $("#holiday-calendars-container").innerHTML = '';
    if ($("#holiday-editor-container")) $("#holiday-editor-container").innerHTML = '';
    if ($("#holiday-list-wrapper")) $("#holiday-list-wrapper").innerHTML = '';
    if ($("#gerador-excecoes-funcionarios-container")) $("#gerador-excecoes-funcionarios-container").innerHTML = '';
    if ($("#gerador-cobertura-turnos-container")) $("#gerador-cobertura-turnos-container").innerHTML = '';

    const toolbox = $("#editor-toolbox");
    if (toolbox) toolbox.classList.add("hidden");

    if (wizardManager) {
        wizardManager.goToStep(1);
    }
    
    setGeradorFormDirty(false);
}

function initGeradorPage(options = {}) {
    const { cargos } = store.getState();
    if (cargos.length === 0) {
        showInfoModal({
            title: "Cadastro de Cargos Necessário",
            contentHTML: `<p>Para usar a geração automática, você precisa primeiro cadastrar pelo menos um cargo no sistema.</p>
                          <p>Clique em "Ir para Cargos" para começar.</p>`
        });
        setTimeout(() => go('cargos'), 100);
        return;
    }

    if (options.isEditing && options.escalaParaEditar) {
        const wizardContainer = $("#gerador-wizard-container");
        if(wizardContainer) wizardContainer.classList.add('hidden');
        
        const escalaView = $("#gerador-escalaView");
        if(escalaView) escalaView.classList.remove('hidden');

        currentEscala = options.escalaParaEditar;
        currentEscala.owner = 'gerador';

        renderEscalaTable(currentEscala);
    } else {
        resetGeradorWizard();
        renderGeradorCargoSelect();
    }
}

function renderGeradorCargoSelect() {
    const sel = $("#gerar-escCargo");
    if (!sel) return;
    const { cargos } = store.getState();
    sel.innerHTML = "<option value=''>Selecione um cargo para a escala</option>";
    cargos.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        sel.appendChild(o);
    });
}

function updateGeradorResumoDias() {
    const inicio = $("#gerar-escIni").value;
    const fim = $("#gerar-escFim").value;
    const resumoEl = $("#gerar-escResumoDias");
    if (resumoEl) {
        if (inicio && fim && fim >= inicio) {
            resumoEl.textContent = `Total: ${dateRangeInclusive(inicio, fim).length} dia(s)`;
        } else {
            resumoEl.textContent = 'Selecione o período para ver a duração da escala.';
        }
    }
}

// --- LÓGICA DO ASSISTENTE (WIZARD) ---
function createWizardManager() {
    const container = $("#gerador-wizard-container");
    if (!container) return { goToStep: () => {}, updateButtonState: () => {} };

    const tabs = $$("#gerador-wizard-tabs .painel-tab-btn", container);
    const contents = $$("#gerador-wizard-content .painel-tab-content", container);
    const nextBtn = $("#btn-gerador-next", container);
    let currentStep = 1;

    function updateButtonState() {
        if (!nextBtn) return;
        const cargoId = $("#gerar-escCargo").value;
        const inicio = $("#gerar-escIni").value;
        const fim = $("#gerar-escFim").value;
        const isStep1Complete = cargoId && inicio && fim && fim >= inicio;

        if (currentStep === 1) {
            nextBtn.disabled = !isStep1Complete;
        } else {
            nextBtn.disabled = false;
        }
        
        if (currentStep === 4) {
            nextBtn.innerHTML = '✨ Gerar Escala';
            parseEmojisInElement(nextBtn);
        } else {
            nextBtn.innerHTML = 'Próximo Passo &gt;';
        }
    }

    function goToStep(stepNumber) {
        currentStep = stepNumber;
        
        tabs.forEach(tab => {
            const step = parseInt(tab.dataset.step, 10);
            tab.classList.remove('active', 'completed');
            tab.disabled = step > currentStep;
            if (step === currentStep) {
                tab.classList.add('active');
            } else if (step < currentStep) {
                tab.classList.add('completed');
            }
        });

        contents.forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent == currentStep);
        });

        switch (currentStep) {
            case 2: renderHolidayStep(); break;
            case 3: renderAusenciasStep(); break;
            case 4: renderPasso4_Cobertura(); break;
        }
        updateButtonState();
    }

    if (nextBtn) {
        nextBtn.onclick = (event) => {
            if (currentStep === 4) {
                playStarBurst(event);
                handleStartGeneration();
            } else {
                if (currentStep === 1) {
                    geradorState.cargoId = $("#gerar-escCargo").value;
                    geradorState.inicio = $("#gerar-escIni").value;
                    geradorState.fim = $("#gerar-escFim").value;
                    playEmojiBurst(event);
                }
                goToStep(currentStep + 1);
            }
        };
    }
    
    tabs.forEach(tab => {
        tab.onclick = () => {
            if (!tab.disabled) {
                goToStep(parseInt(tab.dataset.step, 10));
            }
        };
    });
    
    goToStep(1);

    return { goToStep, updateButtonState };
}

// --- PASSO 2: LÓGICA DE FERIADOS ---
function renderHolidayStep() {
    renderHolidayCalendar();
    renderHolidayEditor(geradorState.selectedDate);
    renderHolidayList();
}

function renderHolidayCalendar() {
    const container = $("#holiday-calendars-container");
    if (!container) return;
    const rangeSet = new Set(dateRangeInclusive(geradorState.inicio, geradorState.fim));
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
            const day = new Date(date + 'T12:00:00');
            const dayOfWeek = day.getUTCDay();
            const holiday = geradorState.feriados.find(f => f.date === date);
            let classes = 'calendar-day';
            if ([0, 6].includes(dayOfWeek)) classes += ' weekend';
            if (date === geradorState.selectedDate) classes += ' is-selected';
            if (holiday) {
                classes += ' is-holiday';
                if (!holiday.trabalha) classes += ' is-holiday-off';
            }
            html += `<div class="${classes}" data-date="${date}"><span class="day-number">${dayNumber}</span></div>`;
        }
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function handleCalendarDayClick(event) {
    const dayEl = event.target.closest('.calendar-day:not(.empty)');
    if (!dayEl) return;
    const newDate = dayEl.dataset.date;
    if (newDate === geradorState.selectedDate) return;
    geradorState.selectedDate = newDate;
    const existingHoliday = geradorState.feriados.find(f => f.date === geradorState.selectedDate);
    tempHolidayData = existingHoliday ? JSON.parse(JSON.stringify(existingHoliday)) : { date: newDate, nome: '', trabalha: true, descontaMeta: false, desconto: { horas: 8, turnos: 1 } };
    renderHolidayStep();
}

function renderHolidayEditor(date) {
    const container = $("#holiday-editor-container");
    if (!container) return;
    if (!date) {
        container.innerHTML = `<div class="holiday-editor-placeholder">Clique em um dia no calendário para configurá-lo.</div>`;
        return;
    }
    const holiday = tempHolidayData;
    container.innerHTML = `<div class="holiday-editor-content"><h5>${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {dateStyle: 'full'})}</h5><fieldset><legend>1. Nome do Feriado/Evento</legend><div class="animated-field"><input id="holiday-name" type="text" placeholder=" " value="${holiday.nome}" /><label for="holiday-name">Ex: Confraternização, Ponto Facultativo</label></div></fieldset><fieldset id="holiday-config-trabalho" disabled><legend>2. Configurações do Dia</legend><div class="holiday-config-row"><div class="form-group"><label class="form-label">Haverá Trabalho?</label><div class="toggle-group" id="holiday-trabalha-toggle"><button type="button" class="toggle-btn ${holiday.trabalha ? 'active' : ''}" data-value="sim">Sim</button><button type="button" class="toggle-btn ${!holiday.trabalha ? 'active' : ''}" data-value="nao">Não (Folga Geral)</button></div></div><div class="form-group"><label class="form-label">Descontar da Meta?</label><div class="toggle-group" id="holiday-desconta-toggle"><button type="button" class="toggle-btn ${holiday.descontaMeta ? 'active' : ''}" data-value="sim">Sim</button><button type="button" class="toggle-btn ${!holiday.descontaMeta ? 'active' : ''}" data-value="nao">Não</button></div></div></div></fieldset><fieldset id="holiday-desconto-options" class="${holiday.descontaMeta ? '' : 'hidden'}" disabled><legend>3. Valor do Desconto</legend><div class="form-row-aligned"><div class="animated-field" style="flex: 1;"><input id="holiday-desconto-horas" type="number" min="0" step="0.5" placeholder=" " value="${holiday.desconto.horas}" /><label for="holiday-desconto-horas">Horas a Descontar</label></div><div class="animated-field" style="flex: 1;"><input id="holiday-desconto-turnos" type="number" min="0" step="1" placeholder=" " value="${holiday.desconto.turnos}" /><label for="holiday-desconto-turnos">Turnos a Descontar</label></div></div><div class="explanation-box"><div>O valor será subtraído da meta do funcionário (seja ela em horas ou turnos) que não trabalhar neste dia.</div></div></fieldset><div class="holiday-editor-actions"><button id="holiday-save-btn" class="success">💾 Salvar</button><button id="holiday-remove-btn" class="danger" ${!geradorState.feriados.some(f => f.date === date) ? 'style="display:none;"' : ''}>🔥 Remover</button></div></div>`;
    addHolidayEditorListeners(date);
    parseEmojisInElement(container);
}

function renderHolidayList() {
    const container = $('#holiday-list-wrapper');
    if (!container) return;
    const sortedHolidays = [...geradorState.feriados].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedHolidays.length === 0) {
        container.innerHTML = `<fieldset class="fieldset-wrapper" style="height: 100%;"><legend>Feriados Adicionados</legend><p class="muted" style="text-align:center; padding: 1rem;">Nenhum feriado adicionado.</p></fieldset>`;
        return;
    }
    const listItems = sortedHolidays.map(h => {
        const d = new Date(h.date + 'T12:00:00');
        const isFolga = !h.trabalha;
        return `<li class="summary-list-item" data-date="${h.date}" style="border-color: ${isFolga ? '#22c55e':'#3b82f6'}"><div class="summary-list-item-header"><span class="item-type">${isFolga ? 'Folga Geral' : 'Dia de Trabalho'}</span><span class="item-name">${h.nome || ''}</span></div><div class="summary-list-item-body">${d.toLocaleDateString('pt-BR', {dateStyle: 'long'})}</div><div class="summary-list-item-footer"><button class="summary-delete-btn">Excluir</button></div></li>`;
    }).join('');
    container.innerHTML = `<fieldset class="fieldset-wrapper"><legend>Feriados Adicionados</legend><ul class="summary-list">${listItems}</ul></fieldset>`;
    $$('.summary-list-item').forEach(item => {
        item.onclick = (e) => {
            const date = item.dataset.date;
            if (e.target.classList.contains('summary-delete-btn')) {
                geradorState.feriados = geradorState.feriados.filter(f => f.date !== date);
                if (geradorState.selectedDate === date) {
                    geradorState.selectedDate = null;
                    tempHolidayData = {};
                }
                setGeradorFormDirty(true);
                renderHolidayStep();
                showToast("Feriado removido.");
                return;
            }
            if (date !== geradorState.selectedDate) {
                geradorState.selectedDate = date;
                const existingHoliday = geradorState.feriados.find(f => f.date === date);
                tempHolidayData = existingHoliday ? JSON.parse(JSON.stringify(existingHoliday)) : {};
                renderHolidayStep();
            }
        };
    });
}

function addHolidayEditorListeners(date) {
    const nomeInput = $('#holiday-name');
    const configTrabalhoFieldset = $('#holiday-config-trabalho');
    const descontaOptionsFieldset = $('#holiday-desconto-options');
    if (!nomeInput || !configTrabalhoFieldset || !descontaOptionsFieldset) return;
    if (nomeInput.value.trim()) {
        configTrabalhoFieldset.disabled = false;
        descontaOptionsFieldset.disabled = !tempHolidayData.descontaMeta;
    }
    nomeInput.oninput = () => {
        tempHolidayData.nome = nomeInput.value.trim();
        configTrabalhoFieldset.disabled = !tempHolidayData.nome;
        if (!tempHolidayData.nome) descontaOptionsFieldset.disabled = true;
        setGeradorFormDirty(true);
    };
    $('#holiday-desconto-horas').oninput = (e) => { tempHolidayData.desconto.horas = parseFloat(e.target.value) || 0; setGeradorFormDirty(true); };
    $('#holiday-desconto-turnos').oninput = (e) => { tempHolidayData.desconto.turnos = parseInt(e.target.value, 10) || 0; setGeradorFormDirty(true); };
    const setupToggle = (toggleId, onToggle) => {
        const toggleEl = $(toggleId);
        if (toggleEl) {
            toggleEl.onclick = (e) => {
                const btn = e.target.closest('.toggle-btn');
                if (btn) {
                    $$('.toggle-btn', toggleEl).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (onToggle) onToggle(btn.dataset.value);
                    setGeradorFormDirty(true);
                }
            };
        }
    };
    setupToggle('#holiday-trabalha-toggle', (value) => tempHolidayData.trabalha = value === 'sim');
    setupToggle('#holiday-desconta-toggle', (value) => {
        const isSim = value === 'sim';
        descontaOptionsFieldset.classList.toggle('hidden', !isSim);
        descontaOptionsFieldset.disabled = !isSim;
        tempHolidayData.descontaMeta = isSim;
    });
    $('#holiday-save-btn').onclick = () => {
        if (!tempHolidayData.nome.trim() && tempHolidayData.trabalha) {
            showToast("Por favor, dê um nome ao feriado ou marque como 'Folga Geral'.");
            return;
        }
        const index = geradorState.feriados.findIndex(f => f.date === date);
        if (index > -1) {
            geradorState.feriados[index] = { ...tempHolidayData };
        } else {
            geradorState.feriados.push({ ...tempHolidayData });
        }
        setGeradorFormDirty(true);
        renderHolidayCalendar();
        renderHolidayList();
        showToast("Feriado salvo!");
        $('#holiday-remove-btn').style.display = 'inline-flex';
    };
    $('#holiday-remove-btn').onclick = () => {
        geradorState.feriados = geradorState.feriados.filter(f => f.date !== date);
        geradorState.selectedDate = null;
        tempHolidayData = {};
        setGeradorFormDirty(true);
        renderHolidayStep();
        showToast("Feriado removido.");
    };
}

// --- PASSO 3: LÓGICA DE AUSÊNCIAS ---
function renderAusenciasStep() {
    const { funcionarios } = store.getState();
    const funcs = funcionarios.filter(f => f.cargoId === geradorState.cargoId && f.status !== 'arquivado').sort((a,b) => a.nome.localeCompare(b.nome));
    const container = $("#gerador-excecoes-funcionarios-container");
    if(!container) return;

    let html = `
        <div class="passo2-holiday-grid" id="ausencia-step-container">
            <div id="ausencia-calendars-container" class="calendars-wrapper"></div>
            <div id="ausencia-editor-container" class="holiday-editor-wrapper">
                <div class="holiday-editor-content">
                    <fieldset id="ausencia-funcs-fieldset">
                        <legend>1. Selecione o(s) Funcionário(s)</legend>
                        <div id="ausencia-funcionario-list" class="check-container" style="max-height: 150px; overflow-y: auto; padding: 8px;">
                            ${funcs.length > 0 ? funcs.map(f => `<label class="check-inline" data-func-id="${f.id}"><input type="checkbox" name="ausencia-funcionario-check" value="${f.id}">${f.nome}</label>`).join('') : '<p class="muted">Nenhum funcionário para este cargo.</p>'}
                        </div>
                    </fieldset>
                    <fieldset id="ausencia-tipo-fieldset" disabled>
                        <legend>2. Escolha o Tipo de Ausência</legend>
                        <div class="toggle-group" id="ausencia-tipo-toggle">
                            <button type="button" class="toggle-btn" data-value="${TURNO_FOLGA_ID}">Folga</button>
                            <button type="button" class="toggle-btn active" data-value="${TURNO_FERIAS_ID}">Férias</button>
                            <button type="button" class="toggle-btn" data-value="${TURNO_AFASTAMENTO_ID}">Afastamento</button>
                        </div>
                    </fieldset>
                    <fieldset id="ausencia-dates-fieldset" disabled>
                         <legend>3. Defina o Período</legend>
                        <div id="ausencia-date-selector" class="form-row" style="margin: 0;">
                            <div class="form-row form-row-vcenter" style="margin:0; flex-grow: 1;">
                                <label>Início <input type="date" id="ausencia-date-ini" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm"></label>
                                <label id="ausencia-date-fim-label">Fim <input type="date" id="ausencia-date-fim" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm"></label>
                            </div>
                            <button id="ausencia-save-btn" class="success" disabled>💾 Adicionar</button>
                        </div>
                        <p class="explanation-box" style="margin-top: 12px;">Selecione as datas diretamente no calendário à esquerda.</p>
                    </fieldset>
                </div>
            </div>
            <div id="ausencia-list-wrapper"></div>
        </div>`;
    container.innerHTML = html;
    addAusenciaListeners();
    renderAusenciaCalendar();
    renderAusenciaList();
    parseEmojisInElement(container);
}

function addAusenciaListeners() {
    const cal = $('#ausencia-calendars-container');
    if(cal) cal.onclick = handleAusenciaCalendarClick;
    const tipo = $('#ausencia-tipo-toggle');
    if(tipo) tipo.onclick = handleAusenciaTipoToggle;
    const funcList = $('#ausencia-funcionario-list');
    if(funcList) funcList.onchange = handleAusenciaFuncionarioChange;
    const dateIni = $('#ausencia-date-ini');
    if(dateIni) dateIni.onchange = handleAusenciaDateChange;
    const dateFim = $('#ausencia-date-fim');
    if(dateFim) dateFim.onchange = handleAusenciaDateChange;
    const saveBtn = $('#ausencia-save-btn');
    if(saveBtn) saveBtn.onclick = saveAusenciaPeriodo;
}

function renderAusenciaCalendar() {
    const container = $("#ausencia-calendars-container");
    if (!container) return;
    const rangeSet = new Set(dateRangeInclusive(geradorState.inicio, geradorState.fim));
    const months = {};
    rangeSet.forEach(date => { const monthKey = date.substring(0, 7); if (!months[monthKey]) months[monthKey] = true; });
    const datesInRange = tempAusencia.start && tempAusencia.end ? dateRangeInclusive(tempAusencia.start, tempAusencia.end) : (tempAusencia.start ? [tempAusencia.start] : []);
    const allAusenciasPorData = {};
    for (const funcId in geradorState.excecoes) {
        for (const tipoId in geradorState.excecoes[funcId]) {
            const dates = geradorState.excecoes[funcId][tipoId];
            if (dates && dates.length > 0) {
                dates.forEach(d => { if (!allAusenciasPorData[d]) allAusenciasPorData[d] = new Set(); allAusenciasPorData[d].add(tipoId); });
            }
        }
    }
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
            if (!rangeSet.has(date)) { html += '<div class="calendar-day empty"></div>'; continue; }
            const day = new Date(date + 'T12:00:00');
            const dayOfWeek = day.getUTCDay();
            let classes = 'calendar-day';
            if ([0, 6].includes(dayOfWeek)) classes += ' weekend';
            if (datesInRange.includes(date)) classes += ' is-selected';
            let dotsHTML = '';
            const ausenciasDoDia = allAusenciasPorData[date];
            if (ausenciasDoDia) {
                classes += ' has-ausencia';
                dotsHTML += '<div class="ausencia-dots-container">';
                if (ausenciasDoDia.size > 2) {
                    const firstType = ausenciasDoDia.values().next().value;
                    let dotClass = '';
                    if (firstType === TURNO_FOLGA_ID) dotClass = 'is-folga-dot'; else if (firstType === TURNO_FERIAS_ID) dotClass = 'is-ferias-dot'; else if (firstType === TURNO_AFASTAMENTO_ID) dotClass = 'is-afastamento-dot';
                    dotsHTML += `<div class="ausencia-dot ${dotClass}"></div><span class="ausencia-plus-symbol">+</span>`;
                } else {
                    ausenciasDoDia.forEach(tipoId => {
                        let dotClass = '';
                        if (tipoId === TURNO_FOLGA_ID) dotClass = 'is-folga-dot'; else if (tipoId === TURNO_FERIAS_ID) dotClass = 'is-ferias-dot'; else if (tipoId === TURNO_AFASTAMENTO_ID) dotClass = 'is-afastamento-dot';
                        dotsHTML += `<div class="ausencia-dot ${dotClass}"></div>`;
                    });
                }
                dotsHTML += '</div>';
            }
            html += `<div class="${classes}" data-date="${date}"><span class="day-number">${dayNumber}</span>${dotsHTML}</div>`;
        }
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function renderAusenciaList() {
    const container = $('#ausencia-list-wrapper');
    if(!container) return;
    const { funcionarios } = store.getState();
    const funcsMap = Object.fromEntries(funcionarios.map(f => [f.id, f.nome]));
    const allAusencias = [];
    for (const funcId in geradorState.excecoes) {
        for (const tipoId in geradorState.excecoes[funcId]) {
            const dates = geradorState.excecoes[funcId][tipoId];
            if (dates && dates.length > 0) {
                const ranges = dates.reduce((acc, date) => { if (acc.length > 0 && date === addDays(acc[acc.length - 1].end, 1)) { acc[acc.length - 1].end = date; } else { acc.push({ start: date, end: date }); } return acc; }, []);
                ranges.forEach(range => { allAusencias.push({ funcId, funcNome: funcsMap[funcId] || "Funcionário Removido", tipoId, tipoNome: TURNOS_SISTEMA_AUSENCIA[tipoId].nome, ...range }); });
            }
        }
    }
    allAusencias.sort((a,b) => a.start.localeCompare(b.start) || a.funcNome.localeCompare(b.funcNome));
    if (allAusencias.length === 0) {
        container.innerHTML = `<fieldset class="fieldset-wrapper" style="height: 100%;"><legend>Ausências Agendadas</legend><p class="muted" style="text-align:center; padding: 1rem;">Nenhuma ausência agendada.</p></fieldset>`;
        return;
    }
    const listItems = allAusencias.map(aus => {
        const d_start = new Date(aus.start + 'T12:00:00');
        const d_end = new Date(aus.end + 'T12:00:00');
        const dateStr = aus.start === aus.end ? d_start.toLocaleDateString('pt-BR', {dateStyle: 'long'}) : `${d_start.toLocaleDateString()} a ${d_end.toLocaleDateString()}`;
        return `<li class="summary-list-item" style="border-color: ${TURNOS_SISTEMA_AUSENCIA[aus.tipoId].cor};"><div class="summary-list-item-header"><span class="item-type">${aus.tipoNome}</span><span class="item-name">${aus.funcNome}</span></div><div class="summary-list-item-body">${dateStr}</div><div class="summary-list-item-footer"><button class="summary-delete-btn" data-remove-func-id="${aus.funcId}" data-remove-tipo-id="${aus.tipoId}" data-remove-start="${aus.start}" data-remove-end="${aus.end}">Excluir</button></div></li>`;
    }).join('');
    container.innerHTML = `<fieldset class="fieldset-wrapper"><legend>Ausências Agendadas</legend><ul class="summary-list">${listItems}</ul></fieldset>`;
    $$('.summary-delete-btn', container).forEach(btn => btn.onclick = removeAusencia);
}

function handleAusenciaTipoToggle(e) {
    const btn = e.target.closest('.toggle-btn');
    if (!btn || btn.classList.contains('active')) return;
    $$('.toggle-btn', e.currentTarget).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tempAusencia.tipo = btn.dataset.value;
    const fimLabel = $('#ausencia-date-fim-label');
    if(fimLabel) fimLabel.style.display = tempAusencia.tipo === TURNO_FOLGA_ID ? 'none' : 'flex';
    const datesFieldset = $('#ausencia-dates-fieldset');
    if(datesFieldset) datesFieldset.disabled = false;
    resetAusenciaDates(); 
}

function handleAusenciaFuncionarioChange() {
    tempAusencia.funcionarios = new Set($$('input[name="ausencia-funcionario-check"]:checked').map(chk => chk.value));
    const hasSelection = tempAusencia.funcionarios.size > 0;
    const tipoFieldset = $('#ausencia-tipo-fieldset');
    if(tipoFieldset) tipoFieldset.disabled = !hasSelection;
    if(!hasSelection) {
        const datesFieldset = $('#ausencia-dates-fieldset');
        if(datesFieldset) datesFieldset.disabled = true;
        resetAusenciaDates();
    }
}

function handleAusenciaDateChange() {
    const iniInput = $('#ausencia-date-ini');
    const fimInput = $('#ausencia-date-fim');
    tempAusencia.start = iniInput ? iniInput.value : null;
    tempAusencia.end = tempAusencia.tipo === TURNO_FOLGA_ID ? tempAusencia.start : (fimInput ? fimInput.value : null);
    const saveBtn = $('#ausencia-save-btn');
    if(saveBtn) saveBtn.disabled = !(tempAusencia.start && tempAusencia.end && tempAusencia.end >= tempAusencia.start && tempAusencia.funcionarios.size > 0);
    renderAusenciaCalendar();
}

function handleAusenciaCalendarClick(e) {
    const dayEl = e.target.closest('.calendar-day:not(.empty)');
    const datesFieldset = $('#ausencia-dates-fieldset');
    if (!dayEl || (datesFieldset && datesFieldset.disabled)) return;
    const date = dayEl.dataset.date;
    if (tempAusencia.tipo === TURNO_FOLGA_ID) {
        tempAusencia.start = date;
        tempAusencia.end = date;
    } else {
        if (!tempAusencia.start || (tempAusencia.start && tempAusencia.end)) {
            tempAusencia.start = date;
            tempAusencia.end = null;
        } else if (date < tempAusencia.start) {
            tempAusencia.end = tempAusencia.start;
            tempAusencia.start = date;
        } else {
            tempAusencia.end = date;
        }
    }
    const iniInput = $('#ausencia-date-ini');
    if(iniInput) iniInput.value = tempAusencia.start;
    const fimInput = $('#ausencia-date-fim');
    if(fimInput) fimInput.value = tempAusencia.end;
    handleAusenciaDateChange();
}

function saveAusenciaPeriodo() {
    if (tempAusencia.funcionarios.size === 0 || !tempAusencia.start || !tempAusencia.end) return;
    const range = dateRangeInclusive(tempAusencia.start, tempAusencia.end);
    tempAusencia.funcionarios.forEach(funcId => {
        if (!geradorState.excecoes[funcId]) geradorState.excecoes[funcId] = {};
        Object.keys(TURNOS_SISTEMA_AUSENCIA).forEach(tipoId => {
            if(geradorState.excecoes[funcId][tipoId]) {
                geradorState.excecoes[funcId][tipoId] = geradorState.excecoes[funcId][tipoId].filter(d => !range.includes(d));
            }
        });
        const currentDates = geradorState.excecoes[funcId][tempAusencia.tipo] || [];
        geradorState.excecoes[funcId][tempAusencia.tipo] = [...new Set([...currentDates, ...range])].sort();
    });
    setGeradorFormDirty(true);
    renderAusenciaList();
    resetAusenciaForm();
    showToast(`${TURNOS_SISTEMA_AUSENCIA[tempAusencia.tipo].nome} adicionada.`);
}

function removeAusencia(event) {
    const { removeFuncId, removeTipoId, removeStart, removeEnd } = event.target.dataset;
    const rangeToRemove = dateRangeInclusive(removeStart, removeEnd);
    const currentDates = geradorState.excecoes[removeFuncId]?.[removeTipoId] || [];
    geradorState.excecoes[removeFuncId][removeTipoId] = currentDates.filter(d => !rangeToRemove.includes(d));
    setGeradorFormDirty(true);
    renderAusenciaList();
    renderAusenciaCalendar();
    showToast("Ausência removida.");
}

function resetAusenciaDates() {
    tempAusencia.start = null;
    tempAusencia.end = null;
    const iniInput = $('#ausencia-date-ini');
    if(iniInput) iniInput.value = '';
    const fimInput = $('#ausencia-date-fim');
    if(fimInput) fimInput.value = '';
    const saveBtn = $('#ausencia-save-btn');
    if(saveBtn) saveBtn.disabled = true;
    renderAusenciaCalendar();
}

function resetAusenciaForm() {
    tempAusencia.funcionarios.clear();
    $$('input[name="ausencia-funcionario-check"]').forEach(chk => chk.checked = false);
    const tipoFieldset = $('#ausencia-tipo-fieldset');
    if(tipoFieldset) tipoFieldset.disabled = true;
    const datesFieldset = $('#ausencia-dates-fieldset');
    if(datesFieldset) datesFieldset.disabled = true;
    resetAusenciaDates();
}

// --- PASSO 4: LÓGICA DE COBERTURA ---
function renderPasso4_Cobertura() {
    const { cargos, turnos, equipes } = store.getState();
    const cargo = cargos.find(c => c.id === geradorState.cargoId);
    const container = $("#gerador-cobertura-turnos-container");
    if(!container) return;
    container.innerHTML = "";

    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        container.innerHTML = `<p class="muted">Este cargo não possui turnos associados.</p>`;
        return;
    }

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id)).sort((a,b)=>a.inicio.localeCompare(b.inicio));
    turnosDoCargo.forEach(turno => {
        const equipesCompativeis = equipes.filter(e => e.cargoId === cargo.id && e.turnoId === turno.id);
        const div = document.createElement('div');
        div.className = 'cobertura-modo-container cobertura-item';
        div.dataset.turnoId = turno.id;
        let equipesOptionsHTML = equipesCompativeis.length > 0 ? equipesCompativeis.map(equipe => `<div class="cobertura-equipe-row"><label class="check-inline"><input type="checkbox" name="equipe_check_${turno.id}" value="${equipe.id}">${equipe.nome} (${equipe.funcionarioIds.length} membros)</label><div class="cobertura-equipe-padrao" style="display: none;"><div class="animated-field"><input type="number" min="1" value="1" placeholder=" " data-pattern="work"><label>Trabalha</label></div><div class="animated-field"><input type="number" min="1" value="1" placeholder=" " data-pattern="off"><label>Folga</label></div><input type="date" data-pattern="start" min="${geradorState.inicio}" max="${geradorState.fim}" value="${geradorState.inicio}" title="Primeiro dia de trabalho da equipe"></div></div><div class="equipe-pattern-explanation" data-equipe-id="${equipe.id}" style="display: none;"></div>`).join('') : `<p class="muted" style="margin: 8px 0;">Nenhuma equipe cadastrada para este turno.</p>`;
        div.innerHTML = `<div class="form-row-aligned" style="margin-bottom: 8px;"><strong style="flex-grow: 1;">${turno.nome} (${turno.inicio} - ${turno.fim})</strong><div class="toggle-group" data-turno-id="${turno.id}"><button type="button" class="toggle-btn active" data-value="individual">Individual</button><button type="button" class="toggle-btn" data-value="equipes">Por Equipes</button></div></div><div class="cobertura-individual-options"><div class="animated-field" style="max-width: 200px;"><input type="number" id="cobertura-${turno.id}" data-cobertura="individual" value="1" min="0" placeholder=" " /><label for="cobertura-${turno.id}">Nº de funcionários</label></div></div><div class="cobertura-equipes-options" style="display: none;">${equipesOptionsHTML}<hr style="border: none; border-top: 1px solid var(--border); margin: 16px 0;"><div class="cobertura-complementar-container"><label class="form-label">Cobertura Individual Complementar:</label><div class="animated-field" style="max-width: 200px;"><input type="number" id="cobertura-extra-${turno.id}" data-cobertura="complementar" value="0" min="0" placeholder=" " /><label for="cobertura-extra-${turno.id}">Nº de funcionários</label></div></div></div>`;
        container.appendChild(div);
    });

    $$('.toggle-group', container).forEach(toggle => {
        $$('.toggle-btn', toggle).forEach(btn => {
            btn.onclick = () => {
                const turnoContainer = toggle.closest('.cobertura-modo-container');
                const modo = btn.dataset.value;
                $$('.toggle-btn', toggle).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $('.cobertura-individual-options', turnoContainer).style.display = modo === 'individual' ? 'block' : 'none';
                $('.cobertura-equipes-options', turnoContainer).style.display = modo === 'equipes' ? 'block' : 'none';
                setGeradorFormDirty(true);
            };
        });
    });
    $$('input[type="checkbox"][name^="equipe_check_"]', container).forEach(chk => {
        chk.onchange = () => {
            const row = chk.closest('.cobertura-equipe-row');
            const patternDiv = row.querySelector('.cobertura-equipe-padrao');
            const explanationDiv = row.nextElementSibling;
            patternDiv.style.display = chk.checked ? 'flex' : 'none';
            explanationDiv.style.display = chk.checked ? 'block' : 'none';
            if (chk.checked) updateTeamPatternExplanation(patternDiv);
            setGeradorFormDirty(true);
        };
    });
    $$('.cobertura-equipe-padrao input').forEach(input => {
        if (input.type === 'date') {
            input.addEventListener('click', function() { try { this.showPicker(); } catch (e) {} });
        }
        input.addEventListener('input', () => {
            const patternDiv = input.closest('.cobertura-equipe-padrao');
            updateTeamPatternExplanation(patternDiv);
            setGeradorFormDirty(true);
        });
    });
    $$('input[data-cobertura]', container).forEach(input => input.addEventListener('input', () => setGeradorFormDirty(true)));
}

function updateTeamPatternExplanation(patternDiv) {
    if(!patternDiv) return;
    const explanationDiv = patternDiv.closest('.cobertura-equipe-row').nextElementSibling;
    const work = parseInt(patternDiv.querySelector('[data-pattern="work"]').value, 10) || 1;
    const off = parseInt(patternDiv.querySelector('[data-pattern="off"]').value, 10) || 1;
    const startDate = patternDiv.querySelector('[data-pattern="start"]').value;
    if (!startDate) return explanationDiv.innerHTML = `Selecione uma data de início.`;
    const dateRange = dateRangeInclusive(geradorState.inicio, geradorState.fim);
    const startIndex = dateRange.indexOf(startDate);
    if (startIndex === -1) return explanationDiv.innerHTML = `A data de início está fora do período da escala.`;
    const ciclo = work + off;
    const diasDeTrabalho = [];
    for (let i = 0; i < Math.min(dateRange.length, 10); i++) {
        if ((i - startIndex) % ciclo >= 0 && (i - startIndex) % ciclo < work) {
            diasDeTrabalho.push(new Date(dateRange[i] + 'T12:00:00').getDate());
        }
    }
    explanationDiv.innerHTML = `🗓️ Esta equipe trabalhará em um padrão de ${work}x${off}, começando em ${new Date(startDate+'T12:00:00').toLocaleDateString()}.<br>Ex: Dias ${diasDeTrabalho.join(', ')}...`;
    parseEmojisInElement(explanationDiv);
}

// --- CONTROLES DA ESCALA GERADA ---
function handleStartGeneration() {
    geradorState.cobertura = {};
    geradorState.coberturaPorEquipe = {};
    $$('#gerador-cobertura-turnos-container .cobertura-modo-container').forEach(container => {
        const turnoId = container.dataset.turnoId;
        const modoAtivo = $('.toggle-btn.active', container);
        if(!modoAtivo) return;
        const modo = modoAtivo.dataset.value;
        if (modo === 'individual') {
            const input = $('[data-cobertura="individual"]', container);
            if(input) geradorState.cobertura[turnoId] = parseInt(input.value, 10) || 0;
        } else {
            const inputComp = $('[data-cobertura="complementar"]', container);
            if(inputComp) geradorState.cobertura[turnoId] = parseInt(inputComp.value, 10) || 0;
            geradorState.coberturaPorEquipe[turnoId] = [];
            $$('input[type="checkbox"][name^="equipe_check_"]:checked', container).forEach(chk => {
                const equipeId = chk.value;
                const patternContainer = chk.closest('.cobertura-equipe-row').querySelector('.cobertura-equipe-padrao');
                if(patternContainer){
                    geradorState.coberturaPorEquipe[turnoId].push({
                        equipeId: equipeId,
                        work: parseInt($('[data-pattern="work"]', patternContainer).value, 10) || 1,
                        off: parseInt($('[data-pattern="off"]', patternContainer).value, 10) || 1,
                        start: $('[data-pattern="start"]', patternContainer).value,
                    });
                }
            });
        }
    });
    const maxDiasInput = $('#gerar-maxDiasConsecutivos');
    if(maxDiasInput) geradorState.maxDiasConsecutivos = parseInt(maxDiasInput.value, 10) || 6;
    const sabadosInput = $('#gerar-minFolgasSabados');
    if(sabadosInput) geradorState.minFolgasSabados = parseInt(sabadosInput.value, 10) || 1;
    const domingosInput = $('#gerar-minFolgasDomingos');
    if(domingosInput) geradorState.minFolgasDomingos = parseInt(domingosInput.value, 10) || 1;
    gerarEscala();
}

function setupInlineTitleEditor() {
    const container = $('#gerador-escala-title-container');
    const textEl = $('#gerador-escalaViewTitle');
    const inputEl = $('#gerador-escalaViewTitleInput');
    const editBtn = $('#gerador-escala-edit-title-btn');
    if(!container || !textEl || !inputEl || !editBtn) return;

    const toViewMode = () => {
        const newName = inputEl.value.trim();
        if (newName && currentEscala && newName !== currentEscala.nome) {
            currentEscala.nome = newName;
            setGeradorFormDirty(true);
        }
        if (currentEscala) textEl.textContent = currentEscala.nome;
        container.classList.remove('is-editing');
        editBtn.innerHTML = '✏️';
        parseEmojisInElement(editBtn);
    };
    const toEditMode = () => {
        if (!currentEscala) return;
        container.classList.add('is-editing');
        editBtn.innerHTML = '✔️';
        parseEmojisInElement(editBtn);
        inputEl.value = currentEscala.nome;
        inputEl.focus();
        inputEl.select();
    };
    editBtn.onclick = () => { container.classList.contains('is-editing') ? toViewMode() : toEditMode(); };
    textEl.onclick = toEditMode;
    inputEl.onblur = toViewMode;
    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') toViewMode();
        else if (e.key === 'Escape') {
            inputEl.value = currentEscala.nome;
            toViewMode();
        }
    };
}

function setupGeradorPage() {
    wizardManager = createWizardManager();
    const escCargoSelect = $("#gerar-escCargo");
    const escIniInput = $("#gerar-escIni");
    const escFimInput = $("#gerar-escFim");

    if (escCargoSelect) {
        escCargoSelect.addEventListener('change', (e) => {
            if (e.target.value && escIniInput) {
                try { escIniInput.showPicker(); } catch (e) {}
            }
            wizardManager.updateButtonState();
            setGeradorFormDirty(true);
        });
    }
    if (escIniInput) {
        escIniInput.addEventListener('change', (e) => {
            if (escFimInput) {
                if (e.target.value) {
                    escFimInput.disabled = false;
                    escFimInput.min = e.target.value;
                    try { escFimInput.showPicker(); } catch (e) {}
                } else {
                    escFimInput.disabled = true;
                    escFimInput.value = '';
                }
            }
            updateGeradorResumoDias();
            wizardManager.updateButtonState();
            setGeradorFormDirty(true);
        });
    }
    if (escFimInput) {
        escFimInput.addEventListener('change', () => {
            updateGeradorResumoDias();
            wizardManager.updateButtonState();
            setGeradorFormDirty(true);
        });
    }
    const calendarsContainer = $('#holiday-calendars-container');
    if (calendarsContainer) calendarsContainer.addEventListener('click', handleCalendarDayClick);
    const btnSalvar = $("#btnSalvarEscalaGerador");
    if (btnSalvar) {
        btnSalvar.addEventListener('click', async (event) => {
            await salvarEscalaAtual();
            playConfettiAnimation(event.target);
            setGeradorFormDirty(false);
        });
    }
    const btnDescartar = $("#btnExcluirEscalaGerador");
    if(btnDescartar){
        btnDescartar.addEventListener('click', async () => {
            const { confirmed } = await showConfirm({
                title: "Descartar Alterações?",
                message: "Você tem certeza que deseja descartar esta escala? Todo o progresso não salvo será perdido."
            });
            if (confirmed) {
                resetGeradorWizard();
                go('home');
            }
        });
    }
    setupInlineTitleEditor();
}

document.addEventListener("DOMContentLoaded", setupGeradorPage);