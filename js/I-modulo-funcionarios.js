/**************************************
 * 👨‍⚕️ Funcionários
 **************************************/

let editingFuncId = null;
let lastSavedFuncId = null;

// Referência à função de troca de abas, será redefinida na inicialização
let switchFuncionariosTab = (tabId) => { console.warn("switchFuncionariosTab não inicializada"); };

// --- Cache de Elementos DOM ---
const pageFuncionarios = $("#page-funcionarios");
const funcNomeInput = $("#funcNome");
const funcDocumentoInput = $("#funcDocumento");
const funcCargoSelect = $("#funcCargo");
const funcContratoInput = $("#funcContrato");
const funcPeriodoHorasInput = $("#funcPeriodoHoras");
const funcCargaHorariaInput = $("#funcCargaHoraria");
const funcHoraExtraInput = $("#funcHoraExtra");
const funcTurnosContainer = $("#funcTurnosContainer");
const filtroFuncionariosInput = $("#filtroFuncionarios"); // Filtro para ativos
const filtroFuncionariosArquivadosInput = $("#filtroFuncionariosArquivados"); // Novo filtro para arquivados
const tblFuncionariosBody = $("#tblFuncionarios tbody"); // Tabela de ativos
const tblFuncionariosArquivadosBody = $("#tblFuncionariosArquivados tbody"); // Nova tabela de arquivados
const btnSalvarFunc = $("#btnSalvarFunc");
const btnCancelarFunc = $("#btnCancelarFunc");
const contratoExplicacaoEl = $("#contratoExplicacao");
const contratoToggleGroup = $("#contratoToggleGroup");
const periodoHorasToggleGroup = $("#periodoHorasToggleGroup");
const horaExtraToggleGroup = $("#horaExtraToggleGroup");
const medicaoCargaToggleGroup = $("#medicaoCargaToggleGroup");
const funcMedicaoCargaInput = $("#funcMedicaoCarga");
const funcCargaHorariaLabel = $("#funcCargaHorariaLabel");
const funcMetaExplicacao = $("#funcMetaExplicacao");
const formTabButtonFuncionarios = $('.painel-tab-btn[data-tab="formulario"]', pageFuncionarios);
// Cache para as novas abas
const gerenciarTabButton = $('.painel-tab-btn[data-tab="gerenciar"]', pageFuncionarios);
const arquivadosTabButton = $('.painel-tab-btn[data-tab="arquivados"]', pageFuncionarios);

const SEM_CARGO_DEFINIDO = "⚠️ Sem Cargo Definido";
// Objeto temporário para guardar a disponibilidade enquanto edita o formulário
let funcDisponibilidadeTemporaria = {};

function setFuncFormDirty(isDirty) {
    dirtyForms.funcionarios = isDirty;
}

// --- Lógicas dos Toggles ---
function setupToggleGroup(group, inputEl, explanationEl = null, explanationTexts = null) {
    // Garante que group e inputEl existam
    if (!group || !inputEl) return;
    $$('.toggle-btn', group).forEach(button => {
        button.addEventListener('click', () => {
            group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const value = button.dataset.value;
            inputEl.value = value;
            if (explanationEl && explanationTexts && explanationTexts[value]) { // Verifica se explanationTexts[value] existe
                explanationEl.innerHTML = `<div>${explanationTexts[value]}</div>`;
            } else if (explanationEl) {
                explanationEl.innerHTML = ''; // Limpa se não houver texto
            }
            setFuncFormDirty(true);
             // Chama a atualização da explicação da meta se for um toggle relacionado
             if (group === medicaoCargaToggleGroup || group === periodoHorasToggleGroup) {
                updateFuncMetaExplicacao();
            }
        });
    });
}


function updateFuncMetaExplicacao() {
    // Garante que os elementos existam
    if (!funcMedicaoCargaInput || !funcPeriodoHorasInput || !funcCargaHorariaInput || !funcMetaExplicacao) return;

    const medicaoValor = funcMedicaoCargaInput.value;
    const periodoValor = funcPeriodoHorasInput.value;
    const cargaValor = funcCargaHorariaInput.value;

    let explicacaoRegra = '';
    if (medicaoValor === 'horas') {
        explicacaoRegra = 'O gerador tentará atingir a meta de horas (semanal/mensal). Ideal para contratos com carga horária fixa.';
    } else { // turnos
        explicacaoRegra = 'O gerador focará no número exato de turnos (plantões), sem se importar com a duração de cada um. Ideal para plantonistas.';
    }

    let resumoMeta = '';
    if (cargaValor && cargaValor > 0) {
        const medicaoTexto = medicaoValor === 'horas' ? 'horas' : (cargaValor == 1 ? 'turno' : 'turnos');
        const periodoTexto = periodoValor === 'semanal' ? (medicaoValor === 'horas' ? 'semanais' : 'semanal') : (medicaoValor === 'horas' ? 'mensais' : 'mensal');
        resumoMeta = `<strong>Resumo:</strong> A meta do funcionário será de <strong>${cargaValor} ${medicaoTexto} ${periodoTexto}</strong>.`;
    } else {
        resumoMeta = 'Defina a meta de trabalho para ver um resumo.';
    }

    funcMetaExplicacao.innerHTML = `<div>${explicacaoRegra}<br><br>${resumoMeta}</div>`;
}


// --- Lógica de Renderização e Interação da Disponibilidade ---

