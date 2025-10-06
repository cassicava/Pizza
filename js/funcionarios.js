/**************************************
 * 👨‍⚕️ Funcionários
 **************************************/

let editingFuncId = null;
let lastAddedFuncId = null;
let funcDisponibilidadeTemporaria = {};

// --- Cache de Elementos DOM ---
const funcNomeInput = $("#funcNome");
const funcDocumentoInput = $("#funcDocumento");
const funcCargoSelect = $("#funcCargo");
const funcContratoInput = $("#funcContrato");
const funcPeriodoHorasInput = $("#funcPeriodoHoras");
const funcCargaHorariaInput = $("#funcCargaHoraria");
const funcHoraExtraInput = $("#funcHoraExtra");
const funcTurnosContainer = $("#funcTurnosContainer");
const filtroFuncionariosInput = $("#filtroFuncionarios");
const tblFuncionariosBody = $("#tblFuncionarios tbody");
const btnSalvarFunc = $("#btnSalvarFunc");
const btnCancelarEdFunc = $("#btnCancelarEdFunc");
const contratoExplicacaoEl = $("#contratoExplicacao");
const contratoToggleGroup = $("#contratoToggleGroup");
const periodoHorasToggleGroup = $("#periodoHorasToggleGroup");
const horaExtraToggleGroup = $("#horaExtraToggleGroup");

const SEM_CARGO_DEFINIDO = "Sem Cargo Definido";

function setFuncFormDirty(isDirty) {
    dirtyForms.funcionarios = isDirty;
}

// --- Lógicas dos Toggles ---
function setupToggleGroup(group, inputEl, explanationEl = null, explanationTexts = null) {
    $$('.toggle-btn', group).forEach(button => {
        button.addEventListener('click', () => {
            group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const value = button.dataset.value;
            if (inputEl) inputEl.value = value;
            if (explanationEl && explanationTexts) {
                explanationEl.innerHTML = `<div>${explanationTexts[value]}</div>`;
            }
            setFuncFormDirty(true);
        });
    });
}

// --- Lógica de Renderização e Interação da Disponibilidade ---

function renderFuncTurnosForCargo() {
    const { cargos, turnos } = store.getState();
    const cargoId = funcCargoSelect.value;
    funcTurnosContainer.innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;
    const placeholder = $(".turno-placeholder", funcTurnosContainer);

    if (!cargoId) {
        placeholder.style.display = 'block';
        return;
    }

    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo || !cargo.turnosIds || cargo.turnosIds.length === 0) {
        placeholder.style.display = 'block';
        placeholder.querySelector('p').textContent = 'Nenhum turno associado a este cargo.';
        return;
    }

    placeholder.style.display = 'none';

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    turnosDoCargo.forEach(t => {
        const isTurnoSelecionado = !!funcDisponibilidadeTemporaria[t.id];

        const item = document.createElement('div');
        item.className = 'turno-disponibilidade-item';
        item.dataset.turnoId = t.id;
        item.classList.toggle('selecionado', isTurnoSelecionado);

        const diasHtml = DIAS_SEMANA.map(d => {
            let classeDeEstado = '';
            if (isTurnoSelecionado) {
                const estado = funcDisponibilidadeTemporaria[t.id]?.[d.id];
                if (estado === 'disponivel') {
                    classeDeEstado = 'dia-disponivel';
                } else if (estado === 'preferencial') {
                    classeDeEstado = 'dia-preferencial';
                }
            }
            return `
                <span class="dia-selecionavel ${classeDeEstado}" data-dia-id="${d.id}" title="${d.nome}">
                    ${d.abrev}
                </span>
            `;
        }).join('');

        item.innerHTML = `
            <div class="turno-disponibilidade-header">
                <input type="checkbox" name="turnoPrincipal" value="${t.id}" ${isTurnoSelecionado ? 'checked' : ''}>
                <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
                <div class="turno-info">
                    <strong>${t.nome}</strong> (${t.inicio}-${t.fim})
                </div>
            </div>
            <div class="turno-disponibilidade-dias">
                ${diasHtml}
            </div>
        `;
        funcTurnosContainer.appendChild(item);
    });
}


