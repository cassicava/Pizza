/**************************************
 * 📅 Escalas
 **************************************/
// Este arquivo agora atua como um orquestrador
// Ele define o estado global do gerador e conecta as funções dos outros módulos.
let currentEscala = null;
const GERADOR_STATE_KEY = 'ge_gerador_state_session';

let geradorState = {
    cargoId: null,
    inicio: null,
    fim: null,
    excecoes: {},
    feriados: [],
    maxDiasConsecutivos: 6,
    minFolgasSabados: 1,
    minFolgasDomingos: 1,
    otimizarFolgas: true,
    cobertura: {}
};

function saveGeradorState() {
    sessionStorage.setItem(GERADOR_STATE_KEY, JSON.stringify(geradorState));
}

function loadAndApplyGeradorState() {
    const savedState = sessionStorage.getItem(GERADOR_STATE_KEY);
    if (savedState) {
        geradorState = JSON.parse(savedState);
        
        if (geradorState.cargoId) $("#escCargo").value = geradorState.cargoId;
        if (geradorState.inicio) $("#escIni").value = geradorState.inicio;
        if (geradorState.fim) {
            $("#escFim").value = geradorState.fim;
            $("#escFim").disabled = false;
        }
        updateEscalaResumoDias();
        updateHolidaySectionState();
        renderFeriadosTags();
        
        if(geradorState.maxDiasConsecutivos) $("#maxDiasConsecutivos").value = geradorState.maxDiasConsecutivos;
        if(geradorState.minFolgasSabados) $("#minFolgasSabados").value = geradorState.minFolgasSabados;
        if(geradorState.minFolgasDomingos) $("#minFolgasDomingos").value = geradorState.minFolgasDomingos;
        
        renderPasso2_Cobertura(geradorState.cargoId);
    }
}


