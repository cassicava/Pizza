/**************************************
 * ✨ Assistente de Geração Automática
 **************************************/

let geradorState = {};

function setGeradorFormDirty(isDirty) {
    dirtyForms['gerar-escala'] = isDirty;
}

function resetGeradorWizard() {
    geradorState = {
        cargoId: null, inicio: null, fim: null, excecoes: {}, feriados: [],
        maxDiasConsecutivos: 6, minFolgasSabados: 1, minFolgasDomingos: 1,
        cobertura: {},
        coberturaPorEquipe: {}, 
    };
    currentEscala = null; // Limpa a escala atual também

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
        
        // A escala para editar é atribuída à variável global 'currentEscala'
        currentEscala = options.escalaParaEditar;
        currentEscala.owner = 'gerador';

        renderEscalaTable(currentEscala);
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

function renderPasso3_Cobertura() {
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

        let equipesOptionsHTML = '';
        if (equipesCompativeis.length > 0) {
            equipesOptionsHTML = equipesCompativeis.map(equipe => `
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
            `).join('');
        } else {
            equipesOptionsHTML = `<p class="muted" style="margin: 8px 0;">Nenhuma equipe cadastrada para este turno.</p>`;
        }

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

    // Add event listeners
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
    
    // --- INÍCIO DA MELHORIA (PASSO 3) ---
    $$('.cobertura-equipe-padrao input').forEach(input => {
        if (input.type === 'date') {
            input.addEventListener('click', function() {
                try { this.showPicker(); } catch (e) { console.error("showPicker() not supported.", e); }
            });
        }
        input.addEventListener('input', () => { // Alterado para 'input' para cobrir teclado e calendário
            const patternDiv = input.closest('.cobertura-equipe-padrao');
            updateTeamPatternExplanation(patternDiv);
            setGeradorFormDirty(true);
        });
    });
    // --- FIM DA MELHORIA ---

    $$('input[data-cobertura]', container).forEach(input => input.addEventListener('input', () => setGeradorFormDirty(true)));
}

function updateTeamPatternExplanation(patternDiv) {
    const explanationDiv = patternDiv.closest('.cobertura-equipe-row').nextElementSibling;
    const work = parseInt(patternDiv.querySelector('[data-pattern="work"]').value, 10) || 1;
    const off = parseInt(patternDiv.querySelector('[data-pattern="off"]').value, 10) || 1;
    const startDate = patternDiv.querySelector('[data-pattern="start"]').value;
    
    if (!startDate) {
        explanationDiv.innerHTML = `Selecione uma data de início.`;
        return;
    }
    
    const dateRange = dateRangeInclusive(geradorState.inicio, geradorState.fim);
    const startIndex = dateRange.indexOf(startDate);
    
    if (startIndex === -1) {
        explanationDiv.innerHTML = `A data de início está fora do período da escala.`;
        return;
    }

    const ciclo = work + off;
    const diasDeTrabalho = [];
    for(let i = 0; i < Math.min(dateRange.length, 10); i++) { // Mostra uma prévia dos primeiros dias
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
        } else { // modo 'equipes'
            geradorState.cobertura[turnoId] = parseInt($('[data-cobertura="complementar"]', container).value, 10) || 0;
            geradorState.coberturaPorEquipe[turnoId] = [];

            $$('input[type="checkbox"][name^="equipe_check_"]:checked', container).forEach(chk => {
                const equipeId = chk.value;
                const patternContainer = chk.closest('.cobertura-equipe-row').querySelector('.cobertura-equipe-padrao');
                const equipeRule = {
                    equipeId: equipeId,
                    work: parseInt($('[data-pattern="work"]', patternContainer).value, 10) || 1,
                    off: parseInt($('[data-pattern="off"]', patternContainer).value, 10) || 1,
                    start: $('[data-pattern="start"]', patternContainer).value,
                };
                geradorState.coberturaPorEquipe[turnoId].push(equipeRule);
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
        // --- INÍCIO DA CORREÇÃO ---
        // Altera a variável de 'geradorCurrentEscala' para 'currentEscala'
        if (newName && currentEscala && newName !== currentEscala.nome) {
            currentEscala.nome = newName;
            setGeradorFormDirty(true);
        }
        if (currentEscala) {
           textEl.textContent = currentEscala.nome;
        }
        // --- FIM DA CORREÇÃO ---
        container.classList.remove('is-editing');
        editBtn.innerHTML = '✏️';
    };

    const toEditMode = () => {
        // --- INÍCIO DA CORREÇÃO ---
        // Altera a variável de 'geradorCurrentEscala' para 'currentEscala'
        if (!currentEscala) return;
        container.classList.add('is-editing');
        editBtn.innerHTML = '✔️';
        inputEl.value = currentEscala.nome;
        // --- FIM DA CORREÇÃO ---
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
            // --- INÍCIO DA CORREÇÃO ---
            // Altera a variável de 'geradorCurrentEscala' para 'currentEscala'
            inputEl.value = currentEscala.nome;
            // --- FIM DA CORREÇÃO ---
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