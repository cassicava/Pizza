let editingCargoId = null;
let lastSavedCargoId = null;

let switchCargosTab = () => {};

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

const cargoMaxDiasConsecutivosInput = $("#cargoMaxDiasConsecutivos");
const cargoMinFolgasSabadosInput = $("#cargoMinFolgasSabados");
const cargoMinFolgasDomingosInput = $("#cargoMinFolgasDomingos");
const cargoMaxDiasLabel = $("label[for='cargoMaxDiasConsecutivos']");

const filtroCargosArquivadosInput = $("#filtroCargosArquivados");
const tblCargosArquivadosBody = $("#tblCargosArquivados tbody");


function setCargoFormDirty(isDirty) { dirtyForms.cargos = isDirty; }

[cargoNomeInput, cargoMaxDiasConsecutivosInput, cargoMinFolgasSabadosInput, cargoMinFolgasDomingosInput].forEach(input => {
    input.addEventListener("input", (e) => {
        const inputEl = e.target;
        if (inputEl === cargoNomeInput && inputEl.value.length > 0) {
            inputEl.value = inputEl.value.charAt(0).toUpperCase() + inputEl.value.slice(1);
        }
        if (inputEl === cargoMaxDiasConsecutivosInput && inputEl.max) {
             if (parseInt(inputEl.value) > parseInt(inputEl.max)) {
                inputEl.value = inputEl.max;
             }
        }
        validateInput(inputEl);
        setCargoFormDirty(true);
    });
});


filtroCargosInput.addEventListener("input", () => {
    renderCargos();
});
filtroCargosArquivadosInput.addEventListener("input", () => {
    renderCargosArquivados();
});


function renderTurnosSelects() {
    const { turnos } = store.getState();
    cargoTurnosContainer.innerHTML = '';
    
    const turnosAtivos = turnos.filter(t => !t.isSystem && t.status === 'ativo');

    if (turnosAtivos.length === 0) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.innerHTML = `Nenhum turno ativo cadastrado. <a href="#" onclick="go('turnos')">Cadastre ou reative um turno primeiro</a>.`;
        cargoTurnosContainer.appendChild(p);
        return;
    }

    const turnosOrdenados = [...turnosAtivos].sort((a, b) => a.nome.localeCompare(b.nome));

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