function renderFuncTurnosForCargo() {
    // Garante que os elementos existam
    if (!funcCargoSelect || !funcTurnosContainer) return;

    const { cargos, turnos } = store.getState();
    const cargoId = funcCargoSelect.value;
    funcTurnosContainer.innerHTML = ''; // Limpa antes de renderizar

    const placeholder = document.createElement('div');
    placeholder.className = 'turno-placeholder';
    placeholder.innerHTML = `<p>Selecione um cargo para ver os turnos disponíveis.</p>`;
    funcTurnosContainer.appendChild(placeholder);


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

    placeholder.style.display = 'none'; // Esconde o placeholder se houver turnos

    const turnosDoCargo = turnos.filter(t => cargo.turnosIds.includes(t.id) && !t.isSystem) // Não mostra turnos de sistema aqui
        .sort((a, b) => a.nome.localeCompare(b.nome));

    turnosDoCargo.forEach(t => {
        // Verifica se o turno está selecionado no estado temporário
        const isTurnoSelecionado = !!funcDisponibilidadeTemporaria[t.id];

        const item = document.createElement('div');
        item.className = 'turno-disponibilidade-item';
        item.dataset.turnoId = t.id;
        item.classList.toggle('selecionado', isTurnoSelecionado);

        // Gera o HTML para os dias da semana
        const diasHtml = DIAS_SEMANA.map(d => {
            let classeDeEstado = '';
            // Verifica o estado do dia (disponivel/preferencial) no estado temporário
            if (isTurnoSelecionado) {
                const estado = funcDisponibilidadeTemporaria[t.id]?.[d.id];
                if (estado === 'disponivel') {
                    classeDeEstado = 'dia-disponivel';
                } else if (estado === 'preferencial') {
                    classeDeEstado = 'dia-preferencial';
                }
            }

            // Verifica se o cargo opera neste dia para desabilitar visualmente
            const isCargoOperatingDay = cargo?.regras?.dias.includes(d.id);
            const disabledStyle = !isCargoOperatingDay ? 'style="opacity: 0.4; cursor: not-allowed;"' : '';
            const disabledTitle = !isCargoOperatingDay ? 'O cargo não opera neste dia' : d.nome;

            return `
                <span class="dia-selecionavel ${classeDeEstado}" data-dia-id="${d.id}" title="${disabledTitle}" ${disabledStyle}>
                    ${d.abrev}
                </span>
            `;
        }).join('');

        // Monta o HTML do item do turno
        item.innerHTML = `
            <div class="turno-disponibilidade-header">
                <input type="checkbox" name="turnoPrincipal" value="${t.id}" ${isTurnoSelecionado ? 'checked' : ''}>
                <span class="color-dot" style="background-color: ${t.cor || '#e2e8f0'}"></span>
                <div class="turno-info">
                    <strong>${t.nome}</strong> (${t.inicio || 'N/A'}-${t.fim || 'N/A'})
                </div>
            </div>
            <div class="turno-disponibilidade-dias">
                ${diasHtml}
            </div>
        `;
        funcTurnosContainer.appendChild(item);
    });
     // Adiciona listener para a grid de disponibilidade APÓS renderizar
     funcTurnosContainer.removeEventListener('click', handleDisponibilidadeGridClick); // Remove listener antigo
     funcTurnosContainer.addEventListener('click', handleDisponibilidadeGridClick);   // Adiciona novo
}


// --- Funções de CRUD ---
[funcNomeInput, funcCargaHorariaInput, funcDocumentoInput].forEach(input => {
    // Garante que o input exista
    if (input) {
        input.addEventListener("input", (e) => {
            if (e.target === funcNomeInput && e.target.value.length > 0) {
                // Capitaliza apenas a primeira letra
                e.target.value = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
            }
            validateInput(e.target);
            updateFuncMetaExplicacao();
            setFuncFormDirty(true);
        });
    }
});


if (funcCargoSelect) {
    funcCargoSelect.addEventListener("change", (e) => {
        validateInput(e.target);
        // Limpa a disponibilidade temporária ao trocar de cargo
        funcDisponibilidadeTemporaria = {};
        renderFuncTurnosForCargo();
        setFuncFormDirty(true);
    });
}

// Listener para o filtro de funcionários ativos
if (filtroFuncionariosInput) {
    filtroFuncionariosInput.addEventListener("input", () => { renderFuncs(); });
}
// Listener para o novo filtro de funcionários arquivados
if (filtroFuncionariosArquivadosInput) {
    filtroFuncionariosArquivadosInput.addEventListener("input", () => { renderArchivedFuncs(); });
}


function renderFuncCargoSelect() {
    // Garante que o select exista
    if (!funcCargoSelect) return;

    const { cargos } = store.getState();
    funcCargoSelect.innerHTML = "<option value=''>Selecione um cargo</option>";

    // Verifica se há cargos cadastrados
    if (cargos.length === 0) {
        const fieldset = funcCargoSelect.closest('.form-group');
        if (fieldset) {
            let p = fieldset.querySelector('.muted-link-helper');
            if (!p) {
                p = document.createElement('p');
                p.className = 'muted-link-helper muted';
                p.style.marginTop = '8px';
                fieldset.appendChild(p);
            }
            // Adiciona link para navegar para a página de cargos
            p.innerHTML = `Nenhum cargo cadastrado. <a href="#" onclick="go('cargos')">Cadastre um cargo primeiro</a>.`;
        }
        return; // Sai se não houver cargos
    }

    // Remove a mensagem de ajuda se houver cargos
    const fieldset = funcCargoSelect.closest('.form-group');
    const p = fieldset?.querySelector('.muted-link-helper');
    if (p) p.remove();

    // Ordena os cargos por nome e popula o select
    const cargosOrdenados = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    cargosOrdenados.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        funcCargoSelect.appendChild(o);
    });
}

