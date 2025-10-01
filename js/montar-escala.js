/**************************************
 * ✍️ Lógica da Criação Manual de Escala
 **************************************/

let montadorState = {
    cargoId: null,
    inicio: null,
    fim: null,
    feriados: [],
    excecoes: {}
};

function resetMontadorState() {
    montadorState = { cargoId: null, inicio: null, fim: null, feriados: [], excecoes: {} };
    // Limpa os campos da UI
    const cargoSelect = $("#montarCargo");
    if (cargoSelect) cargoSelect.value = '';
    const iniInput = $("#montarIni");
    if (iniInput) iniInput.value = '';
    const fimInput = $("#montarFim");
    if (fimInput) {
        fimInput.value = '';
        fimInput.disabled = true;
    }
    // Reseta visualizações
    updateMontarResumoDias();
    if ($("#montar-feriados-tags-container")) $("#montar-feriados-tags-container").innerHTML = '';
    if ($("#montar-excecoes-funcionarios-container")) $("#montar-excecoes-funcionarios-container").innerHTML = '';
    
    // Garante que o container do wizard esteja visível
    $('#montador-container').classList.remove('hidden');

    // Volta para o primeiro passo
    $$("#montador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $(`#montar-passo1`).classList.add('active');
}

function updateMontarResumoDias() {
    const inicio = $("#montarIni").value;
    const fim = $("#montarFim").value;
    const resumoEl = $("#montarResumoDias");

    if (inicio && fim && fim >= inicio) {
        const dias = dateRangeInclusive(inicio, fim).length;
        resumoEl.textContent = `Total: ${dias} dia(s)`;
    } else {
        resumoEl.textContent = 'Selecione o período para ver a duração da escala.';
    }
}

function renderMontarCargoSelect() {
    const { cargos } = store.getState();
    const sel = $("#montarCargo");
    if (!sel) return;

    const currentValue = sel.value;
    sel.innerHTML = "<option value=''>Selecione um cargo para a escala</option>";

    const cargosOrdenados = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        sel.appendChild(o);
    });

    if (cargos.some(c => c.id === currentValue)) {
        sel.value = currentValue;
    }
}


function addMontarFeriado() {
    const dataInput = $('#montar-feriado-data-input');
    const nomeInput = $('#montar-feriado-nome-input');
    const trabalha = $('#montar-feriado-trabalha-toggle .toggle-btn.active').dataset.value === 'sim';
    const descontaHoras = $('#montar-feriado-descontar-toggle .toggle-btn.active').dataset.value === 'sim';
    const horasDescontoInput = $('#montar-feriado-horas-desconto');
    let horasDesconto = 0;
    
    const date = dataInput.value;
    const nome = nomeInput.value.trim();

    if (!date || !nome) return showToast("Por favor, preencha a data e o nome do feriado.");
    if (montadorState.feriados.some(f => f.date === date)) return showToast("Já existe um feriado nesta data.");
    
    if (descontaHoras) {
        horasDesconto = parseInt(horasDescontoInput.value, 10);
        if (isNaN(horasDesconto) || horasDesconto < 0) {
            horasDescontoInput.classList.add('invalid');
            return showToast("Por favor, informe uma quantidade válida de horas para descontar.");
        }
    }
    horasDescontoInput.classList.remove('invalid');

    montadorState.feriados.push({ date, nome, trabalha, descontaHoras, horasDesconto });
    montadorState.feriados.sort((a, b) => a.date.localeCompare(b.date));
    renderMontarFeriadosTags();
    dataInput.value = '';
    nomeInput.value = '';
}

function removeMontarFeriado(date) {
    montadorState.feriados = montadorState.feriados.filter(f => f.date !== date);
    renderMontarFeriadosTags();
}

