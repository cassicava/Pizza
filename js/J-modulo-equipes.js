/**************************************
 * 👥 Equipes
 **************************************/

let editingEquipeId = null;
let lastAddedEquipeId = null;

// Referência à função de troca de abas
let switchEquipesTab = () => {};

// --- Cache de Elementos DOM ---
const pageEquipes = $("#page-equipes");
const equipeNomeInput = $("#equipeNome");
const equipeCargoSelect = $("#equipeCargo");
const equipeTurnoSelect = $("#equipeTurno");
const equipeFuncionariosContainer = $("#equipeFuncionariosContainer");
const filtroEquipesInput = $("#filtroEquipes");
const tblEquipesBody = $("#tblEquipes tbody");
const btnSalvarEquipe = $("#btnSalvarEquipe");
const btnCancelarEquipe = $("#btnCancelarEquipe");
const formTabButtonEquipes = $('.painel-tab-btn[data-tab="formulario"]', pageEquipes);


function setEquipeFormDirty(isDirty) {
    dirtyForms.equipes = isDirty;
}

// --- LÓGICA DE RENDERIZAÇÃO E FORMULÁRIO ---

function renderEquipeCargoSelect() {
    const { cargos } = store.getState();
    equipeCargoSelect.innerHTML = "<option value=''>Selecione um cargo</option>";
    const cargosOrdenados = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        equipeCargoSelect.appendChild(o);
    });
}

function handleEquipeCargoChange() {
    const cargoId = equipeCargoSelect.value;
    const { cargos, turnos } = store.getState();
    
    equipeTurnoSelect.innerHTML = "<option value=''>Selecione um turno</option>";
    equipeTurnoSelect.disabled = true;
    equipeFuncionariosContainer.innerHTML = `<p class="muted">Selecione um cargo e um turno para listar os funcionários elegíveis.</p>`;

    if (!cargoId) return;

    const cargo = cargos.find(c => c.id === cargoId);
    if (cargo && cargo.turnosIds && cargo.turnosIds.length > 0) {
        const turnosDoCargo = turnos
            .filter(t => cargo.turnosIds.includes(t.id))
            .sort((a,b) => a.nome.localeCompare(b.nome));
        
        turnosDoCargo.forEach(t => {
            const o = document.createElement("option");
            o.value = t.id;
            o.textContent = `${t.nome} (${t.inicio}-${t.fim})`;
            equipeTurnoSelect.appendChild(o);
        });
        
        equipeTurnoSelect.disabled = false;
    }
}

function renderEquipeFuncionariosSelect() {
    const cargoId = equipeCargoSelect.value;
    const turnoId = equipeTurnoSelect.value;
    const { funcionarios, equipes } = store.getState();

    equipeFuncionariosContainer.innerHTML = '';

    if (!cargoId || !turnoId) {
        equipeFuncionariosContainer.innerHTML = `<p class="muted">Selecione um cargo e um turno para listar os funcionários.</p>`;
        return;
    }

    const funcionariosEmEquipes = new Set();
    equipes.forEach(equipe => {
        if (equipe.id !== editingEquipeId) {
            equipe.funcionarioIds.forEach(funcId => funcionariosEmEquipes.add(funcId));
        }
    });

    const funcionariosElegiveis = funcionarios
        .filter(f => 
            f.cargoId === cargoId && 
            f.status === 'ativo' && 
            !funcionariosEmEquipes.has(f.id) &&
            f.disponibilidade && f.disponibilidade[turnoId]
        )
        .sort((a,b) => a.nome.localeCompare(b.nome));

    if (funcionariosElegiveis.length === 0) {
        equipeFuncionariosContainer.innerHTML = `<p class="muted">Nenhum funcionário disponível para este turno que já não esteja em outra equipe.</p>`;
        return;
    }

    funcionariosElegiveis.forEach(f => {
        const lbl = document.createElement("label");
        lbl.className = "check-inline";
        lbl.innerHTML = `
            <input type="checkbox" name="equipeFuncionario" value="${f.id}">
            ${f.nome}
        `;
        equipeFuncionariosContainer.appendChild(lbl);
    });
}