// Renderiza a tabela de funcionários ATIVOS
function renderFuncs() {
    // Garante que os elementos existam
    if (!tblFuncionariosBody || !filtroFuncionariosInput) return;

    const { funcionarios, cargos, turnos } = store.getState();
    const filtro = filtroFuncionariosInput.value.toLowerCase();

    tblFuncionariosBody.innerHTML = ""; // Limpa a tabela

    // Filtra apenas funcionários ATIVOS
    const funcsAtivos = funcionarios.filter(f => f.status !== 'arquivado');
    const funcsFiltrados = funcsAtivos.filter(f => f.nome.toLowerCase().includes(filtro));

    // Exibe mensagem se não houver funcionários ativos ou se o filtro não encontrar resultados
    if (funcsFiltrados.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 7; // Ajusta colspan
        if (funcsAtivos.length === 0 && filtro === '') {
             emptyCell.innerHTML = `<div class="empty-state" style="padding: 24px;">
                 <div class="empty-state-icon">🧑‍⚕️</div>
                 <h3>Nenhum Funcionário Ativo</h3>
                 <p>Use o formulário para adicionar funcionários ou reative funcionários da aba 'Arquivados'.</p>
             </div>`;
        } else {
            emptyCell.textContent = `Nenhum funcionário ativo encontrado com o termo "${filtro}".`;
            emptyCell.className = 'muted center';
        }
        emptyRow.appendChild(emptyCell);
        tblFuncionariosBody.appendChild(emptyRow);
        parseEmojisInElement(tblFuncionariosBody); // Parse emoji no empty state
        return;
    }


    const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t])); // Usa turnos do store
    const fragment = document.createDocumentFragment();

    // Agrupa por cargo
    const agrupados = funcsFiltrados.reduce((acc, func) => {
        const cargoNome = cargosMap[func.cargoId] || SEM_CARGO_DEFINIDO;
        if (!acc[cargoNome]) acc[cargoNome] = [];
        acc[cargoNome].push(func);
        return acc;
    }, {});

    // Renderiza grupos ordenados por nome do cargo
    Object.keys(agrupados).sort((a, b) => a.localeCompare(b)).forEach(cargoNome => {
        // Cabeçalho do grupo
        const headerRow = document.createElement('tr');
        const headerCell = document.createElement('th');
        headerCell.colSpan = 7; // Ajusta colspan
        headerCell.className = `group-header ${cargoNome === SEM_CARGO_DEFINIDO ? 'warning' : ''}`;
        headerCell.textContent = cargoNome;
        headerRow.appendChild(headerCell);
        fragment.appendChild(headerRow);

        // Renderiza funcionários do grupo, ordenados por nome
        agrupados[cargoNome].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(f => {
            const row = document.createElement('tr');
            row.dataset.funcId = f.id; // Adiciona ID para referência

            // Calcula a string de carga horária
            let cargaHoraria = 'N/D';
            if (f.cargaHoraria) {
                const unidade = f.medicaoCarga === 'turnos' ? (f.cargaHoraria == 1 ? ' turno' : ' turnos') : 'h';
                const periodo = f.periodoHoras === 'mensal' ? '/mês' : '/semana';
                cargaHoraria = `${f.cargaHoraria}${unidade} ${periodo}`;
            }

            // Gera badges de turnos
            const turnosDoFunc = f.disponibilidade ? Object.keys(f.disponibilidade)
                .map(turnoId => turnosMap[turnoId]) // Mapeia ID para objeto turno
                .filter(Boolean) // Remove turnos não encontrados
                .sort((a,b) => (a.inicio || '').localeCompare(b.inicio || '')) // Ordena por horário de início
                .map(t => `<span class="badge" style="background-color:${t.cor || '#eee'}; color:${getContrastingTextColor(t.cor)}; font-size: 0.75rem; padding: 2px 6px; margin: 1px;" title="${t.nome}">${t.sigla || '?'}</span>`)
                .join(' ') : 'Nenhum';


            const nomeCell = document.createElement('td');
            nomeCell.innerHTML = `${f.nome}<br><small class="muted">${f.documento || '---'}</small>`;

            const cargoCell = document.createElement('td');
            cargoCell.textContent = cargosMap[f.cargoId] || SEM_CARGO_DEFINIDO;
            if (cargoCell.textContent === SEM_CARGO_DEFINIDO) {
                cargoCell.title = "O cargo original foi removido. Edite o funcionário para atribuir um novo.";
            }

            const turnosCell = document.createElement('td');
            turnosCell.innerHTML = turnosDoFunc;

            const contratoCell = document.createElement('td');
            contratoCell.textContent = f.tipoContrato === 'pj' ? 'Prestador' : 'CLT';

            const cargaCell = document.createElement('td');
            cargaCell.textContent = cargaHoraria;

            const extraCell = document.createElement('td');
            extraCell.textContent = f.fazHoraExtra ? 'Sim' : 'Não';

            // Botões de Ação para ativos: Editar e Arquivar
            const acoesCell = document.createElement('td');
            acoesCell.innerHTML = `
                <button class="secondary" data-action="edit" aria-label="Editar ${f.nome}">✏️ Editar</button>
                <button class="danger" data-action="archive" aria-label="Arquivar ${f.nome}">🗃️ Arquivar</button>
                            `;

            row.append(nomeCell, cargoCell, turnosCell, contratoCell, cargaCell, extraCell, acoesCell);
            fragment.appendChild(row);
        });
    });

    tblFuncionariosBody.appendChild(fragment);
    parseEmojisInElement(tblFuncionariosBody); // Parse emojis nos botões

    // Aplica flash se houver um funcionário recém-salvo/editado
    if (lastSavedFuncId) {
        const row = tblFuncionariosBody.querySelector(`tr[data-func-id="${lastSavedFuncId}"]`);
        if(row) {
            row.classList.add('flash-update');
            // Remove a classe após a animação
            setTimeout(() => row.classList.remove('flash-update'), 1500);
        }
        lastSavedFuncId = null; // Reseta o ID
    }
}

