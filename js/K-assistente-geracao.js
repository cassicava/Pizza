let geradorState = {};
let tempHolidayData = {};
let tempAusencia = {
    tipo: TURNO_FERIAS_ID,
    funcionarios: new Set(),
    start: null,
    end: null,
};
let wizardManager = null;

let metasAgrupadasCache = {};
let metasConfirmadas = false;

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
        cobertura: {}, 
        coberturaPorEquipe: {},
        metasOverride: {}, 
        totalMetaHoras: 0, 
        totalMetaTurnos: 0,
    };
    currentEscala = null;
    tempHolidayData = {};
    tempAusencia = {
        tipo: TURNO_FERIAS_ID,
        funcionarios: new Set(),
        start: null,
        end: null,
    };
    metasAgrupadasCache = {};
    metasConfirmadas = false;

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
    resetMetasContent();

    if ($("#holiday-calendars-container")) $("#holiday-calendars-container").innerHTML = '';
    if ($("#holiday-editor-container")) $("#holiday-editor-container").innerHTML = '';
    if ($("#holiday-list-wrapper")) $("#holiday-list-wrapper").innerHTML = '';
    if ($("#gerador-excecoes-funcionarios-container")) $("#gerador-excecoes-funcionarios-container").innerHTML = '';
    if ($("#gerador-cobertura-turnos-container")) $("#gerador-cobertura-turnos-container").innerHTML = '';

    const toolbox = $("#editor-toolbox");
    if (toolbox) toolbox.classList.add("hidden");

    if (wizardManager) {
        wizardManager.goToStep(1);
        wizardManager.updateButtonState(); 
    }
    
    const nextBtn = $("#btn-gerador-next");
    if (nextBtn) nextBtn.classList.remove('pulsing-button');

    setGeradorFormDirty(false);
}

