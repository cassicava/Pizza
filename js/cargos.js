/**************************************
 * 🏥 Cargos
 **************************************/

let editingCargoId = null;
let lastAddedCargoId = null;

// --- Cache de Elementos DOM ---
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
const btnCancelarEdCargo = $("#btnCancelarEdCargo");
const tblCargosBody = $("#tblCargos tbody");

function setCargoFormDirty(isDirty) {
    dirtyForms.cargos = isDirty;
}

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

    if (turnos.length === 0) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.innerHTML = `Nenhum turno cadastrado. <a href="#" onclick="go('turnos')">Cadastre um turno primeiro</a>.`;
        cargoTurnosContainer.appendChild(p);
        return;
    }

    const turnosOrdenados = [...turnos].sort((a, b) => a.nome.localeCompare(b.nome));

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
                const minStartMinutes = Math.min(...turnosSelecionados.map(t => parseTimeToMinutes(t.inicio)));
                const maxEndMinutesTotal = Math.max(...turnosSelecionados.map(t => parseTimeToMinutes(t.fim) + (t.diasDeDiferenca || 0) * 1440));
                
                if (maxEndMinutesTotal >= 1440 && maxEndMinutesTotal > minStartMinutes) {
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

    if (turnosSelecionados.length === 0) {
        cargoInicioInput.value = '';
        cargoFimInput.value = '';
        updateCargoRegrasExplicacao();
        return;
    }

    const minutosEm24h = 1440;
    // Criar intervalos para verificar a continuidade
    let intervalos = turnosSelecionados.map(t => {
        const start = parseTimeToMinutes(t.inicio);
        const end = parseTimeToMinutes(t.fim) + (t.diasDeDiferenca || 0) * minutosEm24h;
        return { start, end };
    });

    // Para verificar um ciclo contínuo, duplicamos os intervalos em um período de 48h
    const intervalosCiclicos = [...intervalos];
    intervalos.forEach(iv => {
        intervalosCiclicos.push({ start: iv.start + minutosEm24h, end: iv.end + minutosEm24h });
    });
    intervalosCiclicos.sort((a, b) => a.start - b.start);

    // Mesclar intervalos sobrepostos
    const merged = [];
    if (intervalosCiclicos.length > 0) {
        merged.push(JSON.parse(JSON.stringify(intervalosCiclicos[0])));
        for (let i = 1; i < intervalosCiclicos.length; i++) {
            const last = merged[merged.length - 1];
            const current = intervalosCiclicos[i];
            // Se o intervalo atual começar antes ou no mesmo minuto que o último termina, eles se sobrepõem ou são contíguos.
            if (current.start <= last.end) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push(JSON.parse(JSON.stringify(current)));
            }
        }
    }

    // Verificar se algum intervalo mesclado cobre 24h ou mais
    for (const iv of merged) {
        if (iv.end - iv.start >= minutosEm24h) {
            $(`.toggle-btn[data-value="24h"]`, cargoHorarioToggle).click();
            return;
        }
    }

    // Se não for 24h contínuo, calcula o início mais cedo e o fim mais tardio
    const minStartMinutes = Math.min(...turnosSelecionados.map(t => parseTimeToMinutes(t.inicio)));
    const maxEndMinutesTotal = Math.max(...turnosSelecionados.map(t => parseTimeToMinutes(t.fim) + (t.diasDeDiferenca || 0) * 1440));
    
    cargoInicioInput.value = minutesToHHMM(minStartMinutes);
    
    const fimModulo = maxEndMinutesTotal % minutosEm24h;
    // Se o fim for exatamente à meia-noite (módulo 0) e o turno não começou à meia-noite,
    // o horário é 24:00, que representamos como 00:00.
    cargoFimInput.value = minutesToHHMM(fimModulo);
    
    updateCargoRegrasExplicacao();
}


// --- RENDERIZAÇÃO DA TABELA ---

