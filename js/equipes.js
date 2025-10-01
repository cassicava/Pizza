/**************************************
 * 🤝 Equipes
 **************************************/

let editingEquipeId = null;
let lastAddedEquipeId = null;

// --- Cache de Elementos DOM ---
const equipeNomeInput = $("#equipeNome");
const equipeCorHiddenInput = $("#equipeCorHidden");
const equipeCargoSelect = $("#equipeCargoSelect");
const equipeTurnoSelect = $("#equipeTurnoSelect");
const equipeMembrosContainer = $("#equipeMembrosContainer");
const equipePadraoSelect = $("#equipePadraoSelect");
const listaEquipesContainer = $("#listaEquipes");
const equipePadraoExplicacao = $("#equipePadraoExplicacao");

function setEquipeFormDirty(isDirty) {
    dirtyForms.equipes = isDirty;
}

const PADROES_EXPLICACAO = {
    'DSDN': '<strong>Dia Sim, Dia Não:</strong> Ideal para escalas 12x36. A equipe trabalha um dia e folga no dia seguinte, em um ciclo contínuo.',
    'DSDD': '<strong>Dia Sim, Dois Dias Não:</strong> Comum em escalas 12x48. A equipe trabalha um dia e folga nos dois dias seguintes.',
    'DDDD': '<strong>Dois Dias Sim, Dois Dias Não:</strong> Padrão 2x2. A equipe trabalha por dois dias consecutivos e depois folga por dois dias consecutivos.'
};

function updatePadraoExplicacao() {
    const padrao = equipePadraoSelect.value;
    equipePadraoExplicacao.innerHTML = PADROES_EXPLICACAO[padrao] || '';
}

function initEquipesPage() {
    renderEquipeCorPalette();
    selectEquipeCor(PALETA_CORES[0]);
    renderEquipeCargoSelect();
    updatePadraoExplicacao();

    equipeCargoSelect.addEventListener('change', handleEquipeCargoChange);
    equipeTurnoSelect.addEventListener('change', handleEquipeTurnoChange);
    equipePadraoSelect.addEventListener('change', updatePadraoExplicacao);
    equipeNomeInput.addEventListener('input', () => setEquipeFormDirty(true));
    
    $("#btnSalvarEquipe").addEventListener('click', saveEquipeFromForm);
    $("#btnCancelarEdEquipe").addEventListener('click', cancelEditEquipe);
    $("#btnLimparEquipe").addEventListener('click', cancelEditEquipe);

    listaEquipesContainer.addEventListener('click', handleEquipesListClick);

    // Lógica para o novo tooltip
    const tooltipTrigger = $(".tooltip-trigger");
    if(tooltipTrigger) {
        const tooltipContent = equipePadraoExplicacao;
        tooltipTrigger.addEventListener('mouseenter', () => {
            tooltipContent.style.opacity = 1;
            tooltipContent.style.visibility = 'visible';
        });
        tooltipTrigger.addEventListener('mouseleave', () => {
            tooltipContent.style.opacity = 0;
            tooltipContent.style.visibility = 'hidden';
        });
    }
    
    setEquipeFormDirty(false);
}

function renderEquipeCorPalette() {
    const container = $("#equipeCorPalette");
    container.innerHTML = '';
    PALETA_CORES.forEach(cor => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = cor;
        swatch.dataset.cor = cor;
        swatch.addEventListener('click', () => {
            selectEquipeCor(cor);
            setEquipeFormDirty(true);
        });
        container.appendChild(swatch);
    });
}

function selectEquipeCor(cor) {
    equipeCorHiddenInput.value = cor;
    $$('#equipeCorPalette .color-swatch').forEach(sw => {
        sw.classList.toggle('selected', sw.dataset.cor === cor);
    });
}

function renderEquipeCargoSelect() {
    const { cargos } = store.getState();
    equipeCargoSelect.innerHTML = "<option value=''>1º Selecione um Cargo</option>";
    const cargosOrdenados = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        equipeCargoSelect.appendChild(o);
    });
}

