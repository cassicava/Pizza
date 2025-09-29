/**************************************
 * 🕒 Turnos
 **************************************/

let editingTurnoId = null;
let lastAddedTurnoId = null;

// --- Cache de Elementos DOM ---
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
const btnCancelarEdTurno = $("#btnCancelarEdTurno");
const filtroTurnosInput = $("#filtroTurnos");
const tblTurnosBody = $("#tblTurnos tbody");

const PALETA_CORES = [
    '#e2e8f0', '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bfdbfe', '#a5b4fc', '#f5d0fe',
    '#cbd5e1', '#fca5a5', '#fbbf24', '#facc15', '#a3e635', '#93c5fd', '#818cf8', '#e879f9',
    '#94a3b8', '#f87171', '#f97316', '#eab308', '#84cc16', '#60a5fa', '#6366f1', '#d946ef'
];

function setTurnoFormDirty(isDirty) {
    dirtyForms.turnos = isDirty;
}

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

[turnoNomeInput, turnoSiglaInput, turnoInicioInput, turnoFimInput, turnoAlmocoInput, descansoHorasInput, turnoFimDiaSelect].forEach(input => {
    input.addEventListener("input", (e) => {
        if (e.target === turnoNomeInput && e.target.value.length > 0) {
            e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
        }
        if (e.target === turnoSiglaInput) {
            e.target.value = e.target.value.toUpperCase();
        }
        updateTurnoCargaPreview();
        validateInput(e.target);
        setTurnoFormDirty(true);
    });
});

filtroTurnosInput.addEventListener("input", () => renderTurnos());

function renderCorPalette() {
    const container = $("#turnoCorPalette");
    container.innerHTML = '';
    PALETA_CORES.forEach(cor => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = cor;
        swatch.dataset.cor = cor;
        swatch.addEventListener('click', () => {
            selectCor(cor);
            setTurnoFormDirty(true);
        });
        container.appendChild(swatch);
    });
}

function selectCor(cor) {
    turnoCorHiddenInput.value = cor;
    $$('#turnoCorPalette .color-swatch').forEach(sw => {
        sw.classList.toggle('selected', sw.dataset.cor === cor);
    });
}

function updateTurnoCargaPreview() {
    const i = turnoInicioInput.value;
    const f = turnoFimInput.value;
    const a = Number(turnoAlmocoInput.value || 0);
    const diasDeDiferenca = Number(turnoFimDiaSelect.value);

    // Esconde todos os indicadores por padrão
    turnoViraDiaIndicator.classList.add('hidden');
    turnoDeLongaDuracaoIndicator.classList.add('hidden');
    turnoCargaSpan.classList.remove("highlight");
    turnoCargaSpan.textContent = "Carga: 00:00";

    if (i && f) {
        const cargaTotalMin = calcCarga(i, f, a, diasDeDiferenca);
        turnoCargaSpan.textContent = `Carga: ${minutesToHHMM(cargaTotalMin)}`;
        turnoCargaSpan.classList.add("highlight");

        const minutosEm24h = 1440;

        if (cargaTotalMin >= minutosEm24h) {
            turnoDeLongaDuracaoIndicator.classList.remove('hidden');
        } else if (diasDeDiferenca > 0) {
            turnoViraDiaIndicator.classList.remove('hidden');
        }
    }
}

