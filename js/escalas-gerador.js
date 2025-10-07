/**************************************
 * 📅 Lógica do Gerador de Escalas (Controlador do Worker)
 **************************************/

let geradorWorker = null; // Variável para manter a referência do worker

async function gerarEscala() {
    // Se um worker antigo estiver ativo, termina ele
    if (geradorWorker) {
        geradorWorker.terminate();
    }

    // Cria uma nova instância do Worker
    geradorWorker = new Worker('js/gerador-worker.js');

    showLoader("Iniciando geração...");

    // Prepara os dados para enviar ao worker
    // CORREÇÃO: Adicionado 'equipes' à lista de dados enviados ao worker
    const { cargos, funcionarios, turnos, equipes } = store.getState();
    const dataForWorker = {
        geradorState: JSON.parse(JSON.stringify(geradorState)), // Envia uma cópia do estado
        funcionarios,
        turnos,
        equipes, // <-- DADO QUE ESTAVA FALTANDO
        cargos
    };

    // Listener para receber mensagens do worker
    geradorWorker.onmessage = function(e) {
        const { type, message, escala } = e.data;

        if (type === 'progress') {
            showLoader(message); // Atualiza a mensagem do loader
        } else if (type === 'done') {
            currentEscala = escala;
            // Adiciona a propriedade 'owner' para que o editor manual saiba qual tabela controlar
            currentEscala.owner = 'gerador';
            
            showLoader("Renderizando visualização...");
            // Usamos um pequeno timeout para garantir que o DOM atualize a mensagem do loader
            setTimeout(() => {
                renderEscalaTable(currentEscala);
                if (typeof initEditor === 'function') {
                    initEditor();
                }
                hideLoader();
            }, 50);

            // Termina o worker após a conclusão
            geradorWorker.terminate();
            geradorWorker = null;

        } else if (type === 'error') {
            console.error("Erro recebido do gerador worker:", message);
            showToast(`Ocorreu um erro ao gerar a escala: ${message}`);
            hideLoader();
            geradorWorker.terminate();
            geradorWorker = null;
        }
    };

    // Listener para erros inesperados no worker
    geradorWorker.onerror = function(error) {
        console.error("Erro fatal no Web Worker:", error);
        showToast("Ocorreu um erro inesperado no processo de geração.");
        hideLoader();
        geradorWorker.terminate();
        geradorWorker = null;
    };

    // Envia os dados para o worker iniciar o processamento
    geradorWorker.postMessage(dataForWorker);
}