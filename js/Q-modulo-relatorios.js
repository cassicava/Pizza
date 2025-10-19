/**************************************
 * 📊 Relatórios e Métricas (v4 - Dashboard de Análise de Escala)
 **************************************/

// Estado da página de relatórios
const relatoriosState = {
    cargoId: null,
    ano: null, 
    escalaId: null,
    funcionarioId: null,
    rankingSort: {
        key: 'nome',
        direction: 'asc'
    },
    currentMetrics: null, 
};

// Instâncias dos gráficos
let geralTurnosChartInstance = null;
let folgasChartInstance = null;
let individualComparisonChartInstance = null;

function destroyCharts() {
    if (geralTurnosChartInstance) geralTurnosChartInstance.destroy();
    if (folgasChartInstance) folgasChartInstance.destroy();
    if (individualComparisonChartInstance) individualComparisonChartInstance.destroy();
    geralTurnosChartInstance = null;
    folgasChartInstance = null;
    individualComparisonChartInstance = null;
}

function handleRelatorioCargoChange() {
    relatoriosState.cargoId = $("#relatorioCargoSelect").value;
    relatoriosState.escalaId = null;
    relatoriosState.ano = null; 
    $('#relatorios-dashboard-container').classList.add('hidden');
    
    renderRelatoriosAnoSelect(); 
    renderRelatoriosEscalaList();
}

function renderRelatoriosAnoSelect() {
    const { escalas } = store.getState();
    const anoSelect = $("#relatorioAnoSelect");
    if (!anoSelect) return;

    const cargoId = relatoriosState.cargoId;
    const escalasParaFiltrar = cargoId ? escalas.filter(e => e.cargoId === cargoId) : [];
    
    const anosDisponiveis = [...new Set(escalasParaFiltrar.map(e => e.inicio.substring(0, 4)))].sort((a, b) => b.localeCompare(a));
    
    anoSelect.innerHTML = `<option value="">Selecione um ano...</option>`;
    anosDisponiveis.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        anoSelect.appendChild(option);
    });
    anoSelect.disabled = !cargoId || anosDisponiveis.length === 0;
}

function renderRelatoriosEscalaList() {
    const { escalas } = store.getState();
    const container = $("#relatoriosEscalaListContainer");
    
    container.innerHTML = "";

    const { cargoId, ano } = relatoriosState;

    if (!cargoId || !ano) {
        let message = "Selecione um cargo e um ano para listar as escalas.";
        if(cargoId && !ano) message = "Agora, selecione um ano para continuar.";
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">${message}</p>`;
        return;
    }

    const escalasFiltradas = escalas.filter(e => {
        const matchCargo = e.cargoId === cargoId;
        const matchAno = e.inicio.startsWith(ano);
        return matchCargo && matchAno;
    });

    if (escalasFiltradas.length === 0) {
        container.innerHTML = `<p class="muted" style="text-align: center; padding: 16px;">Nenhuma escala salva encontrada para os filtros selecionados.</p>`;
        return;
    }

    const escalasAgrupadas = groupEscalasByMonth(escalasFiltradas);
    const anosOrdenados = Object.keys(escalasAgrupadas).sort((a, b) => b.localeCompare(a));

    anosOrdenados.forEach(ano => {
        const mesesDoAno = escalasAgrupadas[ano];
        const mesesOrdenados = Object.keys(mesesDoAno).sort((a, b) => b.localeCompare(a));

        mesesOrdenados.forEach(mesNumero => {
            const nomeMes = new Date(ano, parseInt(mesNumero) - 1, 1).toLocaleString('pt-BR', { month: 'long' });
            const tituloMes = document.createElement('h3');
            tituloMes.className = 'home-section-title';
            tituloMes.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
            container.appendChild(tituloMes);

            const gridContainer = document.createElement('div');
            gridContainer.className = 'card-grid';
            container.appendChild(gridContainer);
            
            const escalasDoMes = mesesDoAno[mesNumero].sort((a,b) => b.inicio.localeCompare(a.inicio));

            escalasDoMes.forEach(esc => {
                const temVagas = esc.slots.some(s => !s.assigned);
                const statusIcon = temVagas ? '⚠️' : '✅';
                const statusClass = temVagas ? 'status-warning' : 'status-ok';
                const statusTitle = temVagas ? 'Escala com turnos vagos' : 'Escala completa';

                const card = document.createElement("div");
                card.className = "escala-card";
                card.dataset.escalaId = esc.id;
                const periodo = `<strong>Período:</strong> ${new Date(esc.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(esc.fim+'T12:00:00').toLocaleDateString()}`;
                const modificadoEm = esc.lastModified ? `<p class="muted" style="font-size: 0.8rem; margin-top: 8px;">Atualizado em: ${formatISODate(esc.lastModified)}</p>` : '';

                card.innerHTML = `
                    <div class="escala-card-status ${statusClass}" title="${statusTitle}">${statusIcon}</div>
                    <div class="escala-card-content">
                        <h3>${esc.nome}</h3>
                        <p class="muted">${periodo}</p>
                        ${modificadoEm}
                    </div>
                `;
                gridContainer.appendChild(card);
            });
        });
    });
    parseEmojisInElement(container);
}

