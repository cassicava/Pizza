/**************************************
 * 📅 Lógica do Gerador de Escalas (Controlador do Worker)
 **************************************/

let geradorWorker = null; // Variável para manter a referência do worker

async function gerarEscala() {
    if (geradorWorker) {
        geradorWorker.terminate();
    }

    geradorWorker = new Worker('js/M-motor-geracao-escala.js');
    
    // O listener para o botão de cancelar foi movido para K-assistente-geracao.js
    const cancelBtn = $("#loader-cancel-btn");
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (geradorWorker) {
                geradorWorker.postMessage({ type: 'cancel' });
                geradorWorker.terminate();
                geradorWorker = null;
                hideLoader();
                showToast("Geração de escala cancelada.");
            }
        };
    }

    showLoader("Iniciando geração...");

    const { cargos, funcionarios, turnos, equipes } = store.getState();
    const dataForWorker = {
        geradorState: JSON.parse(JSON.stringify(geradorState)),
        funcionarios,
        turnos,
        equipes,
        cargos
    };

    geradorWorker.onmessage = function(e) {
        const { type, message, escala } = e.data;

        if (type === 'progress') {
            showLoader(message);
        } else if (type === 'done') {
            currentEscala = escala;
            currentEscala.owner = 'gerador';
            
            showLoader("Renderizando visualização...");
            setTimeout(() => {
                renderEscalaTable(currentEscala);
                if (typeof initEditor === 'function') {
                    initEditor();
                }
                hideLoader();
            }, 50);

            geradorWorker.terminate();
            geradorWorker = null;

        } else if (type === 'error') {
            console.error("Erro recebido do gerador worker:", message);
            showToast(`Ocorreu um erro ao gerar a escala: ${message}`, 'error');
            hideLoader();
            geradorWorker.terminate();
            geradorWorker = null;
        }
    };

    geradorWorker.onerror = function(error) {
        console.error("Erro fatal no Web Worker:", error);
        showToast("Ocorreu um erro inesperado no processo de geração.", 'error');
        hideLoader();
        if(geradorWorker) {
            geradorWorker.terminate();
            geradorWorker = null;
        }
    };

    geradorWorker.postMessage(dataForWorker);
}