function renderMontarFeriadosTags() {
    const container = $('#montar-feriados-tags-container');
    container.innerHTML = montadorState.feriados.map(f => {
        const trabalhaText = f.trabalha ? '' : ' (Folga)';
        const descontoText = f.descontaHoras ? ` (-${f.horasDesconto}h)` : '';
        return `<span class="tag">${new Date(f.date+'T12:00:00').toLocaleDateString()} - ${f.nome}${trabalhaText}${descontoText}<button data-remove-feriado-montar="${f.date}">x</button></span>`
    }).join('');
    $$('[data-remove-feriado-montar]').forEach(btn => {
        btn.addEventListener('click', () => removeMontarFeriado(btn.dataset.removeFeriadoMontar));
    });
}

function handleMontarGoToPasso2() {
    const cargoId = $("#montarCargo").value;
    const inicio = $("#montarIni").value;
    const fim = $("#montarFim").value;

    if (!cargoId || !inicio || !fim) {
        return showToast("Por favor, selecione o cargo e o período completo.");
    }
    if (fim < inicio) {
        return showToast("A data de fim não pode ser anterior à data de início.");
    }

    montadorState.cargoId = cargoId;
    montadorState.inicio = inicio;
    montadorState.fim = fim;

    renderMontarExcecoes(cargoId);
    navigateWizardWithAnimation('#montador-container', 'montar-passo2', 'forward');
}

function renderMontarExcecoes(cargoId) {
    const { funcionarios } = store.getState();
    const funcs = funcionarios.filter(f => f.cargoId === cargoId).sort((a, b) => a.nome.localeCompare(b.nome));
    const container = $("#montar-excecoes-funcionarios-container");
    container.innerHTML = "";

    funcs.forEach(func => {
        if (!montadorState.excecoes[func.id]) {
            montadorState.excecoes[func.id] = { ferias: { dates: [] }, afastamento: { dates: [] }, folgas: [] };
        }
        const div = document.createElement('div');
        div.className = 'excecao-func-card';
        const tipoFolgaOptions = TIPOS_FOLGA.map(t => `<option value="${t.nome}">${t.nome} (${t.sigla})</option>`).join('');

        div.innerHTML = `
            <div class="excecao-header"><strong>${func.nome}</strong></div>
            <div class="excecao-body">
                <fieldset class="fieldset-wrapper">
                    <legend>Férias</legend>
                    <div class="form-row form-row-vcenter">
                        <div class="toggle-group" data-toggle-container="ferias" data-func-id="${func.id}">
                            <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                            <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                        </div>
                        <div class="form-row dates-container hidden" data-dates-container="ferias" data-func-id="${func.id}" style="flex-grow: 1; margin: 0; gap: 8px;">
                            <div>Início: <input type="date" title="Início" data-date-ini="ferias" data-func-id="${func.id}" min="${montadorState.inicio}" max="${montadorState.fim}" class="input-sm"></div>
                            <div>Fim: <input type="date" title="Fim" data-date-fim="ferias" data-func-id="${func.id}" min="${montadorState.inicio}" max="${montadorState.fim}" class="input-sm"></div>
                        </div>
                    </div>
                </fieldset>

                <fieldset class="fieldset-wrapper">
                    <legend>Folgas Avulsas</legend>
                    <div class="form-row-aligned">
                        <div style="flex-basis: 180px;"><input type="date" data-folga-input="${func.id}" min="${montadorState.inicio}" max="${montadorState.fim}" class="input-sm"></div>
                        <div style="flex-basis: 220px; flex-grow: 0;"><select data-folga-tipo="${func.id}">${tipoFolgaOptions}</select></div>
                        <button class="secondary" data-add-folga="${func.id}">Adicionar</button>
                    </div>
                    <div class="folgas-tags" data-folgas-tags="${func.id}"></div>
                </fieldset>
            </div>
        `;
        container.appendChild(div);
        
        $$(`#montar-excecoes-funcionarios-container [data-toggle-container][data-func-id="${func.id}"] .toggle-btn`).forEach(btn => {
            btn.addEventListener('click', (e) => handleMontarExcecaoToggle(e, func.id));
        });
        $$(`#montar-excecoes-funcionarios-container [data-date-ini][data-func-id="${func.id}"], #montar-excecoes-funcionarios-container [data-date-fim][data-func-id="${func.id}"]`).forEach(input => {
            input.addEventListener('change', (e) => {
                updateMontarExcecaoDates(e, input.dataset.dateIni || input.dataset.dateFim, func.id);
                
                const tipo = input.dataset.dateIni;
                if (tipo) {
                    const iniInput = e.target;
                    const fimInput = div.querySelector(`[data-date-fim="${tipo}"][data-func-id="${func.id}"]`);
                    if (iniInput.value && fimInput) {
                        fimInput.min = iniInput.value;
                        if (fimInput.value && fimInput.value < iniInput.value) {
                            fimInput.value = '';
                            fimInput.dispatchEvent(new Event('change'));
                        }
                        fimInput.showPicker();
                    }
                }
            });
        });
        div.querySelector(`[data-add-folga="${func.id}"]`).addEventListener('click', () => addMontarFolga(func.id));
    });
}

