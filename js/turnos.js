/**************************************
 * 🕒 Turnos
 **************************************/

let editingTurnoId = null;
let lastAddedTurnoId = null;

const turnoNomeInput = $("#turnoNome");
const turnoSiglaInput = $("#turnoSigla");
const turnoInicioInput = $("#turnoInicio");
const turnoFimInput = $("#turnoFim");
const turnoFimDiaSelect = $("#turnoFimDia");
const turnoAlmocoInput = $("#turnoAlmoco");
const turnoCorHiddenInput = $("#turnoCorHidden");
const turnoCargaSpan = $("#turnoCarga");
const turnoViraDiaIndicator = $("#turnoViraDia");
const turnoDeLongaDuracaoIndicator = $("#turnoDeLongaDuracao");
const descansoToggleGroup = $("#descansoToggleGroup");
const descansoToggleButtons = $$('.toggle-btn', descansoToggleGroup);
const descansoHorasInput = $("#turnoDescansoHoras");
const descansoHorasGroup = $("#descansoHorasGroup");
const descansoHiddenInput = $("#descansoObrigatorioHidden");
const btnSalvarTurno = $("#btnSalvarTurno");
const btnCancelarTurno = $("#btnCancelarTurno");
const filtroTurnosInput = $("#filtroTurnos");
const tblTurnosBody = $("#tblTurnos tbody");

const PALETA_CORES = [
    '#e2e8f0', '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bfdbfe', '#a5b4fc', '#f5d0fe',
    '#cbd5e1', '#fca5a5', '#fbbf24', '#facc15', '#a3e635', '#93c5fd', '#818cf8', '#e879f9',
    '#94a3b8', '#f87171', '#f97316', '#eab308', '#84cc16', '#60a5fa', '#6366f1', '#d946ef'
];

function setTurnoFormDirty(isDirty) { dirtyForms.turnos = isDirty; }

// ALTERADO: Adiciona validação visual para o campo de horário final
function checkHorarioLogico() {
    const inicio = turnoInicioInput.value;
    const fim = turnoFimInput.value;
    const diasDeDiferenca = Number(turnoFimDiaSelect.value);
    if (inicio && fim && diasDeDiferenca === 0 && parseTimeToMinutes(fim) <= parseTimeToMinutes(inicio)) {
        showToast("Atenção: O horário final deve ser maior que o inicial no mesmo dia.");
        validateInput(turnoFimInput, false); // Adiciona a borda vermelha
        return false;
    }
    validateInput(turnoFimInput, true); // Garante que o campo volte ao normal se estiver correto
    return true;
}


[turnoNomeInput, turnoSiglaInput, turnoAlmocoInput, descansoHorasInput].forEach(input => {
    input.addEventListener("input", (e) => {
        if (e.target === turnoNomeInput && e.target.value.length > 0) e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
        if (e.target === turnoSiglaInput) e.target.value = e.target.value.toUpperCase();
        updateTurnoCargaPreview();
        validateInput(e.target);
        setTurnoFormDirty(true);
    });
});

[turnoInicioInput, turnoFimInput, turnoFimDiaSelect].forEach(input => {
    input.addEventListener("change", () => {
        const inicio = turnoInicioInput.value;
        const fim = turnoFimInput.value;
        if (input !== turnoFimDiaSelect && inicio && fim && parseTimeToMinutes(fim) < parseTimeToMinutes(inicio) && turnoFimDiaSelect.value === '0') {
            turnoFimDiaSelect.value = '1';
            showToast("Turno noturno detectado. Dia de término ajustado.");
        }
        checkHorarioLogico();
        updateTurnoCargaPreview();
        validateInput(input);
        setTurnoFormDirty(true);
    });
});