async function displayReportForEscala(escalaId) {
    relatoriosState.escalaId = escalaId;
    $$('#relatoriosEscalaListContainer .escala-card').forEach(card => {
        card.classList.toggle('active', card.dataset.escalaId === escalaId);
    });

    showLoader("Calculando métricas...");
    await new Promise(res => setTimeout(res, 50));

    try {
        const { escalas } = store.getState();
        const escalaSelecionada = escalas.find(e => e.id === escalaId);

        if (escalaSelecionada) {
            relatoriosState.currentMetrics = calculateMetricsForScale(escalaSelecionada);
            renderDashboard(relatoriosState.currentMetrics, `Análise da Escala: ${escalaSelecionada.nome}`);
        }
    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        showToast("Ocorreu um erro ao gerar este relatório.");
        $('#relatorios-dashboard-container').classList.add('hidden');
    } finally {
        hideLoader();
    }
}

function renderDashboard(metrics, title) {
    destroyCharts();
    $('#relatorios-dashboard-container').classList.remove('hidden');
    
    const headerContainer = $('#dashboard-header-container');
    headerContainer.innerHTML = `
        <div class="card relatorios-header-card">
            <h2 id="dashboard-title" class="config-card-title" style="border: none; margin: 0; padding: 0;"></h2>
            <div class="painel-tabs" id="dashboard-tabs">
                <button class="painel-tab-btn active" data-tab="visao-geral">Visão Geral</button>
                <button class="painel-tab-btn" data-tab="analise-individual" disabled>Análise Individual</button>
            </div>
        </div>
    `;
    $('#dashboard-title').textContent = title;
    
    relatoriosState.funcionarioId = null;
    
    const tabIndividual = $('#dashboard-tabs [data-tab="analise-individual"]');
    tabIndividual.disabled = true;
    
    renderDashboardKPIs(metrics);
    renderRankingTable(metrics);
    renderAggregateCharts(metrics);
    
    const individualPane = $('#analise-individual-content');
    individualPane.innerHTML = '';
    
    $$('#dashboard-tabs .painel-tab-btn').forEach(t => t.classList.toggle('active', t.dataset.tab === 'visao-geral'));
    $$('#dashboard-content .dashboard-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === 'visao-geral'));
}


function renderRelatoriosPage() {
    const { cargos, escalas } = store.getState();
    const cargoSelect = $("#relatorioCargoSelect");

    destroyCharts();
    $('#relatorios-dashboard-container').classList.add('hidden');
    $('#relatoriosEscalaListContainer').innerHTML = "";
    cargoSelect.innerHTML = '<option value="">Selecione um cargo...</option>';

    const cargosComEscalasIds = [...new Set(escalas.map(e => e.cargoId))];
    
    if (cargosComEscalasIds.length === 0) {
        $("#relatorios-empty-state").innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>Nenhuma Escala para Analisar</h3>
            <p>Você precisa ter pelo menos uma escala salva para poder visualizar os relatórios.</p>
        </div>`;
        $("#relatorios-empty-state").classList.remove('hidden');
        cargoSelect.disabled = true;
    } else {
        $("#relatorios-empty-state").classList.add('hidden');
        cargoSelect.disabled = false;
        
        const cargosFiltrados = cargos.filter(c => cargosComEscalasIds.includes(c.id))
                                      .sort((a,b) => a.nome.localeCompare(b.nome));
        
        cargosFiltrados.forEach(cargo => {
            const option = document.createElement('option');
            option.value = cargo.id;
            option.textContent = cargo.nome;
            cargoSelect.appendChild(option);
        });
        
        relatoriosState.cargoId = null;
        handleRelatorioCargoChange();
    }
}

function initRelatoriosPage() {
    $("#relatorioCargoSelect").addEventListener("change", handleRelatorioCargoChange);

    $("#relatorioAnoSelect").addEventListener('change', () => {
        relatoriosState.ano = $("#relatorioAnoSelect").value;
        renderRelatoriosEscalaList();
    });

    $("#relatoriosEscalaListContainer").addEventListener('click', (event) => {
        const card = event.target.closest('.escala-card');
        if(card && card.dataset.escalaId) {
            displayReportForEscala(card.dataset.escalaId);
        }
    });

    $('#relatorios-dashboard-container').addEventListener('click', (e) => {
        const btn = e.target.closest('#dashboard-tabs .painel-tab-btn');
        if (!btn || btn.disabled) return;
        $$('#dashboard-tabs .painel-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('#dashboard-content .dashboard-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === btn.dataset.tab));
    });
}

document.addEventListener("DOMContentLoaded", initRelatoriosPage);

function calculateMetricsForScale(escala) {
    const { funcionarios, turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const funcionariosMap = new Map(funcionarios.map(f => [f.id, f]));
    const turnosMap = new Map(allTurnos.map(t => [t.id, t]));

    const employeeMetrics = {};
    let totalHorasExtras = 0;
    const totalTurnosCount = {};

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    
    const funcsDaEscala = Object.keys(escala.historico || {});

    funcsDaEscala.forEach(funcId => {
        const funcionario = funcionariosMap.get(funcId);
        if (!funcionario) return;

        const medicao = funcionario.medicaoCarga || 'horas';
        const horasTrabalhadas = (escala.historico[funcId]?.horasTrabalhadas / 60) || 0;
        const turnosTrabalhados = escala.historico[funcId]?.turnosTrabalhados || 0;
        
        const { cargos } = store.getState();
        const cargo = cargos.find(c => c.id === escala.cargoId);
        const cargoDiasOperacionais = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
        
        const metaHoras = calcularMetaHoras(funcionario, escala.inicio, escala.fim);
        const metaTurnos = calcularMetaTurnos(funcionario, escala.inicio, escala.fim, cargoDiasOperacionais);
        
        const horasExtras = medicao === 'horas' ? Math.max(0, horasTrabalhadas - metaHoras) : 0;
        const turnosExtras = medicao === 'turnos' ? Math.max(0, turnosTrabalhados - metaTurnos) : 0;
        
        const turnosDoFunc = escala.slots.filter(s => s.assigned === funcId);
        const turnosCount = {};
        turnosDoFunc.forEach(slot => {
            const turno = turnosMap.get(slot.turnoId);
            if (turno) {
                turnosCount[turno.nome] = (turnosCount[turno.nome] || 0) + 1;
                if (!turno.isSystem) {
                    totalTurnosCount[turno.nome] = (totalTurnosCount[turno.nome] || 0) + 1;
                }
            }
        });

        const diasTrabalhados = new Set(turnosDoFunc.filter(s => !turnosMap.get(s.turnoId)?.isSystem).map(s => s.date));
        let sabadosTrabalhados = 0;
        let domingosTrabalhados = 0;
        dateRange.forEach(date => {
            const diaSemana = new Date(date + 'T12:00:00').getUTCDay();
            if (diaSemana === 6 && diasTrabalhados.has(date)) sabadosTrabalhados++;
            if (diaSemana === 0 && diasTrabalhados.has(date)) domingosTrabalhados++;
        });
        
        const totalSabados = dateRange.filter(d => new Date(d + 'T12:00:00').getUTCDay() === 6).length;
        const totalDomingos = dateRange.filter(d => new Date(d + 'T12:00:00').getUTCDay() === 0).length;

        employeeMetrics[funcId] = {
            id: funcId,
            nome: funcionario.nome,
            medicaoCarga: medicao,
            horasTrabalhadas,
            metaHoras,
            saldoHoras: horasTrabalhadas - metaHoras,
            horasExtras,
            turnosTrabalhados,
            metaTurnos,
            saldoTurnos: turnosTrabalhados - metaTurnos,
            turnosExtras,
            turnosCount,
            sabadosDeFolga: totalSabados - sabadosTrabalhados,
            domingosDeFolga: totalDomingos - domingosTrabalhados,
        };

        totalHorasExtras += horasExtras;
    });

    return {
        employeeMetrics: Object.values(employeeMetrics).sort((a,b) => a.nome.localeCompare(b.nome)),
        totalHorasExtras,
        totalTurnosCount,
        escala
    };
}

function renderDashboardKPIs(metrics) {
    const { employeeMetrics, totalTurnosCount, totalHorasExtras } = metrics;
    let totalHoras = 0, totalAusencias = 0;

    employeeMetrics.forEach(emp => {
        totalHoras += emp.horasTrabalhadas;
        if(emp.turnosCount) {
            Object.keys(emp.turnosCount).forEach(turnoNome => {
                if (Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === turnoNome)) {
                    totalAusencias += emp.turnosCount[turnoNome];
                }
            });
        }
    });
    
    const turnoFrequente = Object.entries(totalTurnosCount)
        .sort((a, b) => b[1] - a[1])[0];

    $('#kpi-total-horas').textContent = `${totalHoras.toFixed(1)}h`;
    
    const kpiHorasExtras = $('#kpi-horas-extras');
    kpiHorasExtras.textContent = `${totalHorasExtras.toFixed(1)}h`;
    kpiHorasExtras.parentElement.parentElement.classList.toggle('has-value', totalHorasExtras > 0);


    $('#kpi-ausencias').textContent = totalAusencias;
    $('#kpi-turno-frequente').textContent = turnoFrequente ? turnoFrequente[0] : '-';
}

function renderRankingTable(metrics) {
    const container = $('#relatorio-ranking-table-container');
    const { key, direction } = relatoriosState.rankingSort;

    const sortedEmployees = [...metrics.employeeMetrics].sort((a, b) => {
        let valA = a[key], valB = b[key];
        
        if (key === 'saldo') {
            valA = a.medicaoCarga === 'horas' ? a.saldoHoras : a.saldoTurnos;
            valB = b.medicaoCarga === 'horas' ? b.saldoHoras : b.saldoTurnos;
        } else if (key === 'extras') {
            valA = a.horasExtras;
            valB = b.horasExtras;
        } else if (key === 'ausencias') {
            valA = Object.entries(a.turnosCount).filter(([n, _]) => Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === n)).reduce((sum, [_, c]) => sum + c, 0);
            valB = Object.entries(b.turnosCount).filter(([n, _]) => Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === n)).reduce((sum, [_, c]) => sum + c, 0);
        } else if (key === 'fds') {
            valA = a.sabadosDeFolga + a.domingosDeFolga;
            valB = b.sabadosDeFolga + b.domingosDeFolga;
        }

        if (typeof valA === 'string') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return direction === 'asc' ? valA - valB : valB - valA;
    });

    const getArrow = (sortKey) => (key !== sortKey) ? '' : (direction === 'asc' ? ' ▲' : ' ▼');

    let tableHTML = `<table class="table"><thead><tr>
        <th data-sort-by="nome">Funcionário${getArrow('nome')}</th>
        <th data-sort-by="horasTrabalhadas">Realizado / Meta${getArrow('horasTrabalhadas')}</th>
        <th data-sort-by="saldo">Saldo${getArrow('saldo')}</th>
        <th data-sort-by="extras">Horas Extras${getArrow('extras')}</th>
        <th data-sort-by="ausencias">Ausências${getArrow('ausencias')}</th>
        <th data-sort-by="fds">Folgas FDS (S/D)${getArrow('fds')}</th>
    </tr></thead><tbody>`;

    sortedEmployees.forEach(emp => {
        const isHoras = emp.medicaoCarga === 'horas';
        const realizado = isHoras ? emp.horasTrabalhadas.toFixed(1) + 'h' : emp.turnosTrabalhados;
        const meta = isHoras ? emp.metaHoras.toFixed(1) + 'h' : emp.metaTurnos;
        const saldo = isHoras ? (emp.saldoHoras > 0 ? '+' : '') + emp.saldoHoras.toFixed(1) + 'h' : (emp.saldoTurnos > 0 ? '+' : '') + emp.saldoTurnos;
        const extras = emp.horasExtras.toFixed(1) + 'h';
        const ausencias = Object.entries(emp.turnosCount).filter(([n, _]) => Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === n)).reduce((sum, [_, c]) => sum + c, 0);

        tableHTML += `<tr data-employee-id="${emp.id}" style="cursor: pointer;">
            <td>${emp.nome}</td>
            <td>${realizado} / ${meta}</td>
            <td>${saldo}</td>
            <td>${extras}</td>
            <td>${ausencias}</td>
            <td>${emp.sabadosDeFolga}/${emp.domingosDeFolga}</td>
        </tr>`;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;

    $('thead', container).onclick = e => {
        const th = e.target.closest('th');
        if (!th || !th.dataset.sortBy) return;
        const newKey = th.dataset.sortBy;
        relatoriosState.rankingSort.direction = (relatoriosState.rankingSort.key === newKey && relatoriosState.rankingSort.direction === 'desc') ? 'asc' : 'desc';
        relatoriosState.rankingSort.key = newKey;
        renderRankingTable(metrics);
    };
    
    $('tbody', container).onclick = e => {
        const tr = e.target.closest('tr');
        if (!tr || !tr.dataset.employeeId) return;
        relatoriosState.funcionarioId = tr.dataset.employeeId;
        renderIndividualAnalysis(metrics, relatoriosState.funcionarioId);
    };
}

function renderAggregateCharts(metrics) {
    const { totalTurnosCount, employeeMetrics } = metrics;
    const { turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMap = Object.fromEntries(allTurnos.map(t => [t.nome, t]));

    const turnosData = Object.entries(totalTurnosCount).sort((a,b) => b[1] - a[1]);

    const turnosCtx = $('#geralTurnosChart').getContext('2d');
    geralTurnosChartInstance = new Chart(turnosCtx, {
        type: 'doughnut',
        data: { labels: turnosData.map(d => d[0]), datasets: [{ data: turnosData.map(d => d[1]), backgroundColor: turnosData.map(d => turnosMap[d[0]]?.cor || '#cbd5e1') }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const folgasCtx = $('#folgasChart').getContext('2d');
    folgasChartInstance = new Chart(folgasCtx, {
        type: 'bar',
        data: {
            labels: employeeMetrics.map(e => e.nome),
            datasets: [
                { label: 'Sábados de Folga', data: employeeMetrics.map(e => e.sabadosDeFolga), backgroundColor: 'rgba(168, 85, 247, 0.7)' },
                { label: 'Domingos de Folga', data: employeeMetrics.map(e => e.domingosDeFolga), backgroundColor: 'rgba(249, 115, 22, 0.7)' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
}

function renderIndividualAnalysis(metrics, employeeId) {
    const employeeData = metrics.employeeMetrics.find(emp => emp.id === employeeId);
    if (!employeeData) return;

    const tabBtn = $('#dashboard-tabs [data-tab="analise-individual"]');
    tabBtn.disabled = false;
    tabBtn.click();

    const container = $('#analise-individual-content');
    const ausenciasCount = Object.entries(employeeData.turnosCount)
        .filter(([n, _]) => Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === n))
        .reduce((sum, [_, c]) => sum + c, 0);

    container.innerHTML = `
        <div class="analise-individual-grid">
            <div class="analise-individual-col-left">
                <div class="card">
                    <h3 class="config-card-title">${employeeData.nome}</h3>
                    <div class="kpi-grid">
                        <div class="card kpi-card"><h4>Realizado</h4><p>${employeeData.medicaoCarga === 'horas' ? employeeData.horasTrabalhadas.toFixed(1) + 'h' : employeeData.turnosTrabalhados}</p></div>
                        <div class="card kpi-card"><h4>Meta</h4><p>${employeeData.medicaoCarga === 'horas' ? employeeData.metaHoras.toFixed(1) + 'h' : employeeData.metaTurnos}</p></div>
                        <div class="card kpi-card"><h4>Saldo</h4><p class="${(employeeData.medicaoCarga === 'horas' ? employeeData.saldoHoras : employeeData.saldoTurnos) > 0 ? 'positive' : 'negative'}">${employeeData.medicaoCarga === 'horas' ? (employeeData.saldoHoras > 0 ? '+' : '') + employeeData.saldoHoras.toFixed(1) + 'h' : (employeeData.saldoTurnos > 0 ? '+' : '') + employeeData.saldoTurnos}</p></div>
                        <div class="card kpi-card"><h4>Ausências</h4><p>${ausenciasCount}</p></div>
                    </div>
                </div>
                <div class="card" id="individual-turnos-table-container">
                </div>
            </div>
            <div class="analise-individual-col-right">
                <div class="card">
                    <div class="analise-individual-calendar" id="individual-calendar-container"></div>
                </div>
            </div>
        </div>
    `;

    renderIndividualTurnosTable($('#individual-turnos-table-container'), employeeData);
    renderIndividualActivityCalendar(metrics.escala, employeeData);
}

function renderIndividualTurnosTable(container, employeeData) {
    if (!container) return;

    const turnosDeTrabalho = Object.entries(employeeData.turnosCount)
        .filter(([nome, _]) => !Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === nome))
        .sort((a,b) => b[1] - a[1]);

    if (turnosDeTrabalho.length === 0) {
        container.innerHTML = `
            <h3 class="config-card-title">Resumo de Turnos</h3>
            <p class="muted" style="text-align:center;">Nenhum turno de trabalho alocado para este funcionário na escala.</p>`;
        return;
    }

    const tableRows = turnosDeTrabalho.map(([nome, quantidade]) => `
        <tr>
            <td>${nome}</td>
            <td>${quantidade}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <h3 class="config-card-title">Resumo de Turnos Realizados</h3>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Tipo de Turno</th>
                    <th>Quantidade</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

function renderIndividualActivityCalendar(escala, employeeData) {
    const container = $('#individual-calendar-container');
    const { turnos } = store.getState();
    const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMap = new Map(allTurnos.map(t => [t.id, t]));
    
    const slotsDoFunc = escala.slots.filter(s => s.assigned === employeeData.id);
    const slotsByDate = Object.fromEntries(slotsDoFunc.map(s => [s.date, s]));
    
    const rangeSet = new Set(dateRangeInclusive(escala.inicio, escala.fim));
    
    let html = '';
    const months = {};
    rangeSet.forEach(date => { const monthKey = date.substring(0, 7); if (!months[monthKey]) months[monthKey] = true; });
    
    Object.keys(months).sort().forEach(monthKey => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthName = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        html += `<h4 class="month-title">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h4><div class="calendar-grid">${DIAS_SEMANA.map(d => `<div class="calendar-header">${d.abrev}</div>`).join('')}${Array(firstDayOfMonth).fill('<div class="calendar-day empty"></div>').join('')}`;

        for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            if (!rangeSet.has(date)) {
                html += '<div class="calendar-day empty"></div>';
                continue;
            }
            
            const slot = slotsByDate[date];
            const turno = slot ? turnosMap.get(slot.turnoId) : null;
            let cellContent = `<span class="day-number">${dayNumber}</span>`;
            let cellStyle = '';
            
            if (turno) {
                const textColor = getContrastingTextColor(turno.cor);
                cellStyle = `background-color: ${turno.cor}; color: ${textColor};`;
                cellContent += `<span class="day-shift-sigla">${turno.sigla}</span>`;
            }
            
            html += `<div class="calendar-day" style="${cellStyle}">${cellContent}</div>`;
        }
        html += '</div>';
    });
    
    container.innerHTML = html;
}