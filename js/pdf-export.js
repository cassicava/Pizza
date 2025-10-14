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
                    bgColor = '#eef2ff'; // Light Blue/Gray (cor da celula-feriado-folga)
                    textColor = [67, 56, 202]; // Dark Blue (cor do texto)
                    text = 'FOLGA';
                } else if (isCargoDiaNaoUtil) {
                    bgColor = '#f1f5f9'; // Light Gray (cor da celula-fechada)
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
    
    // --- LEGENDAS ---
    const legendItems = [];
    const turnosNaEscalaIds = [...new Set(escala.slots.filter(s => s.assigned).map(s => s.turnoId))];
    
    turnosNaEscalaIds.forEach(turnoId => {
        const t = getTurnoInfo(turnoId);
        if (t.sigla && t.nome) {
            const text = `${t.sigla} - ${t.nome}\n(${t.inicio} - ${t.fim})`;
            legendItems.push({ color: t.cor, text: text, isSystem: t.isSystem, inicio: t.inicio });
        }
    });

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

    // --- SEGUNDA PÁGINA (RESUMO) ---
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Resumo de Carga Horária no Período', 40, 40);

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
        } else { // Padrão é horas
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
        startY: 60,
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
    const rightMargin = pageWidth - 40;

    dateRange.forEach((date, index) => {
        if (index > 0) doc.addPage();
        
        doc.setFontSize(14);
        doc.text('Escala Fácil', leftMargin, 40);
        doc.setFontSize(9);
        doc.text(escala.nome, rightMargin, 40, { align: 'right' });
        doc.setLineWidth(1.5);
        doc.line(leftMargin, 60, rightMargin, 60);

        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        const diaFormatado = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        
        const feriadoDoDia = escala.feriados.find(f => f.date === date);
        const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
        const isCargoDiaNaoUtil = !cargoDiasOperacionais.has(diaSemanaId);

        let statusDia = '';
        if (feriadoDoDia) {
            statusDia = ` - FERIADO: ${feriadoDoDia.nome}`;
            if (!feriadoDoDia.trabalha) {
                statusDia += ' (FOLGA GERAL)';
            }
        } else if (isCargoDiaNaoUtil) {
            statusDia = ' - CARGO FECHADO';
        }
        
        const fullDateString = `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${diaFormatado}${statusDia}`;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(fullDateString, pageWidth / 2, 110, { align: 'center' });
        doc.setFont(undefined, 'normal');


        let yPos = 140;
        
        // Se o dia for fechado ou folga geral, exibe a mensagem e pula os turnos.
        if (statusDia.includes('FECHADO') || statusDia.includes('FOLGA GERAL')) {
            doc.setFontSize(12);
            doc.setTextColor(150);
            doc.text(`Dia não operacional para este cargo.`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 20;
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
                
                // Se for um turno de sistema (Folga/Férias), o funcionário já está atribuído no slot.
                if (turno.isSystem && funcionariosAlocados.length === 0) {
                     // Isso deve ser raro, mas garante que não quebre.
                    return; 
                }

                const turnoSistemaTitulo = turno.isSystem ? `(${turno.nome})` : `(${turno.inicio} - ${turno.fim})`;
                
                const cardHeight = 30 + (funcionariosAlocados.length * 20); // Ajusta altura para evitar quebra
                const cardY = yPos;

                // Desenha a linha lateral de cor
                doc.setFillColor(turno.cor || '#cccccc');
                doc.rect(leftMargin, cardY, 8, cardHeight, 'F');

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(`${turno.nome} ${turnoSistemaTitulo}`, leftMargin + 20, cardY + 18);
                
                yPos += 25;

                if (funcionariosAlocados.length > 0) {
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(0);
                    
                    funcionariosAlocados.forEach(nome => {
                        doc.text(`\u2022 ${nome}`, leftMargin + 25, yPos);
                        
                        doc.setDrawColor(220, 220, 220); 
                        doc.setLineWidth(0.5);
                        doc.line(leftMargin + 25, yPos + 6, rightMargin, yPos + 6);

                        yPos += 20;
                    });
                } else {
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.text('Nenhum funcionário alocado.', leftMargin + 25, yPos);
                    doc.setTextColor(0);
                    yPos += 20;
                }
                yPos += 15;

                // Quebra de página se o próximo turno não couber
                if (yPos > pageHeight - 60) {
                    doc.setFontSize(8);
                    doc.text(`Página ${index + 1} de ${dateRange.length}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
                    doc.addPage();
                    yPos = 60; // Reinicia a posição Y na nova página
                }
            });
        }
        
        doc.setFontSize(8);
        doc.text(`Página ${index + 1} de ${dateRange.length}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
    });

    return doc;
}

/**
 * Função wrapper para lidar com a exportação, verificando se há alterações não salvas.
 * @param {Function} exportFn - A função que efetivamente gera e baixa o PDF.
 */
async function handleExport(exportFn) {
    if (!currentEscalaToExport) return;

    // A verificação de 'dirty' é relevante se a escala que está sendo exportada
    // é a mesma que está aberta no editor (seja na página de geração ou de escalas salvas).
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
            showToast(e.message || "Erro ao gerar o PDF do relatório diário.", 'error');
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