function handleMontarExcecaoToggle(event, funcId) {
    const container = event.target.closest('[data-toggle-container]');
    const tipo = container.dataset.toggleContainer;
    const value = event.target.dataset.value;

    container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    $(`#montar-excecoes-funcionarios-container [data-dates-container="${tipo}"][data-func-id="${funcId}"]`).classList.toggle('hidden', value === 'nao');
    if (value === 'nao') {
        const iniInput = $(`#montar-excecoes-funcionarios-container [data-date-ini="${tipo}"][data-func-id="${func.id}"]`);
        iniInput.value = '';
        $(`#montar-excecoes-funcionarios-container [data-date-fim="${tipo}"][data-func-id="${func.id}"]`).value = '';
        iniInput.dispatchEvent(new Event('change'));
    }
}

function updateMontarExcecaoDates(event, tipo, funcId) {
    const inicio = $(`#montar-excecoes-funcionarios-container [data-date-ini="${tipo}"][data-func-id="${funcId}"]`).value;
    const fim = $(`#montar-excecoes-funcionarios-container [data-date-fim="${tipo}"][data-func-id="${funcId}"]`).value;
    
    if (inicio && fim && fim >= inicio) {
        montadorState.excecoes[funcId][tipo].dates = dateRangeInclusive(inicio, fim);
    } else {
        montadorState.excecoes[funcId][tipo].dates = [];
    }
}

function addMontarFolga(funcId) {
    const input = $(`#montar-excecoes-funcionarios-container [data-folga-input="${funcId}"]`);
    const tipoSelect = $(`#montar-excecoes-funcionarios-container [data-folga-tipo="${funcId}"]`);
    const date = input.value;
    const tipo = tipoSelect.value;

    if (!date) return;
    if (!montadorState.excecoes[funcId].folgas.some(f => f.date === date)) {
        montadorState.excecoes[funcId].folgas.push({ date, tipo });
        renderMontarFolgas(funcId);
        input.value = '';
    }
}

function removeMontarFolga(funcId, date) {
    montadorState.excecoes[funcId].folgas = montadorState.excecoes[funcId].folgas.filter(f => f.date !== date);
    renderMontarFolgas(funcId);
}

function renderMontarFolgas(funcId) {
    const container = $(`#montar-excecoes-funcionarios-container [data-folgas-tags="${funcId}"]`);
    container.innerHTML = montadorState.excecoes[funcId].folgas.map(f => {
        const sigla = TIPOS_FOLGA.find(tf => tf.nome === f.tipo)?.sigla || 'F';
        return `<span class="tag" data-tipo-folga="${f.tipo}">${new Date(f.date+'T12:00:00').toLocaleDateString()} (${sigla})<button data-remove-montar-folga="${funcId}" data-date="${f.date}">x</button></span>`
    }).join('');

    $$(`#montar-excecoes-funcionarios-container [data-remove-montar-folga="${funcId}"]`).forEach(btn => {
        btn.addEventListener('click', () => removeMontarFolga(funcId, btn.dataset.date));
    });
}