function renderTurnos() {
    const { turnos } = store.getState();
    const filtro = filtroTurnosInput.value.toLowerCase();

    tblTurnosBody.innerHTML = "";

    const turnosFiltrados = turnos.filter(t => t.nome.toLowerCase().includes(filtro) || (t.sigla && t.sigla.toLowerCase().includes(filtro)));
    const turnosOrdenados = [...turnosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));
    const colspan = 9;

    if (turnosOrdenados.length === 0) {
        tblTurnosBody.innerHTML = `<tr><td colspan="${colspan}">
          <div class="empty-state">
              <div class="empty-state-icon">🕒</div>
              <h3>Nenhum Turno Cadastrado</h3>
              <p>Comece a adicionar turnos para poder associá-los aos cargos.</p>
          </div>
      </td></tr>`;
        return;
    }

    turnosOrdenados.forEach(t => {
        const tr = document.createElement("tr");
        tr.dataset.turnoId = t.id;
        const descansoTxt = t.descansoObrigatorioHoras ? `${t.descansoObrigatorioHoras}h` : 'NT';
        
        let indicadorVisual = '';
        if (t.cargaMin >= 1440) {
            indicadorVisual = ' 🔁'; // Longa duração
        } else if (t.diasDeDiferenca > 0) {
            indicadorVisual = ' 🌙'; // Noturno
        }

        tr.innerHTML = `
      <td><span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span></td>
      <td>${t.nome}</td>
      <td><strong>${t.sigla || '--'}</strong></td>
      <td>${t.inicio}</td><td>${t.fim}${indicadorVisual}</td>
      <td>${t.almocoMin} min</td><td>${minutesToHHMM(t.cargaMin)}</td>
      <td>${descansoTxt}</td>
      <td>
        <button class="secondary" data-action="edit" data-id="${t.id}" aria-label="Editar ${t.nome}">✏️ Editar</button>
        <button class="danger" data-action="delete" data-id="${t.id}" aria-label="Excluir ${t.nome}">🔥 Excluir</button>
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

    if (descansoHiddenInput.value === 'sim' && !validateInput(descansoHorasInput)) {
        isValid = false;
    }
    return isValid;
}

async function saveTurnoFromForm() {
    if (!validateTurnoForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        return;
    }

    const { turnos } = store.getState();
    const nome = turnoNomeInput.value.trim();
    const sigla = turnoSiglaInput.value.trim().toUpperCase();

    if (turnos.some(t => t.nome.toLowerCase() === nome.toLowerCase() && t.id !== editingTurnoId)) {
        return showToast("Já existe um turno com esse nome.");
    }
    if (sigla && turnos.some(t => t.sigla && t.sigla.toLowerCase() === sigla.toLowerCase() && t.id !== editingTurnoId)) {
        return showToast("Já existe um turno com essa sigla.");
    }

    const inicio = turnoInicioInput.value;
    const fim = turnoFimInput.value;
    const diasDeDiferenca = Number(turnoFimDiaSelect.value);

    if (diasDeDiferenca > 0) {
        const confirmado = await showConfirm({
            title: "Confirmar Turno que Avança Dias?",
            message: "O horário de término está definido para um dia futuro. Isso está correto?",
        });
        if (!confirmado) return;
    }

    const almocoMin = Number(turnoAlmocoInput.value || 0);
    const descansoObrigatorio = descansoHiddenInput.value === 'sim';

    const dadosTurno = {
        id: editingTurnoId || uid(),
        nome,
        sigla,
        cor: turnoCorHiddenInput.value,
        inicio,
        fim,
        diasDeDiferenca,
        almocoMin,
        descansoObrigatorioHoras: descansoObrigatorio ? Number(descansoHorasInput.value || 0) : null,
        cargaMin: calcCarga(inicio, fim, almocoMin, diasDeDiferenca)
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
    if (!turno) return;

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
    btnCancelarEdTurno.classList.remove("hidden");
    setTurnoFormDirty(false);
    window.scrollTo(0, 0);
}

function cancelEditTurno() {
    editingTurnoId = null;
    // Limpa os campos
    turnoNomeInput.value = "";
    turnoSiglaInput.value = "";
    turnoInicioInput.value = "";
    turnoFimInput.value = "";
    turnoFimDiaSelect.value = 0;
    turnoAlmocoInput.value = "";
    selectCor(PALETA_CORES[0]);

    // Limpa a validação visual
    $$('.invalid', turnoNomeInput.closest('.card')).forEach(el => el.classList.remove('invalid'));
    $$('.invalid-label', turnoNomeInput.closest('.card')).forEach(el => el.classList.remove('invalid-label'));

    // CORREÇÃO: Garante que o estado visual do toggle seja resetado
    $(`.toggle-btn[data-value="nao"]`, descansoToggleGroup).click();

    updateTurnoCargaPreview();

    btnSalvarTurno.textContent = "💾 Salvar Turno";
    btnCancelarEdTurno.classList.add("hidden");
    setTurnoFormDirty(false);

    turnoNomeInput.focus();
}

function deleteTurno(id) {
    handleDeleteItem({ id: id, itemName: 'Turno', dispatchAction: 'DELETE_TURNO' });
}

// --- Função de Delegação de Eventos ---
function handleTurnosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;

    const { action, id } = target.dataset;
    if (action === 'edit') {
        editTurnoInForm(id);
    } else if (action === 'delete') {
        deleteTurno(id);
    }
}

function initTurnosPage() {
    // ALTERADO: Padronização para addEventListener
    btnSalvarTurno.addEventListener('click', saveTurnoFromForm);
    btnCancelarEdTurno.addEventListener('click', cancelEditTurno);
    $("#btnLimparTurno").addEventListener('click', cancelEditTurno);
    tblTurnosBody.addEventListener('click', handleTurnosTableClick);

    renderCorPalette();
    selectCor(PALETA_CORES[0]);
    $(`.toggle-btn[data-value="nao"]`, descansoToggleGroup).click();
    setTurnoFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initTurnosPage);  