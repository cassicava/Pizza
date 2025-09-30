/**************************************
 * 🗂️ Escalas Salvas
 **************************************/

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

  if (!cargoFiltro) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Selecione um cargo para ver as escalas salvas.</p>`;
    return;
  }
  
  if (!anoFiltro) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Agora, selecione um ano.</p>`;
    return;
  }

  const escalasFiltradas = escalas.filter(e => e.cargoId === cargoFiltro && e.inicio.startsWith(anoFiltro));

  if(escalas.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">🗂️</div>
        <h3>Nenhuma Escala Salva</h3>
        <p>As escalas que você gerar e salvar aparecerão aqui para consulta futura.</p>
    </div>`;
    return;
  }

  if(escalasFiltradas.length === 0) {
    container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma escala encontrada para o cargo e ano selecionados.</p>`;
    return;
  }

  const escalasOrdenadas = [...escalasFiltradas].sort((a,b) => b.inicio.localeCompare(a.inicio));

  escalasOrdenadas.forEach(esc => {
    const card = document.createElement("div");
    card.className = "escala-card";
    card.dataset.viewId = esc.id;

    const periodo = `${new Date(esc.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(esc.fim+'T12:00:00').toLocaleDateString()}`;

    card.innerHTML = `
      <div class="escala-card-content">
        <h3>${esc.nome || 'Escala Salva'}</h3>
        <p class="muted">${periodo}</p>
      </div>
      <div class="escala-card-actions">
        <button class="secondary" data-edit-id="${esc.id}" disabled>✏️ Editar</button>
        <button class="danger" data-del-id="${esc.id}">🔥 Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function verEscalaSalva(id) {
    const { escalas } = store.getState();
    const escala = escalas.find(e => e.id === id);
    if(escala) {
        const container = $("#escalaSalvaTabelaWrap");
        renderGenericEscalaTable(escala, container, { isInteractive: false });
        renderEscalaLegend(escala, $("#escalaSalvaViewLegenda"));

        const turnosVagos = escala.slots.filter(s => !s.assigned).length;
        $("#escalaSalvaResumo").innerHTML = `<strong>Resumo:</strong> ${turnosVagos > 0 ? `<span style="color:red;">${turnosVagos} turnos vagos.</span>` : 'Todos os turnos foram preenchidos.'}`;
        $("#escalaSalvaViewTitle").textContent = escala.nome || 'Visualização da Escala';

        $('#lista-escalas-container').classList.add('hidden');
        $('#escalaSalvaView').classList.remove('hidden');

        const btnExport = $("#btnExportarPDF");
        if (btnExport) {
            btnExport.onclick = () => showExportModal(escala);
        }
    }
}

async function excluirEscalaSalva(id){
  handleDeleteItem({
      id: id,
      itemName: 'Escala Salva',
      dispatchAction: 'DELETE_ESCALA_SALVA'
  });
}

function handleEscalasSalvasContainerClick(event) {
    const deleteBtn = event.target.closest('button[data-del-id]');
    if (deleteBtn) {
        event.stopPropagation();
        excluirEscalaSalva(deleteBtn.dataset.delId);
        return;
    }

    const card = event.target.closest('.escala-card[data-view-id]');
    if (card) {
        verEscalaSalva(card.dataset.viewId);
    }
}

$("#btnVoltarParaLista").onclick = () => {
    $('#escalaSalvaView').classList.add('hidden');
    $('#lista-escalas-container').classList.remove('hidden');
};

function initEscalasSalvasPage() {
    const filtroCargoSelect = $("#filtroEscalasCargo");
    if (filtroCargoSelect) {
        filtroCargoSelect.addEventListener('change', () => {
            renderEscalasList();
            if(filtroCargoSelect.value) {
                $("#filtroEscalasAno").showPicker();
            }
        });
    }
    const filtroAnoSelect = $("#filtroEscalasAno");
    if (filtroAnoSelect) {
        filtroAnoSelect.addEventListener('change', () => renderEscalasList());
    }

    const container = $("#listaEscalas");
    if (container) {
        container.addEventListener('click', handleEscalasSalvasContainerClick);
    }
}

document.addEventListener('DOMContentLoaded', initEscalasSalvasPage);