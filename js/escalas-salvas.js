/**************************************
 * 🗂️ Escalas Salvas
 **************************************/

let escalaParaEditar = null; 

function renderFiltroEscalasCargo() {
    const { escalas, cargos } = store.getState();
    const filtroSelect = $("#filtroEscalasCargo");
    if (!filtroSelect) return;
    const valorAtual = filtroSelect.value;
    const cargosComEscalaIds = [...new Set(escalas.map(e => e.cargoId))];
    const cargosFiltrados = cargos.filter(c => cargosComEscalaIds.includes(c.id)).sort((a, b) => a.nome.localeCompare(b.nome));
    filtroSelect.innerHTML = `<option value="">Selecione um cargo...</option>`;
    cargosFiltrados.forEach(cargo => {
        const option = document.createElement('option');
        option.value = cargo.id;
        option.textContent = cargo.nome;
        filtroSelect.appendChild(option);
    });
    filtroSelect.value = valorAtual;
}

function renderEscalasList() {
    const { escalas } = store.getState();
    const filtroCargoSelect = $("#filtroEscalasCargo");
    const container = $("#listaEscalas");
    container.innerHTML = ""; 

    const cargoFiltro = filtroCargoSelect ? filtroCargoSelect.value : '';

    if (escalas.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding: 24px;">
            <div class="empty-state-icon">🗂️</div>
            <h3>Nenhuma Escala Salva</h3>
            <p>As escalas que você gerar e salvar aparecerão aqui para consulta futura.</p>
        </div>`;
        parseEmojisInElement(container);
        return;
    }

    if (!cargoFiltro) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Selecione um cargo para ver as escalas salvas.</p>`;
        return;
    }

    const escalasFiltradas = escalas.filter(e => e.cargoId === cargoFiltro);

    if (escalasFiltradas.length === 0) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma escala encontrada para este cargo.</p>`;
        return;
    }

    const escalasAgrupadas = groupEscalasByMonth(escalasFiltradas);
    const anosOrdenados = Object.keys(escalasAgrupadas).sort((a, b) => b.localeCompare(a));

    anosOrdenados.forEach(ano => {
        const fieldsetAno = document.createElement('fieldset');
        fieldsetAno.className = 'year-group-fieldset';
        fieldsetAno.innerHTML = `<legend>${ano}</legend>`;
        container.appendChild(fieldsetAno);

        const mesesDoAno = escalasAgrupadas[ano];
        const mesesOrdenados = Object.keys(mesesDoAno).sort((a, b) => b.localeCompare(a));

        mesesOrdenados.forEach(mesNumero => {
            const nomeMes = new Date(ano, parseInt(mesNumero) - 1, 1).toLocaleString('pt-BR', { month: 'long' });
            const tituloMes = document.createElement('h3');
            tituloMes.className = 'home-section-title';
            tituloMes.style.marginTop = '0';
            tituloMes.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
            fieldsetAno.appendChild(tituloMes);

            const gridContainer = document.createElement('div');
            gridContainer.className = 'card-grid';
            fieldsetAno.appendChild(gridContainer);
            
            const escalasDoMes = mesesDoAno[mesNumero].sort((a,b) => b.inicio.localeCompare(a.inicio));

            escalasDoMes.forEach(esc => {
                const temVagas = esc.slots.some(s => !s.assigned);
                const statusIcon = temVagas ? '⚠️' : '✅';
                const statusClass = temVagas ? 'status-warning' : 'status-ok';
                const statusTitle = temVagas ? 'Escala com turnos vagos' : 'Escala completa';

                const card = document.createElement("div");
                card.className = "escala-card";
                card.dataset.viewId = esc.id;
                const periodo = `${new Date(esc.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(esc.fim+'T12:00:00').toLocaleDateString()}`;

                card.innerHTML = `
                    <div class="escala-card-status ${statusClass}" title="${statusTitle}">${statusIcon}</div>
                    <div class="escala-card-content">
                        <h3>${esc.nome}</h3>
                        <p class="muted">${periodo}</p>
                    </div>
                `;
                gridContainer.appendChild(card);
            });
        });
    });
    parseEmojisInElement(container);
}

function verEscalaSalva(id) {
    const { escalas } = store.getState();
    const escala = escalas.find(e => e.id === id);
    if (escala) {
        escalaParaEditar = escala;
        currentEscala = escala; // Garante que currentEscala também seja setado
        escala.owner = 'salva';

        $("#escalaSalvaViewTitle").textContent = escala.nome || 'Visualização da Escala';
        renderGenericEscalaTable(escala, $("#escalaSalvaTabelaWrap"), { isInteractive: false });
        renderPainelDaEscala(escala);
        $("#btnExportarPDF").onclick = () => showExportModal(escala);

        $('#listaEscalasContainer').classList.add('hidden');
        $('#escalaSalvaView').classList.remove('hidden');
        parseEmojisInElement($('#escalaSalvaView'));
    }
}


function editEscalaSalva() {
    if (escalaParaEditar) {
        go('gerar-escala', {
            escalaParaEditar: JSON.parse(JSON.stringify(escalaParaEditar)),
            isEditing: true
        });
    }
}

async function excluirEscalaSalva(id) {
    const confirmado = await handleDeleteItem({
        id: id,
        itemName: 'Escala Salva',
        dispatchAction: 'DELETE_ESCALA_SALVA'
    });

    if (confirmado) {
        $('#escalaSalvaView').classList.add('hidden');
        $('#listaEscalasContainer').classList.remove('hidden');
        escalaParaEditar = null;
        renderEscalasList();
    }
}

function handleEscalasSalvasContainerClick(event) {
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
        currentEscala = null; // Limpa a escala atual ao voltar
    };
    $("#btnEditarEscalaSalva").onclick = editEscalaSalva;

    $("#btnExcluirEscalaSalva").onclick = () => {
        if (escalaParaEditar) {
            excluirEscalaSalva(escalaParaEditar.id);
        }
    };
    
    // CORREÇÃO: O botão de exportar agora usa o handler do pdf-export.js,
    // que verifica por alterações não salvas.
    const exportBtn = $("#btnExportarPDF");
    if(exportBtn) {
        exportBtn.onclick = () => {
            if(escalaParaEditar) {
                showExportModal(escalaParaEditar);
            }
        };
    }


    const pageContainer = $("#page-escalas-salvas");
    if(pageContainer) {
        const filtroCargoSelect = $("#filtroEscalasCargo");
        if (filtroCargoSelect) {
            filtroCargoSelect.addEventListener('change', renderEscalasList);
        }

        const listaEscalas = $("#listaEscalas");
        if(listaEscalas) {
            listaEscalas.addEventListener('click', handleEscalasSalvasContainerClick);
        }
    }
}

document.addEventListener('DOMContentLoaded', initEscalasSalvasPage);