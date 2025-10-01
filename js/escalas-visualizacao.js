/**************************************
 * 📅 Visualização da Escala
 **************************************/

function renderEscalaLegend(escala, container) {
    const { turnos, cargos } = store.getState();
    if (!container) return;
    container.innerHTML = '';
    
    let turnosNaEscalaIds = [];
    // Se a escala é manual e está vazia, mostra todos os turnos do cargo
    if (escala.isManual && escala.slots.length === 0) {
        const cargo = cargos.find(c => c.id === escala.cargoId);
        turnosNaEscalaIds = cargo ? cargo.turnosIds : [];
    } else {
        turnosNaEscalaIds = [...new Set(escala.slots.map(s => s.turnoId))];
    }

    const turnosNaEscala = turnos.filter(t => turnosNaEscalaIds.includes(t.id)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (turnosNaEscala.length === 0 && escala.feriados.length === 0) return;

    const legendaItems = [];

    turnosNaEscala.forEach(turno => {
        legendaItems.push(`<div class="legenda-item"><span class="color-dot" style="background-color: ${turno.cor}"></span><strong>${turno.sigla}</strong> - ${turno.nome}</div>`);
    });

    if(escala.feriados.some(f => f.trabalha)) {
         legendaItems.push(`<div class="legenda-item"><span class="color-dot" style="background-color: #dbeafe"></span> Dia de Feriado</div>`);
    }

    if (legendaItems.length > 0) {
        container.innerHTML = `<h4 style="width: 100%; margin-bottom: 0;">Legenda:</h4>` + legendaItems.join('');
    }
}

function renderGenericEscalaTable(escala, container, options = {}) {
    const { isInteractive = false } = options;
    const { funcionarios, turnos, cargos } = store.getState();

    // CORREÇÃO: Popula a cobertura com todos os turnos do cargo se for manual e vazia.
    let cobertura = escala.cobertura || {};
    if (escala.isManual) {
        const cargo = cargos.find(c => c.id === escala.cargoId);
        if (cargo) {
            cargo.turnosIds.forEach(turnoId => {
                if (!cobertura[turnoId]) {
                    cobertura[turnoId] = 0; // Define como 0 para que apareça no rodapé
                }
            });
        }
    }


    const allFuncsInvolved = new Set();
    escala.slots.forEach(s => { if(s.assigned) allFuncsInvolved.add(s.assigned) });
    Object.keys(escala.excecoes).forEach(funcId => allFuncsInvolved.add(funcId));
    Object.keys(escala.historico || {}).forEach(funcId => allFuncsInvolved.add(funcId));

    const funcsDaEscala = [...allFuncsInvolved].map(funcId => funcionarios.find(f => f.id === funcId)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const turnosDoCargo = turnos.filter(t => cobertura.hasOwnProperty(t.id)).sort((a, b) => a.inicio.localeCompare(b.inicio));

    let tableHTML = `<table class="escala-final-table"><thead><tr><th>Funcionário</th>`;
    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const dia = d.getDate();
        const feriado = escala.feriados.find(f => f.date === date);
        const isFeriado = feriado && feriado.trabalha ? 'feriado' : '';
        const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 'weekend' : '';
        tableHTML += `<th class="${isFeriado} ${isWeekend}" title="${feriado ? feriado.nome : ''}">${dia}<br>${diaSemana}</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;

    funcsDaEscala.forEach(func => {
        const nomeHtml = `
            <td>
                ${func.nome}
                <br>
                <small class="muted">${func.documento || '---'}</small>
            </td>
        `;
        tableHTML += `<tr data-employee-row-id="${func.id}">${nomeHtml}`;
        dateRange.forEach(date => {
            const dataAttrs = isInteractive ? `data-date="${date}" data-employee-id="${func.id}"` : '';
            let cellClass = isInteractive ? 'editable-cell' : '';
            const excecoesFunc = escala.excecoes ? escala.excecoes[func.id] : null;

            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);
            const folgaDoDia = excecoesFunc?.folgas.find(f => f.date === date);
            const emFerias = excecoesFunc?.ferias.dates.includes(date);
            const afastado = excecoesFunc?.afastamento.dates.includes(date);

            if (slot) {
                const turno = turnosMap[slot.turnoId];
                const slotAttr = isInteractive ? `data-slot-id="${slot.id}"` : '';
                const draggableAttr = isInteractive ? `draggable="true"` : '';
                const textColor = getContrastingTextColor(turno.cor);
                tableHTML += `<td class="${cellClass}" style="background-color:${turno.cor}; color: ${textColor};" ${dataAttrs} ${slotAttr} ${draggableAttr} title="${turno.nome}">${turno.sigla}</td>`;
            } else if (emFerias) {
                tableHTML += `<td class="celula-ferias" title="Férias">FÉR</td>`;
            } else if (afastado) {
                const motivo = excecoesFunc.afastamento.motivo || "Afastado";
                tableHTML += `<td class="celula-afastamento" title="${motivo}">AFT</td>`;
            } else if (folgaDoDia) {
                const sigla = TIPOS_FOLGA.find(tf => tf.nome === folgaDoDia.tipo)?.sigla || 'F';
                tableHTML += `<td class="celula-excecao" data-tipo-folga="${folgaDoDia.tipo}" title="${folgaDoDia.tipo}">${sigla}</td>`;
            } else {
                 tableHTML += `<td class="${cellClass}" ${dataAttrs}></td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody>`;

    if (isInteractive) {
        tableHTML += `<tfoot>`;
        turnosDoCargo.forEach(turno => {
            tableHTML += `<tr class="total-row"><td><strong>Total ${turno.sigla}</strong></td>`;
            dateRange.forEach(date => {
                const total = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                tableHTML += `<td>${total}</td>`;
            });
            tableHTML += `</tr>`;
        });
        turnosDoCargo.forEach(turno => {
            let hasVagas = false;
            let rowVagasHTML = `<tr class="vagas-row"><td><strong>Vagas ${turno.sigla}</strong></td>`;
            dateRange.forEach(date => {
                const coberturaNecessaria = cobertura[turno.id] || 0;
                const coberturaAtual = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).length;
                if (coberturaAtual < coberturaNecessaria) {
                    hasVagas = true;
                    const vagaSlot = escala.slots.find(s => s.date === date && s.turnoId === turno.id && !s.assigned);
                    if (vagaSlot) {
                        rowVagasHTML += `<td><button class="btn-add-vaga editable-cell" data-slot-id="${vagaSlot.id}" data-date="${vagaSlot.date}" data-employee-id="null" title="Adicionar funcionário">+</button></td>`;
                    } else {
                        rowVagasHTML += `<td></td>`;
                    }
                } else {
                    rowVagasHTML += `<td></td>`;
                }
            });
            rowVagasHTML += `</tr>`;
            if (hasVagas) tableHTML += rowVagasHTML;
        });
        tableHTML += `</tfoot>`;
    }
    container.innerHTML = tableHTML;
}


function renderResumoDetalhado(escala) {
    const { funcionarios } = store.getState();
    const container = $("#escalaResumoDetalhado");
    if (!escala || !escala.historico) {
        container.innerHTML = "";
        return;
    }
    const funcsDaEscala = funcionarios.filter(f => escala.historico[f.id]).sort((a,b) => a.nome.localeCompare(b.nome));
    if(funcsDaEscala.length === 0) {
        container.innerHTML = "";
        return;
    }

    let html = '<h4>Resumo de Horas no Período</h4>';
    funcsDaEscala.forEach(func => {
        const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
        
        const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);

        let extraInfo = '';
        if (horasTrabalhadas > metaHoras) {
            const horasExtras = horasTrabalhadas - metaHoras;
            extraInfo = `<span style="color:var(--danger); font-weight:bold;"> (+${horasExtras.toFixed(2)}h extra)</span>`;
        } else if (horasTrabalhadas < metaHoras && metaHoras > 0) {
            const horasFaltantes = metaHoras - horasTrabalhadas;
            extraInfo = `<span style="color:var(--brand); font-weight:bold;"> (-${horasFaltantes.toFixed(2)}h)</span>`;
        }
        
        const flashClass = func.id === lastEditedEmployeeId ? 'flash-update' : '';
        html += `<div class="resumo-detalhado-item ${flashClass}"><strong>${func.nome}:</strong> ${horasTrabalhadas.toFixed(2)}h / ${metaHoras.toFixed(2)}h${extraInfo}</div>`;
    });
    container.innerHTML = html;
    
    lastEditedEmployeeId = null;
}

function renderEscalaTable(escala) {
    currentEscala = escala;
    const container = $("#escalaTabelaWrap");
    
    renderGenericEscalaTable(escala, container, { isInteractive: true });
    renderEscalaLegend(escala, $("#escalaViewLegenda"));
    
    // Altera a mensagem de resumo para o modo manual
    if (escala.isManual && escala.slots.filter(s => s.assigned).length === 0) {
        $("#escalaResumo").innerHTML = `Comece a preencher a escala usando a <strong>Caixa de Ferramentas</strong>.`;
    } else {
        const turnosVagos = escala.slots.filter(s => !s.assigned).length;
        $("#escalaResumo").innerHTML = `<strong>Resumo:</strong> ${turnosVagos > 0 ? `<span style="color:red;">${turnosVagos} turnos vagos.</span>` : 'Todos os turnos foram preenchidos.'}`;
    }
    
    $("#gerador-container").classList.add('hidden');
    $("#escalaView").classList.remove('hidden');
    $("#escalaViewTitle").textContent = escala.nome;
    
    renderResumoDetalhado(escala);

    // CORREÇÃO CENTRALIZADA: Inicializa o editor sempre que a tabela interativa é renderizada.
    if (typeof initEditor === 'function') {
        initEditor();
    }
}

async function salvarEscalaAtual(){
    if (currentEscala) {
        store.dispatch('SAVE_ESCALA', currentEscala);
        showToast("Alterações salvas com sucesso!");
    }
}