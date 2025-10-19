/**************************************
 * 🏥 Cargos
 **************************************/

let editingCargoId = null;
let lastSavedCargoId = null;

// Referência à função de troca de abas
let switchCargosTab = () => {};

// --- Cache de Elementos DOM ---
const pageCargos = $("#page-cargos");
const cargoNomeInput = $("#cargoNome");
const filtroCargosInput = $("#filtroCargos");
const cargoTurnosContainer = $("#cargoTurnosContainer");
const cargoDiasContainer = $("#cargoDiasContainer");
const cargoHorarioToggle = $("#cargoHorarioToggle");
const cargoTipoHorarioHiddenInput = $("#cargoTipoHorarioHidden");
const cargoHorarioInputsContainer = $("#cargoHorarioInputs");
const cargoInicioInput = $("#cargoInicio");
const cargoFimInput = $("#cargoFim");
const cargoRegrasExplicacaoEl = $("#cargoRegrasExplicacao");
const btnSalvarCargo = $("#btnSalvarCargo");
const btnCancelarCargo = $("#btnCancelarCargo");
const tblCargosBody = $("#tblCargos tbody");
const formTabButtonCargos = $('.painel-tab-btn[data-tab="formulario"]', pageCargos);

function setCargoFormDirty(isDirty) { dirtyForms.cargos = isDirty; }

// --- LÓGICA DO FORMULÁRIO ---

cargoNomeInput.addEventListener("input", (e) => {
    const input = e.target;
    if (input.value.length > 0) {
        input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
    }
    validateInput(input, input.value.trim() !== '');
    setCargoFormDirty(true);
});

filtroCargosInput.addEventListener("input", () => {
    renderCargos();
});

function renderTurnosSelects() {
    const { turnos } = store.getState();
    cargoTurnosContainer.innerHTML = '';
    
    const turnosEditaveis = turnos.filter(t => !t.isSystem);

    if (turnosEditaveis.length === 0) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.innerHTML = `Nenhum turno cadastrado. <a href="#" onclick="go('turnos')">Cadastre um turno primeiro</a>.`;
        cargoTurnosContainer.appendChild(p);
        return;
    }

    const turnosOrdenados = [...turnosEditaveis].sort((a, b) => a.nome.localeCompare(b.nome));

    turnosOrdenados.forEach(t => {
        const lbl = document.createElement("label");
        lbl.className = "check-inline";
        lbl.innerHTML = `
        <input type="checkbox" name="cargoTurno" value="${t.id}">
        <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
        ${t.nome} (${t.inicio}-${t.fim})
    `;
        cargoTurnosContainer.appendChild(lbl);
    });
}

function renderDiasSemanaCargo() {
    cargoDiasContainer.innerHTML = '';
    DIAS_SEMANA.forEach(d => {
        const lbl = document.createElement("label");
        lbl.className = "dia-label";
        lbl.title = d.nome;
        lbl.innerHTML = `
            <input type="checkbox" name="cargoDias" value="${d.id}" class="dia-checkbox">
            <span class="dia-abrev">${d.abrev}</span>
        `;
        const container = cargoDiasContainer;
        container.appendChild(lbl);
        lbl.querySelector('input').addEventListener('change', () => {
            updateCargoRegrasExplicacao();
            setCargoFormDirty(true);
        });
    });
}

$$('.toggle-btn', cargoHorarioToggle).forEach(button => {
    button.addEventListener('click', () => {
        const eraModoAutomatico = cargoTipoHorarioHiddenInput.value === 'automatico';
        const valoresAtuais = {
            inicio: cargoInicioInput.value,
            fim: cargoFimInput.value,
        };

        $$('.toggle-btn', cargoHorarioToggle).forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const tipo = button.dataset.value;
        cargoTipoHorarioHiddenInput.value = tipo;

        cargoHorarioInputsContainer.classList.remove('hidden-height');
        cargoInicioInput.disabled = false;
        cargoFimInput.disabled = false;

        if (tipo === '24h') {
            cargoHorarioInputsContainer.classList.add('hidden-height');
        } else if (tipo === 'automatico') {
            cargoInicioInput.disabled = true;
            cargoFimInput.disabled = true;
            updateAutomaticoHorario();
        } else if (tipo === 'parcial' && eraModoAutomatico) {
            cargoInicioInput.value = valoresAtuais.inicio;
            cargoFimInput.value = valoresAtuais.fim;
        }

        updateCargoRegrasExplicacao();
        setCargoFormDirty(true);
    });
});