function initGeradorPage(options = {}) {
    const { cargos } = store.getState();
    if (cargos.length === 0) {
        showActionModal({
            title: "Cadastro de Cargos Necessário",
            message: "<p>Para usar a geração automática, você precisa primeiro cadastrar pelo menos um cargo no sistema.</p>",
            actions: [{ id: 'go-cargos', text: 'Ir para Cargos', class: 'primary' }]
        }).then(actionId => {
            if (actionId === 'go-cargos') {
                go('cargos');
            } else {
                go('home');
            }
        });
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
    cargos.filter(c => c.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => {
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

function resetMetasContent() {
    const metasContent = $("#gerador-passo1-metas-content");
    const btnConfirmarMetas = $("#btn-confirmar-metas");

    if (metasContent) {
        metasContent.innerHTML = `
            <div class="metas-placeholder">
                <p class="muted">Selecione o Cargo e o Período para calcular as metas de trabalho.</p>
            </div>`;
    }
    if (btnConfirmarMetas) {
        btnConfirmarMetas.classList.add('hidden');
        btnConfirmarMetas.disabled = false;
        btnConfirmarMetas.textContent = '✔️ Confirmar Metas';
        btnConfirmarMetas.classList.remove('pulsing-button');
    }
    metasAgrupadasCache = {};
    metasConfirmadas = false;
    geradorState.metasOverride = {};
    geradorState.totalMetaHoras = 0;
    geradorState.totalMetaTurnos = 0;
    if(wizardManager) wizardManager.updateButtonState();
}

function checkPasso1Inputs() {
    const cargoId = $("#gerar-escCargo").value;
    const inicio = $("#gerar-escIni").value;
    const fim = $("#gerar-escFim").value;
    
    resetMetasContent();

    if (cargoId && inicio && fim && fim >= inicio) {
        calcularEMostrarMetasAgrupadas(cargoId, inicio, fim);
    }
}

function animateNumero(el, valorFinal, unidade) {
    let valorAtual = 0;
    const duracao = 800;
    const inicio = performance.now();
    const eDecimal = unidade === 'h';

    function step(timestamp) {
        const progresso = Math.min((timestamp - inicio) / duracao, 1);
        let valorExibido = progresso * valorFinal;

        if (eDecimal) {
            valorExibido = valorExibido.toFixed(1);
        } else {
            valorExibido = Math.floor(valorExibido);
        }
        
        el.textContent = valorExibido;

        if (progresso < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = eDecimal ? valorFinal.toFixed(1) : valorFinal.toFixed(0);
        }
    }
    requestAnimationFrame(step);
}

function calcularEMostrarMetasAgrupadas(cargoId, inicio, fim) {
    const { funcionarios, cargos } = store.getState();
    const metasContent = $("#gerador-passo1-metas-content");
    const btnConfirmarMetas = $("#btn-confirmar-metas");
    if (!metasContent || !btnConfirmarMetas) return;

    metasContent.innerHTML = `<div class="metas-placeholder"><p class="muted">Calculando metas...</p></div>`;

    const cargo = cargos.find(c => c.id === cargoId);
    const cargoDiasOperacionais = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);

    const funcsDoCargo = funcionarios.filter(f => f.cargoId === cargoId && f.status === 'ativo');
    
    if (funcsDoCargo.length === 0) {
        metasContent.innerHTML = `<div class="metas-placeholder"><p class="muted">⚠️ Nenhum funcionário ativo cadastrado para este cargo.</p></div>`;
        btnConfirmarMetas.classList.add('hidden');
        metasConfirmadas = false; 
        wizardManager.updateButtonState();
        parseEmojisInElement(metasContent);
        return;
    }

    const grupos = {};
    funcsDoCargo.forEach(func => {
        const medicao = func.medicaoCarga || 'horas';
        const valor = func.cargaHoraria || 0;
        const periodo = func.periodoHoras || 'semanal';
        const key = `${medicao}_${valor}_${periodo}`;

        if (!grupos[key]) {
            grupos[key] = {
                funcionarios: [],
                totalMeta: 0,
                label: `${valor} ${medicao === 'horas' ? 'horas' : 'turnos'}/${periodo === 'semanal' ? 'semana' : 'mês'}`
            };
        }
        
        let metaIndividual = 0;
        if (medicao === 'turnos') {
            metaIndividual = calcularMetaTurnos(func, inicio, fim, cargoDiasOperacionais);
        } else {
            metaIndividual = calcularMetaHoras(func, inicio, fim);
        }
        
        grupos[key].funcionarios.push({ ...func, metaCalculada: metaIndividual });
        grupos[key].totalMeta = metaIndividual;
    });

    metasAgrupadasCache = grupos; 

    let html = '';
    const sortedKeys = Object.keys(grupos).sort((a,b) => grupos[a].label.localeCompare(grupos[b].label));

    if (sortedKeys.length === 0) {
        metasContent.innerHTML = `<div class="metas-placeholder"><p class="muted">Nenhum funcionário com meta definida para este cargo.</p></div>`;
        btnConfirmarMetas.classList.remove('hidden');
        metasConfirmadas = false;
        wizardManager.updateButtonState();
        return;
    }

    sortedKeys.forEach((key, index) => {
        const grupo = grupos[key];
        const unidade = key.startsWith('horas') ? 'h' : ' turnos';
        const valorFinal = grupo.totalMeta;
        const valorExibido = (unidade === 'h') ? valorFinal.toFixed(1) : valorFinal.toFixed(0);

        html += `
            <div class="meta-group-card" style="animation-delay: ${index * 100}ms;">
              <div class="meta-group-header">
                <span>Contrato: <strong>${grupo.label}</strong></span>
                <span class="muted">(${grupo.funcionarios.length} ${grupo.funcionarios.length > 1 ? 'funcionários' : 'funcionário'})</span>
              </div>
              <div class="meta-group-barra-animada">
                <div class="barra-progresso" style="width: 0;"></div>
                <span class="meta-numero-animado" data-target="${valorFinal}">${valorExibido}</span>${unidade}
              </div>
              <button class="secondary edit-meta-grupo-btn" data-group-key="${key}">✏️ Ajustar Total</button>
            </div>
        `;
    });

    metasContent.innerHTML = html;
    btnConfirmarMetas.classList.remove('hidden');
    btnConfirmarMetas.classList.add('pulsing-button');
    metasConfirmadas = false; 
    wizardManager.updateButtonState();

    setTimeout(() => {
        $$('.barra-progresso', metasContent).forEach(barra => {
            barra.style.animation = 'fill-width 0.8s ease-out forwards';
        });
        $$('.meta-numero-animado', metasContent).forEach(numEl => {
            const valorFinal = parseFloat(numEl.dataset.target);
            const unidade = numEl.nextSibling.textContent.trim().startsWith('h') ? 'h' : 'turnos';
            animateNumero(numEl, valorFinal, unidade);
        });
    }, 100);

    $$('.edit-meta-grupo-btn', metasContent).forEach(btn => {
        btn.onclick = () => handleAjustarMetaGrupo(btn.dataset.groupKey);
    });
    parseEmojisInElement(metasContent);
}

async function handleAjustarMetaGrupo(groupKey) {
    if (!metasAgrupadasCache[groupKey]) return;

    const grupo = metasAgrupadasCache[groupKey];
    const unidade = groupKey.startsWith('horas') ? 'horas' : 'turnos';
    const valorAtual = grupo.totalMeta;

    const { value: novoTotalStr } = await Swal.fire({
        title: `Ajustar Meta do Contrato`,
        html: `
            <p style="font-size: 0.9rem; color: #64748b; text-align: left;">
                Defina a meta <strong>individual</strong> para o contrato <strong>${grupo.label}</strong> neste período.<br>
                Este valor será aplicado a todos os <strong>${grupo.funcionarios.length}</strong> funcionários deste grupo.
            </p>
        `,
        input: 'number',
        inputValue: unidade === 'horas' ? valorAtual.toFixed(1) : valorAtual.toFixed(0),
        inputLabel: `Nova meta individual (${unidade}):`,
        confirmButtonText: 'Ajustar',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value || isNaN(parseFloat(value)) || parseFloat(value) < 0) {
                return 'Por favor, insira um número válido maior ou igual a zero.';
            }
        }
    });

    if (novoTotalStr) {
        const novoTotalIndividual = parseFloat(novoTotalStr);

        grupo.funcionarios.forEach(func => {
            geradorState.metasOverride[func.id] = novoTotalIndividual;
        });

        grupo.totalMeta = novoTotalIndividual;

        const card = $(`button[data-group-key="${groupKey}"]`).closest('.meta-group-card');
        if (card) {
            const numEl = $('.meta-numero-animado', card);
            const barraEl = $('.barra-progresso', card);
            
            numEl.textContent = unidade === 'horas' ? novoTotalIndividual.toFixed(1) : novoTotalIndividual.toFixed(0);
            numEl.dataset.target = novoTotalIndividual;
            
            barraEl.style.animation = 'none';
            barraEl.style.width = '100%'; 
            
            card.classList.add('modified'); 
        }

        setGeradorFormDirty(true);
        metasConfirmadas = false;
        const btnConfirmarMetas = $("#btn-confirmar-metas");
        if(btnConfirmarMetas) {
             btnConfirmarMetas.disabled = false;
             btnConfirmarMetas.textContent = '✔️ Confirmar Metas';
             btnConfirmarMetas.classList.add('pulsing-button');
             parseEmojisInElement(btnConfirmarMetas);
        }
        wizardManager.updateButtonState();
    }
}


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
        const isStep1InputsComplete = cargoId && inicio && fim && fim >= inicio;

        if (currentStep === 1) {
            nextBtn.disabled = !isStep1InputsComplete || !metasConfirmadas;
        } else {
            nextBtn.disabled = false;
        }

        nextBtn.classList.toggle('pulsing-button', !nextBtn.disabled);
        
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
            
            const isStep1Complete = $("#gerar-escCargo").value && $("#gerar-escIni").value && $("#gerar-escFim").value && metasConfirmadas;
            tab.disabled = (step > 1 && !isStep1Complete) || step > currentStep;
            
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
            nextBtn.classList.remove('pulsing-button');
            const rect = event.currentTarget.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height / 2;
            playStarBurst(originX, originY);

            if (currentStep === 4) {
                handleStartGeneration();
            } else {
                if (currentStep === 1) {
                    geradorState.cargoId = $("#gerar-escCargo").value;
                    geradorState.inicio = $("#gerar-escIni").value;
                    geradorState.fim = $("#gerar-escFim").value;
                }
                goToStep(currentStep + 1);
            }
        };
    }
    
    tabs.forEach(tab => {
        tab.onclick = (event) => {
            if (!tab.disabled) {
                const rect = event.currentTarget.getBoundingClientRect();
                const originX = rect.left + rect.width / 2;
                const originY = rect.top + rect.height / 2;
                playStarBurst(originX, originY);

                goToStep(parseInt(tab.dataset.step, 10));
            }
        };
    });
    
    goToStep(1);

    return { goToStep, updateButtonState };
}

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
    const defaultDesconto = { horas: 8, turnos: 1 };
    tempHolidayData = existingHoliday ? JSON.parse(JSON.stringify(existingHoliday)) : { date: newDate, nome: '', trabalha: true, descontaMeta: false, desconto: defaultDesconto };
    if (!tempHolidayData.desconto) tempHolidayData.desconto = defaultDesconto;
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
                const defaultDesconto = { horas: 8, turnos: 1 };
                tempHolidayData = existingHoliday ? JSON.parse(JSON.stringify(existingHoliday)) : { date: date, nome: '', trabalha: true, descontaMeta: false, desconto: defaultDesconto };
                if (!tempHolidayData.desconto) tempHolidayData.desconto = defaultDesconto;
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
        showToast("Feriado salvo.");
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


