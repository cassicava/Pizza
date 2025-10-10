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
    
    $$('.toggle-btn', trabalhaToggleEl).forEach(button => {
        button.addEventListener('click', () => {
             $$('.toggle-btn', trabalhaToggleEl).forEach(btn => btn.classList.remove('active'));
             button.classList.add('active');
             if (onUpdate) onUpdate();
        });
    });

    $$('.toggle-btn', descontaToggleEl).forEach(button => {
        button.addEventListener('click', () => {
             $$('.toggle-btn', descontaToggleEl).forEach(btn => btn.classList.remove('active'));
             button.classList.add('active');
             horasContainerEl.style.display = button.dataset.value === 'sim' ? 'flex' : 'none';
             if (onUpdate) onUpdate();
        });
    });

    addButtonEl.addEventListener('click', add);
    render(); 
}

// O componente de exceções foi removido pois a lógica foi refatorada
// e integrada diretamente em `gerador-escala-auto.js` para
// acomodar o novo fluxo de trabalho centrado na data.