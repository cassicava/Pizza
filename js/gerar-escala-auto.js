/**************************************
 * ✨ Assistente de Geração Automática
 **************************************/

let geradorState = {};
let tipInterval = null;
let activeTipIndex = 0;
let tempHolidayData = {}; // Objeto temporário para edição de feriados

function setGeradorFormDirty(isDirty) {
    dirtyForms['gerar-escala'] = isDirty;
}

function resetGeradorWizard() {
    geradorState = {
        cargoId: null, inicio: null, fim: null, excecoes: {}, 
        feriados: [], selectedDate: null, 
        maxDiasConsecutivos: 6, minFolgasSabados: 1, minFolgasDomingos: 1,
        cobertura: {}, coberturaPorEquipe: {}, 
    };
    currentEscala = null;
    tempHolidayData = {};

    $("#gerador-wizard-container").classList.remove('hidden');
    $("#gerador-escalaView").classList.add('hidden');
    $$("#gerador-wizard-container .wizard-step").forEach(step => step.classList.remove('active'));
    $("#gerador-wizard-passo1").classList.add('active');
    
    $('#btnGerarEscala').textContent = '✨ Gerar Escala ✨'; 

    if ($("#gerar-escCargo")) $("#gerar-escCargo").value = '';
    if ($("#gerar-escIni")) $("#gerar-escIni").value = '';
    if ($("#gerar-escFim")) $("#gerar-escFim").value = '';
    if ($('#gerar-escFim')) $('#gerar-escFim').disabled = true;
    
    updateGeradorResumoDias();
    
    if ($("#gerador-excecoes-funcionarios-container")) $("#gerador-excecoes-funcionarios-container").innerHTML = '';
    if ($("#gerador-cobertura-turnos-container")) $("#gerador-cobertura-turnos-container").innerHTML = '';
    if ($("#holiday-calendars-container")) $("#holiday-calendars-container").innerHTML = '';
    if ($("#holiday-editor-container")) $("#holiday-editor-container").innerHTML = '';
    if ($("#holiday-list-wrapper")) $("#holiday-list-wrapper").innerHTML = '';

    const toolbox = $("#editor-toolbox");
    if(toolbox) toolbox.classList.add("hidden");

    initAnimatedTips();
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
        $("#gerador-wizard-container").classList.add('hidden');
        $("#gerador-escalaView").classList.remove('hidden');
        
        currentEscala = options.escalaParaEditar;
        currentEscala.owner = 'gerador';

        renderEscalaTable(currentEscala);
    } else {
        resetGeradorWizard();
        renderGeradorCargoSelect();
    }
}

function initAnimatedTips() {
    const tips = [
        "Cansado de passar horas montando a escala manualmente?",
        "Deixe que a gente faz o trabalho pesado para você.",
        "Basta configurar as regras, e a escala fica pronta em minutos.",
        "Menos planilhas, menos dor de cabeça e mais tempo livre!",
        "Vamos começar? É rápido e fácil."
    ];
    const container = $('.wizard-tips-container');
    if (!container) return;
    
    container.innerHTML = `
        ${tips.map((tip, index) => `<div class="wizard-tip ${index === 0 ? 'active' : ''}"><p>${tip}</p></div>`).join('')}
    `;
    
    const tipElements = $$('.wizard-tip', container);
    if(tipElements.length === 0) return;
    
    activeTipIndex = 0;

    if (tipInterval) clearInterval(tipInterval);
    tipInterval = setInterval(() => {
        if (document.hidden) return; // Pausa a animação se a aba não estiver visível
        const currentTip = tipElements[activeTipIndex];
        currentTip.classList.add('is-exiting');

        setTimeout(() => {
            currentTip.classList.remove('active', 'is-exiting');
            activeTipIndex = (activeTipIndex + 1) % tipElements.length;
            tipElements[activeTipIndex].classList.add('active');
        }, 600); // Deve corresponder à duração da transição no CSS
    }, 4000); // Muda a cada 4 segundos
}