function renderAusenciasStep() {
    const { funcionarios } = store.getState();
    const funcs = funcionarios.filter(f => f.cargoId === geradorState.cargoId && f.status !== 'arquivado').sort((a,b) => a.nome.localeCompare(b.nome));
    const container = $("#gerador-excecoes-funcionarios-container");
    if(!container) return;
    
    const tipoActive = tempAusencia.tipo;
    const folgaActive = tipoActive === TURNO_FOLGA_ID ? 'active' : '';
    const feriasActive = tipoActive === TURNO_FERIAS_ID ? 'active' : '';
    const afastamentoActive = tipoActive === TURNO_AFASTAMENTO_ID ? 'active' : '';
    const dateFimStyle = tipoActive === TURNO_FOLGA_ID ? 'style="display: none;"' : '';
    const hasFuncsSelected = tempAusencia.funcionarios.size > 0;
    const tipoFieldsetDisabled = hasFuncsSelected ? '' : 'disabled';
    const datesFieldsetDisabled = (hasFuncsSelected && tipoActive) ? '' : 'disabled';


    let html = `
        <div class="passo2-holiday-grid" id="ausencia-step-container">
            <div id="ausencia-calendars-container" class="calendars-wrapper"></div>
            <div id="ausencia-editor-container" class="holiday-editor-wrapper">
                <div class="holiday-editor-content">
                    <fieldset id="ausencia-funcs-fieldset">
                        <legend>1. Selecione o(s) Funcionário(s)</legend>
                        <div id="ausencia-funcionario-list" class="check-container" style="max-height: 150px; overflow-y: auto; padding: 8px;">
                            ${funcs.length > 0 ? funcs.map(f => `<label class="check-inline" data-func-id="${f.id}"><input type="checkbox" name="ausencia-funcionario-check" value="${f.id}" ${tempAusencia.funcionarios.has(f.id) ? 'checked' : ''}>${f.nome}</label>`).join('') : '<p class="muted">Nenhum funcionário para este cargo.</p>'}
                        </div>
                    </fieldset>
                    <fieldset id="ausencia-tipo-fieldset" ${tipoFieldsetDisabled}>
                        <legend>2. Escolha o Tipo de Ausência</legend>
                        <div class="toggle-group" id="ausencia-tipo-toggle">
                            <button type="button" class="toggle-btn ${folgaActive}" data-value="${TURNO_FOLGA_ID}">Folga</button>
                            <button type="button" class="toggle-btn ${feriasActive}" data-value="${TURNO_FERIAS_ID}">Férias</button>
                            <button type="button" class="toggle-btn ${afastamentoActive}" data-value="${TURNO_AFASTAMENTO_ID}">Afastamento</button>
                        </div>
                    </fieldset>
                    <fieldset id="ausencia-dates-fieldset" ${datesFieldsetDisabled}>
                         <legend>3. Defina o Período</legend>
                        <div id="ausencia-date-selector" class="form-row" style="margin: 0;">
                            <div class="form-row form-row-vcenter" style="margin:0; flex-grow: 1;">
                                <label>Início <input type="date" id="ausencia-date-ini" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm" value="${tempAusencia.start || ''}"></label>
                                <label id="ausencia-date-fim-label" ${dateFimStyle}>Fim <input type="date" id="ausencia-date-fim" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm" value="${tempAusencia.end || ''}"></label>
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
    updateAusenciaSaveButtonState();
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

function updateAusenciaSaveButtonState() {
    const saveBtn = $('#ausencia-save-btn');
    if(saveBtn) saveBtn.disabled = !(tempAusencia.start && (tempAusencia.end || tempAusencia.tipo === TURNO_FOLGA_ID) && tempAusencia.funcionarios.size > 0);
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
    } else {
        const tipoActive = $('.toggle-btn.active', $('#ausencia-tipo-toggle'));
        const datesFieldset = $('#ausencia-dates-fieldset');
        if(datesFieldset) datesFieldset.disabled = !tipoActive;
    }
    updateAusenciaSaveButtonState();
}

function handleAusenciaDateChange() {
    const iniInput = $('#ausencia-date-ini');
    const fimInput = $('#ausencia-date-fim');
    tempAusencia.start = iniInput ? iniInput.value : null;
    tempAusencia.end = tempAusencia.tipo === TURNO_FOLGA_ID ? tempAusencia.start : (fimInput ? fimInput.value : null);
    
    if (tempAusencia.start && tempAusencia.end && tempAusencia.end < tempAusencia.start) {
        tempAusencia.end = tempAusencia.start;
        if(fimInput) fimInput.value = tempAusencia.start;
    }

    updateAusenciaSaveButtonState();
    renderAusenciaCalendar();
}

function handleAusenciaCalendarClick(e) {
    const dayEl = e.target.closest('.calendar-day:not(.empty)');
    const datesFieldset = $('#ausencia-dates-fieldset');
    if (!dayEl || (datesFieldset && datesFieldset.disabled)) return;
    const date = dayEl.dataset.date;
    
    if (!tempAusencia.start) {
        tempAusencia.start = date;
        tempAusencia.end = tempAusencia.tipo === TURNO_FOLGA_ID ? date : null;
    } 
    else if (tempAusencia.tipo === TURNO_FOLGA_ID) {
        tempAusencia.start = date;
        tempAusencia.end = date;
    }
    else if (tempAusencia.start && tempAusencia.end) {
        tempAusencia.start = date;
        tempAusencia.end = null;
    } 
    else {
        if (date < tempAusencia.start) {
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
    updateAusenciaSaveButtonState();
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

function renderAusenciaList() {
    const container = $('#ausencia-list-wrapper');
    if (!container) return;

    const { funcionarios } = store.getState();
    const funcionariosMap = new Map(funcionarios.map(f => [f.id, f.nome]));
    let allAusencias = [];

    for (const funcId in geradorState.excecoes) {
        for (const tipoId in geradorState.excecoes[funcId]) {
            const dates = geradorState.excecoes[funcId][tipoId];
            if (dates && dates.length > 0) {
                const ranges = dates.reduce((acc, date) => {
                    if (acc.length > 0 && addDays(acc[acc.length - 1].end, 1) === date) {
                        acc[acc.length - 1].end = date;
                    } else {
                        acc.push({ start: date, end: date });
                    }
                    return acc;
                }, []);
                
                ranges.forEach(range => {
                    allAusencias.push({
                        funcId,
                        tipoId,
                        ...range
                    });
                });
            }
        }
    }
    
    allAusencias.sort((a,b) => a.start.localeCompare(b.start) || a.funcId.localeCompare(b.funcId));
    
    if (allAusencias.length === 0) {
        container.innerHTML = `<fieldset class="fieldset-wrapper" style="height: 100%;"><legend>Ausências Adicionadas</legend><p class="muted" style="text-align:center; padding: 1rem;">Nenhuma ausência registrada.</p></fieldset>`;
        return;
    }
    
    const listItems = allAusencias.map(aus => {
        const funcName = funcionariosMap.get(aus.funcId) || 'Funcionário Desconhecido';
        const tipoInfo = TURNOS_SISTEMA_AUSENCIA[aus.tipoId] || { nome: 'Ausência', cor: '#cccccc' };
        
        let dateStr;
        if (aus.start === aus.end) {
            dateStr = new Date(aus.start + 'T12:00:00').toLocaleDateString('pt-BR', { dateStyle: 'long' });
        } else {
            const start = new Date(aus.start + 'T12:00:00').toLocaleDateString();
            const end = new Date(aus.end + 'T12:00:00').toLocaleDateString();
            dateStr = `De ${start} a ${end}`;
        }
        
        return `<li class="summary-list-item" style="border-color: ${tipoInfo.cor}">
                    <div class="summary-list-item-header">
                        <span class="item-type">${tipoInfo.nome}</span>
                        <span class="item-name">${funcName}</span>
                    </div>
                    <div class="summary-list-item-body">${dateStr}</div>
                    <div class="summary-list-item-footer">
                        <button class="summary-delete-btn" 
                                data-remove-func-id="${aus.funcId}"
                                data-remove-tipo-id="${aus.tipoId}"
                                data-remove-start="${aus.start}"
                                data-remove-end="${aus.end}">
                            Excluir
                        </button>
                    </div>
                </li>`;
    }).join('');
    
    container.innerHTML = `<fieldset class="fieldset-wrapper"><legend>Ausências Adicionadas</legend><ul class="summary-list">${listItems}</ul></fieldset>`;
    $$('.summary-delete-btn', container).forEach(btn => btn.onclick = removeAusencia);
}



function renderPasso4_Cobertura() {
    const { cargos, turnos, equipes } = store.getState();
    const cargo = cargos.find(c => c.id === geradorState.cargoId);
    const container = $("#gerador-cobertura-turnos-container");
    if(!container) return;

    const balancoHTML = `
        <div class="balanco-mestre-container card">
            <span class="balanco-mestre-label">Balanço de Carga (Demanda vs. Meta Líquida)</span>
            <span class="balanco-mestre-status" id="balanco-mestre-status">OK ✅</span>
            <div class="balanco-mestre-barra-fundo">
                <div class="balanco-mestre-barra" id="balanco-mestre-barra" style="width: 0%;"></div>
            </div>
        </div>
    `;
    container.innerHTML = balancoHTML;
    parseEmojisInElement(container);


    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        container.innerHTML += `<p class="muted">Este cargo não possui turnos associados.</p>`;
        return;
    }
    
    const cargoDiasOperacionais = cargo.regras.dias || [];
    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id)).sort((a,b)=>a.inicio.localeCompare(b.inicio));
    
    turnosDoCargo.forEach(turno => {
        const equipesCompativeis = equipes.filter(e => e.cargoId === cargo.id && e.turnoId === turno.id);
        const hasEquipes = equipesCompativeis.length > 0;

        const fieldset = document.createElement('fieldset');
        fieldset.className = 'cobertura-turno-fieldset';
        fieldset.dataset.turnoId = turno.id;
        
        const legend = document.createElement('legend');
        legend.innerHTML = `${turno.nome} <span>(${turno.inicio} - ${turno.fim})</span>`;
        fieldset.appendChild(legend);

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-group';
        toggleContainer.style.marginBottom = '16px';
        toggleContainer.innerHTML = `
            <button type="button" class="toggle-btn active" data-value="individual">Individual</button>
            <button type="button" class="toggle-btn" data-value="equipes" ${!hasEquipes ? 'disabled title="Nenhuma equipe cadastrada para este turno"' : ''}>Por Equipes</button>
        `;
        fieldset.appendChild(toggleContainer);
        
        const individualOptions = document.createElement('div');
        individualOptions.className = 'cobertura-individual-options';
        let diasInputsHTML = '<div class="cobertura-individual-dias-container">';
        DIAS_SEMANA.forEach(dia => {
            const isEnabled = cargoDiasOperacionais.includes(dia.id);
            diasInputsHTML += `
                <div class="dia-input-group" ${!isEnabled ? 'style="opacity: 0.5;"' : ''}>
                    <label for="cov-ind-${turno.id}-${dia.id}">${dia.abrev}</label>
                    <input type="number" id="cov-ind-${turno.id}-${dia.id}" data-dia-id="${dia.id}" value="1" min="0" ${!isEnabled ? 'disabled' : ''}>
                </div>
            `;
        });
        diasInputsHTML += `<button type="button" class="secondary btn-replicar-cobertura" style="font-size: 0.8rem; padding: 4px 12px;">Replicar 1º</button></div>`;
        individualOptions.innerHTML = `<label class="form-label">Nº de funcionários necessários por dia:</label>${diasInputsHTML}`;
        fieldset.appendChild(individualOptions);

        const equipesOptions = document.createElement('div');
        equipesOptions.className = 'cobertura-equipes-options';
        equipesOptions.style.display = 'none';

        let equipesHTML = '<div class="cobertura-equipes-container">';
        if (hasEquipes) {
            equipesCompativeis.forEach(equipe => {
                equipesHTML += `
                <div class="equipe-config-card" data-equipe-id="${equipe.id}">
                    <h4>${equipe.nome} (${equipe.funcionarioIds.length} membros)</h4>
                    <div class="equipe-config-details" style="display: none;">
                        <div class="pattern-inputs">
                             <label class="form-label">Padrão:</label>
                             <input type="number" min="1" value="1" data-pattern="work"> <span>dias de trabalho</span>
                             <span>&times;</span>
                             <input type="number" min="1" value="1" data-pattern="off"> <span>dias de folga</span>
                        </div>
                        <div class="start-date-input">
                            <label class="form-label">Primeiro dia de trabalho:</label>
                            <input type="date" data-pattern="start" min="${geradorState.inicio}" max="${geradorState.fim}" value="${geradorState.inicio}">
                        </div>
                        <div class="equipe-pattern-explanation explanation-box"></div>
                    </div>
                </div>`;
            });
        } else {
            equipesHTML += `<p class="muted" style="margin: 8px 0;">Nenhuma equipe cadastrada para este turno.</p>`;
        }
        equipesHTML += '</div>';
        
        let complementarHTML = `
            <hr style="border: none; border-top: 1px solid var(--border); margin: 24px 0 16px 0;">
            <div class="cobertura-complementar-container">
                <label class="form-label">Cobertura Individual Complementar (para preencher vagas):</label>
                <div class="cobertura-individual-dias-container">
        `;
        DIAS_SEMANA.forEach(dia => {
            const isEnabled = cargoDiasOperacionais.includes(dia.id);
            complementarHTML += `
                <div class="dia-input-group" ${!isEnabled ? 'style="opacity: 0.5;"' : ''}>
                    <label for="cov-comp-${turno.id}-${dia.id}">${dia.abrev}</label>
                    <input type="number" id="cov-comp-${turno.id}-${dia.id}" data-dia-id="${dia.id}" value="0" min="0" ${!isEnabled ? 'disabled' : ''}>
                </div>
            `;
        });
        complementarHTML += `<button type="button" class="secondary btn-replicar-cobertura" style="font-size: 0.8rem; padding: 4px 12px;">Replicar 1º</button></div></div>`;
        
        equipesOptions.innerHTML = equipesHTML + complementarHTML;
        fieldset.appendChild(equipesOptions);

        container.appendChild(fieldset);
    });
    
    addPasso4Listeners();
    updateBalançoCarga();
}

function updateBalançoCarga() {
    const { turnos, equipes, funcionarios } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const equipesMap = Object.fromEntries(equipes.map(e => [e.id, e]));
    const dateRange = dateRangeInclusive(geradorState.inicio, geradorState.fim);

    let totalDemandaHoras = 0;
    let totalDemandaTurnos = 0;

    $$('#gerador-cobertura-turnos-container .cobertura-turno-fieldset').forEach(fieldset => {
        const turnoId = fieldset.dataset.turnoId;
        const turnoInfo = turnosMap[turnoId];
        if (!turnoInfo) return;

        const modo = $('.toggle-btn.active', fieldset)?.dataset.value || 'individual';
        const turnoCargaHoras = (turnoInfo.cargaMin || 0) / 60;

        if (modo === 'individual') {
            $$('.cobertura-individual-options .dia-input-group input', fieldset).forEach(input => {
                if (!input.disabled) {
                    const count = parseInt(input.value, 10) || 0;
                    totalDemandaTurnos += count;
                    totalDemandaHoras += count * turnoCargaHoras;
                }
            });
        } else {
            $$('.equipe-config-card.selected', fieldset).forEach(card => {
                const equipeId = card.dataset.equipeId;
                const equipe = equipesMap[equipeId];
                if (!equipe) return;

                const numMembros = equipe.funcionarioIds.length;
                const work = parseInt($('[data-pattern="work"]', card).value, 10) || 1;
                const off = parseInt($('[data-pattern="off"]', card).value, 10) || 1;
                const start = $('[data-pattern="start"]', card).value;
                const ciclo = work + off;
                const startIndex = dateRange.indexOf(start);
                
                if (startIndex === -1) return; 

                let diasDeTrabalho = 0;
                dateRange.forEach((date, index) => {
                    const diaNoCiclo = (index - startIndex) % ciclo;
                    if (diaNoCiclo >= 0 && diaNoCiclo < work) {
                        diasDeTrabalho++;
                    }
                });

                totalDemandaTurnos += diasDeTrabalho * numMembros;
                totalDemandaHoras += (diasDeTrabalho * numMembros) * turnoCargaHoras;
            });

            $$('.cobertura-complementar-container .dia-input-group input', fieldset).forEach(input => {
                if (!input.disabled) {
                    const count = parseInt(input.value, 10) || 0;
                    totalDemandaTurnos += count;
                    totalDemandaHoras += count * turnoCargaHoras;
                }
            });
        }
    });

    let netMetaHoras = geradorState.totalMetaHoras;
    let netMetaTurnos = geradorState.totalMetaTurnos;

    geradorState.feriados.filter(f => !f.trabalha && f.descontaMeta).forEach(feriado => {
        const funcsDoCargo = funcionarios.filter(f => f.cargoId === geradorState.cargoId && f.status === 'ativo');
        funcsDoCargo.forEach(func => {
            const isAusente = geradorState.excecoes[func.id] && Object.values(geradorState.excecoes[func.id]).flat().includes(feriado.date);
            if (!isAusente) {
                if (func.medicaoCarga === 'horas') {
                    netMetaHoras -= (feriado.desconto.horas || 0);
                } else {
                    netMetaTurnos -= (feriado.desconto.turnos || 0);
                }
            }
        });
    });

    Object.keys(geradorState.excecoes).forEach(funcId => {
        const func = funcionarios.find(f => f.id === funcId);
        if (!func || func.cargoId !== geradorState.cargoId) return;

        const ausencias = Object.values(geradorState.excecoes[funcId]).flat();
        const diasDeAusenciaUnicos = [...new Set(ausencias)];

        diasDeAusenciaUnicos.forEach(date => {
            if (func.medicaoCarga === 'horas') {
                const valorDia = (func.cargaHoraria / (func.periodoHoras === 'semanal' ? 7 : 30.41));
                netMetaHoras -= valorDia;
            } else {
                const valorDia = (func.cargaHoraria / (func.periodoHoras === 'semanal' ? 7 : 30.41));
                netMetaTurnos -= valorDia;
            }
        });
    });
    
    netMetaHoras = Math.max(0, netMetaHoras);
    netMetaTurnos = Math.max(0, netMetaTurnos);


    const percentHoras = (netMetaHoras > 0) ? (totalDemandaHoras / netMetaHoras) * 100 : (totalDemandaHoras > 0 ? 101 : 0);
    const percentTurnos = (netMetaTurnos > 0) ? (totalDemandaTurnos / netMetaTurnos) * 100 : (totalDemandaTurnos > 0 ? 101 : 0);
    const percentCritico = Math.max(percentHoras, percentTurnos);

    const barra = $('#balanco-mestre-barra');
    const status = $('#balanco-mestre-status');

    if (!barra || !status) return;

    barra.style.width = `${Math.min(percentCritico, 100)}%`;
    barra.classList.remove('verde', 'excesso');
    status.classList.remove('ok', 'excesso');

    if (percentCritico > 100) {
        barra.classList.add('excesso');
        status.textContent = 'Hora Extra Necessária 🟠';
        status.classList.add('excesso');
    } else if (percentCritico >= 90) {
        barra.classList.add('verde');
        status.textContent = 'Meta Atingida ✅';
        status.classList.add('ok');
    } else {
        status.textContent = 'OK ✅';
        status.classList.add('ok');
    }
    parseEmojisInElement(status);
}


function addPasso4Listeners() {
    const container = $("#gerador-cobertura-turnos-container");
    if (!container) return;

    $$('.toggle-group', container).forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (!btn || btn.disabled) return; 
            
            const fieldset = btn.closest('.cobertura-turno-fieldset');
            const modo = btn.dataset.value;
            
            $$('.toggle-btn', toggle).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            $('.cobertura-individual-options', fieldset).style.display = modo === 'individual' ? 'block' : 'none';
            $('.cobertura-equipes-options', fieldset).style.display = modo === 'equipes' ? 'block' : 'none';
            setGeradorFormDirty(true);
            updateBalançoCarga();
        });
    });

    $$('.equipe-config-card', container).forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target !== card && !e.target.closest('h4')) return;
            
            card.classList.toggle('selected');
            const detailsDiv = card.querySelector('.equipe-config-details');
            const isSelected = card.classList.contains('selected');
            
            detailsDiv.style.display = isSelected ? 'flex' : 'none';
            if (isSelected) {
                updateTeamPatternExplanation(detailsDiv);
            }
            setGeradorFormDirty(true);
            updateBalançoCarga();
        });
    });

    $$('.equipe-config-details input', container).forEach(input => {
        input.addEventListener('input', () => {
            const detailsDiv = input.closest('.equipe-config-details');
            updateTeamPatternExplanation(detailsDiv);
            setGeradorFormDirty(true);
            updateBalançoCarga();
        });
        input.addEventListener('click', (e) => e.stopPropagation()); 
    });
    
    $$('.btn-replicar-cobertura').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = e.target.closest('.cobertura-individual-dias-container');
            const allInputs = $$('input[type="number"]', container);
            const firstInput = allInputs.find(input => !input.disabled);
            if(!firstInput) return;
            
            const firstValue = firstInput.value;
            allInputs.forEach(input => {
                if (!input.disabled) {
                    input.value = firstValue;
                }
            });
            setGeradorFormDirty(true);
            updateBalançoCarga();
        });
    });

    $$('input[type="number"]', container).forEach(input => {
        input.addEventListener('input', () => {
            setGeradorFormDirty(true);
            updateBalançoCarga();
        });
    });
}


function updateTeamPatternExplanation(detailsDiv) {
    if(!detailsDiv) return;
    const explanationDiv = detailsDiv.querySelector('.equipe-pattern-explanation');
    const work = parseInt(detailsDiv.querySelector('[data-pattern="work"]').value, 10) || 1;
    const off = parseInt(detailsDiv.querySelector('[data-pattern="off"]').value, 10) || 1;
    const startDate = detailsDiv.querySelector('[data-pattern="start"]').value;

    if (!startDate) {
        explanationDiv.innerHTML = `<div>Selecione uma data de início.</div>`;
        return;
    }

    const dateRange = dateRangeInclusive(geradorState.inicio, geradorState.fim);
    const startIndex = dateRange.indexOf(startDate);

    if (startIndex === -1) {
        explanationDiv.innerHTML = `<div>A data de início está fora do período da escala.</div>`;
        return;
    }

    const ciclo = work + off;
    const diasDeTrabalho = [];
    for (let i = startIndex; i < dateRange.length && diasDeTrabalho.length < 5; i++) {
        const diaNoCiclo = (i - startIndex) % ciclo;
        if (diaNoCiclo < work) {
            diasDeTrabalho.push(new Date(dateRange[i] + 'T12:00:00').getDate());
        }
    }
    
    explanationDiv.innerHTML = `<div>🗓️ Padrão ${work}x${off} a partir de ${new Date(startDate+'T12:00:00').toLocaleDateString()}.<br>Ex: Dias ${diasDeTrabalho.join(', ')}...</div>`;
    parseEmojisInElement(explanationDiv);
}

function handleStartGeneration() {
    geradorState.cobertura = {};
    geradorState.coberturaPorEquipe = {};

    $$('#gerador-cobertura-turnos-container .cobertura-turno-fieldset').forEach(fieldset => {
        const turnoId = fieldset.dataset.turnoId;
        const modoAtivo = $('.toggle-btn.active', fieldset);
        if(!modoAtivo) return;

        const modo = modoAtivo.dataset.value;

        if (modo === 'individual') {
            const coberturaDiaria = {};
            $$('.cobertura-individual-options .dia-input-group input', fieldset).forEach(input => {
                if (!input.disabled) {
                    coberturaDiaria[input.dataset.diaId] = parseInt(input.value, 10) || 0;
                }
            });
            geradorState.cobertura[turnoId] = coberturaDiaria;
        } else { 
            const coberturaComplementar = {};
             $$('.cobertura-complementar-container .dia-input-group input', fieldset).forEach(input => {
                if (!input.disabled) {
                    coberturaComplementar[input.dataset.diaId] = parseInt(input.value, 10) || 0;
                }
            });
            geradorState.cobertura[turnoId] = coberturaComplementar;

            geradorState.coberturaPorEquipe[turnoId] = [];
            $$('.equipe-config-card.selected', fieldset).forEach(card => {
                const equipeId = card.dataset.equipeId;
                const configContainer = card.querySelector('.equipe-config-details');
                if(configContainer){
                    geradorState.coberturaPorEquipe[turnoId].push({
                        equipeId: equipeId,
                        work: parseInt($('[data-pattern="work"]', configContainer).value, 10) || 1,
                        off: parseInt($('[data-pattern="off"]', configContainer).value, 10) || 1,
                        start: $('[data-pattern="start"]', configContainer).value,
                    });
                }
            });
        }
    });

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
    const btnConfirmarMetas = $("#btn-confirmar-metas");

    if (escCargoSelect) {
        escCargoSelect.addEventListener('change', (e) => {
            if (e.target.value && escIniInput) {
                try { escIniInput.showPicker(); } catch (e) {}
            }
            checkPasso1Inputs();
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
            checkPasso1Inputs();
            setGeradorFormDirty(true);
        });
    }
    if (escFimInput) {
        escFimInput.addEventListener('change', () => {
            updateGeradorResumoDias();
            checkPasso1Inputs();
            setGeradorFormDirty(true);
        });
    }

    if (btnConfirmarMetas) {
        btnConfirmarMetas.addEventListener('click', () => {
            metasConfirmadas = true;
            
            geradorState.totalMetaHoras = 0;
            geradorState.totalMetaTurnos = 0;

            for (const key in metasAgrupadasCache) {
                const grupo = metasAgrupadasCache[key];
                const isHoras = key.startsWith('horas');
                
                grupo.funcionarios.forEach(func => {
                    const override = geradorState.metasOverride[func.id];
                    const meta = (override !== undefined) ? override : func.metaCalculada;
                    
                    if (isHoras) {
                        geradorState.totalMetaHoras += meta;
                    } else {
                        geradorState.totalMetaTurnos += meta;
                    }
                });
            }
            
            wizardManager.updateButtonState();
            wizardManager.goToStep(1); 
            btnConfirmarMetas.disabled = true;
            btnConfirmarMetas.textContent = 'Metas Confirmadas ✅';
            btnConfirmarMetas.classList.remove('pulsing-button');
            $$('.edit-meta-grupo-btn').forEach(btn => btn.disabled = true);
            parseEmojisInElement(btnConfirmarMetas);
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