descansoToggleButtons.forEach(button => {
    button.addEventListener('click', () => {
        descansoToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const valor = button.dataset.value;
        descansoHiddenInput.value = valor;
        if (valor === 'sim') {
            descansoHorasGroup.classList.remove('hidden-height');
            descansoHorasInput.disabled = false;
        } else {
            descansoHorasGroup.classList.add('hidden-height');
            descansoHorasInput.disabled = true;
            descansoHorasInput.value = '';
            validateInput(descansoHorasInput, true);
        }
        setTurnoFormDirty(true);
    });
});

// ALTERADO: Adiciona o seletor de cor personalizada
function renderCorPalette() {
    const container = $("#turnoCorPalette");
    container.innerHTML = '';
    PALETA_CORES.forEach(cor => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = cor;
        swatch.dataset.cor = cor;
        swatch.onclick = () => { selectCor(cor); setTurnoFormDirty(true); };
        container.appendChild(swatch);
    });

    // Cria o gatilho para o seletor de cor
    const pickerTrigger = document.createElement('div');
    pickerTrigger.className = 'color-swatch color-picker-trigger';
    pickerTrigger.title = 'Escolher cor personalizada';
    pickerTrigger.innerHTML = `
        <span>🎨</span>
        <input type="color" id="turnoCorPicker" value="#ffffff">
    `;
    container.appendChild(pickerTrigger);

    const colorInput = $("#turnoCorPicker");
    colorInput.addEventListener('input', (e) => {
        selectCor(e.target.value);
        setTurnoFormDirty(true);
    });
}

// ALTERADO: Gerencia a seleção de cores personalizadas e da paleta
function selectCor(cor) {
    turnoCorHiddenInput.value = cor;

    // Remove a seleção de todas as amostras da paleta
    $$('#turnoCorPalette .color-swatch').forEach(sw => sw.classList.remove('selected'));

    const pickerTrigger = $('.color-picker-trigger');
    const isCustomColor = !PALETA_CORES.includes(cor);

    if (isCustomColor) {
        pickerTrigger.classList.add('selected');
        pickerTrigger.style.backgroundColor = cor;
    } else {
        const swatch = $(`#turnoCorPalette .color-swatch[data-cor="${cor}"]`);
        if (swatch) swatch.classList.add('selected');
        pickerTrigger.style.backgroundColor = ''; // Reseta a cor de fundo do gatilho
    }
}


function updateTurnoCargaPreview() {
    const i = turnoInicioInput.value;
    const f = turnoFimInput.value;
    const a = Math.max(0, Number(turnoAlmocoInput.value || 0));
    const diasDeDiferenca = Number(turnoFimDiaSelect.value);

    turnoViraDiaIndicator.classList.add('hidden');
    turnoDeLongaDuracaoIndicator.classList.add('hidden');
    turnoCargaSpan.classList.remove("highlight");
    turnoCargaSpan.textContent = "Carga: 00:00";

    if (i && f) {
        const cargaTotalMin = calcCarga(i, f, a, diasDeDiferenca);
        turnoCargaSpan.textContent = `Carga: ${minutesToHHMM(cargaTotalMin)}`;
        turnoCargaSpan.classList.add("highlight");
        if (cargaTotalMin >= 1440) {
            turnoDeLongaDuracaoIndicator.classList.remove('hidden');
        } else if (diasDeDiferenca > 0 || parseTimeToMinutes(f) < parseTimeToMinutes(i)) {
            turnoViraDiaIndicator.classList.remove('hidden');
        }
    }
}

