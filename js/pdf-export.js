/**************************************
 * 📄 Lógica de Exportação para PDF
 **************************************/

let currentEscalaToExport = null;

function showExportModal(escala) {
    currentEscalaToExport = escala;
    $('#exportModalBackdrop').classList.remove('hidden');
}

function hideExportModal() {
    $('#exportModalBackdrop').classList.add('hidden');
    currentEscalaToExport = null;
}

/**
 * Gera o PDF da Visão Geral da Escala (formato paisagem)
 * @param {object} escala - O objeto da escala a ser exportada.
 * @returns {jsPDF} - A instância do documento jsPDF.
 */
function generateVisaoGeralPDF(escala) {
    // Validação de dados: Garante que a escala tenha um snapshot válido.
    if (!escala.snapshot || !escala.snapshot.turnos || !escala.snapshot.funcionarios) {
        throw new Error("Dados da escala incompletos. Salve a escala novamente antes de exportar.");
    }
    const { cargos } = store.getState();
    const cargo = cargos.find(c => c.id === escala.cargoId);
    const cargoDiasOperacionais = new Set(cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.width;

    // Funções de busca agora usam EXCLUSIVAMENTE o snapshot.
    const getTurnoInfo = (turnoId) => escala.snapshot.turnos?.[turnoId] || {};
    const getFuncInfo = (funcId) => escala.snapshot.funcionarios?.[funcId] || {};

    const funcsDaEscalaIds = Object.keys(escala.historico || {});
    const funcsDaEscala = funcsDaEscalaIds
        .map(id => ({ id, ...getFuncInfo(id) }))
        .filter(f => f.nome)
        .sort((a,b) => a.nome.localeCompare(b.nome));

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
    const cellHeight = dateColWidth;

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
        },
        headStyles: { 
            fillColor: [22, 163, 74], 
            textColor: 255, 
            fontStyle: 'bold', 
            valign: 'middle',
        },
        columnStyles: { 
            0: { 
                halign: 'left', 
                fontStyle: 'bold', 
                minCellWidth: funcColWidth,
                cellWidth: funcColWidth,
                fontSize: 6,
                lineHeight: 1,
            } 
        },
        didParseCell: function (data) {
            if (data.section === 'head' && data.column.index === 0) {
                data.cell.styles.fontSize = 8;
            }
        },
        didDrawCell: (data) => {
            const func = funcsDaEscala[data.row.index];
            const date = dateRange[data.column.index - 1];
            
            if (data.section === 'body' && data.column.index > 0) {
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
                    bgColor = '#ffffff';
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
            // INÍCIO DA CORREÇÃO DEFINITIVA
            const text = (t.isSystem || !t.inicio) // Verifica se é sistema OU se não tem horário
                ? `${t.sigla} - ${t.nome}`
                : `${t.sigla} - ${t.nome}\n(${t.inicio} - ${t.fim})`;
            // FIM DA CORREÇÃO DEFINITIVA
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

        if (func.medicaoCarga === 'turnos') {
            const { cargos } = store.getState();
            const cargo = cargos.find(c => c.id === escala.cargoId);
            const cargoDiasOperacionais = cargo?.regras?.dias || DIAS_SEMANA.map(d => d.id);
            
            const metaTurnos = calcularMetaTurnos(func, escala.inicio, escala.fim, cargoDiasOperacionais);
            const realizadoTurnos = escala.historico[func.id]?.turnosTrabalhados || 0;
            const saldo = realizadoTurnos - metaTurnos;
            
            metaLabel = `${metaTurnos.toFixed(0)} turnos`;
            realizadoLabel = `${realizadoTurnos} turnos`;
            saldoLabel = `${saldo > 0 ? '+' : ''}${saldo.toFixed(0)} turnos`;
        } else {
            const horasTrabalhadas = (escala.historico[func.id]?.horasTrabalhadas / 60) || 0;
            const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);
            const saldo = horasTrabalhadas - metaHoras;
            
            metaLabel = `${metaHoras.toFixed(1)}h`;
            realizadoLabel = `${horasTrabalhadas.toFixed(1)}h`;
            saldoLabel = `${saldo > 0 ? '+' : ''}${saldo.toFixed(1)}h`;
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

/**
 * Gera o PDF do Relatório Diário (formato retrato)
 * @param {object} escala - O objeto da escala a ser exportada.
 * @returns {jsPDF} - A instância do documento jsPDF.
 */
function generateRelatorioDiarioPDF(escala) {
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

                // INÍCIO DA CORREÇÃO DEFINITIVA: Corrige o título para turnos de sistema
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
                    // FIM DA CORREÇÃO DEFINITIVA

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

async function handleExport(exportFn) {
    if (!currentEscalaToExport) return;

    const isDirty = (currentEscala && currentEscala.id === currentEscalaToExport.id) && dirtyForms['gerar-escala'];

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
            currentEscalaToExport = escalas.find(e => e.id === currentEscalaToExport.id);
        }
    }
    
    await exportFn(currentEscalaToExport);
}

async function initPdfExport() {
    $('#btnExportCancelar').addEventListener('click', hideExportModal);

    $('#btnExportVisaoGeral').addEventListener('click', () => handleExport(async (escala) => {
        showLoader('Gerando PDF da Escala Completa...');
        await new Promise(res => setTimeout(res, 50));
        try {
            const doc = generateVisaoGeralPDF(escala);
            doc.save(`${escala.nome.replace(/\s/g, '_')}.pdf`);
        } catch (e) {
            console.error("Erro ao gerar PDF da visão geral:", e);
            showToast(e.message || "Erro ao gerar o PDF da escala completa.", 'error');
        } finally {
            hideLoader();
            hideExportModal();
        }
    }));
    
    $('#btnExportVisaoDiaria').addEventListener('click', () => handleExport(async (escala) => {
        showLoader('Gerando Relatório Diário...');
        await new Promise(res => setTimeout(res, 50));
        try {
            const doc = generateRelatorioDiarioPDF(escala);
            doc.save(`relatorio_diario_${escala.nome.replace(/\s/g, '_')}.pdf`);
        } catch (e) {
            console.error("Erro ao gerar PDF do relatório diário:", e);
            showToast(e.message || "Erro ao gerar o PDF do relatório diatório.", 'error');
        } finally {
            hideLoader();
            hideExportModal();
        }
    }));

    $('#btnExportAmbos').addEventListener('click', () => handleExport(async (escala) => {
        showLoader('Gerando arquivos...');
        await new Promise(res => setTimeout(res, 50));
        try {
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

        } catch (e) {
            console.error("Erro ao gerar arquivo ZIP:", e);
            showToast(e.message || "Erro ao gerar o arquivo ZIP.", 'error');
        } finally {
            hideLoader();
            hideExportModal();
        }
    }));
}

document.addEventListener('DOMContentLoaded', initPdfExport);