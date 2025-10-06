/**************************************
 * 🗂️ Escalas Salvas
 **************************************/

let escalaParaEditar = null; // Armazena a escala selecionada para visualização ou edição

function renderFiltroEscalasCargo() {
    const { escalas, cargos } = store.getState();
    const filtroSelect = $("#filtroEscalasCargo");
    if (!filtroSelect) return;
    const valorAtual = filtroSelect.value;
    const cargosComEscalaIds = [...new Set(escalas.map(e => e.cargoId))];
    const cargosFiltrados = cargos.filter(c => cargosComEscalaIds.includes(c.id)).sort((a,b) => a.nome.localeCompare(b.nome));
    filtroSelect.innerHTML = `<option value="">Selecione um cargo...</option>`;
    cargosFiltrados.forEach(cargo => {
        const option = document.createElement('option');
        option.value = cargo.id;
        option.textContent = cargo.nome;
        filtroSelect.appendChild(option);
    });
    filtroSelect.value = valorAtual;
}

function renderFiltroEscalasAno() {
    const filtroSelect = $("#filtroEscalasAno");
    if (!filtroSelect) return;
    const valorAtual = filtroSelect.value;
    const anoAtual = new Date().getFullYear();
    const anoInicio = 2025;
    filtroSelect.innerHTML = `<option value="" selected>Selecione um ano</option>`;
    for (let ano = anoInicio; ano <= anoAtual + 2; ano++) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        filtroSelect.appendChild(option);
    }
    filtroSelect.value = valorAtual;
}

function renderEscalasList(){
  const { escalas } = store.getState();
  const filtroCargoSelect = $("#filtroEscalasCargo");
  const filtroAnoSelect = $("#filtroEscalasAno");
  const container = $("#listaEscalas");
  container.innerHTML = "";

  renderFiltroEscalasCargo();
  renderFiltroEscalasAno();

  const cargoFiltro = filtroCargoSelect ? filtroCargoSelect.value : '';
  const anoFiltro = filtroAnoSelect ? filtroAnoSelect.value : '';

  if (escalas.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">🗂️</div>
        <h3>Nenhuma Escala Salva</h3>
        <p>As escalas que você gerar e salvar aparecerão aqui para consulta futura.</p>
    </div>`;
    return;
  }

  if (!cargoFiltro) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Selecione um cargo para ver as escalas salvas.</p>`;
    return;
  }
  
  if (!anoFiltro) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Agora, selecione um ano.</p>`;
    return;
  }

  const escalasFiltradas = escalas.filter(e => e.cargoId === cargoFiltro && e.inicio.startsWith(anoFiltro));

  if(escalasFiltradas.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma escala encontrada para o cargo e ano selecionados.</p>`;
    return;
  }

  const escalasOrdenadas = [...escalasFiltradas].sort((a,b) => b.inicio.localeCompare(a.inicio));

  escalasOrdenadas.forEach(esc => {
    // SUGESTÃO B: INDICADOR VISUAL DE "SAÚDE"
    const temVagas = esc.slots.some(s => !s.assigned);
    const statusIcon = temVagas ? '⚠️' : '✅';
    const statusClass = temVagas ? 'status-warning' : 'status-ok';
    const statusTitle = temVagas ? 'Escala com turnos vagos' : 'Escala completa';

    const card = document.createElement("div");
    card.className = "escala-card";
    card.dataset.viewId = esc.id;
    const periodo = `${new Date(esc.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(esc.fim+'T12:00:00').toLocaleDateString()}`;
    
    // REMOÇÃO DOS BOTÕES DOS CARDS
    card.innerHTML = `
      <div class="escala-card-status ${statusClass}" title="${statusTitle}">${statusIcon}</div>
      <div class="escala-card-content">
        <h3>${esc.nome}</h3>
        <p class="muted">${periodo}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

function verEscalaSalva(id) {
    const { escalas } = store.getState();
    const escala = escalas.find(e => e.id === id);
    if(escala) {
        // Armazena a escala para os botões de ação poderem encontrá-la
        escalaParaEditar = escala;

        escala.owner = 'salva';
        
        $("#escalaSalvaViewTitle").textContent = escala.nome || 'Visualização da Escala';
        
        renderGenericEscalaTable(escala, $("#escalaSalvaTabelaWrap"), { isInteractive: false });

        renderPainelDaEscala(escala);

        $("#btnExportarPDF").onclick = () => showExportModal(escala);
        
        $('#listaEscalasContainer').classList.add('hidden');
        $('#escalaSalvaView').classList.remove('hidden');
    }
}


function editEscalaSalva() {
    if (escalaParaEditar) {
        // Redireciona para a página de geração, que também funciona como editora
        go('gerar-escala', { escalaParaEditar: escalaParaEditar, isEditing: true });
    }
}

async function excluirEscalaSalva(id){
  const confirmado = await handleDeleteItem({
      id: id,
      itemName: 'Escala Salva',
      dispatchAction: 'DELETE_ESCALA_SALVA'
  });
  
  if (confirmado) {
      // Retorna para a lista de escalas após a exclusão
      $('#escalaSalvaView').classList.add('hidden');
      $('#listaEscalasContainer').classList.remove('hidden');
      escalaParaEditar = null;
      renderEscalasList(); // Atualiza a lista
  }
}

function handleEscalasSalvasContainerClick(event) {
    // AGORA A LÓGICA DE CLIQUE É APENAS NO CARD PARA VISUALIZAÇÃO
    const card = event.target.closest('.escala-card[data-view-id]');
    if (card) {
        verEscalaSalva(card.dataset.viewId);
    }
}

function initEscalasSalvasPage() {
    $("#btnVoltarParaLista").onclick = () => {
        $('#escalaSalvaView').classList.add('hidden');
        $('#listaEscalasContainer').classList.remove('hidden');
        escalaParaEditar = null;
    };
    $("#btnEditarEscalaSalva").onclick = editEscalaSalva;
    
    // NOVO LISTENER PARA O BOTÃO DE EXCLUIR NA TELA DE VISUALIZAÇÃO
    $("#btnExcluirEscalaSalva").onclick = () => {
        if (escalaParaEditar) {
            excluirEscalaSalva(escalaParaEditar.id);
        }
    };

    const filtroCargoSelect = $("#filtroEscalasCargo");
    if (filtroCargoSelect) {
        filtroCargoSelect.onchange = () => {
            renderEscalasList();
            if(filtroCargoSelect.value) {
                const anoSelect = $("#filtroEscalasAno");
                if (anoSelect) anoSelect.showPicker();
            }
        };
    }
    const filtroAnoSelect = $("#filtroEscalasAno");
    if (filtroAnoSelect) {
        filtroAnoSelect.onchange = renderEscalasList;
    }

    const container = $("#listaEscalas");
    if (container) {
        container.onclick = handleEscalasSalvasContainerClick;
    }
}

document.addEventListener('DOMContentLoaded', initEscalasSalvasPage);