function renderTurnos() {
    const { turnos } = store.getState();
    const filtro = filtroTurnosInput.value.toLowerCase();
    tblTurnosBody.innerHTML = "";
    
    // Filtra os turnos de sistema para que não apareçam na tabela de edição
    const turnosEditaveis = turnos.filter(t => !t.isSystem);

    const turnosFiltrados = turnosEditaveis.filter(t => t.nome.toLowerCase().includes(filtro) || (t.sigla && t.sigla.toLowerCase().includes(filtro)));
    const turnosOrdenados = [...turnosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));
    if (turnosOrdenados.length === 0) {
        const isEmpty = filtro === '' && turnosEditaveis.length === 0;
        const emptyStateText = isEmpty 
            ? `<div class="empty-state"><div class="empty-state-icon">🕒</div>
               <h3>Nenhum Turno Cadastrado</h3>
               <p>Crie os turnos de trabalho da sua operação para começar.</p>
               </div>`
            : `<p class="muted center">Nenhum turno encontrado com o termo "${filtro}".</p>`;
        tblTurnosBody.innerHTML = `<tr><td colspan="9">${emptyStateText}</td></tr>`;
        return;
    }
    turnosOrdenados.forEach(t => {
        const tr = document.createElement("tr");
        tr.dataset.turnoId = t.id;
        const descansoTxt = t.descansoObrigatorioHoras ? `${t.descansoObrigatorioHoras}h` : 'Não';
        let indicadorVisual = '';
        if (t.cargaMin >= 1440) indicadorVisual = ' 🔁';
        else if (t.diasDeDiferenca > 0) indicadorVisual = ' 🌙';
        tr.innerHTML = `
            <td><span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span></td>
            <td>${t.nome}</td>
            <td><strong>${t.sigla || '--'}</strong></td>
            <td>${t.inicio}</td><td>${t.fim}${indicadorVisual}</td>
            <td>${t.almocoMin} min</td><td>${minutesToHHMM(t.cargaMin)}</td>
            <td>${descansoTxt}</td>
            <td>
                <button class="secondary" data-action="edit" data-id="${t.id}" aria-label="Editar o turno ${t.nome}">✏️ Editar</button>
                <button class="danger" data-action="delete" data-id="${t.id}" aria-label="Excluir o turno ${t.nome}">🔥 Excluir</button>
            </td>`;
        tblTurnosBody.appendChild(tr);
    });
    if (lastAddedTurnoId) {
        tblTurnosBody.querySelector(`tr[data-turno-id="${lastAddedTurnoId}"]`)?.classList.add('new-item');
        lastAddedTurnoId = null;
    }
}

function validateTurnoForm() {
    let isValid = true;
    if (!validateInput(turnoNomeInput)) isValid = false;
    if (!validateInput(turnoSiglaInput)) isValid = false;
    if (!validateInput(turnoInicioInput)) isValid = false;
    if (!validateInput(turnoFimInput)) isValid = false;
    if (descansoHiddenInput.value === 'sim' && !validateInput(descansoHorasInput)) isValid = false;
    return isValid;
}

async function saveTurnoFromForm() {
    if (!validateTurnoForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        focusFirstInvalidInput('#page-turnos .card');
        return;
    }
    if (!checkHorarioLogico()) return;

    const almocoMin = Number(turnoAlmocoInput.value || 0);
    if (almocoMin < 0) {
        showToast("O tempo de almoço não pode ser negativo.");
        validateInput(turnoAlmocoInput, false);
        return;
    }
    
    const inicio = turnoInicioInput.value;
    const fim = turnoFimInput.value;
    const diasDeDiferenca = Number(turnoFimDiaSelect.value);
    const cargaMin = calcCarga(inicio, fim, almocoMin, diasDeDiferenca);

    if (parseTimeToMinutes(fim) + (diasDeDiferenca * 1440) - parseTimeToMinutes(inicio) < almocoMin) {
        showToast("O tempo de almoço não pode ser maior que a duração do turno.");
        validateInput(turnoAlmocoInput, false);
        return;
    }

    const { turnos } = store.getState();
    const nome = turnoNomeInput.value.trim();
    const sigla = turnoSiglaInput.value.trim().toUpperCase();
    if (turnos.some(t => t.nome.toLowerCase() === nome.toLowerCase() && t.id !== editingTurnoId)) return showToast("Já existe um turno com este nome.");
    if (sigla && turnos.some(t => t.sigla && t.sigla.toLowerCase() === sigla.toLowerCase() && t.id !== editingTurnoId)) return showToast("Já existe um turno com essa sigla.");

    const descansoObrigatorio = descansoHiddenInput.value === 'sim';
    const dadosTurno = {
        id: editingTurnoId || uid(), nome, sigla, cor: turnoCorHiddenInput.value,
        inicio, fim, diasDeDiferenca, almocoMin,
        descansoObrigatorioHoras: descansoObrigatorio ? Number(descansoHorasInput.value || 0) : null,
        cargaMin: cargaMin
    };

    if (!editingTurnoId) {
        lastAddedTurnoId = dadosTurno.id;
    }
    
    store.dispatch('SAVE_TURNO', dadosTurno);
    
    cancelEditTurno();
    
    showToast("Turno salvo com sucesso!");
}