function renderCargos() {
    const { cargos, funcionarios, turnos } = store.getState();
    const filtro = filtroCargosInput.value.toLowerCase();

    tblCargosBody.innerHTML = "";

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
        return;
    }

    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

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
                <button class="secondary" data-action="edit" data-id="${c.id}" aria-label="Editar cargo ${c.nome}">✏️ Editar</button>
                <button class="danger" data-action="delete" data-id="${c.id}" aria-label="Excluir cargo ${c.nome}">🔥 Excluir</button>
            </td>
        `;
        tblCargosBody.appendChild(tr);
    });

    if (lastAddedCargoId) {
        tblCargosBody.querySelector(`tr[data-cargo-id="${lastAddedCargoId}"]`)?.classList.add('new-item');
        lastAddedCargoId = null;
    }
}


// --- AÇÕES PRINCIPAIS ---

function saveCargoFromForm() {
    const nome = cargoNomeInput.value.trim();
    const turnosIds = $$('input[name="cargoTurno"]:checked').map(chk => chk.value);

    if (!nome || turnosIds.length === 0) {
        showToast("O nome do cargo e pelo menos um turno são obrigatórios.");
        if (!nome) validateInput(cargoNomeInput);
        return;
    }

    const { cargos } = store.getState();
    if (cargos.some(c => c.nome.toLowerCase() === nome.toLowerCase() && c.id !== editingCargoId)) {
        return showToast("Já existe um cargo com este nome.");
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

    if (!editingCargoId) {
        lastAddedCargoId = cargoData.id;
    }

    store.dispatch('SAVE_CARGO', cargoData);

    cancelEditCargo();
    showToast("Cargo salvo com sucesso!");
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
    
    // Assegura que o cálculo automático seja executado ao editar
    updateAutomaticoHorario();
    updateCargoRegrasExplicacao();

    btnSalvarCargo.textContent = "💾 Salvar Alterações";
    btnCancelarEdCargo.classList.remove("hidden");
    setCargoFormDirty(false);
    window.scrollTo(0, 0);
}

function cancelEditCargo() {
    editingCargoId = null;
    cargoNomeInput.value = "";
    validateInput(cargoNomeInput, true);
    $$('input[name="cargoTurno"]').forEach(chk => chk.checked = false);

    $$('input[name="cargoDias"]').forEach(chk => chk.checked = false);
    cargoInicioInput.value = "";
    cargoFimInput.value = "";
    
    $(`.toggle-btn[data-value="automatico"]`, cargoHorarioToggle).click();
    updateCargoRegrasExplicacao();

    btnSalvarCargo.textContent = "💾 Salvar Cargo";
    btnCancelarEdCargo.classList.add("hidden");
    setCargoFormDirty(false);

    cargoNomeInput.focus();
}

async function deleteCargo(id) {
    const { escalas } = store.getState();
    const escalasAfetadas = escalas.filter(e => e.cargoId === id);
    let additionalInfo = 'Os funcionários associados a ele ficarão sem cargo definido.';

    if (escalasAfetadas.length > 0) {
        additionalInfo += ` Além disso, <strong>${escalasAfetadas.length} escala(s) salva(s)</strong> associada(s) a este cargo serão <strong>excluídas permanentemente.</strong>`;
    }

    handleDeleteItem({
        id,
        itemName: 'Cargo',
        dispatchAction: 'DELETE_CARGO',
        additionalInfo
    });
}

// --- Delegação de Eventos ---
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
    btnSalvarCargo.addEventListener('click', saveCargoFromForm);
    btnCancelarEdCargo.addEventListener('click', cancelEditCargo);
    $("#btnLimparCargo").addEventListener('click', cancelEditCargo);
    tblCargosBody.addEventListener('click', handleCargosTableClick);
    
    // Listener para o container de checkboxes de turno
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

    renderDiasSemanaCargo();
    $(`.toggle-btn[data-value="automatico"]`, cargoHorarioToggle).click();
    setCargoFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initCargosPage);