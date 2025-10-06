/**************************************
 * 🧙‍♂️ Helpers Reutilizáveis para Wizards
 **************************************/

/**
 * Cria e gerencia o componente de adição de feriados.
 * @param {object} options
 * @param {object} options.stateObject - O objeto de estado (geradorState ou montadorState) a ser modificado.
 * @param {string} options.containerSelector - Seletor do container onde as tags dos feriados serão renderizadas.
 * @param {string} options.dataInputSelector - Seletor do input de data do feriado.
 * @param {string} options.nomeInputSelector - Seletor do input de nome do feriado.
 * @param {string} options.trabalhaToggleSelector - Seletor do toggle 'trabalha sim/não'.
 * @param {string} options.descontaToggleSelector - Seletor do toggle 'desconta horas sim/não'.
 * @param {string} options.horasInputSelector - Seletor do input de horas a descontar.
 * @param {string} options.horasContainerSelector - Seletor do container do input de horas.
 * @param {string} options.addButtonSelector - Seletor do botão de adicionar feriado.
 * @param {function} [options.onUpdate] - Callback opcional a ser chamado quando os feriados mudam.
 */
function createFeriadosComponent(options) {
    const { stateObject, containerSelector, dataInputSelector, nomeInputSelector, trabalhaToggleSelector, descontaToggleSelector, horasInputSelector, horasContainerSelector, addButtonSelector, onUpdate } = options;

    // LINHA CORRIGIDA: Garante que a propriedade 'feriados' sempre exista no objeto de estado.
    if (!stateObject.feriados) { stateObject.feriados = []; }

    const containerEl = $(containerSelector);
    const dataInputEl = $(dataInputSelector);
    const nomeInputEl = $(nomeInputSelector);
    const trabalhaToggleEl = $(trabalhaToggleSelector);
    const descontaToggleEl = $(descontaToggleSelector);
    const horasInputEl = $(horasInputSelector);
    const horasContainerEl = $(horasContainerSelector);
    const addButtonEl = $(addButtonSelector);

    function render() {
        containerEl.innerHTML = stateObject.feriados.map(f => {
            const trabalhaText = f.trabalha ? '' : ' (Folga)';
            const descontoText = f.descontaHoras ? ` (-${f.horasDesconto}h)` : '';
            return `<span class="tag">${new Date(f.date+'T12:00:00').toLocaleDateString()} - ${f.nome}${trabalhaText}${descontoText}<button data-remove-date="${f.date}">x</button></span>`;
        }).join('');

        $$('button[data-remove-date]', containerEl).forEach(btn => {
            btn.onclick = () => remove(btn.dataset.removeDate);
        });
    }

    function add() {
        const date = dataInputEl.value;
        const nome = nomeInputEl.value.trim();
        const trabalha = $('.toggle-btn.active', trabalhaToggleEl).dataset.value === 'sim';
        const descontaHoras = $('.toggle-btn.active', descontaToggleEl).dataset.value === 'sim';
        let horasDesconto = 0;

        if (!date || !nome) return showToast("Por favor, preencha a data e o nome do feriado.");
        if (stateObject.feriados.some(f => f.date === date)) return showToast("Já existe um feriado nesta data.");

        if (descontaHoras) {
            horasDesconto = parseInt(horasInputEl.value, 10);
            if (isNaN(horasDesconto) || horasDesconto < 0) {
                horasInputEl.classList.add('invalid');
                return showToast("Por favor, informe uma quantidade válida de horas para descontar.");
            }
        }
        horasInputEl.classList.remove('invalid');

        stateObject.feriados.push({ date, nome, trabalha, descontaHoras, horasDesconto });
        stateObject.feriados.sort((a, b) => a.date.localeCompare(b.date));
        
        render();
        dataInputEl.value = '';
        nomeInputEl.value = '';
        if (onUpdate) onUpdate();
    }

    function remove(date) {
        stateObject.feriados = stateObject.feriados.filter(f => f.date !== date);
        render();
        if (onUpdate) onUpdate();
    }
    
    // Adiciona o event listener para o toggle de "Haverá Trabalho?"
    $$('.toggle-btn', trabalhaToggleEl).forEach(button => {
        button.addEventListener('click', () => {
             $$('.toggle-btn', trabalhaToggleEl).forEach(btn => btn.classList.remove('active'));
             button.classList.add('active');
             if (onUpdate) onUpdate();
        });
    });

    // Configuração para o toggle de "Descontar Horas?"
    $$('.toggle-btn', descontaToggleEl).forEach(button => {
        button.addEventListener('click', () => {
             $$('.toggle-btn', descontaToggleEl).forEach(btn => btn.classList.remove('active'));
             button.classList.add('active');
             horasContainerEl.style.display = button.dataset.value === 'sim' ? 'flex' : 'none';
             if (onUpdate) onUpdate();
        });
    });

    addButtonEl.addEventListener('click', add);
    render(); // Renderiza o estado inicial
}