function renderEquipes() {
    const { equipes, cargos, turnos, funcionarios } = store.getState();
    const filtro = filtroEquipesInput.value.toLowerCase();
    
    tblEquipesBody.innerHTML = "";

    const equipesFiltradas = equipes.filter(e => e.nome.toLowerCase().includes(filtro));
    if (equipesFiltradas.length === 0) {
        const isEmpty = filtro === '' && equipes.length === 0;
        const emptyHTML = isEmpty 
            ? `<div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
                    <div class="empty-state-icon">👥</div>
                    <h3>Nenhuma Equipe Cadastrada</h3>
                    <p>Use o formulário acima para criar sua primeira equipe.</p>
               </div>`
            : `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma equipe encontrada com o termo "${filtro}".</p>`;
        tblEquipesBody.innerHTML = `<tr><td colspan="5">${emptyHTML}</td></tr>`;
        return;
    }

    const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t.nome]));
    const funcionariosMap = Object.fromEntries(funcionarios.map(f => [f.id, f.nome]));

    equipesFiltradas.forEach(e => {
        const tr = document.createElement("tr");
        tr.dataset.equipeId = e.id;
        
        const nomesMembros = e.funcionarioIds.map(id => funcionariosMap[id] || 'Funcionário Removido').join(', ');

        const cargoNome = cargosMap[e.cargoId];
        const turnoNome = turnosMap[e.turnoId];
        
        const cargoCell = !cargoNome ? `<td title="O cargo original desta equipe foi removido.">⚠️ Cargo Removido</td>` : `<td>${cargoNome}</td>`;
        const turnoCell = !turnoNome ? `<td title="O turno original desta equipe foi removido ou desassociado do cargo.">⚠️ Turno Removido</td>` : `<td>${turnoNome}</td>`;

        tr.innerHTML = `
            <td>${e.nome}</td>
            ${cargoCell}
            ${turnoCell}
            <td>${nomesMembros}</td>
            <td>
                <button class="secondary" data-action="edit" data-id="${e.id}" aria-label="Editar a equipe ${e.nome}">✏️ Editar</button>
                <button class="danger" data-action="delete" data-id="${e.id}" aria-label="Excluir a equipe ${e.nome}">🔥 Excluir</button>
            </td>`;
        tblEquipesBody.appendChild(tr);
    });

    if (lastAddedEquipeId) {
        tblEquipesBody.querySelector(`tr[data-equipe-id="${lastAddedEquipeId}"]`)?.classList.add('new-item');
        lastAddedEquipeId = null;
    }
}

// --- AÇÕES DE CRUD ---

function validateEquipeForm() {
    let isValid = true;
    if (!validateInput(equipeNomeInput)) isValid = false;
    if (!validateInput(equipeCargoSelect)) isValid = false;
    if (!validateInput(equipeTurnoSelect)) isValid = false;
    
    const membrosSelecionados = $$('input[name="equipeFuncionario"]:checked');
    const membrosFieldset = equipeFuncionariosContainer.closest('fieldset');
    if (membrosSelecionados.length === 0) {
        isValid = false;
        membrosFieldset.classList.add('invalid-fieldset');
    } else {
        membrosFieldset.classList.remove('invalid-fieldset');
    }
    return isValid;
}

