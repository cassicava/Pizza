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
        
        // Aplica o estado salvo à UI do Passo 1
        if (geradorState.cargoId) $("#escCargo").value = geradorState.cargoId;
        if (geradorState.inicio) $("#escIni").value = geradorState.inicio;
        if (geradorState.fim) {
            $("#escFim").value = geradorState.fim;
            $("#escFim").disabled = false;
        }
        updateEscalaResumoDias();
        updateHolidaySectionState();
        renderFeriadosTags();
        
        // Aplica o estado salvo à UI do Passo 2 (se já tiver sido preenchido)
        if(geradorState.maxDiasConsecutivos) $("#maxDiasConsecutivos").value = geradorState.maxDiasConsecutivos;
        if(geradorState.minFolgasSabados) $("#minFolgasSabados").value = geradorState.minFolgasSabados;
        if(geradorState.minFolgasDomingos) $("#minFolgasDomingos").value = geradorState.minFolgasDomingos;
        
        // Como a cobertura agora é sempre manual, renderizamos e preenchemos os valores
        renderPasso2_Regras(geradorState.cargoId);
        for(const turnoId in geradorState.cobertura){
            const input = $(`#cobertura-${turnoId}`);
            if(input) input.value = geradorState.cobertura[turnoId];
        }
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
    // Garante que só o primeiro passo esteja visível ao resetar
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
        feriadosFieldset.disabled = false;
        feriadoDataInput.min = inicio;
        feriadoDataInput.max = fim;
    } else {
        feriadosFieldset.disabled = true;
        feriadoDataInput.min = '';
        feriadoDataInput.max = '';
    }
}

function resetHolidays() {
    geradorState.feriados = [];
    renderFeriadosTags();
    $('#feriado-data-input').value = '';
    $('#feriado-nome-input').value = '';
    $('#feriado-horas-desconto').value = '';
    setDescontarHorasToggleState('nao');
    saveGeradorState();
}

function setDescontarHorasToggleState(value) {
    const feriadoDescontarToggle = $('#feriado-descontar-toggle');
    const feriadoHorasDescontoContainer = $('#feriado-horas-desconto-container');
    
    $$('.toggle-btn', feriadoDescontarToggle).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
    
    const showHorasInput = value === 'sim';
    feriadoHorasDescontoContainer.style.display = showHorasInput ? 'flex' : 'none';
}

function setTrabalhaToggleState(value) {
    const feriadoTrabalhaToggle = $('#feriado-trabalha-toggle');
     $$('.toggle-btn', feriadoTrabalhaToggle).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
}


// Funções de inicialização e eventos
function setupEscalas() {
    const escIniInput = $("#escIni");
    const escFimInput = $("#escFim");

    escIniInput.onclick = () => escIniInput.showPicker();
    escFimInput.onclick = () => escFimInput.showPicker();
    $('#feriado-data-input').onclick = () => $('#feriado-data-input').showPicker();

    $("#btn-goto-passo2").onclick = () => handleGoToPasso2();
    $("#btn-back-passo1").onclick = () => navigateWizardWithAnimation('#gerador-container', 'passo1-selecao', 'backward');
    $("#btn-goto-passo3").onclick = () => handleGoToPasso3();
    $("#btn-back-passo2").onclick = () => navigateWizardWithAnimation('#gerador-container', 'passo2-cobertura', 'backward');

    $("#btnGerarEscala").onclick = async () => {
        await gerarEscala();
    };

    $("#btnVoltarPasso3").onclick = () => {
        $("#escalaView").classList.add('hidden');
        $("#gerador-container").classList.remove('hidden');
        navigateWizardWithAnimation('#gerador-container', 'passo3-excecoes', 'backward');
        const toolbox = $("#editor-toolbox");
        if(toolbox) toolbox.classList.add("hidden");
    };

    $("#escCargo").onchange = (e) => {
        $("#escCargo").classList.remove('invalid');
        geradorState.cargoId = e.target.value;
        saveGeradorState();
    };

    escIniInput.onchange = () => {
        escIniInput.classList.remove('invalid');
        geradorState.inicio = escIniInput.value;
        if (escIniInput.value) {
            escFimInput.disabled = false;
            escFimInput.min = escIniInput.value;
            escFimInput.showPicker();
        } else {
            escFimInput.disabled = true;
            escFimInput.value = '';
            geradorState.fim = null;
        }
        if (escFimInput.value && escFimInput.value < escIniInput.value) {
            escFimInput.value = '';
            geradorState.fim = null;
        }
        updateEscalaResumoDias();
        resetHolidays();
        updateHolidaySectionState();
        saveGeradorState();
    };
    escFimInput.onchange = () => {
        escFimInput.classList.remove('invalid');
        geradorState.fim = escFimInput.value;
        updateEscalaResumoDias();
        resetHolidays();
        updateHolidaySectionState();
        saveGeradorState();
    };

    $('#btn-add-feriado').onclick = () => addFeriado();

    $$('#feriado-trabalha-toggle .toggle-btn').forEach(button => {
        button.onclick = () => {
            setTrabalhaToggleState(button.dataset.value);
        };
    });

    const feriadoDescontarToggle = $('#feriado-descontar-toggle');
    $$('.toggle-btn', feriadoDescontarToggle).forEach(button => {
        button.onclick = () => {
            setDescontarHorasToggleState(button.dataset.value);
        };
    });

    $("#btnSalvarEscala").onclick = () => salvarEscalaAtual();
    $("#btnExcluirEscala").onclick = () => resetGeradorEscala();

    renderEscCargoSelect();
    loadAndApplyGeradorState();
    
    setTrabalhaToggleState('sim');
    setDescontarHorasToggleState('nao');
}

document.addEventListener("DOMContentLoaded", setupEscalas);