/**
 * Cria e gerencia o componente de exceções de funcionários.
 * @param {object} options
 * @param {object} options.stateObject - O objeto de estado (geradorState ou montadorState) a ser modificado.
 * @param {string} options.containerSelector - Seletor do container principal.
 * @param {string} options.cargoId - O ID do cargo para filtrar os funcionários.
 * @param {function} [options.onUpdate] - Callback opcional a ser chamado quando as exceções mudam.
 */
function createExcecoesComponent(options) {
    const { stateObject, containerSelector, cargoId, onUpdate } = options;
    const { funcionarios } = store.getState();
    const containerEl = $(containerSelector);

    function render() {
        const funcs = funcionarios.filter(f => f.cargoId === cargoId && f.status !== 'arquivado').sort((a, b) => a.nome.localeCompare(b.nome));
        containerEl.innerHTML = "";

        if (funcs.length === 0) {
            containerEl.innerHTML = `<p class="muted">Nenhum funcionário ativo encontrado para este cargo.</p>`;
            return;
        }

        funcs.forEach(func => {
            if (!stateObject.excecoes[func.id]) {
                stateObject.excecoes[func.id] = { ferias: { dates: [] }, afastamento: { dates: [], motivo: '' }, folgas: [] };
            }
            
            const div = document.createElement('div');
            div.className = 'excecao-func-card';
            const tipoFolgaOptions = TIPOS_FOLGA.map(t => `<option value="${t.nome}">${t.nome} (${t.sigla})</option>`).join('');
            const tipoAfastamentoOptions = TIPOS_AFASTAMENTO.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('');

            div.innerHTML = `
                <div class="excecao-header"><strong>${func.nome}</strong></div>
                <div class="excecao-body">
                    <div class="grid-2-col" style="margin-bottom: 0;">
                        <fieldset class="fieldset-wrapper">
                            <legend>Férias</legend>
                            <div class="form-row form-row-vcenter">
                                <div class="toggle-group" data-toggle-container="ferias">
                                    <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                                    <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                                </div>
                                <div class="form-row dates-container hidden" data-dates-container="ferias" style="flex-grow: 1; margin: 0; gap: 8px;">
                                    <div><input type="date" title="Início Férias" data-date-ini="ferias" min="${stateObject.inicio}" max="${stateObject.fim}" class="input-sm"></div>
                                    <div><input type="date" title="Fim Férias" data-date-fim="ferias" min="${stateObject.inicio}" max="${stateObject.fim}" class="input-sm"></div>
                                </div>
                            </div>
                        </fieldset>

                        <fieldset class="fieldset-wrapper">
                            <legend>Afastamento</legend>
                             <div class="form-row form-row-vcenter">
                                <div class="toggle-group" data-toggle-container="afastamento">
                                    <button type="button" class="toggle-btn active" data-value="nao">Não</button>
                                    <button type="button" class="toggle-btn" data-value="sim">Sim</button>
                                </div>
                                <div class="form-row dates-container hidden" data-dates-container="afastamento" style="flex-grow: 1; margin: 0; gap: 8px; flex-wrap: nowrap; align-items: center;">
                                    <div><input type="date" title="Início Afastamento" data-date-ini="afastamento" min="${stateObject.inicio}" max="${stateObject.fim}" class="input-sm"></div>
                                    <div><input type="date" title="Fim Afastamento" data-date-fim="afastamento" min="${stateObject.inicio}" max="${stateObject.fim}" class="input-sm"></div>
                                    <div style="flex-grow:1;"><select data-afastamento-motivo style="width: 100%;">${tipoAfastamentoOptions}</select></div>
                                </div>
                            </div>
                        </fieldset>
                    </div>

                    <fieldset class="fieldset-wrapper" style="margin-top: 12px;">
                        <legend>Folgas Avulsas</legend>
                        <div class="form-row-aligned">
                            <div style="flex-basis: 180px;"><input type="date" data-folga-input min="${stateObject.inicio}" max="${stateObject.fim}" class="input-sm"></div>
                            <div style="flex-basis: 220px; flex-grow: 0;"><select data-folga-tipo>${tipoFolgaOptions}</select></div>
                            <button class="secondary" data-add-folga>Adicionar</button>
                        </div>
                        <div class="folgas-tags" data-folgas-tags></div>
                    </fieldset>
                </div>
            `;
            containerEl.appendChild(div);

            // Adiciona event listeners específicos para este card de funcionário
            addCardEventListeners(div, func.id);
            renderFolgas(div, func.id);
        });
    }

    function addCardEventListeners(cardEl, funcId) {
        // Event listeners para os toggles de Férias/Afastamento
        $$('[data-toggle-container]', cardEl).forEach(container => {
            $$('.toggle-btn', container).forEach(btn => {
                btn.onclick = (e) => handleExcecaoToggle(e, funcId);
            });
        });

        // Event listeners para os inputs de data
        $$('[data-date-ini], [data-date-fim]', cardEl).forEach(input => {
            input.onchange = (e) => updateExcecaoDates(e, funcId);
        });
        
        // Event listener para o select de motivo do afastamento
        const afastamentoMotivoSelect = $('[data-afastamento-motivo]', cardEl);
        if (afastamentoMotivoSelect) {
            afastamentoMotivoSelect.onchange = () => {
                stateObject.excecoes[funcId].afastamento.motivo = afastamentoMotivoSelect.value;
                if (onUpdate) onUpdate();
            };
        }
        
        // Event listener para adicionar folga
        $('[data-add-folga]', cardEl).onclick = () => addFolga(cardEl, funcId);
    }

    function handleExcecaoToggle(event, funcId) {
        const container = event.target.closest('[data-toggle-container]');
        const tipo = container.dataset.toggleContainer;
        const value = event.target.dataset.value;

        container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');

        // Mostra/esconde todos os containers de data associados
        $$(`[data-dates-container="${tipo}"]`, container.closest('.excecao-body')).forEach(el => {
            el.classList.toggle('hidden', value === 'nao');
        });

        if (value === 'nao') {
            const iniInput = $(`[data-date-ini="${tipo}"]`, container.closest('.excecao-body'));
            if(iniInput) {
                iniInput.value = '';
                // Dispara a atualização para limpar as datas no estado
                iniInput.dispatchEvent(new Event('change')); 
            }
        } else if (tipo === 'afastamento' && !stateObject.excecoes[funcId].afastamento.motivo) {
            // Define um motivo padrão ao ativar
            const motivoSelect = $('[data-afastamento-motivo]', container.closest('.excecao-body'));
            stateObject.excecoes[funcId].afastamento.motivo = motivoSelect.value;
        }
        if (onUpdate) onUpdate();
    }

    function updateExcecaoDates(event, funcId) {
        const inputEl = event.target;
        const container = inputEl.closest('[data-dates-container]');
        const tipo = container.dataset.datesContainer;
        
        const inicio = $(`[data-date-ini="${tipo}"]`, container.closest('.excecao-body')).value;
        const fim = $(`[data-date-fim="${tipo}"]`, container.closest('.excecao-body')).value;

        if (inicio && fim && fim >= inicio) {
            stateObject.excecoes[funcId][tipo].dates = dateRangeInclusive(inicio, fim);
        } else {
            stateObject.excecoes[funcId][tipo].dates = [];
        }
        if (onUpdate) onUpdate();
    }

    function addFolga(cardEl, funcId) {
        const input = $('[data-folga-input]', cardEl);
        const tipoSelect = $('[data-folga-tipo]', cardEl);
        const date = input.value;
        const tipo = tipoSelect.value;

        if (!date) return;
        if (!stateObject.excecoes[funcId].folgas.some(f => f.date === date)) {
            stateObject.excecoes[funcId].folgas.push({ date, tipo });
            renderFolgas(cardEl, funcId);
            input.value = '';
        }
        if (onUpdate) onUpdate();
    }

    function removeFolga(cardEl, funcId, date) {
        stateObject.excecoes[funcId].folgas = stateObject.excecoes[funcId].folgas.filter(f => f.date !== date);
        renderFolgas(cardEl, funcId);
        if (onUpdate) onUpdate();
    }

    function renderFolgas(cardEl, funcId) {
        const container = $('[data-folgas-tags]', cardEl);
        container.innerHTML = stateObject.excecoes[funcId].folgas
            .sort((a,b) => a.date.localeCompare(b.date))
            .map(f => {
                const sigla = TIPOS_FOLGA.find(tf => tf.nome === f.tipo)?.sigla || 'F';
                return `<span class="tag" data-tipo-folga="${f.tipo}">${new Date(f.date+'T12:00:00').toLocaleDateString()} (${sigla})<button data-remove-folga-date="${f.date}">x</button></span>`
            }).join('');

        $$('[data-remove-folga-date]', container).forEach(btn => {
            btn.onclick = () => removeFolga(cardEl, funcId, btn.dataset.removeFolgaDate);
        });
    }

    render();
}