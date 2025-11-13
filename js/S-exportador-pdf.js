let currentEscalaToExport = null;

function showExportModal(escala) {
    currentEscalaToExport = escala;
    const backdrop = $('#exportModalBackdrop');
    const modal = $('#exportModal');
    if (!backdrop || !modal) return;

    backdrop.classList.remove('hidden', 'modal-hiding');
    void modal.offsetWidth;
    modal.classList.add('modal-showing');
}

function hideExportModal() {
    const backdrop = $('#exportModalBackdrop');
    const modal = $('#exportModal');
    if (!backdrop || !modal) return;

    backdrop.classList.add('modal-hiding');
    modal.classList.remove('modal-showing');

    backdrop.addEventListener('transitionend', () => {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('modal-hiding');
    }, { once: true });
    
    currentEscalaToExport = null;
}

function generateVisaoGeralPDF(escala) {
    if (!escala.snapshot) {
        const { funcionarios, turnos } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
        const funcsInvolvedIds = new Set(escala.slots.filter(s => s.assigned).map(s => s.assigned));
        const turnosInvolvedIds = new Set(escala.slots.filter(s => s.assigned).map(s => s.turnoId));

        escala.snapshot = { funcionarios: {}, turnos: {} };

        funcsInvolvedIds.forEach(id => {
            const func = funcionarios.find(f => f.id === id);
            if (func) escala.snapshot.funcionarios[id] = { nome: func.nome, documento: func.documento };
        });
        turnosInvolvedIds.forEach(id => {
            const turno = allTurnos.find(t => t.id === id);
            if (turno) escala.snapshot.turnos[id] = { nome: turno.nome, sigla: turno.sigla, cor: turno.cor, inicio: turno.inicio, fim: turno.fim };
        });
    }


    if (!escala || !escala.snapshot || !escala.snapshot.turnos || !escala.snapshot.funcionarios) {
        throw new Error("Dados da escala incompletos. Salve a escala novamente antes de exportar.");
    }
    const { cargos, equipes } = store.getState();
    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;

    const getTurnoInfo = (turnoId) => escala.snapshot.turnos?.[turnoId] || {};
    const getFuncInfo = (funcId) => escala.snapshot.funcionarios?.[funcId] || {};

    const funcsDaEscalaIds = Object.keys(escala.historico || {});

    const equipesMap = new Map();
    equipes.filter(e => e.cargoId === escala.cargoId).forEach(e => {
        e.funcionarioIds.forEach(funcId => equipesMap.set(funcId, e.id));
    });

    const funcsDaEscala = funcsDaEscalaIds
        .map(id => ({ id, ...getFuncInfo(id), equipeId: equipesMap.get(id) }))
        .filter(f => f.nome)
        .sort((a,b) => {
            if (a.equipeId && !b.equipeId) return -1;
            if (!a.equipeId && b.equipeId) return 1;
            if (a.equipeId && b.equipeId && a.equipeId !== b.equipeId) {
                const equipeA = equipes.find(e => e.id === a.equipeId)?.nome || '';
                const equipeB = equipes.find(e => e.id === b.equipeId)?.nome || '';
                return equipeA.localeCompare(equipeB);
            }
            return a.nome.localeCompare(b.nome);
        });


    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);

    doc.setFontSize(18);
    doc.text(escala.nome, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    doc.setFontSize(10);

    const head = [['Funcionário', ...dateRange.map(date => {
        const d = new Date(date + 'T12:00:00');
        const dia = d.getDate();
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).charAt(0).toUpperCase();
        return `${dia}\n${diaSemana}`;
    })]];

    const body = funcsDaEscala.map(func => {
        const nomeComDocumento = `${func.nome}\n${func.documento || '---'}`;
        const row = [nomeComDocumento];
        dateRange.forEach(date => {
            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);
            if (slot) row.push(getTurnoInfo(slot.turnoId)?.sigla || '?');
            else row.push('');
        });
        return row;
    });

    const pageMargin = 40;
    const availableWidth = doc.internal.pageSize.getWidth() - (pageMargin * 2);
    const funcColWidth = 60;
    const dateColWidth = (availableWidth - funcColWidth) / dateRange.length;
    const cellHeight = dateColWidth < 20 ? 20 : dateColWidth;

    doc.autoTable({
        head: head,
        body: body,
        startY: 60,
        theme: 'grid',
        styles: {
            fontSize: 8,
            halign: 'center',
            valign: 'middle',
            minCellHeight: cellHeight,
            lineColor: [180, 180, 180],
            lineWidth: 0.5,
        },
        headStyles: {
            fillColor: [22, 163, 74],
            textColor: 255,
            fontStyle: 'bold',
            valign: 'middle',
            cellPadding: { top: 5, bottom: 5 },
            lineColor: [180, 180, 180],
            lineWidth: 0.5,
        },
        columnStyles: {
            0: {
                halign: 'left',
                fontStyle: 'bold',
                minCellWidth: funcColWidth,
                cellWidth: funcColWidth,
                fontSize: 6,
                lineHeight: 1,
                cellPadding: { left: 5, right: 5 }
            }
        },
        didParseCell: function (data) {
            if (data.section === 'head' && data.column.index === 0) {
                data.cell.styles.fontSize = 8;
            }
             if (data.section === 'body' && data.column.index === 0) {
                const func = funcsDaEscala[data.row.index];
                if (func && func.equipeId) {
                     data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        },
        didDrawCell: (data) => {
            const func = funcsDaEscala[data.row.index];
            const date = dateRange[data.column.index - 1];

            if (data.section === 'body' && data.column.index > 0 && func && date) { 
                const d = new Date(date + 'T12:00:00');
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
                const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

                const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);
                const turnoInfo = slot ? getTurnoInfo(slot.turnoId) : null;

                let text = data.cell.text.toString().trim();
                let bgColor = '';
                let textColor = [0, 0, 0];
                let fontStyle = 'normal';

                if (slot && turnoInfo) {
                    bgColor = turnoInfo.cor;
                    textColor = getContrastingTextColor(turnoInfo.cor) === '#FFFFFF' ? [255, 255, 255] : [0, 0, 0];
                    fontStyle = 'bold';
                    text = turnoInfo.sigla;
                } else if (feriadoFolga) {
                    bgColor = '#eef2ff';
                    textColor = [67, 56, 202];
                    text = 'FG';
                    fontStyle = 'bold';
                } else if (isCargoDiaNaoUtil) {
                    bgColor = '#f1f5f9';
                    text = '';
                } else {
                    bgColor = (func && func.equipeId) ? '#f0f0f0' : '#ffffff';
                }

                if (bgColor) {
                    doc.setFillColor(bgColor); 
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                }

                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                doc.setFont(undefined, fontStyle);
                doc.setFontSize(data.cell.styles.fontSize);

                if (text) {
                     const textWidth = doc.getTextWidth(text);
                     const textX = data.cell.x + (data.cell.width - textWidth) / 2;
                     const textY = data.cell.y + (data.cell.height / 2);

                     doc.text(text, textX, textY, { valign: 'middle' });
                }
            }
        },
    });

    let finalY = doc.lastAutoTable.finalY || 60;

    const legendItems = [];
    const turnosNaEscalaIds = [...new Set(escala.slots.filter(s => s.assigned).map(s => s.turnoId))];

    turnosNaEscalaIds.forEach(turnoId => {
        const t = getTurnoInfo(turnoId);
        if (t.sigla && t.nome) {
            const text = (t.isSystem || !t.inicio)
                ? `${t.sigla} - ${t.nome}`
                : `${t.sigla} - ${t.nome}\n(${t.inicio} - ${t.fim})`;
            legendItems.push({ color: t.cor, text: text, isSystem: t.isSystem, inicio: t.inicio });
        }
    });

    const hasFolgaGeral = escala.feriados.some(f => !f.trabalha);
    if (hasFolgaGeral) {
        legendItems.push({ color: '#eef2ff', text: 'FG - Folga Geral', isSystem: true, inicio: '00:00' });
    }

    legendItems.sort((a,b) => {
        if(a.isSystem && !b.isSystem) return -1;
        if(!a.isSystem && b.isSystem) return 1;
        if(!a.inicio || !b.inicio) return 0;
        return a.inicio.localeCompare(b.inicio);
    });

    const rectSize = 10;
    const spacing = 15;
    const textSpacing = 4;
    const lineHeight = 9;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');

    let totalLegendWidth = 0;
    legendItems.forEach(item => {
        const textLines = item.text.split('\n');
        const maxWidth = Math.max(...textLines.map(line => doc.getTextWidth(line)));
        totalLegendWidth += rectSize + textSpacing + maxWidth + spacing;
    });
    totalLegendWidth -= spacing;

    let legendX = (doc.internal.pageSize.getWidth() - totalLegendWidth) / 2;
    const legendY = finalY + 25;

    legendItems.forEach(item => {
        doc.setFillColor(item.color);
        doc.setDrawColor(50);
        doc.rect(legendX, legendY - rectSize / 2, rectSize, rectSize, 'FD');

        doc.setTextColor(0, 0, 0);

        const textLines = item.text.split('\n');
        let textYPos = legendY;
        if (textLines.length > 1) {
            textYPos = legendY - (lineHeight / 4);
        }

        doc.text(textLines, legendX + rectSize + textSpacing, textYPos, {
            valign: 'middle',
            lineHeightFactor: 1.1
        });

        const maxWidth = Math.max(...textLines.map(line => doc.getTextWidth(line)));
        legendX += rectSize + textSpacing + maxWidth + spacing;
    });

    doc.addPage();
    let currentY = 40;

    if (escala.observacoes && escala.observacoes.trim() !== '') {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Observações', 40, currentY);
        currentY += 15;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const observacoesLines = doc.splitTextToSize(escala.observacoes.trim(), pageWidth - 80);
        doc.text(observacoesLines, 40, currentY);
        currentY += (observacoesLines.length * 12) + 30;
    }

    const feriadosFolga = escala.feriados.filter(f => !f.trabalha);
    if (feriadosFolga.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Feriados com Folga Geral', 40, currentY);
        currentY += 15;

        const feriadosHead = [['Data', 'Nome do Feriado']];
        const feriadosBody = feriadosFolga.map(f => {
            const dataFormatada = new Date(f.date + 'T12:00:00').toLocaleDateString('pt-BR');
            return [dataFormatada, f.nome];
        });

        doc.autoTable({
            head: feriadosHead,
            body: feriadosBody,
            startY: currentY,
            theme: 'striped',
            headStyles: { fillColor: [45, 55, 72] },
        });

        currentY = doc.lastAutoTable.finalY + 30;
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Resumo de Carga Horária no Período', 40, currentY);
    currentY += 20;

    const resumoHead = [['Funcionário', 'Meta', 'Realizado', 'Saldo']];
    const resumoBody = funcsDaEscala.map(func => {
        let metaLabel = '';
        let realizadoLabel = '';
        let saldoLabel = '';
        const funcionarioOriginal = store.getState().funcionarios.find(f => f.id === func.id);

        if (funcionarioOriginal) {
            const medicao = funcionarioOriginal.medicaoCarga || 'horas';
            const temOverride = escala.metasOverride && escala.metasOverride[func.id] !== undefined;

             if (medicao === 'turnos') {
                const { cargos } = store.getState();
                const cargo = cargos.find(c => c.id === escala.cargoId);
                const cargoDiasOperacionais = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);

                const metaOriginal = calcularMetaTurnos(funcionarioOriginal, escala.inicio, escala.fim, cargoDiasOperacionais);
                const metaTurnos = temOverride ? parseFloat(escala.metasOverride[func.id]) : metaOriginal;
                const realizadoTurnos = escala.historico[func.id]?.turnosTrabalhados || 0;
                const saldo = realizadoTurnos - metaTurnos;

                metaLabel = `${metaTurnos.toFixed(0)} turnos`;
                realizadoLabel = `${realizadoTurnos} turnos`;
                saldoLabel = `${saldo > 0 ? '+' : ''}${saldo.toFixed(0)} turnos`;
            } else {
                const horasTrabalhadas = (escala.historico[func.id]?.horasTrabalhadas / 60) || 0;
                
                const metaOriginal = calcularMetaHoras(funcionarioOriginal, escala.inicio, escala.fim);
                const metaHoras = temOverride ? parseFloat(escala.metasOverride[func.id]) : metaOriginal;
                
                const saldo = horasTrabalhadas - metaHoras;

                metaLabel = `${metaHoras.toFixed(1)}h`;
                realizadoLabel = `${horasTrabalhadas.toFixed(1)}h`;
                saldoLabel = `${saldo > 0 ? '+' : ''}${saldo.toFixed(1)}h`;
            }
        } else {
             metaLabel = 'N/D';
             realizadoLabel = 'N/D';
             saldoLabel = 'N/D';
        }

        return [func.nome, metaLabel, realizadoLabel, saldoLabel];
    });


    doc.autoTable({
        head: resumoHead,
        body: resumoBody,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [45, 55, 72] },
    });

    return doc;
}


