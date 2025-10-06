/**************************************
 * ✨ Assistente de Geração Automática
 **************************************/

let geradorState = {};
let geradorCurrentEscala = null;

function setGeradorFormDirty(isDirty) {
    dirtyForms['gerar-escala'] = isDirty;
}

function resetGeradorWizard() {
    geradorState = {
        cargoId: null, inicio: null, fim: null, excecoes: {}, feriados: [],
        maxDiasConsecutivos: 6, minFolgasSabados: 1, minFolgasDomingos: 1,
        cobertura: {}
    };
    geradorCurrentEscala = null;

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
    resetGeradorHolidays();
    updateGeradorHolidaySectionState();

    if ($("#gerador-excecoes-funcionarios-container")) $("#gerador-excecoes-funcionarios-container").innerHTML = '';
    if ($("#gerador-cobertura-turnos-container")) $("#gerador-cobertura-turnos-container").innerHTML = '';

    const toolbox = $("#editor-toolbox");
    if(toolbox) toolbox.classList.add("hidden");

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
        
        geradorCurrentEscala = options.escalaParaEditar;
        geradorCurrentEscala.owner = 'gerador';

        renderEscalaTable(geradorCurrentEscala);
    } else {
        resetGeradorWizard();
        renderGeradorCargoSelect();
    }
}

function renderGeradorCargoSelect() {
    const { cargos } = store.getState();
    const sel = $("#gerar-escCargo");
    if (!sel) return;
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

function updateGeradorHolidaySectionState() {
    const feriadosFieldset = $("#gerar-feriados-fieldset");
    const feriadoDataInput = $('#gerar-feriado-data-input');
    const inicio = $("#gerar-escIni").value;
    const fim = $("#gerar-escFim").value;
    if (feriadosFieldset && inicio && fim && fim >= inicio) {
        feriadosFieldset.disabled = false;
        feriadoDataInput.min = inicio;
        feriadoDataInput.max = fim;
    } else if (feriadosFieldset) {
        feriadosFieldset.disabled = true;
    }
}

function resetGeradorHolidays() {
    geradorState.feriados = [];
    if ($("#gerar-feriados-tags-container")) $("#gerar-feriados-tags-container").innerHTML = '';
    if ($('#gerar-feriado-data-input')) $('#gerar-feriado-data-input').value = '';
    if ($('#gerar-feriado-nome-input')) $('#gerar-feriado-nome-input').value = '';
}

function handleGoToPasso2() {
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
    createExcecoesComponent({
        stateObject: geradorState,
        containerSelector: '#gerador-excecoes-funcionarios-container',
        cargoId: geradorState.cargoId,
        onUpdate: () => setGeradorFormDirty(true),
    });
    navigateWizardWithAnimation('#gerador-wizard-container', 'gerador-wizard-passo2', 'forward');
}

function renderPasso3_Cobertura(coberturaExistente = {}) {
    const { cargos, turnos } = store.getState();
    const cargo = cargos.find(c => c.id === geradorState.cargoId);
    const container = $("#gerador-cobertura-turnos-container");
    container.innerHTML = "";
    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        container.innerHTML = `<p class="muted">Este cargo não possui turnos associados.</p>`;
        return;
    }
    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id));
    turnosDoCargo.forEach(turno => {
        const valorCobertura = coberturaExistente[turno.id] || 1;
        const div = document.createElement('div');
        div.className = 'form-row-aligned cobertura-item';
        div.innerHTML = `
            <span style="flex-grow: 1;">${turno.nome} (${turno.inicio} - ${turno.fim})</span>
            <div class="animated-field" style="max-width: 150px;">
                <input type="number" id="cobertura-${turno.id}" data-turno-id="${turno.id}" value="${valorCobertura}" min="0" placeholder=" " />
                <label for="cobertura-${turno.id}">Nº de funcionários</label>
            </div>
        `;
        container.appendChild(div);
        $(`#cobertura-${turno.id}`).addEventListener('input', () => setGeradorFormDirty(true));
    });
}

