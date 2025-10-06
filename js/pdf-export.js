/**************************************
 * 📄 Lógica de Exportação para PDF
 **************************************/

let currentEscalaToExport = null;

// Função principal que é chamada pelo botão na tela de escalas salvas
function showExportModal(escala) {
    currentEscalaToExport = escala;
    $('#exportModalBackdrop').classList.remove('hidden');
}

function hideExportModal() {
    $('#exportModalBackdrop').classList.add('hidden');
    currentEscalaToExport = null;
}

// Função para acionar o download de um arquivo Blob (usado para o ZIP)
function triggerDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

/**
 * Gera o PDF da Visão Geral da Escala (formato paisagem)
 * @param {object} escala - O objeto da escala a ser exportada.
 * @returns {jsPDF} - A instância do documento jsPDF.
 */
function generateVisaoGeralPDF(escala) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
    });

    const { funcionarios, turnos } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const funcsDaEscala = funcionarios.filter(f => escala.historico && escala.historico[f.id]).sort((a,b) => a.nome.localeCompare(b.nome));
    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    
    // --- Cabeçalho ---
    doc.setFontSize(18);
    doc.text(escala.nome, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    doc.setFontSize(10);
    // Removido "Gerado por"
    
    // --- Tabela Principal da Escala ---
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
            const excecoesFunc = escala.excecoes ? escala.excecoes[func.id] : null;
            const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);
            const folgaDoDia = excecoesFunc?.folgas.find(f => f.date === date);
            const emFerias = excecoesFunc?.ferias.dates.includes(date);

            if (slot) row.push(turnosMap[slot.turnoId]?.sigla || '?');
            else if (emFerias) row.push('FÉR');
            else if (folgaDoDia) row.push(TIPOS_FOLGA.find(tf => tf.nome === folgaDoDia.tipo)?.sigla || 'F');
            else row.push('');
        });
        return row;
    });
    
    // Cálculo para células quadradas
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
            if (data.section === 'body' && data.column.index > 0) {
                const func = funcsDaEscala[data.row.index];
                const date = dateRange[data.column.index - 1];
                const slot = escala.slots.find(s => s.date === date && s.assigned === func.id);

                if (slot && turnosMap[slot.turnoId]?.cor) {
                    doc.setFillColor(turnosMap[slot.turnoId].cor);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    
                    doc.setTextColor(getContrastingTextColor(turnosMap[slot.turnoId].cor));
                    doc.setFont(undefined, 'bold');
                    doc.setFontSize(data.cell.styles.fontSize);

                    const text = data.cell.text.toString().trim();
                    
                    // Centralização manual baseada na largura real do texto
                    const textWidth = doc.getTextWidth(text);
                    const textX = data.cell.x + (data.cell.width - textWidth) / 2;
                    const textY = data.cell.y + (data.cell.height / 2);

                    doc.text(
                        text, 
                        textX, 
                        textY,
                        { valign: 'middle' }
                    );
                }
            }
        },
    });

    let finalY = doc.lastAutoTable.finalY || 60;
    
    // --- Legenda Horizontal ---
    const legendItems = [];
    const turnosNaEscala = turnos.filter(t => escala.slots.some(s => s.turnoId === t.id && s.assigned));
    
    turnosNaEscala.forEach(t => {
        const text = `${t.sigla} - ${t.nome}\n(${t.inicio} - ${t.fim})`;
        legendItems.push({ color: t.cor, text: text });
    });
    legendItems.push({ color: '#f0fdf4', text: `FÉR - Férias` });
    
    TIPOS_FOLGA.forEach(tf => {
        const hasFolga = escala.excecoes && Object.values(escala.excecoes).some(ex => ex.folgas && ex.folgas.some(f => f.tipo === tf.nome));
        if (hasFolga) {
            let color = '#eef2ff';
            if (tf.nome === "Atestado Médico") color = '#fffbeb';
            if (tf.nome === "Folga Aniversário") color = '#f3e8ff';
            legendItems.push({ color, text: `${tf.sigla} - ${tf.nome}` });
        }
    });

    const rectSize = 10;
    const spacing = 15;
    const textSpacing = 4;
    const lineHeight = 9;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');

    // Calcula a largura total da legenda para centralizá-la
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


    // --- Tabela de Resumo de Horas ---
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Resumo de Horas no Período', 40, 40);

    const resumoBody = funcsDaEscala.map(func => {
        const horasTrabalhadas = (escala.historico[func.id].horasTrabalhadas / 60);
        const metaHoras = calcularMetaHoras(func, escala.inicio, escala.fim);
        const saldo = horasTrabalhadas - metaHoras;
        return [func.nome, `${metaHoras.toFixed(2)}h`, `${horasTrabalhadas.toFixed(2)}h`, `${saldo > 0 ? '+' : ''}${saldo.toFixed(2)}h`];
    });

    doc.autoTable({
        head: [['Funcionário', 'Meta de Horas', 'Horas Realizadas', 'Saldo']],
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
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const { funcionarios, turnos } = store.getState();
    const turnosMap = Object.fromEntries(turnos.map(t => [t.id, t]));
    const funcionariosMap = Object.fromEntries(funcionarios.map(f => [f.id, f]));
    const dateRange = dateRangeInclusive(escala.inicio, escala.fim);
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 60; 
    const rightMargin = pageWidth - 40;

    dateRange.forEach((date, index) => {
        if (index > 0) doc.addPage();
        
        // --- Cabeçalho da Página ---
        doc.setFontSize(14);
        doc.text('Escala Fácil', leftMargin, 40);
        doc.setFontSize(9);
        doc.text(escala.nome, rightMargin, 40, { align: 'right' });
        doc.setLineWidth(1.5);
        doc.line(leftMargin, 60, rightMargin, 60);

        // --- Título do Dia ---
        const d = new Date(date + 'T12:00:00');
        const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        const diaFormatado = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const fullDateString = `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${diaFormatado}`;
        doc.setFontSize(20);
        doc.text(fullDateString, pageWidth / 2, 110, { align: 'center' });

        // --- Seções dos Turnos ---
        let yPos = 160;
        const turnosDoDia = [...new Set(escala.slots.filter(s => s.date === date).map(s => s.turnoId))];
        const turnosOrdenados = turnos.filter(t => turnosDoDia.includes(t.id)).sort((a,b) => a.inicio.localeCompare(b.inicio));
        
        turnosOrdenados.forEach(turno => {
            const funcionariosAlocados = escala.slots.filter(s => s.date === date && s.turnoId === turno.id && s.assigned).map(s => funcionariosMap[s.assigned]?.nome);
            
            const cardHeight = 25 + (funcionariosAlocados.length * 30);
            doc.setFillColor(turno.cor || '#cccccc');
            doc.rect(leftMargin, yPos, 8, cardHeight, 'F');

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`${turno.nome} (${turno.inicio} - ${turno.fim})`, leftMargin + 20, yPos + 18);
            
            yPos += 25 + 15;

            if (funcionariosAlocados.length > 0) {
                doc.setFontSize(16);
                doc.setFont(undefined, 'normal');
                funcionariosAlocados.forEach(nome => {
                    doc.text(`\u2022 ${nome}`, leftMargin + 25, yPos);
                    
                    doc.setDrawColor(220, 220, 220); 
                    doc.setLineWidth(0.5);
                    doc.line(leftMargin + 25, yPos + 8, rightMargin, yPos + 8);

                    yPos += 30;
                });
            } else {
                doc.setFontSize(12);
                doc.setTextColor(150);
                doc.text('Nenhum funcionário alocado.', leftMargin + 25, yPos);
                doc.setTextColor(0);
                yPos += 30;
            }
            yPos += 15;
        });
        
        // --- Rodapé da Página ---
        doc.setFontSize(8);
        doc.text(`Página ${index + 1} de ${dateRange.length}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
    });

    return doc;
}

// Lógica para os botões do modal
async function initPdfExport() {
    // MELHORIA: Trocado .onclick por addEventListener para maior robustez.
    $('#btnExportCancelar').addEventListener('click', hideExportModal);

    $('#btnExportVisaoGeral').addEventListener('click', async () => {
        if (!currentEscalaToExport) return;
        showLoader('Gerando PDF da Escala Completa...');
        await new Promise(res => setTimeout(res, 50));
        try {
            const doc = generateVisaoGeralPDF(currentEscalaToExport);
            doc.save(`${currentEscalaToExport.nome.replace(/\s/g, '_')}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Erro ao gerar o PDF.");
        } finally {
            hideLoader();
            hideExportModal();
        }
    });
    
    $('#btnExportVisaoDiaria').addEventListener('click', async () => {
        if (!currentEscalaToExport) return;
        showLoader('Gerando Relatório Diário...');
        await new Promise(res => setTimeout(res, 50));
        try {
            const doc = generateRelatorioDiarioPDF(currentEscalaToExport);
            doc.save(`relatorio_diario_${currentEscalaToExport.nome.replace(/\s/g, '_')}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Erro ao gerar o PDF.");
        } finally {
            hideLoader();
            hideExportModal();
        }
    });

    $('#btnExportAmbos').addEventListener('click', async () => {
        if (!currentEscalaToExport) return;
        showLoader('Gerando arquivos...');
        await new Promise(res => setTimeout(res, 50));
        try {
            const geralPDF = generateVisaoGeralPDF(currentEscalaToExport);
            showLoader('Gerando arquivo 2 de 2...');
            await new Promise(res => setTimeout(res, 50));
            const diarioPDF = generateRelatorioDiarioPDF(currentEscalaToExport);

            const zip = new JSZip();
            const nomeBase = currentEscalaToExport.nome.replace(/\s/g, '_');
            zip.file(`escala_completa_${nomeBase}.pdf`, geralPDF.output('blob'));
            zip.file(`relatorio_diario_${nomeBase}.pdf`, diarioPDF.output('blob'));

            showLoader('Compactando arquivos...');
            await new Promise(res => setTimeout(res, 50));
            
            const zipBlob = await zip.generateAsync({ type: "blob" });
            triggerDownload(zipBlob, `export_escala_${nomeBase}.zip`);

        } catch (e) {
            console.error(e);
            showToast("Erro ao gerar o arquivo ZIP.");
        } finally {
            hideLoader();
            hideExportModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', initPdfExport);