function generateRelatorioDiarioPDF(escala) {
    if (!escala.snapshot) {
        const { funcionarios, turnos } = store.getState();
        const allTurnos = [...turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
        const funcsInvolvedIds = new Set(escala.slots.filter(s => s.assigned).map(s => s.assigned));
        const turnosInvolvedIds = new Set(escala.slots.filter(s => s.assigned).map(s => s.turnoId));

        escala.snapshot = { funcionarios: {}, turnos: {} };

        funcsInvolvedIds.forEach(id => {
            const func = funcionarios.find(f => f.id === id);
            if (func) escala.snapshot.funcionarios[id] = { nome: func.nome, documento: func.documento };
        });
        turnosInvolvedIds.forEach(id => {
            const turno = allTurnos.find(t => t.id === id);
            if (turno) escala.snapshot.turnos[id] = { nome: turno.nome, sigla: turno.sigla, cor: turno.cor, inicio: turno.inicio, fim: turno.fim };
        });
    }

    if (!escala.snapshot || !escala.snapshot.turnos || !escala.snapshot.funcionarios) {
        throw new Error("Dados da escala incompletos. Salve a escala novamente antes de exportar.");
    }
    const { cargos } = store.getState();
    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));


    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const getTurnoInfo = (turnoId) => escala.snapshot.turnos?.[turnoId] || {};
    const getFuncInfo = (funcId) => escala.snapshot.funcionarios?.[funcId] || {};

    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 60;
    const rightMargin = pageWidth - 60;

    dateRange.forEach((date, index) => {
        if (index > 0) doc.addPage();

        doc.setFontSize(14);
        doc.text('Escala Fácil', leftMargin, 40);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(escala.nome, rightMargin, 40, { align: 'right' });
        doc.setLineWidth(1.5);
        doc.setDrawColor(230, 230, 230);
        doc.line(leftMargin, 55, rightMargin, 55);

        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        const diaFormatado = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        let yPos = 100;

        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text(diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1), pageWidth / 2, yPos, { align: 'center' });

        yPos += 20;
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100);
        doc.text(diaFormatado, pageWidth / 2, yPos, { align: 'center' });
        yPos += 25;

        const feriadoDoDia = escala.feriados.find(f => f.date === date);
        const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
        const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

        if (feriadoDoDia) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 102, 204);
            doc.text(`FERIADO: ${feriadoDoDia.nome}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;
            if (!feriadoDoDia.trabalha) {
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(150);
                doc.text('(Folga Geral para este cargo)', pageWidth / 2, yPos, { align: 'center' });
                yPos += 25;
            }
        }

        yPos += 15;

        if (isCargoDiaNaoUtil || (feriadoDoDia && !feriadoDoDia.trabalha)) {
            const boxY = yPos - 10;
            const boxHeight = 50;
            doc.setFillColor(248, 249, 250);
            doc.rect(leftMargin, boxY, rightMargin - leftMargin, boxHeight, 'F');

            doc.setFontSize(12);
            doc.setTextColor(150);
            const mensagem = isCargoDiaNaoUtil ? "Cargo não operacional neste dia" : "Dia de Folga Geral";
            doc.text(mensagem, pageWidth / 2, boxY + boxHeight / 2, { align: 'center', valign: 'middle' });
            yPos += boxHeight;
        } else {
             const turnosDoDiaIds = [...new Set(escala.slots.filter(s => s.date === date).map(s => s.turnoId))];
             const turnosOrdenados = turnosDoDiaIds
                .map(id => ({ id, ...getTurnoInfo(id) }))
                .filter(t => t.id)
                .sort((a,b) => {
                    if(!a.inicio || !b.inicio) return 0;
                    return a.inicio.localeCompare(b.inicio);
                });

            turnosOrdenados.forEach(turno => {
                if (!turno.id) return;

                const funcionariosAlocados = escala.slots
                    .filter(s => s.date === date && s.turnoId === turno.id && s.assigned)
                    .map(s => {
                        const func = getFuncInfo(s.assigned);
                        const isExtra = s.isExtra ? ' (H. Extra)' : '';
                        return `${func.nome || 'Funcionário Removido'}${isExtra}`;
                    });

                if (turno.isSystem && funcionariosAlocados.length === 0) {
                    return;
                }

                const tituloTurno = (turno.isSystem || !turno.inicio)
                    ? turno.nome
                    : `${turno.nome} (${turno.inicio} - ${turno.fim})`;

                const cardY = yPos;

                doc.setFillColor(turno.cor || '#cccccc');
                doc.rect(leftMargin, cardY, 8, 30, 'F');

                doc.setFontSize(13);
                doc.setFont(undefined, 'bold');
                doc.text(tituloTurno, leftMargin + 20, cardY + 19);

                yPos += 35;

                if (funcionariosAlocados.length > 0) {
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(50);

                    funcionariosAlocados.forEach(nome => {
                        doc.text(`\u2022 ${nome}`, leftMargin + 25, yPos);

                        doc.setDrawColor(220, 220, 220);
                        doc.setLineWidth(0.5);
                        doc.line(leftMargin + 25, yPos + 8, rightMargin, yPos + 8);

                        yPos += 25;
                    });

                    const finalCardHeight = yPos - cardY - 10;
                    doc.setFillColor(turno.cor || '#cccccc');
                    doc.rect(leftMargin, cardY + 30, 8, finalCardHeight - 30, 'F');

                } else {
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.text('Nenhum funcionário alocado.', leftMargin + 25, yPos);
                    doc.setTextColor(0);
                    yPos += 22;
                }
                yPos += 15;

                if (yPos > pageHeight - 60) {
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(`Página ${index + 1} de ${dateRange.length}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
                    doc.addPage();
                    yPos = 60;
                }
            });
        }

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${index + 1} de ${dateRange.length}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
    });

    return doc;
}

