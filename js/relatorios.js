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
 * Inicializa a página de relatórios, adicionando os listeners de eventos.
 */
function initRelatoriosPage() {
    const cargoSelect = $("#relatorioCargoSelect");
    const anoSelect = $("#relatorioAnoSelect");
    const escalaSelect = $("#relatorioEscalaSelect");

    if (cargoSelect) cargoSelect.addEventListener("change", handleCargoSelectChange);
    if (anoSelect) anoSelect.addEventListener("change", handleAnoSelectChange);
    if (escalaSelect) escalaSelect.addEventListener("change", handleEscalaSelectChange);
}

/**
 * É chamada quando o usuário navega para a página de relatórios.
 */
function renderRelatoriosPage() {
    const { cargos, escalas } = store.getState();
    const cargoSelect = $("#relatorioCargoSelect");
    const anoSelect = $("#relatorioAnoSelect");
    const escalaSelect = $("#relatorioEscalaSelect");
    const container = $("#relatorios-container");
    const emptyState = $("#relatorios-empty-state");

    // Limpa e reseta a página
    destroyCharts();
    container.classList.add('hidden');
    cargoSelect.innerHTML = '<option value="">Selecione um cargo...</option>';
    anoSelect.innerHTML = '<option value="">Ano</option>';
    escalaSelect.innerHTML = '<option value="">Selecione cargo e ano...</option>';
    anoSelect.disabled = true;
    escalaSelect.disabled = true;

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
    }
}

function handleCargoSelectChange() {
    const cargoId = $("#relatorioCargoSelect").value;
    const anoSelect = $("#relatorioAnoSelect");
    const escalaSelect = $("#relatorioEscalaSelect");

    destroyCharts();
    escalaSelect.innerHTML = '<option value="">Selecione o ano...</option>';
    escalaSelect.disabled = true;
    $("#relatorios-container").classList.add('hidden');

    if (cargoId) {
        // Utiliza a nova função reutilizável
        renderAnoSelect("#relatorioAnoSelect");
        anoSelect.disabled = false;
        anoSelect.showPicker();
    } else {
        anoSelect.innerHTML = '<option value="">Ano</option>';
        anoSelect.disabled = true;
    }
}

function handleAnoSelectChange() {
    const cargoId = $("#relatorioCargoSelect").value;
    const ano = $("#relatorioAnoSelect").value;
    const escalaSelect = $("#relatorioEscalaSelect");
    const { escalas } = store.getState();

    destroyCharts();
    escalaSelect.innerHTML = '<option value="">Selecione a escala...</option>';
    $("#relatorios-container").classList.add('hidden');

    if (!cargoId || !ano) {
        escalaSelect.disabled = true;
        return;
    }

    const escalasFiltradas = escalas.filter(e => e.cargoId === cargoId && e.inicio.startsWith(ano))
                                    .sort((a, b) => b.inicio.localeCompare(a.inicio));
    
    if (escalasFiltradas.length > 0) {
        escalasFiltradas.forEach(escala => {
            const option = document.createElement('option');
            option.value = escala.id;
            option.textContent = escala.nome;
            escalaSelect.appendChild(option);
        });
        escalaSelect.disabled = false;
        escalaSelect.showPicker();
    } else {
        escalaSelect.innerHTML = '<option value="">Nenhuma escala encontrada</option>';
        escalaSelect.disabled = true;
    }
}


/**
 * Lida com a mudança no seletor de ESCALA, disparando os cálculos e a renderização.
 */
async function handleEscalaSelectChange(event) {
    const escalaId = event.target.value;
    const container = $("#relatorios-container");
    destroyCharts();

    if (!escalaId) {
        container.classList.add('hidden');
        return;
    }

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
 * Calcula as métricas para TODOS os funcionários de uma dada escala.
 * @param {object} escala - O objeto da escala salva.
 * @returns {object} - Um objeto contendo todas as métricas calculadas.
 */
function calculateMetricsForScale(escala) {
    const { funcionarios, turnos } = store.getState();
    const funcionariosMap = Object.fromEntries(funcionarios.map(f => [f.id, f]));
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));

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

        const horasTrabalhadas = (escala.historico[funcId].horasTrabalhadas / 60) || 0;
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

        const ausencias = { total: 0 };
        const excecoes = escala.excecoes ? escala.excecoes[funcId] : null;
        if (excecoes) {
            if (excecoes.ferias && excecoes.ferias.dates) {
                ausencias['Férias'] = excecoes.ferias.dates.length;
                ausencias.total += excecoes.ferias.dates.length;
            }
            if (excecoes.folgas) {
                excecoes.folgas.forEach(folga => {
                    ausencias[folga.tipo] = (ausencias[folga.tipo] || 0) + 1;
                    ausencias.total++;
                });
            }
        }

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
            ausencias
        };

        totalHorasExtras += horasExtras;
    }

    return {
        employeeMetrics: Object.values(employeeMetrics).sort((a,b) => a.nome.localeCompare(b.nome)),
        totalHorasExtras,
        totalTurnosCount,
    };
}

/**
 * Renderiza os cards de resumo e os gráficos com as métricas calculadas.
 * @param {object} metrics - O objeto de métricas retornado por calculateMetricsForScale.
 */
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
    const turnosMap = Object.fromEntries(turnos.map(t => [t.nome, t]));

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
        Object.keys(emp.ausencias).forEach(type => {
            if(type !== 'total') allAusenciaTypes.add(type);
        });
    });
    
    if(employeeMetrics.some(e => e.ausencias.total > 0)) {
        allAusenciaTypes.add('Férias');
        TIPOS_FOLGA.forEach(tf => allAusenciaTypes.add(tf.nome));
    }

    if (allAusenciaTypes.size === 0) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma ausência registrada nesta escala.</p>`;
        return;
    }
    
    const sortedTypes = Array.from(allAusenciaTypes).sort();

    let tableHTML = `<table class="table table-sm"><thead><tr><th>Funcionário</th>`;
    sortedTypes.forEach(type => tableHTML += `<th>${type}</th>`);
    tableHTML += `<th>Total</th></tr></thead><tbody>`;

    employeeMetrics.forEach(emp => {
        tableHTML += `<tr><td>${emp.nome}</td>`;
        sortedTypes.forEach(type => {
            tableHTML += `<td>${emp.ausencias[type] || 0}</td>`;
        });
        tableHTML += `<td><strong>${emp.ausencias.total || 0}</strong></td>`;
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