function handleEquipeCargoChange() {
    renderEquipeTurnoSelect();
    equipeMembrosContainer.innerHTML = '<p class="muted">Selecione um turno para listar os funcionários.</p>';
    setEquipeFormDirty(true);
}

function renderEquipeTurnoSelect() {
    const { cargos, turnos } = store.getState();
    const cargoId = equipeCargoSelect.value;
    equipeTurnoSelect.innerHTML = "<option value=''>2º Selecione um Turno Base</option>";
    equipeTurnoSelect.disabled = true;

    if (!cargoId) return;

    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo || !cargo.turnosIds.length) return;

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id)).sort((a, b) => a.nome.localeCompare(b.nome));
    turnosDoCargo.forEach(t => {
        const o = document.createElement("option");
        o.value = t.id;
        o.textContent = t.nome;
        equipeTurnoSelect.appendChild(o);
    });
    equipeTurnoSelect.disabled = false;
}

function handleEquipeTurnoChange() {
    renderEquipeMembrosSelect();
    setEquipeFormDirty(true);
}

function renderEquipeMembrosSelect() {
    const { funcionarios, equipes } = store.getState();
    const cargoId = equipeCargoSelect.value;
    const turnoId = equipeTurnoSelect.value;
    equipeMembrosContainer.innerHTML = '';

    if (!cargoId || !turnoId) {
        equipeMembrosContainer.innerHTML = '<p class="muted">Selecione um cargo e um turno para listar os funcionários.</p>';
        return;
    }

    const funcionariosEmOutrasEquipes = new Set(equipes.flatMap(e => e.id !== editingEquipeId ? e.membros : []));
    
    const funcionariosDisponiveis = funcionarios.filter(f => {
        const pertenceAoCargo = f.cargoId === cargoId;
        const naoEstaEmOutraEquipe = !funcionariosEmOutrasEquipes.has(f.id);
        const temDisponibilidade = f.disponibilidade && f.disponibilidade[turnoId];
        return pertenceAoCargo && naoEstaEmOutraEquipe && temDisponibilidade;
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    if (funcionariosDisponiveis.length === 0) {
        equipeMembrosContainer.innerHTML = '<p class="muted">Nenhum funcionário encontrado com os critérios selecionados.</p>';
        return;
    }

    const membrosAtuais = equipes.find(e => e.id === editingEquipeId)?.membros || [];

    funcionariosDisponiveis.forEach(func => {
        const isChecked = membrosAtuais.includes(func.id);
        const lbl = document.createElement("label");
        lbl.className = "check-inline";
        lbl.innerHTML = `
            <input type="checkbox" name="equipeMembro" value="${func.id}" ${isChecked ? 'checked' : ''}>
            ${func.nome}
        `;
        lbl.addEventListener('change', () => setEquipeFormDirty(true));
        equipeMembrosContainer.appendChild(lbl);
    });
}

function saveEquipeFromForm() {
    const nome = equipeNomeInput.value.trim();
    const cargoId = equipeCargoSelect.value;
    const turnoId = equipeTurnoSelect.value;
    const membros = $$('input[name="equipeMembro"]:checked').map(chk => chk.value);

    if (!nome || !cargoId || !turnoId || membros.length === 0) {
        showToast("Preencha todos os campos: Nome, Cargo, Turno Base e selecione ao menos um membro.");
        return;
    }

    const { equipes } = store.getState();
    if (equipes.some(e => e.nome.toLowerCase() === nome.toLowerCase() && e.id !== editingEquipeId)) {
        return showToast("Já existe uma equipe com este nome.");
    }

    const equipeData = {
        id: editingEquipeId || uid(),
        nome,
        cor: equipeCorHiddenInput.value,
        cargoId,
        turnoId,
        membros,
        padrao: equipePadraoSelect.value,
    };

    if (!editingEquipeId) {
        lastAddedEquipeId = equipeData.id;
    }

    store.dispatch('SAVE_EQUIPE', equipeData);
    cancelEditEquipe();
    showToast("Equipe salva com sucesso!");
}

function cancelEditEquipe() {
    editingEquipeId = null;
    equipeNomeInput.value = '';
    selectEquipeCor(PALETA_CORES[0]);
    equipeCargoSelect.value = '';
    equipeTurnoSelect.innerHTML = "<option value=''>2º Selecione um Turno Base</option>";
    equipeTurnoSelect.disabled = true;
    equipeMembrosContainer.innerHTML = '';
    equipePadraoSelect.value = 'DSDN';
    updatePadraoExplicacao();


    $("#btnSalvarEquipe").textContent = "💾 Salvar Equipe";
    $("#btnCancelarEdEquipe").classList.add("hidden");
    setEquipeFormDirty(false);
}

function editEquipeInForm(equipeId) {
    const { equipes } = store.getState();
    const equipe = equipes.find(e => e.id === equipeId);
    if (!equipe) return;
    
    cancelEditEquipe();
    editingEquipeId = equipeId;

    equipeNomeInput.value = equipe.nome;
    selectEquipeCor(equipe.cor);
    equipeCargoSelect.value = equipe.cargoId;
    
    renderEquipeTurnoSelect();
    equipeTurnoSelect.value = equipe.turnoId;
    
    renderEquipeMembrosSelect();
    
    equipe.membros.forEach(membroId => {
        const chk = $(`input[name="equipeMembro"][value="${membroId}"]`);
        if (chk) chk.checked = true;
    });

    equipePadraoSelect.value = equipe.padrao;
    updatePadraoExplicacao();

    $("#btnSalvarEquipe").textContent = "💾 Salvar Alterações";
    $("#btnCancelarEdEquipe").classList.remove("hidden");
    setEquipeFormDirty(false);
    window.scrollTo(0, 0);
}

function deleteEquipe(equipeId) {
    handleDeleteItem({
        id: equipeId,
        itemName: 'Equipe',
        dispatchAction: 'DELETE_EQUIPE'
    });
}

function renderEquipes() {
    const { equipes, cargos, funcionarios } = store.getState();
    listaEquipesContainer.innerHTML = '';

    if (equipes.length === 0) {
        listaEquipesContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🤝</div>
            <h3>Nenhuma Equipe Cadastrada</h3>
            <p>Crie equipes para automatizar escalas com padrões fixos, como 12x36.</p>
        </div>`;
        return;
    }
    
    const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
    const funcionariosMap = Object.fromEntries(funcionarios.map(f => [f.id, f.nome]));
    const equipesOrdenadas = [...equipes].sort((a, b) => a.nome.localeCompare(b.nome));

    equipesOrdenadas.forEach(equipe => {
        const card = document.createElement("div");
        card.className = "escala-card equipe-card";
        card.style.borderColor = equipe.cor;

        const cargoNome = cargosMap[equipe.cargoId] || 'Cargo não encontrado';
        const membrosNomes = equipe.membros.map(id => funcionariosMap[id] || '?').join(', ');

        card.innerHTML = `
          <div class="escala-card-content">
            <h3>${equipe.nome}</h3>
            <p class="muted">${cargoNome} • ${equipe.membros.length} membro(s)</p>
            <p class="muted" style="font-size: 0.8rem; margin-top: 4px;">${membrosNomes}</p>
          </div>
          <div class="escala-card-actions">
            <button class="secondary" data-action="edit" data-id="${equipe.id}">✏️ Editar</button>
            <button class="danger" data-action="delete" data-id="${equipe.id}">🔥 Excluir</button>
          </div>
        `;
        listaEquipesContainer.appendChild(card);
    });
}

function handleEquipesListClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    const { action, id } = button.dataset;
    if (action === 'edit') {
        editEquipeInForm(id);
    } else if (action === 'delete') {
        deleteEquipe(id);
    }
}

document.addEventListener('DOMContentLoaded', initEquipesPage);