// Nova função para renderizar a tabela de funcionários ARQUIVADOS
function renderArchivedFuncs() {
    // Garante que os elementos existam
    if (!tblFuncionariosArquivadosBody || !filtroFuncionariosArquivadosInput) return;

    const { funcionarios, cargos } = store.getState();
    const filtro = filtroFuncionariosArquivadosInput.value.toLowerCase();

    tblFuncionariosArquivadosBody.innerHTML = ""; // Limpa a tabela

    // Filtra apenas funcionários ARQUIVADOS
    const funcsArquivados = funcionarios.filter(f => f.status === 'arquivado');
    const funcsFiltrados = funcsArquivados.filter(f => f.nome.toLowerCase().includes(filtro));

    // Exibe mensagem se não houver funcionários arquivados ou se o filtro não encontrar resultados
    if (funcsFiltrados.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4; // Ajusta colspan para a nova tabela
        if (funcsArquivados.length === 0 && filtro === '') {
             emptyCell.innerHTML = `<div class="empty-state" style="padding: 24px;">
                 <div class="empty-state-icon">🗃️</div> 
                 <h3>Nenhum Funcionário Arquivado</h3>
                 <p>Funcionários arquivados aparecerão aqui.</p>
             </div>`;
        } else {
            emptyCell.textContent = `Nenhum funcionário arquivado encontrado com o termo "${filtro}".`;
            emptyCell.className = 'muted center';
        }
        emptyRow.appendChild(emptyCell);
        tblFuncionariosArquivadosBody.appendChild(emptyRow);
        parseEmojisInElement(tblFuncionariosArquivadosBody);
        return;
    }

    const cargosMap = Object.fromEntries(cargos.map(c => [c.id, c.nome]));
    const fragment = document.createDocumentFragment();

    // Renderiza funcionários arquivados ordenados por nome
    funcsFiltrados.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(f => {
        const row = document.createElement('tr');
        row.dataset.funcId = f.id; // Adiciona ID para referência
        row.style.opacity = '0.7'; // Deixa levemente esmaecido

        const nomeCell = document.createElement('td');
        nomeCell.innerHTML = `${f.nome}<br><small class="muted">${f.documento || '---'}</small>`;

        const cargoCell = document.createElement('td');
        cargoCell.textContent = cargosMap[f.cargoId] || SEM_CARGO_DEFINIDO;

        const contratoCell = document.createElement('td');
        contratoCell.textContent = f.tipoContrato === 'pj' ? 'Prestador' : 'CLT';

        // Botão de Ação para arquivados: Apenas Reativar
        const acoesCell = document.createElement('td');
        acoesCell.innerHTML = `<button class="secondary" data-action="unarchive" aria-label="Reativar ${f.nome}">🔄 Reativar</button>`;

        row.append(nomeCell, cargoCell, contratoCell, acoesCell);
        fragment.appendChild(row);
    });

    tblFuncionariosArquivadosBody.appendChild(fragment);
    parseEmojisInElement(tblFuncionariosArquivadosBody); // Parse emojis nos botões
}


function validateFuncForm() {
     // Garante que os inputs existam antes de validar
    if (!funcNomeInput || !funcCargoSelect || !funcCargaHorariaInput) return false;

    // Limpa validações anteriores
    $$('.invalid-label', pageFuncionarios).forEach(el => el.classList.remove('invalid-label'));
    $$('.invalid', pageFuncionarios).forEach(el => el.classList.remove('invalid'));

    const isNomeValid = validateInput(funcNomeInput);
    const isCargoValid = validateInput(funcCargoSelect);
    const isCargaValid = validateInput(funcCargaHorariaInput);

    return isNomeValid && isCargoValid && isCargaValid;
}