function saveEquipeFromForm() {
    if (!validateEquipeForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        focusFirstInvalidInput('#page-equipes .painel-gerenciamento');
        return;
    }

    // CORREÇÃO: Adicionada a validação de nome de equipe duplicado
    const { equipes } = store.getState();
    const nome = equipeNomeInput.value.trim();
    if (equipes.some(e => e.nome.toLowerCase() === nome.toLowerCase() && e.id !== editingEquipeId)) {
        return showToast("Já existe uma equipe com este nome.");
    }

    const equipeData = {
        id: editingEquipeId || uid(),
        nome: nome,
        cargoId: equipeCargoSelect.value,
        turnoId: equipeTurnoSelect.value,
        funcionarioIds: $$('input[name="equipeFuncionario"]:checked').map(chk => chk.value)
    };

    if (!editingEquipeId) {
        lastAddedEquipeId = equipeData.id;
    }

    store.dispatch('SAVE_EQUIPE', equipeData);
    
    showToast("Equipe salva com sucesso!");
    switchEquipesTab('gerenciar');
}

function editEquipeInForm(id) {
    const { equipes } = store.getState();
    const equipe = equipes.find(e => e.id === id);
    if (!equipe) return;

    cancelEditEquipe();
    editingEquipeId = id;

    equipeNomeInput.value = equipe.nome;
    equipeCargoSelect.value = equipe.cargoId;
    
    handleEquipeCargoChange();
    
    equipeTurnoSelect.value = equipe.turnoId;
    
    renderEquipeFuncionariosSelect();
    
    equipe.funcionarioIds.forEach(funcId => {
        const checkbox = $(`input[name="equipeFuncionario"][value="${funcId}"]`);
        if (checkbox) checkbox.checked = true;
    });

    btnSalvarEquipe.textContent = "💾 Salvar Alterações";
    setEquipeFormDirty(false);
    
    formTabButtonEquipes.textContent = `Editando: ${equipe.nome}`;
    switchEquipesTab('formulario');
}


function cancelEditEquipe() {
    editingEquipeId = null;
    equipeNomeInput.value = "";
    equipeCargoSelect.value = "";
    
    handleEquipeCargoChange();
    
    btnSalvarEquipe.textContent = "💾 Salvar Equipe";
    formTabButtonEquipes.textContent = "Nova Equipe";
    setEquipeFormDirty(false);
    
    $$('.invalid, .invalid-fieldset', pageEquipes).forEach(el => el.classList.remove('invalid-fieldset', 'invalid'));
    
    equipeNomeInput.focus();
}

function deleteEquipe(id) {
    handleDeleteItem({
        id: id,
        itemName: 'Equipe',
        dispatchAction: 'DELETE_EQUIPE',
    });
}

function handleEquipesTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'edit') editEquipeInForm(id);
    else if (action === 'delete') deleteEquipe(id);
}

// --- INICIALIZAÇÃO DA PÁGINA ---

function initEquipesPageListeners() {
    switchEquipesTab = setupTabbedPanel('#page-equipes .painel-gerenciamento', 'equipes', (tabId) => {
        if (tabId === 'gerenciar') {
            cancelEditEquipe();
        }
    });

    $('.btn-add-new', pageEquipes).addEventListener('click', () => {
        cancelEditEquipe();
        formTabButtonEquipes.textContent = "Nova Equipe";
        switchEquipesTab('formulario');
    });

    equipeCargoSelect.addEventListener('change', () => {
        handleEquipeCargoChange();
        setEquipeFormDirty(true);
    });
    equipeTurnoSelect.addEventListener('change', () => {
        renderEquipeFuncionariosSelect();
        setEquipeFormDirty(true);
    });
    filtroEquipesInput.addEventListener('input', renderEquipes);
    
    btnSalvarEquipe.addEventListener('click', saveEquipeFromForm);
    btnCancelarEquipe.addEventListener('click', () => {
        cancelEditEquipe();
        switchEquipesTab('gerenciar');
    });

    tblEquipesBody.addEventListener('click', handleEquipesTableClick);

    equipeNomeInput.addEventListener('input', () => setEquipeFormDirty(true));
    equipeFuncionariosContainer.addEventListener('change', () => setEquipeFormDirty(true));

    setEquipeFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initEquipesPageListeners);