function renderGeradorCargoSelect() {
    const sel = $("#gerar-escCargo");
    if (!sel) return;
    const { cargos } = store.getState();
    sel.innerHTML = "<option value=''>Selecione um cargo para a escala</option>";
    cargos.forEach(c => {
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
    if (inicio && fim && fim >= inicio) {
        resumoEl.textContent = `Total: ${dateRangeInclusive(inicio, fim).length} dia(s)`;
    } else {
        resumoEl.textContent = 'Selecione o período para ver a duração da escala.';
    }
}

function handleGoToStep(step) {
    const cargoId = $("#gerar-escCargo").value;
    const inicio = $("#gerar-escIni").value;
    const fim = $("#gerar-escFim").value;

    if (!cargoId || !inicio || !fim || fim < inicio) {
        showToast("Por favor, selecione o cargo e um período válido.");
        return;
    }

    geradorState.cargoId = cargoId;
    geradorState.inicio = inicio;
    geradorState.fim = fim;
    
    switch(step) {
        case 2:
            renderHolidayStep();
            navigateWizardWithAnimation('#gerador-wizard-container', 'gerador-wizard-passo2', 'forward');
            break;
        case 3:
            createExcecoesComponent({
                stateObject: geradorState,
                containerSelector: '#gerador-excecoes-funcionarios-container',
                cargoId: geradorState.cargoId,
                onUpdate: () => setGeradorFormDirty(true),
            });
            navigateWizardWithAnimation('#gerador-wizard-container', 'gerador-wizard-passo3', 'forward');
            break;
        case 4:
            renderPasso4_Cobertura();
            navigateWizardWithAnimation('#gerador-wizard-container', 'gerador-wizard-passo4', 'forward');
            break;
    }
}

function renderHolidayStep() {
    renderHolidayCalendar();
    renderHolidayEditor(geradorState.selectedDate);
    renderHolidayList();
}

function renderHolidayCalendar() {
    const container = $("#holiday-calendars-container");
    if (!container) return;

    const range = dateRangeInclusive(geradorState.inicio, geradorState.fim);
    const months = {};
    range.forEach(date => {
        const monthKey = date.substring(0, 7);
        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(date);
    });

    let html = '';
    for (const monthKey in months) {
        const [year, month] = monthKey.split('-').map(Number);
        const monthName = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(year, month - 1, 1).getUTCDay();
        
        html += `<div class="calendar-instance">
                    <h4 class="month-title">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h4>
                    <div class="calendar-grid">
                        ${DIAS_SEMANA.map(d => `<div class="calendar-header">${d.abrev}</div>`).join('')}
                        ${Array(firstDayOfMonth).fill('<div class="calendar-day empty"></div>').join('')}
                `;
        
        months[monthKey].forEach(date => {
            const day = new Date(date + 'T12:00:00');
            const dayNumber = day.getUTCDate();
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
        });

        html += '</div></div>';
    }
    container.innerHTML = html;
}

function handleCalendarDayClick(event) {
    const dayEl = event.target.closest('.calendar-day:not(.empty)');
    if (!dayEl) return;
    const newDate = dayEl.dataset.date;
    
    // Se clicar no mesmo dia, não faz nada
    if (newDate === geradorState.selectedDate) return;

    geradorState.selectedDate = newDate;
    const existingHoliday = geradorState.feriados.find(f => f.date === geradorState.selectedDate);
    
    // Reseta o estado temporário para o feriado existente ou um objeto vazio
    tempHolidayData = existingHoliday 
        ? JSON.parse(JSON.stringify(existingHoliday)) 
        : { 
            date: newDate, 
            nome: '', 
            trabalha: true, 
            descontaMeta: false, 
            desconto: { tipo: 'horas', valor: 8 } 
        };

    renderHolidayStep();
}


function renderHolidayEditor(date) {
    const container = $("#holiday-editor-container");
    if (!container) return;

    if (!date) {
        container.innerHTML = `<div class="holiday-editor-placeholder">Clique em um dia no calendário para configurá-lo.</div>`;
        return;
    }
    
    // Usa sempre o tempHolidayData como fonte da verdade para a UI
    const holiday = tempHolidayData;

    container.innerHTML = `
        <div class="holiday-editor-content">
            <h5>${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {dateStyle: 'full'})}</h5>
            
            <fieldset>
                <legend>Configurações do Dia</legend>
                <div class="animated-field">
                    <input id="holiday-name" type="text" placeholder=" " value="${holiday.nome}" />
                    <label for="holiday-name">Nome do Feriado/Evento</label>
                </div>

                <div class="holiday-config-row">
                    <div class="form-group">
                        <label class="form-label">Haverá Trabalho?</label>
                        <div class="toggle-group" id="holiday-trabalha-toggle">
                            <button type="button" class="toggle-btn ${holiday.trabalha ? 'active' : ''}" data-value="sim">Sim</button>
                            <button type="button" class="toggle-btn ${!holiday.trabalha ? 'active' : ''}" data-value="nao">Não</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Descontar da Meta?</label>
                        <div class="toggle-group" id="holiday-desconta-toggle">
                            <button type="button" class="toggle-btn ${holiday.descontaMeta ? 'active' : ''}" data-value="sim">Sim</button>
                            <button type="button" class="toggle-btn ${!holiday.descontaMeta ? 'active' : ''}" data-value="nao">Não</button>
                        </div>
                    </div>
                </div>

                <div id="holiday-desconto-options" class="form-row-aligned ${holiday.descontaMeta ? '' : 'hidden'}" style="margin-top:16px;">
                     <div class="toggle-group" id="holiday-desconto-tipo-toggle">
                        <button type="button" class="toggle-btn ${holiday.desconto.tipo === 'horas' ? 'active' : ''}" data-value="horas">Horas</button>
                        <button type="button" class="toggle-btn ${holiday.desconto.tipo === 'turnos' ? 'active' : ''}" data-value="turnos">Turnos</button>
                    </div>
                    <div class="animated-field" style="max-width: 120px;">
                        <input id="holiday-desconto-valor" type="number" min="0" step="0.5" placeholder=" " value="${holiday.desconto.valor}" />
                        <label for="holiday-desconto-valor" id="holiday-desconto-label">Valor do Desconto</label>
                    </div>
                </div>
                 <div class="explanation-box ${holiday.descontaMeta ? '' : 'hidden'}" id="holiday-desconto-explanation">
                    <div>O valor definido será subtraído da meta (semanal ou mensal) de cada funcionário que não trabalhar neste dia.</div>
                </div>
            </fieldset>

            <div class="holiday-editor-actions">
                <button id="holiday-save-btn" class="success">💾 Salvar</button>
                <button id="holiday-remove-btn" class="danger" ${!geradorState.feriados.some(f => f.date === date) ? 'style="display:none;"' : ''}>🔥 Remover</button>
            </div>
        </div>
    `;
    addHolidayEditorListeners(date);
}

function renderHolidayList() {
    const container = $('#holiday-list-wrapper');
    if (!container) return;

    const sortedHolidays = [...geradorState.feriados].sort((a,b) => a.date.localeCompare(b.date));

    if (sortedHolidays.length === 0) {
        container.innerHTML = `<fieldset class="fieldset-wrapper" style="height: 100%;">
            <legend>Feriados Adicionados</legend>
            <p class="muted" style="text-align:center; padding: 1rem;">Nenhum feriado adicionado ainda.</p>
        </fieldset>`;
        return;
    }

    const listItems = sortedHolidays.map(h => {
        const d = new Date(h.date + 'T12:00:00');
        const isFolga = !h.trabalha;
        return `
            <li class="holiday-list-item" data-date="${h.date}">
                <span class="holiday-list-date">${d.getDate()}/${d.getMonth()+1}</span>
                <span class="holiday-list-name">${h.nome || 'Dia de Folga'}</span>
                <span class="holiday-list-status ${isFolga ? 'off' : 'work'}">${isFolga ? 'Folga' : 'Normal'}</span>
            </li>
        `;
    }).join('');

    container.innerHTML = `<fieldset class="fieldset-wrapper">
        <legend>Feriados Adicionados</legend>
        <ul class="holiday-list">${listItems}</ul>
    </fieldset>`;

    $$('.holiday-list-item').forEach(item => {
        item.onclick = () => {
            const newDate = item.dataset.date;
            if (newDate === geradorState.selectedDate) return;

            geradorState.selectedDate = newDate;
            const existingHoliday = geradorState.feriados.find(f => f.date === geradorState.selectedDate);
            tempHolidayData = existingHoliday ? JSON.parse(JSON.stringify(existingHoliday)) : {};
            renderHolidayStep();
        };
    });
}


function addHolidayEditorListeners(date) {
    const nomeInput = $('#holiday-name');
    if(nomeInput) {
        nomeInput.oninput = () => {
            if (nomeInput.value.length > 0) {
                nomeInput.value = nomeInput.value.charAt(0).toUpperCase() + nomeInput.value.slice(1);
            }
            tempHolidayData.nome = nomeInput.value.trim();
        };
    }
    
    $('#holiday-desconto-valor').oninput = (e) => {
        tempHolidayData.desconto.valor = parseFloat(e.target.value) || 0;
    };


    const setupToggle = (toggleId, onToggle) => {
        const toggleEl = $(toggleId);
        if (toggleEl) {
            toggleEl.onclick = (e) => {
                const btn = e.target.closest('.toggle-btn');
                if (btn) {
                    $$('.toggle-btn', toggleEl).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if(onToggle) onToggle(btn.dataset.value);
                }
            };
        }
    };

    setupToggle('#holiday-trabalha-toggle', (value) => {
        tempHolidayData.trabalha = value === 'sim';
    });
    
    setupToggle('#holiday-desconta-toggle', (value) => {
        const isSim = value === 'sim';
        $('#holiday-desconto-options').classList.toggle('hidden', !isSim);
        $('#holiday-desconto-explanation').classList.toggle('hidden', !isSim);
        tempHolidayData.descontaMeta = isSim;
    });

    setupToggle('#holiday-desconto-tipo-toggle', (value) => {
        const label = $('#holiday-desconto-label');
        if (label) {
            label.textContent = value === 'horas' ? 'Total de Horas' : 'Total de Turnos';
        }
        tempHolidayData.desconto.tipo = value;
    });
    
    // Trigger initial state for label
    const initialTipo = $('#holiday-desconto-tipo-toggle .active')?.dataset.value || 'horas';
    const label = $('#holiday-desconto-label');
    if(label) label.textContent = initialTipo === 'horas' ? 'Total de Horas' : 'Total de Turnos';


    $('#holiday-save-btn').onclick = () => {
        if (!tempHolidayData.nome && tempHolidayData.trabalha) {
            showToast("Por favor, dê um nome ao feriado ou marque que 'Não Haverá Trabalho'.");
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

function renderPasso4_Cobertura() {
    const { cargos, turnos, equipes } = store.getState();
    const cargo = cargos.find(c => c.id === geradorState.cargoId);
    const container = $("#gerador-cobertura-turnos-container");
    container.innerHTML = "";

    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        container.innerHTML = `<p class="muted">Este cargo não possui turnos associados.</p>`;
        return;
    }

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id));
    turnosDoCargo.forEach(turno => {
        const equipesCompativeis = equipes.filter(e => e.cargoId === cargo.id && e.turnoId === turno.id);
        const div = document.createElement('div');
        div.className = 'cobertura-modo-container cobertura-item';
        div.dataset.turnoId = turno.id;

        let equipesOptionsHTML = equipesCompativeis.length > 0 ? equipesCompativeis.map(equipe => `
            <div class="cobertura-equipe-row">
                <label class="check-inline">
                    <input type="checkbox" name="equipe_check_${turno.id}" value="${equipe.id}">
                    ${equipe.nome} (${equipe.funcionarioIds.length} membros)
                </label>
                <div class="cobertura-equipe-padrao" style="display: none;">
                    <div class="animated-field"><input type="number" min="1" value="1" placeholder=" " data-pattern="work"><label>Trabalha</label></div>
                    <div class="animated-field"><input type="number" min="1" value="1" placeholder=" " data-pattern="off"><label>Folga</label></div>
                    <input type="date" data-pattern="start" min="${geradorState.inicio}" max="${geradorState.fim}" value="${geradorState.inicio}" title="Primeiro dia de trabalho da equipe">
                </div>
            </div>
            <div class="equipe-pattern-explanation" data-equipe-id="${equipe.id}" style="display: none;"></div>
        `).join('') : `<p class="muted" style="margin: 8px 0;">Nenhuma equipe cadastrada para este turno.</p>`;

        div.innerHTML = `
            <div class="form-row-aligned" style="margin-bottom: 8px;">
                <strong style="flex-grow: 1;">${turno.nome} (${turno.inicio} - ${turno.fim})</strong>
                <div class="toggle-group" data-turno-id="${turno.id}">
                    <button type="button" class="toggle-btn active" data-value="individual">Individual</button>
                    <button type="button" class="toggle-btn" data-value="equipes">Por Equipes</button>
                </div>
            </div>
            <div class="cobertura-individual-options">
                <div class="animated-field" style="max-width: 200px;">
                    <input type="number" id="cobertura-${turno.id}" data-cobertura="individual" value="1" min="0" placeholder=" " />
                    <label for="cobertura-${turno.id}">Nº de funcionários</label>
                </div>
            </div>
            <div class="cobertura-equipes-options" style="display: none;">
                ${equipesOptionsHTML}
                <hr style="border: none; border-top: 1px solid var(--border); margin: 16px 0;">
                <div class="cobertura-complementar-container">
                    <label class="form-label">Cobertura Individual Complementar:</label>
                    <div class="animated-field" style="max-width: 200px;">
                        <input type="number" id="cobertura-extra-${turno.id}" data-cobertura="complementar" value="0" min="0" placeholder=" " />
                        <label for="cobertura-extra-${turno.id}">Nº de funcionários</label>
                    </div>
                </div>
            </div>
        `;
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
            if(chk.checked) updateTeamPatternExplanation(patternDiv);
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
    for(let i = 0; i < Math.min(dateRange.length, 10); i++) {
        if ((i - startIndex) % ciclo >= 0 && (i - startIndex) % ciclo < work) {
            diasDeTrabalho.push(new Date(dateRange[i]+'T12:00:00').getDate());
        }
    }
    explanationDiv.innerHTML = `🗓️ Esta equipe trabalhará em um padrão de ${work}x${off}, começando em ${new Date(startDate+'T12:00:00').toLocaleDateString()}.<br>Ex: Dias ${diasDeTrabalho.join(', ')}...`;
}


function handleStartGeneration() {
    geradorState.cobertura = {};
    geradorState.coberturaPorEquipe = {};

    $$('#gerador-cobertura-turnos-container .cobertura-modo-container').forEach(container => {
        const turnoId = container.dataset.turnoId;
        const modo = $('.toggle-btn.active', container).dataset.value;

        if (modo === 'individual') {
            geradorState.cobertura[turnoId] = parseInt($('[data-cobertura="individual"]', container).value, 10) || 0;
        } else {
            geradorState.cobertura[turnoId] = parseInt($('[data-cobertura="complementar"]', container).value, 10) || 0;
            geradorState.coberturaPorEquipe[turnoId] = [];

            $$('input[type="checkbox"][name^="equipe_check_"]:checked', container).forEach(chk => {
                const equipeId = chk.value;
                const patternContainer = chk.closest('.cobertura-equipe-row').querySelector('.cobertura-equipe-padrao');
                geradorState.coberturaPorEquipe[turnoId].push({
                    equipeId: equipeId,
                    work: parseInt($('[data-pattern="work"]', patternContainer).value, 10) || 1,
                    off: parseInt($('[data-pattern="off"]', patternContainer).value, 10) || 1,
                    start: $('[data-pattern="start"]', patternContainer).value,
                });
            });
        }
    });

    geradorState.maxDiasConsecutivos = parseInt($('#gerar-maxDiasConsecutivos').value, 10) || 6;
    geradorState.minFolgasSabados = parseInt($('#gerar-minFolgasSabados').value, 10) || 1;
    geradorState.minFolgasDomingos = parseInt($('#gerar-minFolgasDomingos').value, 10) || 1;
    
    gerarEscala();
}

function setupInlineTitleEditor() {
    const container = $('#gerador-escala-title-container');
    const textEl = $('#gerador-escalaViewTitle');
    const inputEl = $('#gerador-escalaViewTitleInput');
    const editBtn = $('#gerador-escala-edit-title-btn');

    const toViewMode = () => {
        const newName = inputEl.value.trim();
        if (newName && currentEscala && newName !== currentEscala.nome) {
            currentEscala.nome = newName;
            setGeradorFormDirty(true);
        }
        if (currentEscala) textEl.textContent = currentEscala.nome;
        container.classList.remove('is-editing');
        editBtn.innerHTML = '✏️';
    };

    const toEditMode = () => {
        if (!currentEscala) return;
        container.classList.add('is-editing');
        editBtn.innerHTML = '✔️';
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
    $("#btn-gerador-goto-passo2").addEventListener('click', () => handleGoToStep(2));
    $("#btn-gerador-goto-passo3").addEventListener('click', () => handleGoToStep(3));
    $("#btn-gerador-goto-passo4").addEventListener('click', () => handleGoToStep(4));
    
    $$('[data-wizard-back-to][data-wizard="gerador"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetStep = btn.dataset.wizardBackTo;
            navigateWizardWithAnimation('#gerador-wizard-container', `gerador-wizard-passo${targetStep}`, 'backward');
        });
    });

    $("#btnGerarEscala").addEventListener('click', handleStartGeneration);

    const escCargoSelect = $("#gerar-escCargo");
    const escIniInput = $("#gerar-escIni");
    const escFimInput = $("#gerar-escFim");
    
    escCargoSelect.addEventListener('change', (e) => {
        geradorState.cargoId = e.target.value;
        if (e.target.value) try { escIniInput.showPicker(); } catch(e){}
        setGeradorFormDirty(true);
    });

    escIniInput.addEventListener('change', (e) => {
        if (e.target.value) {
            escFimInput.disabled = false;
            escFimInput.min = e.target.value;
            try { escFimInput.showPicker(); } catch(e){}
        } else {
            escFimInput.disabled = true;
            escFimInput.value = '';
        }
        updateGeradorResumoDias();
        setGeradorFormDirty(true);
    });

    escFimInput.addEventListener('change', () => { updateGeradorResumoDias(); setGeradorFormDirty(true); });

    [escIniInput, escFimInput].forEach(input => {
        if (input) {
            input.addEventListener('click', function() { try { this.showPicker(); } catch (e) {} });
            input.addEventListener('input', () => setGeradorFormDirty(true));
        }
    });

    const calendarsContainer = $('#holiday-calendars-container');
    if (calendarsContainer) calendarsContainer.addEventListener('click', handleCalendarDayClick);

    $("#btnSalvarEscalaGerador").addEventListener('click', async (event) => {
        await salvarEscalaAtual();
        playConfettiAnimation(event.target);
        setGeradorFormDirty(false);
    });
    
    $("#btnExcluirEscalaGerador").addEventListener('click', async () => {
        const confirmado = await showConfirm({
            title: "Descartar Alterações?",
            message: "Você tem certeza que deseja descartar esta escala? Todo o progresso não salvo será perdido."
        });
        if (confirmado) { resetGeradorWizard(); go('home'); }
    });

    setupInlineTitleEditor();
}

document.addEventListener("DOMContentLoaded", setupGeradorPage);