// Funções de inicialização e navegação
function resetGeradorEscala() {
    geradorState = { cargoId: null, inicio: null, fim: null, excecoes: {}, feriados: [], maxDiasConsecutivos: 6, minFolgasSabados: 1, minFolgasDomingos: 1, otimizarFolgas: true, cobertura: {} };
    sessionStorage.removeItem(GERADOR_STATE_KEY);
    currentEscala = null;

    if (typeof editorState !== 'undefined' && editorState) {
        editorState.isEditMode = false;
        editorState.selectedCell = null;
        editorState.currentEscala = null;
        editorState.selectedEmployeeBrush = null;
    }

    $("#escalaView").classList.add('hidden');
    $("#gerador-container").classList.remove('hidden');
    $$("#gerador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $("#passo1-selecao").classList.add('active');

    $("#escCargo").value = '';
    $("#escIni").value = '';
    $("#escFim").value = '';
    $('#escFim').disabled = true;
    updateEscalaResumoDias();
    $$('#passo1-selecao .invalid').forEach(el => el.classList.remove('invalid'));
    $("#cobertura-turnos-container").innerHTML = '';
    $("#excecoes-funcionarios-container").innerHTML = '';
    $("#minFolgasSabados").value = 1;
    $("#minFolgasDomingos").value = 1;
    resetHolidays();

    if ($("#feriados-fieldset")) {
        $("#feriados-fieldset").disabled = true;
    }
    const toolbox = $("#editor-toolbox");
    if(toolbox) toolbox.classList.add("hidden");

    setTrabalhaToggleState('sim'); 
}

function updateHolidaySectionState() {
    const feriadosFieldset = $("#feriados-fieldset");
    const feriadoDataInput = $('#feriado-data-input');
    const inicio = $("#escIni").value;
    const fim = $("#escFim").value;

    if (inicio && fim && fim >= inicio) {
        if (feriadosFieldset) feriadosFieldset.disabled = false;
        if (feriadoDataInput) {
            feriadoDataInput.min = inicio;
            feriadoDataInput.max = fim;
        }
    } else {
        if (feriadosFieldset) feriadosFieldset.disabled = true;
        if (feriadoDataInput) {
            feriadoDataInput.min = '';
            feriadoDataInput.max = '';
        }
    }
}

function resetHolidays() {
    geradorState.feriados = [];
    renderFeriadosTags();
    const feriadoDataInput = $('#feriado-data-input');
    if (feriadoDataInput) feriadoDataInput.value = '';
    const feriadoNomeInput = $('#feriado-nome-input');
    if (feriadoNomeInput) feriadoNomeInput.value = '';
    const feriadoHorasInput = $('#feriado-horas-desconto');
    if (feriadoHorasInput) feriadoHorasInput.value = '';
    setDescontarHorasToggleState('nao');
    saveGeradorState();
}

function setDescontarHorasToggleState(value) {
    const feriadoDescontarToggle = $('#feriado-descontar-toggle');
    const feriadoHorasDescontoContainer = $('#feriado-horas-desconto-container');
    
    if (feriadoDescontarToggle) {
        $$('.toggle-btn', feriadoDescontarToggle).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }
    
    if (feriadoHorasDescontoContainer) {
        feriadoHorasDescontoContainer.style.display = (value === 'sim') ? 'flex' : 'none';
    }
}

function setTrabalhaToggleState(value) {
    const feriadoTrabalhaToggle = $('#feriado-trabalha-toggle');
    if (feriadoTrabalhaToggle) {
        $$('.toggle-btn', feriadoTrabalhaToggle).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }
}


// Funções de inicialização e eventos
function setupEscalas() {
    // CORREÇÃO: Adicionadas verificações (if (elemento)) antes de cada addEventListener
    // para evitar o erro "Cannot read properties of null".

    const escCargoInput = $("#escCargo");
    if (escCargoInput) {
        escCargoInput.addEventListener('change', (e) => {
            escCargoInput.classList.remove('invalid');
            geradorState.cargoId = e.target.value;
            if (e.target.value) {
                try { $("#escIni").showPicker(); } catch (err) { console.warn("showPicker() não suportado."); }
            }
            saveGeradorState();
        });
    }

    const escIniInput = $("#escIni");
    if (escIniInput) {
        escIniInput.addEventListener('change', () => {
            const escFimInput = $("#escFim"); // Re-query para garantir
            escIniInput.classList.remove('invalid');
            const inicioValue = escIniInput.value;
            geradorState.inicio = inicioValue;
        
            if (inicioValue) {
                if (escFimInput) {
                    escFimInput.disabled = false;
                    escFimInput.min = inicioValue;
                }
            } else {
                if (escFimInput) {
                    escFimInput.disabled = true;
                    escFimInput.value = '';
                }
                geradorState.fim = null;
            }
        
            if (escFimInput && escFimInput.value && escFimInput.value < inicioValue) {
                escFimInput.value = '';
                geradorState.fim = null;
            }
            
            updateEscalaResumoDias();
            resetHolidays();
            updateHolidaySectionState();
            saveGeradorState();
        });
    }

    const escFimInput = $("#escFim");
    if (escFimInput) {
        escFimInput.addEventListener('change', () => {
            escFimInput.classList.remove('invalid');
            geradorState.fim = escFimInput.value;
            updateEscalaResumoDias();
            resetHolidays();
            updateHolidaySectionState();
            saveGeradorState();
        });
    }

    const feriadoDataInput = $('#feriado-data-input');
    if (feriadoDataInput) {
        feriadoDataInput.addEventListener('click', () => {
            try { feriadoDataInput.showPicker(); } catch(e) { console.warn("showPicker() não suportado."); }
        });
    }

    const btnGotoPasso2 = $("#btn-goto-passo2");
    if (btnGotoPasso2) btnGotoPasso2.addEventListener('click', () => handleGoToPasso2());

    const btnBackPasso1 = $("#btn-back-passo1");
    if (btnBackPasso1) btnBackPasso1.addEventListener('click', () => navigateWizardWithAnimation('#gerador-container', 'passo1-selecao', 'backward'));
    
    const btnGotoPasso3 = $("#btn-goto-passo3");
    if (btnGotoPasso3) btnGotoPasso3.addEventListener('click', () => handleGoToPasso3());
    
    const btnBackPasso2 = $("#btn-back-passo2");
    if (btnBackPasso2) btnBackPasso2.addEventListener('click', () => navigateWizardWithAnimation('#gerador-container', 'passo2-cobertura', 'backward'));

    const btnBackPasso3 = $("#btn-back-passo3");
    if (btnBackPasso3) btnBackPasso3.addEventListener('click', () => navigateWizardWithAnimation('#gerador-container', 'passo3-excecoes', 'backward'));
    
    const btnGerarEscala = $("#btnGerarEscala");
    if (btnGerarEscala) btnGerarEscala.addEventListener('click', async () => await gerarEscala());

    const btnVoltarPasso3 = $("#btnVoltarPasso3");
    if(btnVoltarPasso3) {
        btnVoltarPasso3.addEventListener('click', () => {
            $("#escalaView").classList.add('hidden');
            $("#gerador-container").classList.remove('hidden');
            navigateWizardWithAnimation('#gerador-container', 'passo3-excecoes', 'backward');
            const toolbox = $("#editor-toolbox");
            if(toolbox) toolbox.classList.add("hidden");
        });
    }
    
    const btnAddFeriado = $('#btn-add-feriado');
    if (btnAddFeriado) btnAddFeriado.addEventListener('click', () => addFeriado());

    const feriadoTrabalhaToggle = $('#feriado-trabalha-toggle');
    if (feriadoTrabalhaToggle) {
        $$('.toggle-btn', feriadoTrabalhaToggle).forEach(button => {
            button.addEventListener('click', () => {
                setTrabalhaToggleState(button.dataset.value);
            });
        });
    }

    const feriadoDescontarToggle = $('#feriado-descontar-toggle');
    if (feriadoDescontarToggle) {
        $$('.toggle-btn', feriadoDescontarToggle).forEach(button => {
            button.addEventListener('click', () => {
                setDescontarHorasToggleState(button.dataset.value);
            });
        });
    }

    const btnSalvarEscala = $("#btnSalvarEscala");
    if (btnSalvarEscala) btnSalvarEscala.addEventListener('click', () => salvarEscalaAtual());

    const btnExcluirEscala = $("#btnExcluirEscala");
    if (btnExcluirEscala) btnExcluirEscala.addEventListener('click', () => resetGeradorEscala());

    renderEscCargoSelect();
    loadAndApplyGeradorState();
    
    setTrabalhaToggleState('sim');
    setDescontarHorasToggleState('nao');
}

document.addEventListener("DOMContentLoaded", setupEscalas);