function generateIndividualReportPDF(escala, funcionarioId) {
    if (!escala || !funcionarioId) {
        throw new Error("Dados insuficientes para gerar o relatório individual (escala ou funcionário ausente).");
    }

    const { funcionarios, turnos } = store.getState();
    const metrics = calculateMetricsForScale(escala);
    const employeeMetrics = metrics.employeeMetrics;
    const employeeData = employeeMetrics.find(emp => emp.id === funcionarioId);
    const funcionario = funcionarios.find(f => f.id === funcionarioId);

    if (!employeeData || !funcionario) {
        throw new Error("Funcionário não encontrado nos dados da escala para gerar o relatório.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    let yPos = margin;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Relatório Individual - ${employeeData.nome}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Escala: ${escala.nome}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    const periodoStr = `Período: ${new Date(escala.inicio+'T12:00:00').toLocaleDateString()} a ${new Date(escala.fim+'T12:00:00').toLocaleDateString()}`;
    doc.text(periodoStr, pageWidth / 2, yPos, { align: 'center' });
    yPos += 30;

    const kpiData = [
        { label: 'Realizado', value: employeeData.medicaoCarga === 'horas' ? employeeData.horasTrabalhadas.toFixed(1) + 'h' : employeeData.turnosTrabalhados },
        { label: 'Meta', value: employeeData.medicaoCarga === 'horas' ? employeeData.metaHoras.toFixed(1) + 'h' : employeeData.metaTurnos },
        { label: 'Saldo', value: employeeData.medicaoCarga === 'horas' ? (employeeData.saldoHoras > 0 ? '+' : '') + employeeData.saldoHoras.toFixed(1) + 'h' : (employeeData.saldoTurnos > 0 ? '+' : '') + employeeData.saldoTurnos },
        { label: 'Ausências', value: Object.entries(employeeData.turnosCount).filter(([n, _]) => Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === n)).reduce((sum, [_, c]) => sum + c, 0) },
    ];

    const kpiBoxWidth = (pageWidth - margin * 2) / kpiData.length - 10 * (kpiData.length -1) / kpiData.length;
    let currentX = margin;

    kpiData.forEach(kpi => {
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(currentX, yPos, kpiBoxWidth, 50, 5, 5, 'FD');
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(kpi.label, currentX + kpiBoxWidth / 2, yPos + 15, { align: 'center' });
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(37, 99, 235);
        if(kpi.label === 'Saldo'){
            const saldo = employeeData.medicaoCarga === 'horas' ? employeeData.saldoHoras : employeeData.saldoTurnos;
             if (saldo > 0) doc.setTextColor(249, 115, 22);
             else if (saldo < 0) doc.setTextColor(100, 116, 139);
             else doc.setTextColor(37, 99, 235);
        }
        doc.text(String(kpi.value), currentX + kpiBoxWidth / 2, yPos + 35, { align: 'center' });
        currentX += kpiBoxWidth + 10;
    });
    yPos += 50 + 25;

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Resumo de Turnos Realizados', margin, yPos);
    yPos += 15;

    const allTurnosStore = [...store.getState().turnos, ...Object.values(TURNOS_SISTEMA_AUSENCIA)];
    const turnosMapByName = Object.fromEntries(allTurnosStore.map(t => [t.nome, t]));

    const turnosTableBody = Object.entries(employeeData.turnosCount)
        .filter(([nome, _]) => !Object.values(TURNOS_SISTEMA_AUSENCIA).some(t => t.nome === nome))
        .sort((a,b) => b[1] - a[1])
        .map(([nome, quantidade]) => {
            const turnoInfo = turnosMapByName[nome];
            const sigla = turnoInfo ? turnoInfo.sigla : '??';
            return [ { content: sigla, styles: { fillColor: turnoInfo?.cor || '#eee', textColor: getContrastingTextColor(turnoInfo?.cor) === '#FFFFFF' ? 255 : 0 } } , nome, quantidade ];
        });

     if (turnosTableBody.length > 0) {
        doc.autoTable({
            head: [['Sigla', 'Tipo de Turno', 'Quantidade']],
            body: turnosTableBody,
            startY: yPos,
            theme: 'grid',
            styles: {
                lineColor: [180, 180, 180],
                lineWidth: 0.5
            },
            headStyles: {
                fillColor: [45, 55, 72],
                lineColor: [180, 180, 180],
                lineWidth: 0.5
            },
            columnStyles: { 0: { halign: 'center', fontStyle: 'bold' } },
        });
        yPos = doc.lastAutoTable.finalY + 25;
     } else {
         doc.setFontSize(10);
         doc.setTextColor(150);
         doc.text('Nenhum turno de trabalho alocado.', margin, yPos);
         yPos += 25;
     }

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Calendário de Atividades', margin, yPos);
    yPos += 20;

    const turnosMapById = new Map(allTurnosStore.map(t => [t.id, t]));
    const slotsDoFunc = escala.slots.filter(s => s.assigned === funcionarioId);
    const slotsByDate = Object.fromEntries(slotsDoFunc.map(s => [s.date, s]));
    const rangeSet = new Set(dateRangeInclusive(escala.inicio, escala.fim));
    const months = {};
    rangeSet.forEach(date => { const monthKey = date.substring(0, 7); if (!months[monthKey]) months[monthKey] = true; });

    const availableWidthForCalendar = pageWidth - margin * 2;
    const dayWidth = availableWidthForCalendar / 7;
    const dayHeight = 40;
    const dayPadding = 2;

    Object.keys(months).sort().forEach(monthKey => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthName = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        if (yPos + 30 > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), margin, yPos);
        yPos += 15;

        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        DIAS_SEMANA.forEach((dia, index) => {
            doc.setTextColor(100);
             if (index === 0 || index === 6) doc.setTextColor(239, 68, 68);
             doc.text(dia.abrev, margin + index * dayWidth + dayWidth / 2, yPos, { align: 'center' });
        });
        yPos += 15;
        doc.setTextColor(0);

        let currentX = margin + firstDayOfMonth * dayWidth;
        let currentDay = 1;

        while (currentDay <= daysInMonth) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
            if (rangeSet.has(date)) {
                const d = new Date(date + 'T12:00:00');
                const dayOfWeek = d.getUTCDay();
                const feriadoFolga = escala.feriados.find(f => f.date === date && !f.trabalha);
                const { cargos } = store.getState();
                const cargo = cargos.find(c => c.id === escala.cargoId);
                const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));
                const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
                const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

                const slot = slotsByDate[date];
                const turno = slot ? turnosMapById.get(slot.turnoId) : null;

                let fillColor = [255, 255, 255];
                let strokeColor = [226, 232, 240];
                let dayNumberColor = [150];
                let sigla = '';
                let siglaColor = [0];

                if (feriadoFolga) {
                    fillColor = [238, 242, 255]; 
                    sigla = 'FG';
                    siglaColor = [67, 56, 202]; 
                } else if (isCargoDiaNaoUtil && !slot) {
                     fillColor = [241, 245, 249]; 
                     strokeColor = [226, 232, 240];
                } else if (turno) {
                    fillColor = turno.cor || '#eee'; 
                    sigla = turno.sigla;
                    const contrast = getContrastingTextColor(turno.cor);
                    siglaColor = contrast === '#FFFFFF' ? [255] : [0]; 
                    dayNumberColor = contrast === '#FFFFFF' ? [255, 255, 255, 0.7] : [150]; 
                }

                if (typeof fillColor === 'string') {
                    doc.setFillColor(fillColor);
                } else {
                     doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                }
                doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
                doc.rect(currentX + dayPadding, yPos + dayPadding, dayWidth - dayPadding * 2, dayHeight - dayPadding * 2, 'FD');

                doc.setFontSize(7);
                doc.setTextColor(dayNumberColor[0], dayNumberColor[1] ?? dayNumberColor[0], dayNumberColor[2] ?? dayNumberColor[0]);
                doc.text(String(currentDay), currentX + dayWidth - dayPadding - 5, yPos + dayPadding + 8, { align: 'right' });

                if (sigla) {
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(siglaColor[0], siglaColor[1] ?? siglaColor[0], siglaColor[2] ?? siglaColor[0]);
                    doc.text(sigla, currentX + dayWidth / 2, yPos + dayHeight / 2 + 3, { align: 'center', baseline: 'middle' });
                }
            } else {
                 doc.setFillColor(248, 249, 250);
                 doc.setDrawColor(226, 232, 240);
                 doc.rect(currentX + dayPadding, yPos + dayPadding, dayWidth - dayPadding * 2, dayHeight - dayPadding * 2, 'FD');
            }


            const currentDayOfWeek = (firstDayOfMonth + currentDay -1) % 7;
            if (currentDayOfWeek === 6) {
                yPos += dayHeight;
                currentX = margin;
                if (yPos + dayHeight > pageHeight - margin && currentDay < daysInMonth) {
                     doc.addPage();
                     yPos = margin;
                     doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), margin, yPos); yPos += 15;
                     doc.setFontSize(8); doc.setFont(undefined, 'bold');
                     DIAS_SEMANA.forEach((dia, index) => {
                         doc.setTextColor(100); if (index === 0 || index === 6) doc.setTextColor(239, 68, 68);
                         doc.text(dia.abrev, margin + index * dayWidth + dayWidth / 2, yPos, { align: 'center' });
                     });
                     yPos += 15; doc.setTextColor(0);
                }
            } else {
                currentX += dayWidth;
            }
            currentDay++;
        }
        yPos += dayHeight + 15;
    });


    return doc;
}


