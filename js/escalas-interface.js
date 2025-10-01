/**************************************
 * 📅 Lógica da Interface do Gerador
 **************************************/

function navigateWizardWithAnimation(containerSelector, targetStepId, direction = 'forward') {
    const container = $(containerSelector);
    if (!container) return;

    const currentStepEl = $('.wizard-step.active', container);
    const nextStepEl = $(`#${targetStepId}`, container);

    if (!nextStepEl || (currentStepEl && currentStepEl.id === targetStepId)) return;

    const animOutClass = direction === 'forward' ? 'anim-slide-out-left' : 'anim-slide-out-right';
    const animInClass = direction === 'forward' ? 'anim-slide-in-right' : 'anim-slide-in-left';

    if (currentStepEl) {
        currentStepEl.classList.add(animOutClass);
        setTimeout(() => {
            currentStepEl.classList.remove('active', animOutClass);
        }, 400); // Duração da animação
    }

    nextStepEl.classList.remove('anim-slide-in-right', 'anim-slide-in-left', 'anim-slide-out-right', 'anim-slide-out-left');
    nextStepEl.classList.add('active', animInClass);
}


function renderEscCargoSelect() {
    const { cargos } = store.getState();
    const sel = $("#escCargo");
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

function updateEscalaResumoDias() {
    const inicio = $("#escIni").value;
    const fim = $("#escFim").value;
    const resumoEl = $("#escResumoDias");

    if (inicio && fim && fim >= inicio) {
        const dias = dateRangeInclusive(inicio, fim).length;
        resumoEl.textContent = `Total: ${dias} dia(s)`;
    } else {
        resumoEl.textContent = 'Selecione o período para ver a duração da escala.';
    }
}

function renderPasso2_Cobertura(cargoId) {
    const { cargos, turnos, equipes } = store.getState();
    const cargo = cargos.find(c => c.id === cargoId);
    const container = $("#cobertura-turnos-container");
    container.innerHTML = "";

    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        container.innerHTML = `<p class="muted">Este cargo não possui turnos associados. Volte e edite o cargo primeiro.</p>`;
        return;
    }

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id)).sort((a, b) => a.nome.localeCompare(b.nome));

    turnosDoCargo.forEach(turno => {
        const div = document.createElement('div');
        div.className = 'cobertura-item';
        div.dataset.turnoId = turno.id;

        div.innerHTML = `
            <div class="cobertura-item-header">
                <strong>${turno.nome} <span class="muted">(${turno.inicio}-${turno.fim})</span></strong>
                <div class="toggle-group" data-cobertura-modo-toggle>
                    <button type="button" class="toggle-btn active" data-value="individual">Individuais</button>
                    <button type="button" class="toggle-btn" data-value="equipe">Equipe</button>
                </div>
            </div>

            <div class="cobertura-options" style="margin-top: 12px;">
                <div data-cobertura-modo="individual">
                    <div class="animated-field" style="max-width: 180px;">
                        <input type="number" data-cobertura-individual-count value="1" min="0" placeholder=" " />
                        <label>Nº de funcionários</label>
                    </div>
                </div>
                <div data-cobertura-modo="equipe" class="hidden">
                    <div class="cobertura-equipe-options-compact">
                        <div class="form-group">
                            <label>Dias Ímpares:</label>
                            <select data-cobertura-equipe-impar class="select-sm"></select>
                        </div>
                        <div class="form-group">
                            <label>Dias Pares:</label>
                            <select data-cobertura-equipe-par class="select-sm"></select>
                        </div>
                    </div>
                    <small class="muted" style="margin-top: 8px; display: block;">O dia 1 da escala é ímpar, o dia 2 é par, etc.</small>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    $$('[data-cobertura-modo-toggle]').forEach(toggle => {
        const coberturaItem = toggle.closest('.cobertura-item');
        const turnoId = coberturaItem.dataset.turnoId;
        const equipesCompativeis = equipes.filter(e => e.cargoId === cargoId && e.turnoId === turnoId);

        $$('.toggle-btn', toggle).forEach(btn => {
            btn.addEventListener('click', () => {
                const modo = btn.dataset.value;
                $$('.toggle-btn', toggle).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                coberturaItem.querySelector('[data-cobertura-modo="individual"]').classList.toggle('hidden', modo !== 'individual');
                coberturaItem.querySelector('[data-cobertura-modo="equipe"]').classList.toggle('hidden', modo !== 'equipe');

                if (modo === 'equipe') {
                    const selectImpar = $('[data-cobertura-equipe-impar]', coberturaItem);
                    const selectPar = $('[data-cobertura-equipe-par]', coberturaItem);
                    
                    const optionsHTML = '<option value="">Nenhuma</option>' + equipesCompativeis.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
                    selectImpar.innerHTML = optionsHTML;
                    selectPar.innerHTML = optionsHTML;
                }
            });
        });
    });
}


function addFeriado() {
    const dataInput = $('#feriado-data-input');
    const nomeInput = $('#feriado-nome-input');
    const trabalha = $('#feriado-trabalha-toggle .toggle-btn.active').dataset.value === 'sim';
    const descontaHoras = $('#feriado-descontar-toggle .toggle-btn.active').dataset.value === 'sim';
    const horasDescontoInput = $('#feriado-horas-desconto');
    let horasDesconto = 0;

    const date = dataInput.value;
    const nome = nomeInput.value.trim();

    if (!date || !nome) {
        showToast("Por favor, preencha a data e o nome do feriado.");
        return;
    }

    if (geradorState.inicio && geradorState.fim && (date < geradorState.inicio || date > geradorState.fim)) {
        showToast("A data do feriado deve estar dentro do período selecionado para a escala.");
        return;
    }

    if (descontaHoras) {
        horasDesconto = parseInt(horasDescontoInput.value, 10);
        if (isNaN(horasDesconto) || horasDesconto < 0) {
            showToast("Por favor, informe uma quantidade válida de horas para descontar.");
            horasDescontoInput.classList.add('invalid');
            return;
        }
    }
    horasDescontoInput.classList.remove('invalid');

    if (geradorState.feriados.some(f => f.date === date)) {
        showToast("Já existe um feriado nesta data.");
        return;
    }

    geradorState.feriados.push({ date, nome, trabalha, descontaHoras, horasDesconto });
    geradorState.feriados.sort((a, b) => a.date.localeCompare(b.date));
    renderFeriadosTags();
    dataInput.value = '';
    nomeInput.value = '';
    $('#feriado-descontar-toggle .toggle-btn[data-value="nao"]').click();
    $('#feriado-horas-desconto').value = '';
    saveGeradorState();
}

function removeFeriado(date) {
    geradorState.feriados = geradorState.feriados.filter(f => f.date !== date);
    renderFeriadosTags();
    saveGeradorState();
}

function renderFeriadosTags() {
    const container = $('#feriados-tags-container');
    container.innerHTML = geradorState.feriados.map(f => {
        const trabalhaText = f.trabalha ? '' : ' (Não trabalha)';
        const descontoText = f.descontaHoras ? ` (-${f.horasDesconto}h)` : '';
        return `<span class="tag">${new Date(f.date + 'T12:00:00').toLocaleDateString()} - ${f.nome}${trabalhaText}${descontoText}<button data-remove-feriado="${f.date}">x</button></span>`
    }).join('');
    $$('[data-remove-feriado]').forEach(btn => {
        btn.onclick = () => removeFeriado(btn.dataset.removeFeriado);
    });
}

function renderPasso3_Excecoes(cargoId) {
    const { funcionarios } = store.getState();
    const funcs = funcionarios.filter(f => f.cargoId === cargoId).sort((a, b) => a.nome.localeCompare(b.nome));
    const container = $("#excecoes-funcionarios-container");
    container.innerHTML = "";
    if (funcs.length === 0) {
        container.innerHTML = `<p class="muted">Nenhum funcionário encontrado para este cargo.</p>`;
        return;
    }

    funcs.forEach(func => {
        if (!geradorState.excecoes[func.id]) {
            geradorState.excecoes[func.id] = { ferias: { dates: [], motivo: '' }, afastamento: { dates: [], motivo: '' }, folgas: [] };
        }
        const div = document.createElement('div');
        div.className = 'excecao-func-card';
        const tipoFolgaOptions = TIPOS_FOLGA.map(t => `<option value="${t.nome}">${t.nome} (${t.sigla})</option>`).join('');

        div.innerHTML = `
            <div class="excecao-header"><strong>${func.nome}</strong></div>
            <div class="excecao-body">
                <div class="grid-2-col" style="margin: 0; align-items: start; gap: 8px;">
                    <fieldset class="fieldset-wrapper" style="margin: 0;">
                        <legend>Férias</legend>
                        <div class="form-row form-row-vcenter">
                             <div class="toggle-group" data-toggle-container="ferias" data-func-id="${func.id}">
                                <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                                <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                            </div>
                            <div class="form-row dates-container hidden" data-dates-container="ferias" data-func-id="${func.id}" style="flex-grow: 1; margin: 0; gap: 8px;">
                                <div>Início: <input type="date" title="Início das férias" data-date-ini="ferias" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm"></div>
                                <div>Fim: <input type="date" title="Fim das férias" data-date-fim="ferias" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm"></div>
                            </div>
                            <span class="dias-resumo" data-resumo-dias="ferias" data-func-id="${func.id}"></span>
                        </div>
                    </fieldset>

                    <fieldset class="fieldset-wrapper" style="margin: 0;">
                        <legend>Afastamento</legend>
                        <div class="form-row form-row-vcenter">
                            <div class="toggle-group" data-toggle-container="afastamento" data-func-id="${func.id}">
                                <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                                <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                            </div>
                            <div class="form-row dates-container hidden" data-dates-container="afastamento" data-func-id="${func.id}" style="flex-grow: 1; margin: 0; gap: 8px;">
                                <div>Início: <input type="date" title="Início do afastamento" data-date-ini="afastamento" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm"></div>
                                <div>Fim: <input type="date" title="Fim do afastamento" data-date-fim="afastamento" data-func-id="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}" class="input-sm"></div>
                                <div class="animated-field" style="flex-grow:1; min-width: 120px;">
                                    <input type="text" placeholder=" " data-motivo="afastamento" data-func-id="${func.id}">
                                    <label>Motivo</label>
                                </div>
                            </div>
                             <span class="dias-resumo" data-resumo-dias="afastamento" data-func-id="${func.id}"></span>
                        </div>
                    </fieldset>
                </div>
                
                <fieldset class="fieldset-wrapper">
                    <legend>Folgas Avulsas</legend>
                    <div class="form-row-aligned">
                        <div style="flex-basis: 180px;"><input type="date" data-folga-input="${func.id}" min="${geradorState.inicio}" max="${geradorState.fim}"></div>
                        <div style="flex-basis: 220px; flex-grow: 0;"><select data-folga-tipo="${func.id}">${tipoFolgaOptions}</select></div>
                        <button class="secondary" data-add-folga="${func.id}">Adicionar</button>
                    </div>
                    <div class="folgas-tags" data-folgas-tags="${func.id}"></div>
                </fieldset>
            </div>
        `;
        container.appendChild(div);

        $$(`[data-toggle-container][data-func-id="${func.id}"] .toggle-btn`).forEach(btn => {
            btn.onclick = (e) => handleExcecaoToggle(e, func.id);
        });

        $$(`[data-date-ini][data-func-id="${func.id}"], [data-date-fim][data-func-id="${func.id}"], [data-motivo][data-func-id="${func.id}"]`).forEach(input => {
            input.onchange = (e) => {
                updateDiasResumo(e, input.dataset.dateIni || input.dataset.dateFim || input.dataset.motivo, func.id);

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
            };
        });

        div.querySelector(`[data-add-folga="${func.id}"]`).onclick = () => addFolga(func.id);

        $$(`input[type="date"]`, div).forEach(dateInput => {
            dateInput.onclick = () => dateInput.showPicker();
        });
    });
}

function handleExcecaoToggle(event, funcId) {
    const container = event.target.closest('[data-toggle-container]');
    const tipo = container.dataset.toggleContainer;
    const value = event.target.dataset.value;

    container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    $(`[data-dates-container="${tipo}"][data-func-id="${funcId}"]`).classList.toggle('hidden', value === 'nao');
    if (value === 'nao') {
        const iniInput = $(`[data-date-ini="${tipo}"][data-func-id="${func.id}"]`);
        const fimInput = $(`[data-date-fim="${tipo}"][data-func-id="${func.id}"]`);
        iniInput.value = '';
        fimInput.value = '';
        if ($(`[data-motivo="${tipo}"][data-func-id="${func.id}"]`)) {
            $(`[data-motivo="${tipo}"][data-func-id="${func.id}"]`).value = '';
        }
        iniInput.dispatchEvent(new Event('change'));
    }
}

function handleGoToPasso2() {
    const escIniInput = $("#escIni");
    const escFimInput = $("#escFim");
    const cargoId = $("#escCargo").value;
    const inicio = escIniInput.value;
    const fim = escFimInput.value;

    $("#escCargo").classList.toggle('invalid', !cargoId);
    escIniInput.classList.toggle('invalid', !inicio);
    escFimInput.classList.toggle('invalid', !fim);

    if (!cargoId || !inicio || !fim) {
        return showToast("Por favor, selecione o cargo e o período completo.");
    }
    if (fim < inicio) {
        return showToast("A data de fim não pode ser anterior à data de início.");
    }

    geradorState.cargoId = cargoId;
    geradorState.inicio = inicio;
    geradorState.fim = fim;

    $('#feriado-data-input').min = inicio;
    $('#feriado-data-input').max = fim;

    renderPasso2_Cobertura(cargoId);
    navigateWizardWithAnimation('#gerador-container', 'passo2-cobertura', 'forward');
    saveGeradorState();
}

function handleGoToPasso3() {
    geradorState.cobertura = {};
    $$('#cobertura-turnos-container .cobertura-item').forEach(item => {
        const turnoId = item.dataset.turnoId;
        const modoAtivo = $('.toggle-btn.active', item).dataset.value;

        if (modoAtivo === 'individual') {
            geradorState.cobertura[turnoId] = {
                mode: 'individual',
                count: parseInt($('[data-cobertura-individual-count]', item).value, 10) || 0,
            };
        } else {
            geradorState.cobertura[turnoId] = {
                mode: 'equipe',
                imparId: $('[data-cobertura-equipe-impar]', item).value || null,
                parId: $('[data-cobertura-equipe-par]', item).value || null,
            };
        }
    });

    geradorState.maxDiasConsecutivos = parseInt($('#maxDiasConsecutivos').value, 10) || 6;
    geradorState.minFolgasSabados = parseInt($('#minFolgasSabados').value, 10) || 1;
    geradorState.minFolgasDomingos = parseInt($('#minFolgasDomingos').value, 10) || 1;
    renderPasso3_Excecoes(geradorState.cargoId);
    navigateWizardWithAnimation('#gerador-container', 'passo3-excecoes', 'forward');
    saveGeradorState();
}

function checkDateOverlap(funcId, datesToCheck, tipoExcecaoAtual) {
    const excecoesFunc = geradorState.excecoes[funcId];
    const allExistingDates = new Set();

    const addExcecaoToSet = (excecao) => {
        if (excecao.dates.length > 0) {
            excecao.dates.forEach(d => allExistingDates.add(d));
        }
    };

    if (tipoExcecaoAtual !== 'ferias') addExcecaoToSet(excecoesFunc.ferias);
    if (tipoExcecaoAtual !== 'afastamento') addExcecaoToSet(excecoesFunc.afastamento);
    if (tipoExcecaoAtual !== 'folgas') {
        excecoesFunc.folgas.forEach(f => allExistingDates.add(f.date));
    }

    for (const date of datesToCheck) {
        if (allExistingDates.has(date)) {
            return true;
        }
    }
    return false;
}

function updateDiasResumo(event, tipo, funcId) {
    const inicioInput = $(`[data-date-ini="${tipo}"][data-func-id="${funcId}"]`);
    const fimInput = $(`[data-date-fim="${tipo}"][data-func-id="${funcId}"]`);
    const motivoInput = $(`[data-motivo="${tipo}"][data-func-id="${funcId}"]`);
    const resumoEl = $(`[data-resumo-dias="${tipo}"][data-func-id="${funcId}"]`);

    const inicio = inicioInput.value;
    const fim = fimInput.value;

    if (inicio && fim && fim >= inicio) {
        const newDates = dateRangeInclusive(inicio, fim);
        
        if (checkDateOverlap(funcId, newDates, tipo)) {
            showToast("Erro: O período selecionado conflita com outra folga, férias ou afastamento.");
            event.target.value = '';
            const otherInput = event.target === inicioInput ? fimInput : inicioInput;
            if (otherInput.value === '') {
                resumoEl.textContent = '';
                geradorState.excecoes[funcId][tipo].dates = [];
            }
            saveGeradorState();
            return;
        }
        const diasEfetivos = newDates.length;
        resumoEl.textContent = `Total: ${diasEfetivos} dia(s)`;
        geradorState.excecoes[funcId][tipo].dates = newDates;
        if (motivoInput) geradorState.excecoes[funcId][tipo].motivo = motivoInput.value;
    } else {
        resumoEl.textContent = '';
        geradorState.excecoes[funcId][tipo].dates = [];
        if (motivoInput) geradorState.excecoes[funcId][tipo].motivo = '';
    }
    saveGeradorState();
}

function addFolga(funcId) {
    const input = $(`[data-folga-input="${funcId}"]`);
    const tipoSelect = $(`[data-folga-tipo="${funcId}"]`);
    const date = input.value;
    const tipo = tipoSelect.value;

    if (!date) {
        showToast("Selecione uma data para a folga.");
        return;
    }

    if (checkDateOverlap(funcId, [date], 'folgas')) {
        showToast("Erro: Esta data conflita com outra folga, férias ou afastamento.");
        input.value = '';
        return;
    }

    if (!geradorState.excecoes[funcId].folgas.some(f => f.date === date)) {
        geradorState.excecoes[funcId].folgas.push({ date, tipo });
        renderFolgas(funcId);
        input.value = '';
    }
    saveGeradorState();
}

function removeFolga(funcId, date) {
    geradorState.excecoes[funcId].folgas = geradorState.excecoes[funcId].folgas.filter(f => f.date !== date);
    renderFolgas(funcId);
    saveGeradorState();
}

function renderFolgas(funcId) {
    const container = $(`[data-folgas-tags="${funcId}"]`);
    container.innerHTML = geradorState.excecoes[funcId].folgas
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(f => {
            const sigla = TIPOS_FOLGA.find(tf => tf.nome === f.tipo)?.sigla || 'F';
            return `<span class="tag" data-tipo-folga="${f.tipo}">${new Date(f.date + 'T12:00:00').toLocaleDateString()} (${sigla})<button data-remove-folga="${funcId}" data-date="${f.date}">x</button></span>`
        }).join('');

    $$(`[data-remove-folga="${funcId}"]`).forEach(btn => {
        btn.onclick = () => removeFolga(funcId, btn.dataset.date);
    });
}