async function saveFuncFromForm() {
    if (!validateFuncForm()) {
        showToast("Preencha todos os campos obrigatórios.");
        focusFirstInvalidInput('#page-funcionarios .painel-tab-content[data-tab-content="formulario"]'); // Foca dentro do form
        return;
    }
    const { funcionarios, equipes } = store.getState();
    const documento = funcDocumentoInput.value.trim();
    // Verifica documento duplicado (ignorando o funcionário atual se estiver editando)
    if (documento && funcionarios.some(f => f.documento?.toLowerCase() === documento.toLowerCase() && f.id !== editingFuncId)) {
        validateInput(funcDocumentoInput, false); // Marca o campo como inválido
        return showToast("O número do documento já está em uso por outro funcionário.");
    } else if (funcDocumentoInput) {
         validateInput(funcDocumentoInput, true); // Garante que fique válido se não for duplicado
    }

    // Cria os objetos finais de disponibilidade e preferências a partir do estado temporário
    const disponibilidadeFinal = {};
    const preferenciasFinal = {};

    for (const turnoId in funcDisponibilidadeTemporaria) {
        const dias = funcDisponibilidadeTemporaria[turnoId];
        const diasDisponiveis = [];
        const diasPreferenciais = [];
        for (const diaId in dias) {
            if (dias[diaId] === 'disponivel') {
                diasDisponiveis.push(diaId);
            } else if (dias[diaId] === 'preferencial') {
                diasDisponiveis.push(diaId); // Dia preferencial também é disponível
                diasPreferenciais.push(diaId);
            }
        }
        if (diasDisponiveis.length > 0) {
            disponibilidadeFinal[turnoId] = diasDisponiveis;
        }
        if (diasPreferenciais.length > 0) {
            preferenciasFinal[turnoId] = diasPreferenciais;
        }
    }


    // VERIFICAÇÕES DE EQUIPE (ao editar funcionário)
    if (editingFuncId) {
        const funcOriginal = funcionarios.find(f => f.id === editingFuncId);
        const novoCargoId = funcCargoSelect.value;
        const equipeDoFunc = equipes.find(e => e.funcionarioIds.includes(editingFuncId));

        // 1. Verificação por MUDANÇA DE CARGO enquanto em equipe
        if (funcOriginal && funcOriginal.cargoId !== novoCargoId && equipeDoFunc && equipeDoFunc.cargoId !== novoCargoId) {
            const { confirmed } = await showConfirm({
                title: "Remover Funcionário da Equipe?",
                message: `Ao alterar o cargo deste funcionário para um cargo diferente da equipe "${equipeDoFunc.nome}", ele será removido dela. Deseja continuar?`,
                confirmText: "Sim, Continuar"
            });
            if (!confirmed) {
                funcCargoSelect.value = funcOriginal.cargoId; // Reverte a seleção do cargo
                return; // Aborta o salvamento
            }
            // Remove o funcionário da equipe e salva a equipe
            equipeDoFunc.funcionarioIds = equipeDoFunc.funcionarioIds.filter(id => id !== editingFuncId);
            store.dispatch('SAVE_EQUIPE', equipeDoFunc);
        }
        // 2. Verificação por MUDANÇA DE DISPONIBILIDADE enquanto em equipe
        else if (equipeDoFunc && !disponibilidadeFinal[equipeDoFunc.turnoId]) {
             const { confirmed } = await showConfirm({
                title: "Remover Funcionário da Equipe?",
                message: `Ao remover a disponibilidade para o turno (${turnos.find(t=>t.id === equipeDoFunc.turnoId)?.nome || '?'}) da equipe "${equipeDoFunc.nome}", este funcionário será removido dela. Deseja continuar?`,
                confirmText: "Sim, Continuar"
            });
            if (!confirmed) {
                 // Reverte a disponibilidade temporária para incluir o turno da equipe
                 // (Implementação mais complexa, por ora apenas aborta)
                 // TODO: Opcionalmente, reverter a seleção no funcDisponibilidadeTemporaria
                return; // Aborta o salvamento
            }
            // Remove o funcionário da equipe e salva a equipe
            equipeDoFunc.funcionarioIds = equipeDoFunc.funcionarioIds.filter(id => id !== editingFuncId);
            store.dispatch('SAVE_EQUIPE', equipeDoFunc);
        }
    }


    const funcData = {
        id: editingFuncId || uid(),
        nome: funcNomeInput.value.trim(),
        cargoId: funcCargoSelect.value,
        tipoContrato: funcContratoInput.value,
        medicaoCarga: funcMedicaoCargaInput.value,
        cargaHoraria: funcCargaHorariaInput.value,
        periodoHoras: funcPeriodoHorasInput.value,
        fazHoraExtra: funcHoraExtraInput.value === 'sim',
        documento: documento || '', // Salva vazio se não preenchido
        disponibilidade: disponibilidadeFinal,
        preferencias: preferenciasFinal,
        status: 'ativo' // Garante que ao salvar/editar, o status seja ativo
    };

    // Guarda o ID para aplicar o efeito 'flash' na tabela
    lastSavedFuncId = funcData.id;

    store.dispatch('SAVE_FUNCIONARIO', funcData);

    showToast("Funcionário salvo com sucesso!");
    switchFuncionariosTab('gerenciar'); // Volta para a aba de gerenciamento
    cancelEditFunc(); // Limpa o formulário
}


function editFuncInForm(id) {
    const { funcionarios } = store.getState();
    const func = funcionarios.find(f => f.id === id);
    // Não permite editar arquivados diretamente (precisa reativar primeiro)
    if (!func || func.status === 'arquivado') return;

    cancelEditFunc(); // Limpa o formulário antes de preencher
    editingFuncId = id;

    // Preenche os campos básicos
    funcNomeInput.value = func.nome;
    funcCargoSelect.value = func.cargoId;
    funcCargaHorariaInput.value = func.cargaHoraria || '';
    funcDocumentoInput.value = func.documento || '';

    // Ativa os toggles corretos
    $(`.toggle-btn[data-value="${func.tipoContrato || 'clt'}"]`, contratoToggleGroup)?.click();
    $(`.toggle-btn[data-value="${func.medicaoCarga || 'horas'}"]`, medicaoCargaToggleGroup)?.click();
    $(`.toggle-btn[data-value="${func.periodoHoras || 'semanal'}"]`, periodoHorasToggleGroup)?.click();
    $(`.toggle-btn[data-value="${func.fazHoraExtra ? 'sim' : 'nao'}"]`, horaExtraToggleGroup)?.click();

    // Reconstrói o estado temporário da disponibilidade
    funcDisponibilidadeTemporaria = {};
    const disponibilidade = func.disponibilidade || {};
    const preferencias = func.preferencias || {};
    for (const turnoId in disponibilidade) {
        funcDisponibilidadeTemporaria[turnoId] = {};
        const diasDisponiveis = disponibilidade[turnoId] || [];
        const diasPreferenciais = preferencias[turnoId] || [];
        // Marca todos como 'disponivel' primeiro
        diasDisponiveis.forEach(diaId => {
            funcDisponibilidadeTemporaria[turnoId][diaId] = 'disponivel';
        });
        // Sobrescreve os preferenciais
        diasPreferenciais.forEach(diaId => {
            funcDisponibilidadeTemporaria[turnoId][diaId] = 'preferencial';
        });
    }

    // Renderiza a grid de disponibilidade com os dados preenchidos
    renderFuncTurnosForCargo();
    updateFuncMetaExplicacao(); // Atualiza a explicação da meta

    // Atualiza UI do formulário para modo de edição
    btnSalvarFunc.textContent = "💾 Salvar Alterações";
    setFuncFormDirty(false); // Começa como "não sujo"

    // Atualiza o título da aba do formulário
    if (formTabButtonFuncionarios) formTabButtonFuncionarios.innerHTML = `📝 Editando: ${func.nome}`;
    switchFuncionariosTab('formulario'); // Muda para a aba do formulário
}