function updateCargoRegrasExplicacao() {
    const dias = $$('input[name="cargoDias"]:checked').map(chk => DIAS_SEMANA.find(d => d.id === chk.value)?.nome || '');
    const tipoHorario = cargoTipoHorarioHiddenInput.value;
    const inicio = cargoInicioInput.value;
    const fim = cargoFimInput.value;

    let texto = "Este cargo operará ";
    if (dias.length === 0) {
        cargoRegrasExplicacaoEl.innerHTML = "Defina os dias e a faixa de horário em que este cargo precisa de cobertura. Isso ajudará o gerador de escala a entender a demanda.";
        return;
    }
    texto += dias.length === 7 ? "todos os dias" : `às ${dias.join(", ")}`;

    if (tipoHorario === '24h') {
        texto += ", 24 horas por dia.";
    } else if (inicio && fim) {
        let sufixo = "";
        if (tipoHorario === 'automatico') {
            const { turnos } = store.getState();
            const turnosIdsSelecionados = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);
            const turnosSelecionados = turnos.filter(t => turnosIdsSelecionados.includes(t.id));
            
            if (turnosSelecionados.length > 0) {
                const maxEndMinutesTotal = Math.max(...turnosSelecionados.map(t => parseTimeToMinutes(t.fim) + (t.diasDeDiferenca || 0) * 1440));
                
                if (maxEndMinutesTotal >= 1440) {
                     const diasDepois = Math.floor(maxEndMinutesTotal / 1440);
                     if (diasDepois === 1) {
                        sufixo = " (termina no dia seguinte)";
                     } else {
                        sufixo = ` (termina ${diasDepois} dias depois)`;
                     }
                }
                sufixo += " (calculado)";
            }
        }
        texto += `, das ${inicio} às ${fim}${sufixo}.`;
    } else {
        texto += ".";
    }
    cargoRegrasExplicacaoEl.innerHTML = texto;
}

function updateAutomaticoHorario() {
    if (cargoTipoHorarioHiddenInput.value !== 'automatico') return;

    const { turnos } = store.getState();
    const turnosIdsSelecionados = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);
    const turnosSelecionados = turnos.filter(t => turnosIdsSelecionados.includes(t.id));

    const result = mergeTimeIntervals(turnosSelecionados);

    if (!result) {
        cargoInicioInput.value = '';
        cargoFimInput.value = '';
    } else if (result.is24h) {
        $(`.toggle-btn[data-value="24h"]`, cargoHorarioToggle).click();
    } else {
        cargoInicioInput.value = result.inicio;
        cargoFimInput.value = result.fim;
    }
    
    updateCargoRegrasExplicacao();
}