// --- Funções de CRUD ---
[funcNomeInput, funcCargaHorariaInput, funcDocumentoInput].forEach(input => {
    input.addEventListener("input", (e) => {
        if (e.target === funcNomeInput && e.target.value.length > 0) {
            e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
        }
        validateInput(e.target);
        setFuncFormDirty(true);
    });
});

funcCargoSelect.addEventListener("change", (e) => {
    validateInput(e.target);
    funcDisponibilidadeTemporaria = {};
    renderFuncTurnosForCargo();
    setFuncFormDirty(true);
});

filtroFuncionariosInput.addEventListener("input", () => { renderFuncs(); });

function renderFuncCargoSelect() {
    const { cargos } = store.getState();
    funcCargoSelect.innerHTML = "<option value=''>Selecione um cargo</option>";

    if (cargos.length === 0) {
        const fieldset = funcCargoSelect.closest('fieldset');
        if (fieldset) {
            let p = fieldset.querySelector('.muted-link-helper');
            if (!p) {
                p = document.createElement('p');
                p.className = 'muted-link-helper muted';
                p.style.marginTop = '8px';
                fieldset.appendChild(p);
            }
            p.innerHTML = `Nenhum cargo cadastrado. <a href="#" onclick="go('cargos')">Cadastre um cargo primeiro</a>.`;
        }
        return;
    }

    const fieldset = funcCargoSelect.closest('fieldset');
    const p = fieldset?.querySelector('.muted-link-helper');
    if (p) p.remove();

    const cargosOrdenados = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        funcCargoSelect.appendChild(o);
    });
}


function renderFuncs() {
    const { funcionarios, cargos, turnos } = store.getState();
    const filtro = filtroFuncionariosInput.value.toLowerCase();
    const mostrarArquivados = $("#mostrarArquivadosCheck")?.checked || false;

    tblFuncionariosBody.innerHTML = "";

    const funcsFiltrados = funcionarios.filter(f => {
        const correspondeFiltro = f.nome.toLowerCase().includes(filtro);
        const correspondeStatus = mostrarArquivados ? true : f.status !== 'arquivado';
        return correspondeFiltro && correspondeStatus;
    });

    const colspan = 6; 

    if (funcsFiltrados.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = colspan;
        if (funcionarios.filter(f => f.status !== 'arquivado').length === 0 && !mostrarArquivados) {
            emptyCell.innerHTML = `<div class="empty-state">
                                <div class="empty-state-icon">👨‍⚕️</div>
                                <h3>Nenhum Funcionário Cadastrado</h3>
                                <p>Comece a cadastrar funcionários para poder gerar escalas.</p>
                               </div>`;
        } else {
            emptyCell.textContent = `Nenhum funcionário encontrado.`;
            emptyCell.className = 'muted center';
        }
        emptyRow.appendChild(emptyCell);
        tblFuncionariosBody.appendChild(emptyRow);
        return;
    }

    const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

    const agrupados = funcsFiltrados.reduce((acc, func) => {
        const cargoNome = cargosMap[func.cargoId] || SEM_CARGO_DEFINIDO;
        if (!acc[cargoNome]) acc[cargoNome] = [];
        acc[cargoNome].push(func);
        return acc;
    }, {});

    const cargosOrdenados = Object.keys(agrupados).sort((a, b) => a.localeCompare(b));

    for (const cargoNome of cargosOrdenados) {
        const funcsDoGrupo = agrupados[cargoNome].sort((a, b) => a.nome.localeCompare(b.nome));

        const headerRow = document.createElement('tr');
        const headerCell = document.createElement('th');
        headerCell.colSpan = colspan;
        headerCell.className = `group-header ${cargoNome === SEM_CARGO_DEFINIDO ? 'warning' : ''}`;
        headerCell.textContent = cargoNome;
        headerRow.appendChild(headerCell);
        tblFuncionariosBody.appendChild(headerRow);

        funcsDoGrupo.forEach(f => {
            const isArquivado = f.status === 'arquivado';
            const nomesTurnos = Object.keys(f.disponibilidade || {}).map(id => turnosMap[id]?.nome || "").join(", ") || "Nenhum";
            const cargaHoraria = f.cargaHoraria ? `${f.cargaHoraria}h ${f.periodoHoras === 'mensal' ? '/mês' : '/semana'}` : 'N/D';
            const horaExtra = f.fazHoraExtra ? 'Sim' : 'Não';
            const tipoContrato = f.tipoContrato === 'pj' ? 'Prestador' : 'CLT';

            const row = document.createElement('tr');
            row.dataset.funcId = f.id;
            if (isArquivado) row.style.opacity = '0.6';

            const acoes = isArquivado 
            ? `
                <button class="secondary" data-action="unarchive" aria-label="Reativar ${f.nome}">🔄 Reativar</button>
                <button class="danger" data-action="delete" aria-label="Excluir permanentemente ${f.nome}">🔥 Excluir</button>
            ` 
            : `
                <button class="secondary" data-action="edit" aria-label="Editar ${f.nome}">✏️ Editar</button>
                <button class="danger" data-action="archive" aria-label="Arquivar ${f.nome}">🗄️ Arquivar</button>
            `;

            row.innerHTML = `
                <td>
                    ${f.nome} ${isArquivado ? '(Arquivado)' : ''}
                    <br>
                    <small class="muted">${f.documento || '---'}</small>
                </td>
                <td>${tipoContrato}</td>
                <td>${cargaHoraria}</td>
                <td>${horaExtra}</td>
                <td>${nomesTurnos}</td>
                <td>${acoes}</td>
            `;
            tblFuncionariosBody.appendChild(row);
        });
    }

    if (lastAddedFuncId) {
        tblFuncionariosBody.querySelector(`tr[data-func-id="${lastAddedFuncId}"]`)?.classList.add('new-item');
        lastAddedFuncId = null;
    }
}