function cancelEditFunc() {
    editingFuncId = null; // Reseta o ID de edição

    // Limpa os campos do formulário
    if (funcNomeInput) funcNomeInput.value = "";
    if (funcCargoSelect) funcCargoSelect.value = "";
    if (funcCargaHorariaInput) funcCargaHorariaInput.value = "";
    if (funcDocumentoInput) funcDocumentoInput.value = "";

    // Remove classes de validação
    $$('.invalid', pageFuncionarios).forEach(el => el.classList.remove('invalid'));
    $$('.invalid-label', pageFuncionarios).forEach(el => el.classList.remove('invalid-label'));

    // Reseta os toggles para o padrão
    $(`.toggle-btn[data-value="clt"]`, contratoToggleGroup)?.click();
    $(`.toggle-btn[data-value="horas"]`, medicaoCargaToggleGroup)?.click();
    $(`.toggle-btn[data-value="semanal"]`, periodoHorasToggleGroup)?.click();
    $(`.toggle-btn[data-value="nao"]`, horaExtraToggleGroup)?.click();

    // Limpa a disponibilidade temporária e a grid
    funcDisponibilidadeTemporaria = {};
    if (funcTurnosContainer) {
        funcTurnosContainer.innerHTML = `<div class="turno-placeholder"><p>Selecione um cargo para ver os turnos disponíveis.</p></div>`;
    }

    updateFuncMetaExplicacao(); // Atualiza a explicação da meta

    // Reseta o botão de salvar e o título da aba
    if (btnSalvarFunc) btnSalvarFunc.textContent = "💾 Salvar Funcionário";
    if (formTabButtonFuncionarios) formTabButtonFuncionarios.innerHTML = "📝 Novo Funcionário";
    setFuncFormDirty(false); // Marca como "não sujo"

    // Opcional: focar no primeiro campo
    // if (funcNomeInput) funcNomeInput.focus();
}


async function archiveFuncionario(id) {
    const { funcionarios, equipes } = store.getState(); // Pega estado atual
    const func = funcionarios.find(f => f.id === id);
    if (!func) return; // Sai se não encontrar

    const equipeDoFunc = equipes.find(e => e.funcionarioIds.includes(id));

    // Monta a mensagem de confirmação
    let message = `O funcionário "${func.nome}" não aparecerá mais nas listas para criação de novas escalas, mas seu histórico em escalas salvas será mantido. Você pode reativá-lo a qualquer momento na aba 'Arquivados'.`;
    if (equipeDoFunc) {
        message += `<br><br><strong>Atenção:</strong> Este funcionário pertence à equipe "<strong>${equipeDoFunc.nome}</strong>" e será removido dela ao ser arquivado.`;
    }

    // Pede confirmação
    const { confirmed } = await showConfirm({
        title: "Arquivar Funcionário?",
        message: message,
        confirmText: "Sim, Arquivar"
    });

    if(confirmed) {
        // Se pertence a uma equipe, remove da equipe primeiro
        if (equipeDoFunc) {
            equipeDoFunc.funcionarioIds = equipeDoFunc.funcionarioIds.filter(funcId => funcId !== id);
            store.dispatch('SAVE_EQUIPE', equipeDoFunc);
        }
        // Despacha a ação para arquivar
        store.dispatch('ARCHIVE_FUNCIONARIO', id);
        showToast(`Funcionário "${func.nome}" arquivado.`);
        // Re-renderiza ambas as tabelas
        renderFuncs();
        renderArchivedFuncs();
    }
}

async function unarchiveFuncionario(id) {
    const { funcionarios } = store.getState();
    const func = funcionarios.find(f => f.id === id);
    if (!func) return;

    // Despacha a ação para reativar
    store.dispatch('UNARCHIVE_FUNCIONARIO', id);
    showToast(`Funcionário "${func.nome}" reativado com sucesso.`);
    // Re-renderiza ambas as tabelas
    renderFuncs();
    renderArchivedFuncs();
}


