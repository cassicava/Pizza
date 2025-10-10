/**************************************
 * 📊 Relatórios e Métricas (v3 - Por Cargo/Escala)
 **************************************/

// Variáveis para armazenar as instâncias dos gráficos e evitar duplicação
let horasChartInstance = null;
let metaTurnosChartInstance = null;
let folgasSabadoChartInstance = null;
let folgasDomingoChartInstance = null;
let turnosChartInstance = null;

/**
 * Destrói todas as instâncias de gráficos existentes para evitar memory leaks.
 */
function destroyCharts() {
    if(horasChartInstance) horasChartInstance.destroy();
    if(metaTurnosChartInstance) metaTurnosChartInstance.destroy();
    if(folgasSabadoChartInstance) folgasSabadoChartInstance.destroy();
    if(folgasDomingoChartInstance) folgasDomingoChartInstance.destroy();
    if(turnosChartInstance) turnosChartInstance.destroy();
    horasChartInstance = null;
    metaTurnosChartInstance = null;
    folgasSabadoChartInstance = null;
    folgasDomingoChartInstance = null;
    turnosChartInstance = null;
}

/**
 * Lida com a mudança no seletor de CARGO, disparando a renderização da lista de escalas.
 */
function handleRelatorioCargoChange() {
    const cargoId = $("#relatorioCargoSelect").value;
    renderRelatoriosEscalaList(cargoId);
}

/**
 * Renderiza a lista de escalas disponíveis para o cargo selecionado.
 * @param {string} cargoId - O ID do cargo selecionado.
 */
function renderRelatoriosEscalaList(cargoId) {
    const { escalas } = store.getState();
    const container = $("#relatoriosEscalaListContainer");
    const reportsContainer = $("#relatorios-container");
    
    // Esconde os relatórios e limpa a lista anterior
    reportsContainer.classList.add('hidden');
    destroyCharts();
    container.innerHTML = "";

    if (!cargoId) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Selecione um cargo para listar as escalas disponíveis.</p>`;
        return;
    }

    const escalasFiltradas = escalas.filter(e => e.cargoId === cargoId);

    if (escalasFiltradas.length === 0) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma escala salva encontrada para este cargo.</p>`;
        return;
    }

    // Agrupa por ano e mês (mesma lógica de escalas-salvas.js)
    const escalasAgrupadas = escalasFiltradas.reduce((acc, esc) => {
        const ano = esc.inicio.substring(0, 4);
        const mes = esc.inicio.substring(5, 7);
        if (!acc[ano]) acc[ano] = {};
        if (!acc[ano][mes]) acc[ano][mes] = [];
        acc[ano][mes].push(esc);
        return acc;
    }, {});

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
                const card = document.createElement("div");
                card.className = "escala-card";
                card.dataset.escalaId = esc.id;
                const periodo = `${new Date(esc.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(esc.fim+'T12:00:00').toLocaleDateString()}`;
                card.innerHTML = `<h3>${esc.nome}</h3><p class="muted">${periodo}</p>`;
                gridContainer.appendChild(card);
            });
        });
    });
}


/**
 * Exibe o relatório para uma escala específica após o clique no card.
 * @param {string} escalaId - O ID da escala a ser analisada.
 */