function validateFuncForm() {
    $$('.invalid-label', funcNomeInput.closest('.card')).forEach(el => el.classList.remove('invalid-label'));
    const isNomeValid = validateInput(funcNomeInput);
    const isCargoValid = validateInput(funcCargoSelect);
    const isCargaValid = validateInput(funcCargaHorariaInput);

    return isNomeValid && isCargoValid && isCargaValid;
}

function saveFuncFromForm() {
    if (!validateFuncForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        focusFirstInvalidInput('#page-funcionarios .card');
        return;
    }
    const { funcionarios } = store.getState();
    const documento = funcDocumentoInput.value.trim();
    if (documento && funcionarios.some(f => f.documento?.toLowerCase() === documento.toLowerCase() && f.id !== editingFuncId)) {
        return showToast("O número do documento já está em uso por outro funcionário.");
    }

    const disponibilidadeFinal = {};
    const preferenciasFinal = {};
    for (const turnoId in funcDisponibilidadeTemporaria) {
        const dias = funcDisponibilidadeTemporaria[turnoId];
        const diasDisponiveis = [];
        const diasPreferenciais = [];

        for (const diaId in dias) {
            if (dias[diaId] === 'disponivel' || dias[diaId] === 'preferencial') {
                diasDisponiveis.push(diaId);
            }
            if (dias[diaId] === 'preferencial') {
                diasPreferenciais.push(diaId);
            }
        }
        
        disponibilidadeFinal[turnoId] = diasDisponiveis;
        
        if (diasPreferenciais.length > 0) {
            preferenciasFinal[turnoId] = diasPreferenciais;
        }
    }

    const funcData = {
        id: editingFuncId || uid(),
        nome: funcNomeInput.value.trim(),
        cargoId: funcCargoSelect.value,
        tipoContrato: funcContratoInput.value,
        cargaHoraria: funcCargaHorariaInput.value,
        periodoHoras: funcPeriodoHorasInput.value,
        fazHoraExtra: funcHoraExtraInput.value === 'sim',
        documento,
        disponibilidade: disponibilidadeFinal,
        preferencias: preferenciasFinal,
    };

    if (!editingFuncId) {
        lastAddedFuncId = funcData.id;
    }

    store.dispatch('SAVE_FUNCIONARIO', funcData);

    cancelEditFunc();
    showToast("Funcionário salvo com sucesso!");
}