async function deleteFuncionario(id) {
     // A lógica de exclusão permanente não é comum para arquivados,
     // mas mantemos a verificação caso queira adicionar um botão de exclusão na aba de arquivados.
    const { escalas, equipes } = store.getState();

    // Verifica se pertence a alguma equipe
    const equipeDoFunc = equipes.find(e => e.funcionarioIds.includes(id));
    if (equipeDoFunc) {
        showInfoModal({
            title: "Exclusão Permanente Bloqueada",
            contentHTML: `<p>Este funcionário não pode ser excluído permanentemente porque é membro da equipe "<strong>${equipeDoFunc.nome}</strong>".</p><p>Por favor, edite a equipe e remova este funcionário antes de tentar excluí-lo.</p>`
        });
        return;
    }

    // Verifica se está em alguma escala salva
    const isInEscalaSalva = escalas.some(escala =>
        escala.slots.some(slot => slot.assigned === id)
    );

    if (isInEscalaSalva) {
        showInfoModal({
            title: "Exclusão Permanente Bloqueada",
            contentHTML: "<p>Este funcionário não pode ser excluído permanentemente porque possui registros (turnos ou ausências) em uma ou mais escalas salvas. Para preservar o histórico, a exclusão não é permitida.</p><p>Em vez disso, você pode <strong>arquivar</strong> o funcionário.</p>"
        });
        return;
    }

    // Se passou nas verificações, confirma e deleta
    handleDeleteItem({
        id: id,
        itemName: 'Funcionário',
        dispatchAction: 'DELETE_FUNCIONARIO',
        additionalInfo: 'Esta ação é definitiva e não pode ser desfeita.'
    });
    // A função handleDeleteItem já chama o dispatch, que por sua vez chama renderRouter,
    // que deve chamar renderFuncs/renderArchivedFuncs se a página ativa for 'funcionarios'.
}


// --- Delegação de Eventos ---

// Handler para cliques na tabela de funcionários ATIVOS
function handleFuncionariosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return; // Ignora cliques fora de botões

    const parentRow = target.closest('tr');
    // Garante que a linha e o ID existam
    if (!parentRow || !parentRow.dataset.funcId) return;

    const { action } = target.dataset;
    const id = parentRow.dataset.funcId;

    if (action === 'edit') editFuncInForm(id);
    else if (action === 'archive') archiveFuncionario(id);
    // else if (action === 'delete') deleteFuncionario(id); // Ação de deletar removida da tabela de ativos
}

// Handler para cliques na tabela de funcionários ARQUIVADOS
function handleArquivadosTableClick(event) {
    const target = event.target.closest('button');
    if (!target) return; // Ignora cliques fora de botões

    const parentRow = target.closest('tr');
    // Garante que a linha e o ID existam
    if (!parentRow || !parentRow.dataset.funcId) return;

    const { action } = target.dataset;
    const id = parentRow.dataset.funcId;

    if (action === 'unarchive') unarchiveFuncionario(id);
    // else if (action === 'delete') deleteFuncionario(id); // Opcional: Adicionar botão de exclusão aqui se desejado
}


function handleDisponibilidadeGridClick(event) {
    const header = event.target.closest('.turno-disponibilidade-header');
    const diaSpan = event.target.closest('.dia-selecionavel');

    // Clique no cabeçalho (para ativar/desativar o turno inteiro)
    if (header) {
        const item = header.closest('.turno-disponibilidade-item');
        if (!item) return;
        const turnoId = item.dataset.turnoId;
        const chkPrincipal = header.querySelector('input[name="turnoPrincipal"]');
        if (!chkPrincipal) return;

        // Se o clique não foi diretamente no checkbox, inverte o estado dele
        if (event.target !== chkPrincipal) {
            chkPrincipal.checked = !chkPrincipal.checked;
        }

        const isChecked = chkPrincipal.checked;
        item.classList.toggle('selecionado', isChecked);

        if (isChecked) {
            // Se ativou, cria a entrada e define todos os dias operacionais como 'disponivel'
            funcDisponibilidadeTemporaria[turnoId] = {};
            const { cargos } = store.getState();
            const cargo = cargos.find(c => c.id === funcCargoSelect.value);
            const diasOperacionais = cargo?.regras?.dias || []; // Pega dias do cargo

            diasOperacionais.forEach(diaId => {
                funcDisponibilidadeTemporaria[turnoId][diaId] = 'disponivel';
            });
             // Re-renderiza para mostrar os dias marcados
            renderFuncTurnosForCargo();
        } else {
            // Se desativou, remove a entrada do turno
            delete funcDisponibilidadeTemporaria[turnoId];
             // Re-renderiza para mostrar o turno desmarcado
            renderFuncTurnosForCargo();
        }
        setFuncFormDirty(true);
    }

    // Clique em um dia específico
    if (diaSpan) {
        // Ignora se o dia está visualmente desabilitado
        if (diaSpan.style.cursor === 'not-allowed') return;

        const item = diaSpan.closest('.turno-disponibilidade-item');
        if (!item) return;
        const chkPrincipal = item.querySelector('input[name="turnoPrincipal"]');
        // Só permite alterar dias se o turno principal estiver checado
        if (chkPrincipal && chkPrincipal.checked) {
            const turnoId = item.dataset.turnoId;
            const diaId = diaSpan.dataset.diaId;

            // Garante que a estrutura exista
            if (!funcDisponibilidadeTemporaria[turnoId]) {
                 funcDisponibilidadeTemporaria[turnoId] = {};
            }

            const estadoAtual = funcDisponibilidadeTemporaria[turnoId]?.[diaId];
            let novoEstado = 'disponivel'; // Padrão ao clicar em dia vazio

            if (estadoAtual === 'disponivel') {
                novoEstado = 'preferencial';
            } else if (estadoAtual === 'preferencial') {
                novoEstado = undefined; // Remove (volta ao estado 'implícito' de indisponível)
            }

            // Atualiza o estado temporário
            if (novoEstado) {
                funcDisponibilidadeTemporaria[turnoId][diaId] = novoEstado;
            } else {
                delete funcDisponibilidadeTemporaria[turnoId][diaId];
            }

            // Atualiza o visual do dia clicado
            diaSpan.classList.remove('dia-disponivel', 'dia-preferencial');
            if (novoEstado) {
                diaSpan.classList.add(`dia-${novoEstado}`);
            }

            setFuncFormDirty(true);
        }
    }
}