function renderCargos() {
    const { cargos, funcionarios, turnos } = store.getState();
    const filtro = filtroCargosInput.value.toLowerCase();

    tblCargosBody.innerHTML = "";
    
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

    const cargosFiltrados = cargos.filter(c => c.nome.toLowerCase().includes(filtro));
    const cargosOrdenados = [...cargosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

    if (cargosOrdenados.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        if (filtro.length === 0 && cargos.length === 0) {
            cell.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏥</div>
                <h3>Nenhum Cargo Cadastrado</h3>
                <p>Crie cargos e associe turnos a eles para poder cadastrar funcionários.</p>
            </div>`;
        } else {
            cell.textContent = `Nenhum cargo encontrado com o termo "${filtro}".`;
            cell.className = 'muted center';
        }
        row.appendChild(cell);
        tblCargosBody.appendChild(row);
        parseEmojisInElement(tblCargosBody);
        return;
    }


    cargosOrdenados.forEach(c => {
        const numFuncionarios = funcionarios.filter(f => f.cargoId === c.id).length;
        const nomesTurnos = (c.turnosIds || []).map(id => turnosMap[id]?.nome || "—").join(", ") || 'Nenhum';

        let funcionamento = 'Não definido';
        if (c.regras && c.regras.dias.length > 0) {
            const dias = c.regras.dias.map(d => DIAS_SEMANA.find(dia => dia.id === d)?.abrev).join(', ') || '';
            const tipoHorario = c.regras.tipoHorario || 'automatico';
            let horario = 'N/D';
            if (tipoHorario === '24h') {
                horario = '24h';
            } else if (c.regras.inicio && c.regras.fim) {
                horario = `${c.regras.inicio}-${c.regras.fim}`;
            }
            funcionamento = `${dias} (${horario})`;
        }

        const tr = document.createElement("tr");
        tr.dataset.cargoId = c.id;
        
        tr.innerHTML = `
            <td>${c.nome} <span class="muted">(${numFuncionarios})</span></td>
            <td>${nomesTurnos}</td>
            <td>${funcionamento}</td>
            <td>
                <button class="secondary" data-action="edit" data-id="${c.id}" aria-label="Editar o cargo ${c.nome}">✏️ Editar</button>
                <button class="danger" data-action="delete" data-id="${c.id}" aria-label="Excluir o cargo ${c.nome}">🔥 Excluir</button>
            </td>
        `;
        tblCargosBody.appendChild(tr);
    });
    parseEmojisInElement(tblCargosBody);

    if (lastSavedCargoId) {
        const row = tblCargosBody.querySelector(`tr[data-cargo-id="${lastSavedCargoId}"]`);
        if(row) {
            row.classList.add('flash-update');
            setTimeout(() => row.classList.remove('flash-update'), 1500);
        }
        lastSavedCargoId = null;
    }
}

function validateCargoForm() {
    let isValid = true;
    
    if (!validateInput(cargoNomeInput)) isValid = false;

    const turnosIds = $$('input[name="cargoTurno"]:checked');
    const turnosFieldset = cargoTurnosContainer.closest('fieldset');
    if (turnosIds.length === 0) {
        isValid = false;
        turnosFieldset.classList.add('invalid-fieldset');
    } else {
        turnosFieldset.classList.remove('invalid-fieldset');
    }
    
    const diasSelecionados = $$('input[name="cargoDias"]:checked');
    const regrasFieldset = $("#cargoRegrasFieldset");
    if (diasSelecionados.length === 0) {
        isValid = false;
        regrasFieldset.classList.add('invalid-fieldset');
    } else {
        regrasFieldset.classList.remove('invalid-fieldset');
    }

    const tipoHorario = cargoTipoHorarioHiddenInput.value;
    if (tipoHorario === 'parcial') {
        if (!validateInput(cargoInicioInput)) isValid = false;
        if (!validateInput(cargoFimInput)) isValid = false;
    } else {
        validateInput(cargoInicioInput, true);
        validateInput(cargoFimInput, true);
    }

    return isValid;
}

async function saveCargoFromForm() {
    if (!validateCargoForm()) {
        showToast("Preencha todos os campos obrigatórios para salvar o cargo.");
        focusFirstInvalidInput('#page-cargos .painel-gerenciamento');
        return;
    }

    const nome = cargoNomeInput.value.trim();
    const turnosIds = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);
    
    const { cargos, equipes, funcionarios } = store.getState();
    if (cargos.some(c => c.nome.toLowerCase() === nome.toLowerCase() && c.id !== editingCargoId)) {
        return showToast("Já existe um cargo com este nome.");
    }
    
    if (editingCargoId) {
        const cargoOriginal = cargos.find(c => c.id === editingCargoId);
        const turnosRemovidosIds = cargoOriginal.turnosIds.filter(id => !turnosIds.includes(id));
        
        if (turnosRemovidosIds.length > 0) {
            const equipesAfetadas = equipes.filter(e => e.cargoId === editingCargoId && turnosRemovidosIds.includes(e.turnoId));
            if (equipesAfetadas.length > 0) {
                const nomesEquipes = equipesAfetadas.map(e => `"${e.nome}"`).join(', ');
                showInfoModal({
                    title: "Ação Bloqueada",
                    contentHTML: `<p>Não é possível remover o(s) turno(s) porque a(s) seguinte(s) equipe(s) depende(m) dele(s): <strong>${nomesEquipes}</strong>.</p><p>Por favor, edite ou exclua esta(s) equipe(s) primeiro.</p>`
                });
                return;
            }
        }
        
        const funcsAfetados = funcionarios.filter(f => 
            f.cargoId === editingCargoId && 
            turnosRemovidosIds.some(turnoId => f.disponibilidade && f.disponibilidade[turnoId])
        );

        if (funcsAfetados.length > 0) {
            showInfoModal({
                title: "Ação Bloqueada",
                contentHTML: `<p>Não é possível remover o(s) turno(s) deste cargo, pois isso apagaria as configurações de disponibilidade de <strong>${funcsAfetados.length} funcionário(s)</strong>.</p><p>Primeiro, edite o(s) funcionário(s) para remover a disponibilidade do(s) turno(s) em questão, ou mude-os de cargo.</p>`
            });
            return;
        }
    }

    const cargoData = {
        id: editingCargoId || uid(),
        nome,
        turnosIds,
        regras: {
            dias: $$('input[name="cargoDias"]:checked').map(chk => chk.value),
            tipoHorario: cargoTipoHorarioHiddenInput.value,
            inicio: cargoInicioInput.value,
            fim: cargoFimInput.value,
        }
    };

    lastSavedCargoId = cargoData.id;

    store.dispatch('SAVE_CARGO', cargoData);
    
    showToast("Cargo salvo com sucesso!");
    switchCargosTab('gerenciar');
}

function editCargoInForm(id) {
    const { cargos } = store.getState();
    const cargo = cargos.find(c => c.id === id);
    if (!cargo) return;

    cancelEditCargo();
    editingCargoId = id;

    cargoNomeInput.value = cargo.nome;
    $$('input[name="cargoTurno"]').forEach(chk => {
        chk.checked = (cargo.turnosIds || []).includes(chk.value);
    });

    if (cargo.regras) {
        $$('input[name="cargoDias"]').forEach(chk => chk.checked = cargo.regras.dias.includes(chk.value));
        const tipoHorario = cargo.regras.tipoHorario || 'automatico';
        $(`.toggle-btn[data-value="${tipoHorario}"]`, cargoHorarioToggle).click();
        cargoInicioInput.value = cargo.regras.inicio || '';
        cargoFimInput.value = cargo.regras.fim || '';
    }
    
    updateAutomaticoHorario();
    updateCargoRegrasExplicacao();

    btnSalvarCargo.textContent = "💾 Salvar Alterações";
    parseEmojisInElement(btnSalvarCargo);
    setCargoFormDirty(false);

    formTabButtonCargos.innerHTML = `📝 Editando: ${cargo.nome}`;
    switchCargosTab('formulario');
}

function cancelEditCargo() {
    editingCargoId = null;
    cargoNomeInput.value = "";
    validateInput(cargoNomeInput, true);
    $$('input[name="cargoTurno"]').forEach(chk => chk.checked = false);

    $$('input[name="cargoDias"]').forEach(chk => chk.checked = false);
    cargoInicioInput.value = "";
    cargoFimInput.value = "";
    
    $$('.invalid-fieldset', pageCargos).forEach(el => el.classList.remove('invalid-fieldset'));

    $(`.toggle-btn[data-value="automatico"]`, cargoHorarioToggle).click();
    updateCargoRegrasExplicacao();

    btnSalvarCargo.textContent = "💾 Salvar Cargo";
    formTabButtonCargos.innerHTML = "📝 Novo Cargo";
    parseEmojisInElement(btnSalvarCargo);
    setCargoFormDirty(false);
    
    cargoNomeInput.focus();
}

async function deleteCargo(id) {
    const { escalas, funcionarios } = store.getState();
    const blockingIssues = [];

    // 1. Verificar em escalas salvas
    const escalasAfetadas = escalas.filter(e => e.cargoId === id);
    if (escalasAfetadas.length > 0) {
        const plural = escalasAfetadas.length > 1;
        blockingIssues.push(`Está sendo utilizado em <strong>${escalasAfetadas.length} escala${plural ? 's' : ''} salva${plural ? 's' : ''}</strong>.`);
    }

    // 2. Verificar em funcionários ativos
    const funcsUsando = funcionarios.filter(f => f.cargoId === id && f.status !== 'arquivado');
    if (funcsUsando.length > 0) {
        const nomesFuncs = funcsUsando.map(f => `<strong>${f.nome}</strong>`).join(', ');
        blockingIssues.push(`Está sendo utilizado pelo(s) funcionário(s): ${nomesFuncs}.`);
    }

    // 3. Mostrar modal unificado se houver problemas
    if (blockingIssues.length > 0) {
        const messageHTML = `
            <p>Este cargo não pode ser excluído pelos seguintes motivos:</p>
            <ul>
                ${blockingIssues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
            <p>Por favor, resolva estas dependências antes de tentar excluir o cargo.</p>
        `;
        showInfoModal({
            title: "Exclusão Bloqueada",
            contentHTML: messageHTML
        });
        return;
    }

    // 4. Se não houver problemas, prosseguir com a confirmação de exclusão
    await handleDeleteItem({
        id,
        itemName: 'Cargo',
        dispatchAction: 'DELETE_CARGO'
    });
}


function handleCargosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;

    const { action, id } = target.dataset;
    if (action === 'edit') {
        editCargoInForm(id);
    } else if (action === 'delete') {
        deleteCargo(id);
    }
}

function initCargosPage() {
    switchCargosTab = setupTabbedPanel('#page-cargos .painel-gerenciamento', 'cargos', (tabId) => {
        if (tabId === 'gerenciar') {
            cancelEditCargo();
        }
    });

    $('.btn-add-new', pageCargos).addEventListener('click', () => {
        cancelEditCargo();
        formTabButtonCargos.innerHTML = "📝 Novo Cargo";
        switchCargosTab('formulario');
    });

    btnSalvarCargo.addEventListener('click', saveCargoFromForm);
    btnCancelarCargo.addEventListener('click', () => {
        cancelEditCargo();
        switchCargosTab('gerenciar');
    });

    tblCargosBody.addEventListener('click', handleCargosTableClick);
    
    cargoTurnosContainer.addEventListener('change', (e) => {
        if (e.target.name === 'cargoTurno') {
            updateAutomaticoHorario();
            setCargoFormDirty(true);
        }
    });

    const cargoHorarioInputs = [cargoInicioInput, cargoFimInput];
    cargoHorarioInputs.forEach(sel => sel.addEventListener('input', () => {
        updateCargoRegrasExplicacao();
        setCargoFormDirty(true);
    }));
    
    const btnToggleTodosDias = $("#btnToggleTodosDiasCargo");
    if (btnToggleTodosDias) {
        btnToggleTodosDias.addEventListener('click', () => {
            const checkboxes = $$('input[name="cargoDias"]');
            const allChecked = checkboxes.every(chk => chk.checked);
            
            checkboxes.forEach(chk => {
                if (chk.checked === allChecked) {
                    chk.click();
                }
            });
        });
    }

    const btnToggleDiasSemana = $("#btnToggleDiasSemanaCargo");
    if (btnToggleDiasSemana) {
        btnToggleDiasSemana.addEventListener('click', () => {
            const diasDeSemanaIds = ['seg', 'ter', 'qua', 'qui', 'sex'];
            const checkboxes = $$('input[name="cargoDias"]');
            checkboxes.forEach(chk => {
                const shouldBeChecked = diasDeSemanaIds.includes(chk.value);
                if (chk.checked !== shouldBeChecked) {
                    chk.click();
                }
            });
        });
    }

    renderDiasSemanaCargo();
    $(`.toggle-btn[data-value="automatico"]`, cargoHorarioToggle).click();
    setCargoFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initCargosPage);