function updateAllocationRulesState() {
    const diasSelecionados = $$('input[name="cargoDias"]:checked').map(chk => chk.value);
    const trabalhaSabado = diasSelecionados.includes('sab');
    const trabalhaDomingo = diasSelecionados.includes('dom');

    let maxDiasPossivel = 7;
    if (!trabalhaSabado && !trabalhaDomingo) maxDiasPossivel = 5;
    else if (!trabalhaSabado || !trabalhaDomingo) maxDiasPossivel = 6;
    
    cargoMaxDiasConsecutivosInput.max = maxDiasPossivel;
    if (parseInt(cargoMaxDiasConsecutivosInput.value) > maxDiasPossivel) {
        cargoMaxDiasConsecutivosInput.value = maxDiasPossivel;
    }
    cargoMaxDiasLabel.textContent = `Máx. dias de trabalho consecutivos (máx: ${maxDiasPossivel})`;

    cargoMinFolgasSabadosInput.disabled = !trabalhaSabado;
    if (!trabalhaSabado) {
        cargoMinFolgasSabadosInput.value = 0;
        validateInput(cargoMinFolgasSabadosInput, true);
    }

    cargoMinFolgasDomingosInput.disabled = !trabalhaDomingo;
    if (!trabalhaDomingo) {
        cargoMinFolgasDomingosInput.value = 0;
        validateInput(cargoMinFolgasDomingosInput, true);
    }
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
            updateAllocationRulesState();
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

    const cargosAtivos = cargos.filter(c => c.status === 'ativo');
    const cargosFiltrados = cargosAtivos.filter(c => c.nome.toLowerCase().includes(filtro));
    const cargosOrdenados = [...cargosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

    if (cargosOrdenados.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        if (filtro.length === 0 && cargosAtivos.length === 0) {
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
        const numFuncionarios = funcionarios.filter(f => f.cargoId === c.id && f.status === 'ativo').length;
        const nomesTurnos = (c.turnosIds || [])
            .map(id => turnosMap[id])
            .filter(Boolean)
            .map(t => t.nome)
            .join(", ") || 'Nenhum';

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
        
        let regrasResumo = 'N/D';
        if (c.regras) {
            regrasResumo = `Max: ${c.regras.maxDiasConsecutivos || '?'}d / Sáb: ${c.regras.minFolgasSabados || '0'} / Dom: ${c.regras.minFolgasDomingos || '0'}`;
        }


        const tr = document.createElement("tr");
        tr.dataset.cargoId = c.id;
        
        tr.innerHTML = `
            <td>${c.nome} <span class="muted">(${numFuncionarios})</span></td>
            <td>${nomesTurnos}</td>
            <td>${funcionamento}</td>
            <td style="font-size: 0.8rem; white-space: nowrap;">${regrasResumo}</td> 
            <td>
                <button class="secondary" data-action="edit" data-id="${c.id}" aria-label="Editar o cargo ${c.nome}">✏️ Editar</button>
                <button class="danger" data-action="archive" data-id="${c.id}" aria-label="Arquivar o cargo ${c.nome}">🗃️ Arquivar</button>
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

function renderCargosArquivados() {
    const { cargos, turnos } = store.getState();
    const filtro = filtroCargosArquivadosInput.value.toLowerCase();
    tblCargosArquivadosBody.innerHTML = "";
    
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

    const cargosArquivados = cargos.filter(c => c.status === 'arquivado');
    const cargosFiltrados = cargosArquivados.filter(c => c.nome.toLowerCase().includes(filtro));
    const cargosOrdenados = [...cargosFiltrados].sort((a, b) => a.nome.localeCompare(b.nome));

    if (cargosOrdenados.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        if (filtro.length === 0 && cargosArquivados.length === 0) {
            cell.innerHTML = `<div class="empty-state" style="padding: 24px;"><div class="empty-state-icon">🗃️</div>
                <h3>Nenhum Cargo Arquivado</h3>
                <p>Cargos arquivados aparecerão aqui.</p>
            </div>`;
        } else {
            cell.textContent = `Nenhum cargo arquivado encontrado com o termo "${filtro}".`;
            cell.className = 'muted center';
        }
        row.appendChild(cell);
        tblCargosArquivadosBody.appendChild(row);
        parseEmojisInElement(tblCargosArquivadosBody);
        return;
    }

    cargosOrdenados.forEach(c => {
        const nomesTurnos = (c.turnosIds || [])
            .map(id => turnosMap[id])
            .filter(Boolean)
            .map(t => t.nome)
            .join(", ") || 'Nenhum';

        let funcionamento = 'Não definido';
        if (c.regras && c.regras.dias.length > 0) {
            const dias = c.regras.dias.map(d => DIAS_SEMANA.find(dia => dia.id === d)?.abrev).join(', ') || '';
            const tipoHorario = c.regras.tipoHorario || 'automatico';
            let horario = 'N/D';
            if (tipoHorario === '24h') horario = '24h';
            else if (c.regras.inicio && c.regras.fim) horario = `${c.regras.inicio}-${c.regras.fim}`;
            funcionamento = `${dias} (${horario})`;
        }
        
        const tr = document.createElement("tr");
        tr.dataset.cargoId = c.id;
        tr.style.opacity = '0.7';
        
        tr.innerHTML = `
            <td>${c.nome}</td>
            <td>${nomesTurnos}</td>
            <td>${funcionamento}</td>
            <td>
                <button class="secondary" data-action="unarchive" data-id="${c.id}" aria-label="Reativar o cargo ${c.nome}">🔄 Reativar</button>
            </td>
        `;
        tblCargosArquivadosBody.appendChild(tr);
    });
    parseEmojisInElement(tblCargosArquivadosBody);
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
    
    if (!cargoMaxDiasConsecutivosInput.disabled && !validateInput(cargoMaxDiasConsecutivosInput)) isValid = false;
    if (!cargoMinFolgasSabadosInput.disabled && !validateInput(cargoMinFolgasSabadosInput)) isValid = false;
    if (!cargoMinFolgasDomingosInput.disabled && !validateInput(cargoMinFolgasDomingosInput)) isValid = false;


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
    
    const { cargos, equipes, funcionarios, turnos } = store.getState();
    if (cargos.some(c => c.nome.toLowerCase() === nome.toLowerCase() && c.id !== editingCargoId)) {
        return showToast("Já existe um cargo com este nome.");
    }
    
    if (editingCargoId) {
        const cargoOriginal = cargos.find(c => c.id === editingCargoId);
        
        const turnosAtivosStore = turnos.filter(t => t.status === 'ativo').map(t => t.id);
        const turnosAtivosSelecionados = turnosIds.filter(id => turnosAtivosStore.includes(id));

        const turnosRemovidosIds = cargoOriginal.turnosIds
            .filter(id => turnosAtivosStore.includes(id)) 
            .filter(id => !turnosAtivosSelecionados.includes(id));
        
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
            f.status === 'ativo' &&
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
    
    const turnosArquivadosNoCargo = editingCargoId 
        ? cargos.find(c => c.id === editingCargoId).turnosIds.filter(id => !turnos.some(t => t.id === id && t.status === 'ativo'))
        : [];
    
    const turnosIdsFinais = [...new Set([...turnosIds, ...turnosArquivadosNoCargo])];


    const cargoData = {
        id: editingCargoId || uid(),
        nome,
        turnosIds: turnosIdsFinais,
        regras: {
            dias: $$('input[name="cargoDias"]:checked').map(chk => chk.value),
            tipoHorario: cargoTipoHorarioHiddenInput.value,
            inicio: cargoInicioInput.value,
            fim: cargoFimInput.value,
            maxDiasConsecutivos: parseInt(cargoMaxDiasConsecutivosInput.value, 10) || 6,
            minFolgasSabados: parseInt(cargoMinFolgasSabadosInput.value, 10) || 0,
            minFolgasDomingos: parseInt(cargoMinFolgasDomingosInput.value, 10) || 0,
        },
        status: 'ativo'
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
        
        cargoMaxDiasConsecutivosInput.value = cargo.regras.maxDiasConsecutivos ?? 6;
        cargoMinFolgasSabadosInput.value = cargo.regras.minFolgasSabados ?? 1;
        cargoMinFolgasDomingosInput.value = cargo.regras.minFolgasDomingos ?? 1;
    }
    
    updateAutomaticoHorario();
    updateCargoRegrasExplicacao();
    updateAllocationRulesState();

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
    
    cargoMaxDiasConsecutivosInput.value = "6";
    cargoMinFolgasSabadosInput.value = "1";
    cargoMinFolgasDomingosInput.value = "1";
    
    $$('.invalid-fieldset', pageCargos).forEach(el => el.classList.remove('invalid-fieldset'));
    $$('.invalid', pageCargos).forEach(el => el.classList.remove('invalid'));

    $(`.toggle-btn[data-value="automatico"]`, cargoHorarioToggle).click();
    updateCargoRegrasExplicacao();
    updateAllocationRulesState();

    btnSalvarCargo.textContent = "💾 Salvar Cargo";
    formTabButtonCargos.innerHTML = "📝 Novo Cargo";
    parseEmojisInElement(btnSalvarCargo);
    setCargoFormDirty(false);
}

async function archiveCargo(id) {
    const { funcionarios, equipes } = store.getState();
    const blockingIssues = [];

    const funcsUsando = funcionarios.filter(f => f.cargoId === id && f.status === 'ativo');
    if (funcsUsando.length > 0) {
        const nomesFuncs = funcsUsando.map(f => `<strong>${f.nome}</strong>`).join(', ');
        blockingIssues.push(`Está sendo utilizado pelo(s) funcionário(s) ativo(s): ${nomesFuncs}.`);
    }
    
    const equipesUsando = equipes.filter(e => e.cargoId === id);
    if (equipesUsando.length > 0) {
        const nomesEquipes = equipesUsando.map(e => `<strong>${e.nome}</strong>`).join(', ');
        blockingIssues.push(`Está sendo utilizado pela(s) equipe(s): ${nomesEquipes}.`);
    }


    if (blockingIssues.length > 0) {
        const messageHTML = `
            <p>Este cargo não pode ser arquivado pelos seguintes motivos:</p>
            <ul>
                ${blockingIssues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
            <p>Por favor, altere o cargo dos funcionários ou equipes ativas antes de arquivá-lo.</p>
        `;
        showInfoModal({
            title: "Arquivamento Bloqueado",
            contentHTML: messageHTML
        });
        return;
    }

    const { confirmed } = await showConfirm({
        title: "Arquivar Cargo?",
        message: "O cargo não aparecerá mais nas listas de seleção, mas seu histórico em escalas salvas será mantido. Deseja continuar?",
        confirmText: "Sim, Arquivar"
    });

    if (confirmed) {
        store.dispatch('ARCHIVE_CARGO', id);
        showToast(`Cargo arquivado com sucesso.`, 'success');
        renderCargos();
        renderCargosArquivados();
    }
}

async function unarchiveCargo(id) {
    store.dispatch('UNARCHIVE_CARGO', id);
    showToast(`Cargo reativado com sucesso.`, 'success');
    renderCargos();
    renderCargosArquivados();
}


function handleCargosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;

    const { action, id } = target.dataset;
    if (action === 'edit') {
        editCargoInForm(id);
    } else if (action === 'archive') {
        archiveCargo(id);
    }
}

function handleCargosArquivadosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'unarchive') {
        unarchiveCargo(id);
    }
}


function initCargosPage() {
    switchCargosTab = setupTabbedPanel('#page-cargos .painel-gerenciamento', 'cargos', (tabId) => {
        const addBtn = $('.btn-add-new', pageCargos);
        if (addBtn) addBtn.style.display = (tabId === 'gerenciar' || tabId === 'arquivados') ? 'inline-flex' : 'none';

        if (tabId === 'gerenciar') {
            cancelEditCargo();
            renderCargos();
            filtroCargosInput.value = '';
        } else if (tabId === 'arquivados') {
            cancelEditCargo();
            renderCargosArquivados();
            filtroCargosArquivadosInput.value = '';
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
    tblCargosArquivadosBody.addEventListener('click', handleCargosArquivadosTableClick);
    
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
    updateAllocationRulesState();
    setCargoFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initCargosPage);