function iniciarEdicaoManual() {
    const { cargos, funcionarios } = store.getState();
    const { cargoId, inicio, fim, feriados, excecoes } = montadorState;

    const cargo = cargos.find(c => c.id === cargoId);
    const funcsDoCargo = funcionarios.filter(f => f.cargoId === cargoId);

    const historico = {};
    funcsDoCargo.forEach(f => {
        historico[f.id] = { horasTrabalhadas: 0, ultimoTurnoFim: null };
    });

    const nomeEscala = generateEscalaNome(cargo.nome, inicio, fim);

    currentEscala = {
        id: uid(), nome: nomeEscala, cargoId, inicio, fim,
        slots: [], historico,
        excecoes: JSON.parse(JSON.stringify(excecoes)),
        feriados: [...feriados], cobertura: {},
        isManual: true // Flag para identificar a escala como manual
    };
    
    $('#page-montar-escala').classList.remove('active');
    $('#montador-container').classList.add('hidden');
    $('#page-gerar-escala').classList.add('active');
    $('#gerador-escala-titulo').textContent = '✍️ Editor Manual de Escala';
    $('#gerador-container').classList.add('hidden');
    $('#escalaView').classList.remove('hidden');

    $$(".tab-btn").forEach(b => b.classList.remove("active"));
    $(`.tab-btn[data-page="montar-escala"]`).classList.add('active');

    renderEscalaTable(currentEscala);

    const btnVoltar = $("#btnVoltarPasso3");
    btnVoltar.textContent = "< Descartar e Voltar";
    
    const novoBtnVoltar = btnVoltar.cloneNode(true);
    btnVoltar.parentNode.replaceChild(novoBtnVoltar, btnVoltar);
    novoBtnVoltar.addEventListener('click', () => go('montar-escala'));
}

function initMontarEscalaPage() {
    renderMontarCargoSelect();

    const cargoInput = $("#montarCargo");
    const iniInput = $("#montarIni");
    const fimInput = $("#montarFim");
    
    if (iniInput) iniInput.addEventListener('click', () => iniInput.showPicker());
    if (fimInput) fimInput.addEventListener('click', () => fimInput.showPicker());

    cargoInput.addEventListener('change', (e) => {
        if(e.target.value) iniInput.showPicker();
    });

    iniInput.addEventListener('change', (e) => {
        if (e.target.value) {
            fimInput.disabled = false;
            fimInput.min = e.target.value;
            fimInput.showPicker();
        } else {
            fimInput.disabled = true;
            fimInput.value = '';
        }
        updateMontarResumoDias();
        $('#montar-feriados-fieldset').disabled = !e.target.value;
    });
    fimInput.addEventListener('change', updateMontarResumoDias);

    $("#btn-montar-goto-passo2").addEventListener('click', handleMontarGoToPasso2);
    $("#btn-add-montar-feriado").addEventListener('click', addMontarFeriado);
    
    $$('#montar-feriado-trabalha-toggle .toggle-btn').forEach(button => {
        button.addEventListener('click', () => {
            $$('#montar-feriado-trabalha-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
    const trabalhaToggleDefault = $('#montar-feriado-trabalha-toggle .toggle-btn[data-value="sim"]');
    if(trabalhaToggleDefault) trabalhaToggleDefault.click();

    const descontarToggle = $('#montar-feriado-descontar-toggle');
    $$('.toggle-btn', descontarToggle).forEach(button => {
        button.addEventListener('click', () => {
             $$('.toggle-btn', descontarToggle).forEach(btn => btn.classList.remove('active'));
             button.classList.add('active');
             $('#montar-feriado-horas-desconto-container').style.display = button.dataset.value === 'sim' ? 'flex' : 'none';
        });
    });
     const descontarToggleDefault = $('#montar-feriado-descontar-toggle .toggle-btn[data-value="nao"]');
     if(descontarToggleDefault) descontarToggleDefault.click();


    $("#btn-montar-back-passo1").addEventListener('click', () => navigateWizardWithAnimation('#montador-container', 'montar-passo1', 'backward'));
    $("#btnIniciarEdicaoManual").addEventListener('click', iniciarEdicaoManual);
    
    $$("#montador-container .wizard-step").forEach(step => step.classList.remove('active'));
    $(`#montar-passo1`).classList.add('active');
}

document.addEventListener('DOMContentLoaded', initMontarEscalaPage);