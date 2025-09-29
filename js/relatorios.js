/**************************************
 * 📊 Relatórios e Métricas (v3 - Por Cargo/Escala)
 **************************************/

// Variáveis para armazenar as instâncias dos gráficos e evitar duplicação
let horasChartInstance = null;
let folgasChartInstance = null;
let turnosChartInstance = null;

/**
 * Inicializa a página de relatórios, adicionando os listeners de eventos.
 */
function initRelatoriosPage() {
    const cargoSelect = $("#relatorioCargoSelect");
    const escalaSelect = $("#relatorioEscalaSelect");

    if (cargoSelect) {
        cargoSelect.addEventListener("change", handleCargoSelectChange);
    }
    if (escalaSelect) {
        escalaSelect.addEventListener("change", handleEscalaSelectChange);
    }
}

/**
 * É chamada quando o usuário navega para a página de relatórios.
 * Popula o seletor com os cargos que possuem escalas salvas.
 */
function renderRelatoriosPage() {
    const { cargos, escalas } = store.getState();
    const cargoSelect = $("#relatorioCargoSelect");
    const escalaSelect = $("#relatorioEscalaSelect");
    const container = $("#relatorios-container");
    const emptyState = $("#relatorios-empty-state");

    // Limpa e reseta a página
    container.classList.add('hidden');
    cargoSelect.innerHTML = '<option value="">Selecione um cargo...</option>';
    escalaSelect.innerHTML = '<option value="">Primeiro, selecione um cargo...</option>';
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

/**
 * Lida com a mudança no seletor de CARGO.
 * Popula o seletor de escalas com base no cargo selecionado.
 */
function handleCargoSelectChange(event) {
    const cargoId = event.target.value;
    const { escalas } = store.getState();
    const escalaSelect = $("#relatorioEscalaSelect");
    const container = $("#relatorios-container");

    container.classList.add('hidden');
    escalaSelect.innerHTML = '<option value="">Selecione uma escala...</option>';

    if (!cargoId) {
        escalaSelect.disabled = true;
        return;
    }

    const escalasDoCargo = escalas.filter(e => e.cargoId === cargoId)
                                  .sort((a, b) => b.inicio.localeCompare(a.inicio));

    if (escalasDoCargo.length > 0) {
        escalasDoCargo.forEach(escala => {
            const option = document.createElement('option');
            option.value = escala.id;
            option.textContent = escala.nome;
            escalaSelect.appendChild(option);
        });
        escalaSelect.disabled = false;
    } else {
        escalaSelect.disabled = true;
    }
}


/**
 * Lida com a mudança no seletor de ESCALA, disparando os cálculos e a renderização.
 */
async function handleEscalaSelectChange(event) {
    const escalaId = event.target.value;
    const container = $("#relatorios-container");

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
        const horasTrabalhadas = (escala.historico[funcId].horasTrabalhadas / 60) || 0;
        const metaHoras = calcularMetaHoras(funcionario, escala.inicio, escala.fim);
        const horasExtras = Math.max(0, horasTrabalhadas - metaHoras);
        
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
            horasTrabalhadas,
            metaHoras,
            horasExtras,
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
        totalTurnosCount
    };
}

/**
 * Renderiza os cards de resumo e os gráficos com as métricas calculadas.
 * @param {object} metrics - O objeto de métricas retornado por calculateMetricsForScale.
 */
function renderMetrics(metrics) {
    const { employeeMetrics, totalHorasExtras, totalTurnosCount } = metrics;
    
    const summaryContainer = $("#relatorios-summary-cards");
    summaryContainer.innerHTML = `
        <div class="card">
            <h3>Total de Horas Extras</h3>
            <p style="font-size: 2rem; font-weight: bold; color: var(--brand);">${totalHorasExtras.toFixed(1)}h</p>
        </div>
        <div class="card">
            <h3>Total de Funcionários na Escala</h3>
            <p style="font-size: 2rem; font-weight: bold; color: var(--brand);">${employeeMetrics.length}</p>
        </div>
    `;

    const labels = employeeMetrics.map(e => e.nome);

    if(horasChartInstance) horasChartInstance.destroy();
    if(folgasChartInstance) folgasChartInstance.destroy();
    if(turnosChartInstance) turnosChartInstance.destroy();

    const horasCtx = $('#horasChart').getContext('2d');
    horasChartInstance = new Chart(horasCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas Trabalhadas',
                data: employeeMetrics.map(e => e.horasTrabalhadas),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }, {
                label: 'Meta de Horas',
                data: employeeMetrics.map(e => e.metaHoras),
                backgroundColor: 'rgba(203, 213, 225, 0.7)',
                borderColor: 'rgba(203, 213, 225, 1)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    const folgasCtx = $('#folgasChart').getContext('2d');
    folgasChartInstance = new Chart(folgasCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sábados de Folga',
                data: employeeMetrics.map(e => e.sabadosDeFolga),
                backgroundColor: 'rgba(168, 85, 247, 0.7)', 
            }, {
                label: 'Domingos de Folga',
                data: employeeMetrics.map(e => e.domingosDeFolga),
                backgroundColor: 'rgba(249, 115, 22, 0.7)',
            }]
        },
        options: { 
            responsive: true, 
            indexAxis: 'y', 
            scales: { 
                x: { 
                    stacked: true, 
                    ticks: { stepSize: 1 }
                }, 
                y: { stacked: true } 
            } 
        }
    });

    renderTurnosChart(totalTurnosCount);
    renderAusenciasTable(employeeMetrics);
}

/**
 * Renderiza o gráfico de círculo com a distribuição de turnos.
 * @param {object} totalTurnosCount - Objeto com a contagem total de cada tipo de turno.
 */
function renderTurnosChart(totalTurnosCount) {
    const turnosCtx = $('#turnosChart').getContext('2d');
    const labels = Object.keys(totalTurnosCount);
    const data = Object.values(totalTurnosCount);
    
    const colors = [
        'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(20, 184, 166, 0.8)'
    ];

    turnosChartInstance = new Chart(turnosCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distribuição de Turnos',
                data: data,
                backgroundColor: colors,
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/**
 * Renderiza a tabela com o resumo de ausências.
 * @param {Array} employeeMetrics - O array com as métricas de todos os funcionários.
 */
function renderAusenciasTable(employeeMetrics) {
    const container = $("#ausenciasContainer");
    
    const folgaTypes = [...TIPOS_FOLGA.map(t => t.nome)];
    const allAusenciaTypes = new Set(['Férias']);
    employeeMetrics.forEach(emp => {
        Object.keys(emp.ausencias).forEach(type => {
            if(type !== 'total') allAusenciaTypes.add(type);
        });
    });
    
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


document.addEventListener("DOMContentLoaded", initRelatoriosPage);