async function handleExport(exportFn) {
    if (!currentEscalaToExport) return;

    let escalaParaProcessar = JSON.parse(JSON.stringify(currentEscalaToExport));

    const isDirty = (currentEscala && currentEscala.id === escalaParaProcessar.id) && dirtyForms['gerar-escala'];

    if (isDirty) {
        const { confirmed } = await showConfirm({
            title: "Salvar Alterações Antes de Exportar?",
            message: "Você tem alterações não salvas nesta escala. Deseja salvá-las para que apareçam no PDF?",
            confirmText: "Salvar e Exportar",
            cancelText: "Exportar Sem Salvar"
        });

        if (confirmed) {
            await salvarEscalaAtual({ showToast: false });
            setGeradorFormDirty(false);

            const { escalas } = store.getState();
            escalaParaProcessar = escalas.find(e => e.id === escalaParaProcessar.id);
            if (escalaParaProcessar) escalaParaProcessar = JSON.parse(JSON.stringify(escalaParaProcessar));
             else {
                 showToast("Erro ao encontrar a escala após salvar. Exportação cancelada.", "error");
                 return;
             }
        }
    }

    hideExportModal();

    await exportFn(escalaParaProcessar);
}

async function initPdfExport() {
    $('#btnExportCancelar').addEventListener('click', hideExportModal);

    const performExport = (loaderMessage, exportAction) => {
        handleExport(async (escala) => {
            showLoader(loaderMessage);
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
                await exportAction(escala);
                hideLoader();
                setTimeout(() => {
                    requestAnimationFrame(() => showDownloadToast(true));
                }, 500);
            } catch (e) {
                console.error("Erro durante a exportação:", e);
                hideLoader();
                setTimeout(() => {
                    requestAnimationFrame(() => showDownloadToast(false, e.message));
                }, 500);
            }
        });
    };

    $('#btnExportVisaoGeral').addEventListener('click', () => {
        performExport('Gerando PDF da Escala Completa...', (escala) => {
            const doc = generateVisaoGeralPDF(escala);
            doc.save(`${escala.nome.replace(/\s/g, '_')}.pdf`);
        });
    });

    $('#btnExportVisaoDiaria').addEventListener('click', () => {
        performExport('Gerando Relatório Diário...', (escala) => {
            const doc = generateRelatorioDiarioPDF(escala);
            doc.save(`relatorio_diario_${escala.nome.replace(/\s/g, '_')}.pdf`);
        });
    });

    $('#btnExportAmbos').addEventListener('click', () => {
        performExport('Gerando arquivos...', async (escala) => {
            const geralPDF = generateVisaoGeralPDF(escala);
            showLoader('Gerando arquivo 2 de 2...');
            await new Promise(res => setTimeout(res, 50));
            const diarioPDF = generateRelatorioDiarioPDF(escala);

            const zip = new JSZip();
            const nomeBase = escala.nome.replace(/\s/g, '_');
            zip.file(`escala_completa_${nomeBase}.pdf`, geralPDF.output('blob'));
            zip.file(`relatorio_diario_${nomeBase}.pdf`, diarioPDF.output('blob'));

            showLoader('Compactando arquivos...');
            await new Promise(res => setTimeout(res, 50));

            const zipBlob = await zip.generateAsync({ type: "blob" });
            triggerDownload(zipBlob, `export_escala_${nomeBase}.zip`);
        });
    });
}

document.addEventListener('DOMContentLoaded', initPdfExport);