function initFuncionariosPage() {
    // Configura as abas
    switchFuncionariosTab = setupTabbedPanel('#page-funcionarios .painel-gerenciamento', 'funcionarios', (tabId) => {
        // Callback chamado ao trocar de aba
        if (tabId === 'gerenciar') {
            cancelEditFunc(); // Limpa form se voltar para gerenciar
            renderFuncs(); // Renderiza funcionários ativos
        } else if (tabId === 'arquivados') {
            cancelEditFunc(); // Limpa form se for para arquivados
            renderArchivedFuncs(); // Renderiza funcionários arquivados
        } else if (tabId === 'formulario') {
             // Limpa/Reseta o form se não estiver editando (caso tenha navegado para cá pelo botão "Novo")
             if (!editingFuncId) cancelEditFunc();
        }
        // Ajusta visibilidade do botão "Adicionar Novo"
        const addBtn = $('.btn-add-new', pageFuncionarios);
        if (addBtn) addBtn.style.display = (tabId === 'gerenciar' || tabId === 'arquivados') ? 'inline-flex' : 'none';

         // Limpa os filtros ao trocar de aba principal (Gerenciar/Arquivados)
         if (tabId === 'gerenciar' && filtroFuncionariosInput) filtroFuncionariosInput.value = '';
         if (tabId === 'arquivados' && filtroFuncionariosArquivadosInput) filtroFuncionariosArquivadosInput.value = '';
    });


    // Botão "Adicionar Novo" agora só muda para a aba do formulário
    const addBtn = $('.btn-add-new', pageFuncionarios);
    if(addBtn) {
        addBtn.addEventListener('click', () => {
            cancelEditFunc(); // Garante que o formulário esteja limpo
            if (formTabButtonFuncionarios) formTabButtonFuncionarios.innerHTML = "📝 Novo Funcionário"; // Reseta título da aba form
            switchFuncionariosTab('formulario'); // Muda para a aba do formulário
        });
    }

    // Remove listener antigo da checkbox (não existe mais)
    // const checkArquivados = $("#mostrarArquivadosCheck");
    // if (checkArquivados) checkArquivados.removeEventListener('change', renderFuncs);


    // Listeners dos botões Salvar/Cancelar no formulário
    if (btnSalvarFunc) btnSalvarFunc.addEventListener('click', saveFuncFromForm);
    if (btnCancelarFunc) btnCancelarFunc.addEventListener('click', () => {
        cancelEditFunc(); // Limpa o formulário
        switchFuncionariosTab('gerenciar'); // Volta para a aba de gerenciamento
    });

    // Listeners para cliques nas tabelas (delegação)
    if (tblFuncionariosBody) tblFuncionariosBody.addEventListener('click', handleFuncionariosTableClick);
    if (tblFuncionariosArquivadosBody) tblFuncionariosArquivadosBody.addEventListener('click', handleArquivadosTableClick);

    // Listener para a grid de disponibilidade (será adicionado/removido em renderFuncTurnosForCargo)

    // Configura os Toggles
    setupToggleGroup(contratoToggleGroup, funcContratoInput, contratoExplicacaoEl, {
        'clt': '<strong>CLT / Concursado:</strong> Vínculo empregatício tradicional. As regras de descanso obrigatório são aplicadas.',
        'pj': '<strong>Prestador de Serviço:</strong> Contrato de prestação de serviços. As regras de descanso obrigatório também são aplicadas.'
    });
    setupToggleGroup(medicaoCargaToggleGroup, funcMedicaoCargaInput);
    setupToggleGroup(periodoHorasToggleGroup, funcPeriodoHorasInput);
    setupToggleGroup(horaExtraToggleGroup, funcHoraExtraInput);

    // Listener para atualizar label e explicação da meta
    if (medicaoCargaToggleGroup) {
        medicaoCargaToggleGroup.addEventListener('click', () => {
            if (!funcMedicaoCargaInput || !funcCargaHorariaLabel) return;
            const value = funcMedicaoCargaInput.value;
            funcCargaHorariaLabel.textContent = (value === 'horas') ? 'Carga Horária (h)' : 'Meta de Turnos';
            updateFuncMetaExplicacao();
        });
    }
     // Garante que a explicação seja atualizada ao mudar o período também
    if (periodoHorasToggleGroup) {
        periodoHorasToggleGroup.addEventListener('click', updateFuncMetaExplicacao);
    }

    // Inicializa o estado dos toggles (se os elementos existirem)
    if (contratoToggleGroup) $(`.toggle-btn[data-value="clt"]`, contratoToggleGroup)?.click();
    if (medicaoCargaToggleGroup) $(`.toggle-btn[data-value="horas"]`, medicaoCargaToggleGroup)?.click();
    if (periodoHorasToggleGroup) $(`.toggle-btn[data-value="semanal"]`, periodoHorasToggleGroup)?.click();
    if (horaExtraToggleGroup) $(`.toggle-btn[data-value="nao"]`, horaExtraToggleGroup)?.click();

    setFuncFormDirty(false); // Define estado inicial como "não sujo"
    // Renderiza a tabela inicial de ativos (caso a aba 'gerenciar' seja a padrão)
    renderFuncs();
}

document.addEventListener('DOMContentLoaded', initFuncionariosPage);