async function displayReportForEscala(escalaId) {
    const container = $("#relatorios-container");
    destroyCharts();

    if (!escalaId) {
        container.classList.add('hidden');
        return;
    }
    
    // Adiciona a classe 'active' ao card clicado
    $$('#relatoriosEscalaListContainer .escala-card').forEach(card => {
        card.classList.toggle('active', card.dataset.escalaId === escalaId);
    });

    showLoader("Calculando métricas...");
    await new Promise(res => setTimeout(res, 50));

    try {
        const { escalas } = store.getState();
        const escalaSelecionada = escalas.find(e => e.id === escalaId);

        if (escalaSelecionada) {
            const metrics = calculateMetricsForScale(escalaSelecionada);
            renderMetrics(metrics);
            container.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        showToast("Ocorreu um erro ao gerar este relatório.");
        container.classList.add('hidden');
    } finally {
        hideLoader();
    }
}


/**
 * É chamada quando o usuário navega para a página de relatórios.
 */
function renderRelatoriosPage() {
    const { cargos, escalas } = store.getState();
    const cargoSelect = $("#relatorioCargoSelect");
    const container = $("#relatorios-container");
    const emptyState = $("#relatorios-empty-state");
    const listContainer = $("#relatoriosEscalaListContainer");

    // Limpa e reseta a página
    destroyCharts();
    container.classList.add('hidden');
    listContainer.innerHTML = "";
    cargoSelect.innerHTML = '<option value="">Selecione um cargo...</option>';

    const cargosComEscalasIds = [...new Set(escalas.map(e => e.cargoId))];
    
    if (cargosComEscalasIds.length === 0) {
        emptyState.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>Nenhuma Escala para Analisar</h3>
            <p>Você precisa ter pelo menos uma escala salva para poder visualizar os relatórios.</p>
        </div>`;
        emptyState.classList.remove('hidden');
        cargoSelect.disabled = true;
    } else {
        emptyState.classList.add('hidden');
        cargoSelect.disabled = false;
        const cargosFiltrados = cargos.filter(c => cargosComEscalasIds.includes(c.id))
                                      .sort((a,b) => a.nome.localeCompare(b.nome));
        
        cargosFiltrados.forEach(cargo => {
            const option = document.createElement('option');
            option.value = cargo.id;
            option.textContent = cargo.nome;
            cargoSelect.appendChild(option);
        });
        
        // Inicia a tela com a mensagem para selecionar um cargo
        handleRelatorioCargoChange();
    }
}

/**
 * Inicializa a página de relatórios, adicionando os listeners de eventos.
 */
function initRelatoriosPage() {
    const cargoSelect = $("#relatorioCargoSelect");
    if (cargoSelect) cargoSelect.addEventListener("change", handleRelatorioCargoChange);

    const listContainer = $("#relatoriosEscalaListContainer");
    if (listContainer) {
        listContainer.addEventListener('click', (event) => {
            const card = event.target.closest('.escala-card');
            if(card && card.dataset.escalaId) {
                displayReportForEscala(card.dataset.escalaId);
            }
        });
    }
}


// O restante do arquivo (calculateMetricsForScale, renderMetrics, etc.) permanece o mesmo

function calculateMetricsForScale(escala) {
    const { funcionarios, turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const funcionariosMap = Object.fromEntries(funcionarios.map(f => [f.id, f]));
    const turnosMap = Object.fromEntries(allTurnos.map(t => [t.id, t]));

    const employeeMetrics = {};
    let totalHorasExtras = 0;
    const totalTurnosCount = {};

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const totalSabados = dateRange.filter(d => new Date(d + 'T12:00:00').getUTCDay() === 6).length;
    const totalDomingos = dateRange.filter(d => new Date(d + 'T12:00:00').getUTCDay() === 0).length;

    for (const funcId in escala.historico) {
        if (!funcionariosMap[funcId]) continue; 

        const funcionario = funcionariosMap[funcId];
        const medicao = funcionario.medicaoCarga || 'horas';

        const horasTrabalhadas = (escala.historico[funcId]?.horasTrabalhadas / 60) || 0;
        const turnosTrabalhados = escala.historico[funcId].turnosTrabalhados || 0;
        
        const metaHoras = calcularMetaHoras(funcionario, escala.inicio, escala.fim);
        const metaTurnos = calcularMetaTurnos(funcionario, escala.inicio, escala.fim);
        
        const horasExtras = medicao === 'horas' ? Math.max(0, horasTrabalhadas - metaHoras) : 0;
        
        const turnosDoFunc = escala.slots.filter(s => s.assigned === funcId);
        const turnosCount = {};
        turnosDoFunc.forEach(slot => {
            const turnoNome = turnosMap[slot.turnoId]?.nome || 'Desconhecido';
            turnosCount[turnoNome] = (turnosCount[turnoNome] || 0) + 1;
            totalTurnosCount[turnoNome] = (totalTurnosCount[turnoNome] || 0) + 1;
        });

        const diasTrabalhados = new Set(turnosDoFunc.map(s => s.date));
        let sabadosTrabalhados = 0;
        let domingosTrabalhados = 0;
        diasTrabalhados.forEach(date => {
            const diaSemana = new Date(date + 'T12:00:00').getUTCDay();
            if (diaSemana === 6) sabadosTrabalhados++;
            if (diaSemana === 0) domingosTrabalhados++;
        });

        employeeMetrics[funcId] = {
            nome: funcionario.nome,
            medicaoCarga: medicao,
            horasTrabalhadas,
            metaHoras,
            horasExtras,
            turnosTrabalhados,
            metaTurnos,
            turnosCount,
            sabadosDeFolga: totalSabados - sabadosTrabalhados,
            domingosDeFolga: totalDomingos - domingosTrabalhados,
        };

        totalHorasExtras += horasExtras;
    }

    return {
        employeeMetrics: Object.values(employeeMetrics).sort((a,b) => a.nome.localeCompare(b.nome)),
        totalHorasExtras,
        totalTurnosCount,
    };
}

function renderMetrics(metrics) {
    const { employeeMetrics, totalHorasExtras, totalTurnosCount } = metrics;
    
    $("#summary-horas-extras").textContent = `${totalHorasExtras.toFixed(1)}h`;
    $("#summary-total-funcs").textContent = employeeMetrics.length;
    
    destroyCharts();

    const employeesByHoras = employeeMetrics.filter(e => e.medicaoCarga === 'horas');
    const employeesByTurnos = employeeMetrics.filter(e => e.medicaoCarga === 'turnos');

    const horasChartContainer = $('#horasChartContainerWrapper');
    if (employeesByHoras.length > 0) {
        horasChartContainer.style.display = 'block';
        const horasCtx = $('#horasChart').getContext('2d');
        horasChartInstance = new Chart(horasCtx, {
            type: 'bar',
            data: {
                labels: employeesByHoras.map(e => e.nome),
                datasets: [{
                    label: 'Horas Trabalhadas',
                    data: employeesByHoras.map(e => e.horasTrabalhadas),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                }, {
                    label: 'Meta de Horas',
                    data: employeesByHoras.map(e => e.metaHoras),
                    backgroundColor: 'rgba(203, 213, 225, 0.7)',
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    } else {
        horasChartContainer.style.display = 'none';
    }

    const turnosChartContainer = $('#turnosChartContainerWrapper');
    if (employeesByTurnos.length > 0) {
        turnosChartContainer.style.display = 'block';
        const metaTurnosCtx = $('#metaTurnosChart').getContext('2d');
        metaTurnosChartInstance = new Chart(metaTurnosCtx, {
            type: 'bar',
            data: {
                labels: employeesByTurnos.map(e => e.nome),
                datasets: [{
                    label: 'Turnos Realizados',
                    data: employeesByTurnos.map(e => e.turnosTrabalhados),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                }, {
                    label: 'Meta de Turnos',
                    data: employeesByTurnos.map(e => e.metaTurnos),
                    backgroundColor: 'rgba(203, 213, 225, 0.7)',
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    } else {
        turnosChartContainer.style.display = 'none';
    }

    renderFolgasCharts(employeeMetrics);
    renderTurnosChart(totalTurnosCount);
    renderAusenciasTable(employeeMetrics);
    renderEmployeeShiftDistributionTable(employeeMetrics);
}

function renderTurnosChart(totalTurnosCount) {
    const { turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMap = Object.fromEntries(allTurnos.map(t => [t.nome, t]));

    const turnosCtx = $('#turnosChart').getContext('2d');
    const labels = Object.keys(totalTurnosCount);
    const data = Object.values(totalTurnosCount);
    
    const backgroundColors = labels.map(label => turnosMap[label]?.cor || '#cbd5e1');

    turnosChartInstance = new Chart(turnosCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Turnos',
                data: data,
                backgroundColor: backgroundColors,
            }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderFolgasCharts(employeeMetrics) {
    const labels = employeeMetrics.map(e => e.nome);
    const sabadosData = employeeMetrics.map(e => e.sabadosDeFolga);
    const domingosData = employeeMetrics.map(e => e.domingosDeFolga);

    const options = {
        type: 'bar',
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { stepSize: 1 } } }
        }
    };
    
    const sabadoCtx = $('#folgasSabadoChart').getContext('2d');
    folgasSabadoChartInstance = new Chart(sabadoCtx, {
        ...options,
        data: {
            labels: labels,
            datasets: [{
                label: 'Sábados de Folga',
                data: sabadosData,
                backgroundColor: 'rgba(168, 85, 247, 0.7)',
            }]
        }
    });
    
    const domingoCtx = $('#folgasDomingoChart').getContext('2d');
    folgasDomingoChartInstance = new Chart(domingoCtx, {
        ...options,
        data: {
            labels: labels,
            datasets: [{
                label: 'Domingos de Folga',
                data: domingosData,
                backgroundColor: 'rgba(249, 115, 22, 0.7)',
            }]
        }
    });
}


function renderAusenciasTable(employeeMetrics) {
    const container = $("#ausenciasContainer");
    
    const allAusenciaTypes = new Set();
    employeeMetrics.forEach(emp => {
        Object.keys(emp.turnosCount).forEach(turnoName => {
            const turno = Object.values(TURNOS_SISTEMA_AUSENCIA).find(t => t.nome === turnoName);
            if (turno) allAusenciaTypes.add(turno.nome);
        });
    });

    if (allAusenciaTypes.size === 0) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma ausência registrada nesta escala.</p>`;
        return;
    }
    
    const sortedTypes = Array.from(allAusenciaTypes).sort();

    let tableHTML = `<table class="table table-sm"><thead><tr><th>Funcionário</th>`;
    sortedTypes.forEach(type => tableHTML += `<th>${type}</th>`);
    tableHTML += `<th>Total</th></tr></thead><tbody>`;

    employeeMetrics.forEach(emp => {
        let totalAusencias = 0;
        tableHTML += `<tr><td>${emp.nome}</td>`;
        sortedTypes.forEach(type => {
            const count = emp.turnosCount[type] || 0;
            totalAusencias += count;
            tableHTML += `<td>${count}</td>`;
        });
        tableHTML += `<td><strong>${totalAusencias}</strong></td>`;
        tableHTML += `</tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderEmployeeShiftDistributionTable(employeeMetrics) {
    const container = $("#distribuicaoTurnosContainer");
    
    const allTurnoNames = new Set();
    employeeMetrics.forEach(emp => {
        Object.keys(emp.turnosCount).forEach(turnoName => allTurnoNames.add(turnoName));
    });

    if(allTurnoNames.size === 0) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhum turno alocado nesta escala para exibir a distribuição.</p>`;
        return;
    }

    const sortedTurnoNames = Array.from(allTurnoNames).sort();

    let tableHTML = `<table class="table table-sm"><thead><tr><th>Funcionário</th>`;
    sortedTurnoNames.forEach(name => tableHTML += `<th>${name}</th>`);
    tableHTML += `</tr></thead><tbody>`;

    employeeMetrics.forEach(emp => {
        tableHTML += `<tr><td>${emp.nome}</td>`;
        sortedTurnoNames.forEach(turnoName => {
            tableHTML += `<td>${emp.turnosCount[turnoName] || 0}</td>`;
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

document.addEventListener("DOMContentLoaded", initRelatoriosPage);