function editTurnoInForm(id) {
    const { turnos } = store.getState();
    const turno = turnos.find(t => t.id === id);
    if (!turno || turno.isSystem) return; // Impede a edição de turnos de sistema
    editingTurnoId = id;
    turnoNomeInput.value = turno.nome;
    turnoSiglaInput.value = turno.sigla || '';
    selectCor(turno.cor || PALETA_CORES[0]);
    turnoInicioInput.value = turno.inicio;
    turnoFimInput.value = turno.fim;
    turnoFimDiaSelect.value = turno.diasDeDiferenca || 0;
    turnoAlmocoInput.value = turno.almocoMin || "";
    if (turno.descansoObrigatorioHoras) {
        $(`.toggle-btn[data-value="sim"]`, descansoToggleGroup).click();
        descansoHorasInput.value = turno.descansoObrigatorioHoras;
    } else {
        $(`.toggle-btn[data-value="nao"]`, descansoToggleGroup).click();
    }
    updateTurnoCargaPreview();
    btnSalvarTurno.textContent = "💾 Salvar Alterações";
    setTurnoFormDirty(false);
    window.scrollTo(0, 0);
}

function cancelEditTurno() {
    editingTurnoId = null;
    turnoNomeInput.value = "";
    turnoSiglaInput.value = "";
    turnoInicioInput.value = "";
    turnoFimInput.value = "";
    turnoFimDiaSelect.value = 0;
    turnoAlmocoInput.value = "";

    const { turnos } = store.getState();
    const colorCounts = PALETA_CORES.reduce((acc, color) => ({ ...acc, [color]: 0 }), {});
    turnos.forEach(t => {
        if (colorCounts.hasOwnProperty(t.cor)) {
            colorCounts[t.cor]++;
        }
    });
    const leastUsedColor = Object.entries(colorCounts).sort((a, b) => a[1] - b[1])[0][0];
    selectCor(leastUsedColor || PALETA_CORES[0]);
    
    $$('.invalid', turnoNomeInput.closest('.card')).forEach(el => el.classList.remove('invalid'));
    $(`.toggle-btn[data-value="nao"]`, descansoToggleGroup).click();
    updateTurnoCargaPreview();
    btnSalvarTurno.textContent = "💾 Salvar Turno";
    setTurnoFormDirty(false);
    turnoNomeInput.focus();
}

function deleteTurno(id) {
    handleDeleteItem({ id, itemName: 'Turno', dispatchAction: 'DELETE_TURNO' });
}

function handleTurnosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'edit') editTurnoInForm(id);
    else if (action === 'delete') deleteTurno(id);
}

function initTurnosPage() {
    btnSalvarTurno.addEventListener('click', saveTurnoFromForm);
    btnCancelarTurno.addEventListener('click', cancelEditTurno);
    tblTurnosBody.addEventListener('click', handleTurnosTableClick);
    renderCorPalette();
    selectCor(PALETA_CORES[0]);
    $(`.toggle-btn[data-value="nao"]`, descansoToggleGroup).click();
    setTurnoFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initTurnosPage);