function editFuncInForm(id) {
    const { funcionarios } = store.getState();
    const func = funcionarios.find(f => f.id === id);
    if (!func || func.status === 'arquivado') return;

    cancelEditFunc();
    editingFuncId = id;

    funcNomeInput.value = func.nome;
    funcCargoSelect.value = func.cargoId;
    funcCargaHorariaInput.value = func.cargaHoraria || '';
    funcDocumentoInput.value = func.documento || '';

    $(`.toggle-btn[data-value="${func.tipoContrato || 'clt'}"]`, contratoToggleGroup).click();
    $(`.toggle-btn[data-value="${func.periodoHoras || 'semanal'}"]`, periodoHorasToggleGroup).click();
    $(`.toggle-btn[data-value="${func.fazHoraExtra ? 'sim' : 'nao'}"]`, horaExtraToggleGroup).click();

    funcDisponibilidadeTemporaria = {};
    const disponibilidade = func.disponibilidade || {};
    const preferencias = func.preferencias || {};
    for (const turnoId in disponibilidade) {
        funcDisponibilidadeTemporaria[turnoId] = {};
        const diasDisponiveis = disponibilidade[turnoId] || [];
        const diasPreferenciais = preferencias[turnoId] || [];
        diasDisponiveis.forEach(diaId => {
            funcDisponibilidadeTemporaria[turnoId][diaId] = 'disponivel';
        });
        diasPreferenciais.forEach(diaId => {
            funcDisponibilidadeTemporaria[turnoId][diaId] = 'preferencial';
        });
    }

    renderFuncTurnosForCargo();

    btnSalvarFunc.textContent = "💾 Salvar Alterações";
    btnCancelarEdFunc.classList.remove("hidden");
    setFuncFormDirty(false);
    window.scrollTo(0, 0);
}

function cancelEditFunc() {
    editingFuncId = null;
    funcNomeInput.value = "";
    funcCargoSelect.value = "";
    funcCargaHorariaInput.value = "";
    funcDocumentoInput.value = "";

    $$('.invalid', funcNomeInput.closest('.card')).forEach(el => el.classList.remove('invalid'));
    $$('.invalid-label', funcNomeInput.closest('.card')).forEach(el => el.classList.remove('invalid-label'));

    $(`.toggle-btn[data-value="clt"]`, contratoToggleGroup).click();
    $(`.toggle-btn[data-value="semanal"]`, periodoHorasToggleGroup).click();
    $(`.toggle-btn[data-value="nao"]`, horaExtraToggleGroup).click();

    funcDisponibilidadeTemporaria = {};
    funcTurnosContainer.innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;

    btnSalvarFunc.textContent = "💾 Salvar Funcionário";
    btnCancelarEdFunc.classList.add("hidden");
    setFuncFormDirty(false);

    funcNomeInput.focus();
}

async function archiveFuncionario(id) {
    const confirmado = await showConfirm({
        title: "Arquivar Funcionário?",
        message: "O funcionário não aparecerá mais nas listas para criação de novas escalas, mas seu histórico em escalas salvas será mantido. Você pode reativá-lo a qualquer momento."
    });
    if(confirmado) {
        store.dispatch('ARCHIVE_FUNCIONARIO', id);
        showToast("Funcionário arquivado.");
    }
}

async function unarchiveFuncionario(id) {
    store.dispatch('UNARCHIVE_FUNCIONARIO', id);
    showToast("Funcionário reativado com sucesso.");
}

async function deleteFuncionario(id) {
    const { escalas } = store.getState();
    const isInEscalaSalva = escalas.some(escala =>
        escala.slots.some(slot => slot.assigned === id)
    );

    if (isInEscalaSalva) {
        showInfoModal({
            title: "Exclusão Permanente Bloqueada",
            contentHTML: "<p>Este funcionário não pode ser excluído permanentemente porque está registrado em uma ou mais escalas salvas. Para preservar o histórico, a exclusão não é permitida.</p>"
        });
        return;
    }

    handleDeleteItem({
        id: id,
        itemName: 'Funcionário',
        dispatchAction: 'DELETE_FUNCIONARIO',
        additionalInfo: 'Esta ação é definitiva e não pode ser desfeita.'
    });
}


// --- Delegação de Eventos ---
function handleFuncionariosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    
    const parentRow = target.closest('tr');
    if (!parentRow || !parentRow.dataset.funcId) return;
    
    const { action } = target.dataset;
    const id = parentRow.dataset.funcId;

    if (action === 'edit') editFuncInForm(id);
    else if (action === 'archive') archiveFuncionario(id);
    else if (action === 'unarchive') unarchiveFuncionario(id);
    else if (action === 'delete') deleteFuncionario(id);
}