function handleStartGeneration() {
    geradorState.cobertura = {};
    $$('#gerador-cobertura-turnos-container input').forEach(input => {
        geradorState.cobertura[input.dataset.turnoId] = parseInt(input.value, 10) || 0;
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
        if (newName && geradorCurrentEscala && newName !== geradorCurrentEscala.nome) {
            geradorCurrentEscala.nome = newName;
            setGeradorFormDirty(true);
        }
        if (geradorCurrentEscala) {
           textEl.textContent = geradorCurrentEscala.nome;
        }
        container.classList.remove('is-editing');
        editBtn.innerHTML = '✏️';
    };

    const toEditMode = () => {
        if (!geradorCurrentEscala) return;
        container.classList.add('is-editing');
        editBtn.innerHTML = '✔️';
        inputEl.value = geradorCurrentEscala.nome;
        inputEl.focus();
        inputEl.select();
    };

    editBtn.onclick = () => {
        if (container.classList.contains('is-editing')) {
            toViewMode();
        } else {
            toEditMode();
        }
    };
    textEl.onclick = toEditMode;
    inputEl.onblur = toViewMode;
    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            toViewMode();
        } else if (e.key === 'Escape') {
            inputEl.value = geradorCurrentEscala.nome;
            toViewMode();
        }
    };
}


function setupGeradorPage() {
    $("#btn-gerador-goto-passo2").addEventListener('click', handleGoToPasso2);
    $("#btn-gerador-goto-passo3").addEventListener('click', () => {
        renderPasso3_Cobertura();
        navigateWizardWithAnimation('#gerador-wizard-container', 'gerador-wizard-passo3', 'forward');
    });
    
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
    const feriadoDataInput = $('#gerar-feriado-data-input');

    escCargoSelect.addEventListener('change', (e) => {
        geradorState.cargoId = e.target.value;
        if (e.target.value) {
            setTimeout(() => escIniInput.showPicker(), 100);
        }
        setGeradorFormDirty(true);
    });

    escIniInput.addEventListener('change', (e) => {
        if (e.target.value) {
            escFimInput.disabled = false;
            escFimInput.min = e.target.value;
            setTimeout(() => escFimInput.showPicker(), 100);
        } else {
            escFimInput.disabled = true;
            escFimInput.value = '';
        }
        updateGeradorResumoDias();
        updateGeradorHolidaySectionState();
        setGeradorFormDirty(true);
    });

    escFimInput.addEventListener('change', () => {
        updateGeradorResumoDias();
        updateGeradorHolidaySectionState();
        setGeradorFormDirty(true);
    });

    [escIniInput, escFimInput, feriadoDataInput, $('#gerar-maxDiasConsecutivos'), $('#gerar-minFolgasSabados'), $('#gerar-minFolgasDomingos')].forEach(input => {
        if (input) {
            if (input.type === 'date') {
                input.addEventListener('click', function() {
                    try { this.showPicker(); } catch (e) { console.error("showPicker() not supported.", e); }
                });
            }
            input.addEventListener('input', () => setGeradorFormDirty(true));
        }
    });

    createFeriadosComponent({
        stateObject: geradorState,
        containerSelector: '#gerar-feriados-tags-container',
        dataInputSelector: '#gerar-feriado-data-input',
        nomeInputSelector: '#gerar-feriado-nome-input',
        trabalhaToggleSelector: '#gerar-feriado-trabalha-toggle',
        descontaToggleSelector: '#gerar-feriado-descontar-toggle',
        horasInputSelector: '#gerar-feriado-horas-desconto',
        horasContainerSelector: '#gerar-feriado-horas-desconto-container',
        addButtonSelector: '#btn-add-feriado-gerar',
        onUpdate: () => setGeradorFormDirty(true),
    });
    
    $('#gerar-feriado-trabalha-toggle .toggle-btn[data-value="nao"]').click();
    $('#gerar-feriado-descontar-toggle .toggle-btn[data-value="nao"]').click();

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
        if (confirmado) {
            resetGeradorWizard();
            go('home');
        }
    });

    setupInlineTitleEditor();
}

document.addEventListener("DOMContentLoaded", setupGeradorPage);