function handleDisponibilidadeGridClick(event) {
    const header = event.target.closest('.turno-disponibilidade-header');
    const diaSpan = event.target.closest('.dia-selecionavel');

    if (header) {
        const item = header.closest('.turno-disponibilidade-item');
        const turnoId = item.dataset.turnoId;
        const chkPrincipal = header.querySelector('input[name="turnoPrincipal"]');
        
        if (event.target.tagName !== 'INPUT') {
            chkPrincipal.checked = !chkPrincipal.checked;
        }
        
        const isChecked = chkPrincipal.checked;
        item.classList.toggle('selecionado', isChecked);

        if (isChecked) {
            funcDisponibilidadeTemporaria[turnoId] = {};
            DIAS_SEMANA.forEach(d => {
                funcDisponibilidadeTemporaria[turnoId][d.id] = 'disponivel';
            });
        } else {
            delete funcDisponibilidadeTemporaria[turnoId];
        }
        renderFuncTurnosForCargo();
        setFuncFormDirty(true);
    }

    if (diaSpan) {
        const item = diaSpan.closest('.turno-disponibilidade-item');
        const chkPrincipal = item.querySelector('input[name="turnoPrincipal"]');
        if (chkPrincipal.checked) {
            const turnoId = item.dataset.turnoId;
            const diaId = diaSpan.dataset.diaId;
            
            const estadoAtual = funcDisponibilidadeTemporaria[turnoId]?.[diaId];
            let novoEstado = 'disponivel'; 

            if (estadoAtual === 'disponivel') {
                novoEstado = 'preferencial';
            } else if (estadoAtual === 'preferencial') {
                novoEstado = undefined; 
            }

            if (novoEstado) {
                funcDisponibilidadeTemporaria[turnoId][diaId] = novoEstado;
            } else {
                delete funcDisponibilidadeTemporaria[turnoId][diaId];
            }

            diaSpan.classList.remove('dia-disponivel', 'dia-preferencial');
            if (novoEstado) {
                diaSpan.classList.add(`dia-${novoEstado}`);
            }
            
            setFuncFormDirty(true);
        }
    }
}


function initFuncionariosPage() {
    const filtroContainer = filtroFuncionariosInput.parentElement;
    if (filtroContainer && !$("#mostrarArquivadosCheck")) {
        const checkWrapper = document.createElement('label');
        checkWrapper.className = 'check-inline';
        checkWrapper.innerHTML = `<input type="checkbox" id="mostrarArquivadosCheck"> Mostrar arquivados`;
        checkWrapper.style.flexGrow = '0';
        filtroContainer.appendChild(checkWrapper);
        $("#mostrarArquivadosCheck").addEventListener('change', renderFuncs);
    }

    btnSalvarFunc.addEventListener('click', saveFuncFromForm);
    btnCancelarEdFunc.addEventListener('click', cancelEditFunc);
    $("#btnLimparFunc").addEventListener('click', cancelEditFunc);
    tblFuncionariosBody.addEventListener('click', handleFuncionariosTableClick);
    
    funcTurnosContainer.addEventListener('click', handleDisponibilidadeGridClick);
    
    // --- INÍCIO DA ALTERAÇÃO ---
    // Atualiza os textos para não incluírem a palavra "Funcionários"
    setupToggleGroup(contratoToggleGroup, funcContratoInput, contratoExplicacaoEl, {
        'clt': '<strong>CLT / Concursados</strong> seguirão rigorosamente as regras de descanso obrigatório.',
        'pj': '<strong>Prestadores de Serviço</strong> terão as regras de descanso ignoradas.'
    });
    // --- FIM DA ALTERAÇÃO ---
    setupToggleGroup(periodoHorasToggleGroup, funcPeriodoHorasInput);
    setupToggleGroup(horaExtraToggleGroup, funcHoraExtraInput);

    $(`.toggle-btn[data-value="clt"]`, contratoToggleGroup).click();
    $(`.toggle-btn[data-value="semanal"]`, periodoHorasToggleGroup).click();
    $(`.toggle-btn[data-value="nao"]`, horaExtraToggleGroup).click();
    setFuncFormDirty(false);
}

document.addEventListener('DOMContentLoaded', initFuncionariosPage);