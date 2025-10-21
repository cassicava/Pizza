/**************************************
 * 🚀 Inicialização e Navegação
 **************************************/

const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
    equipes: false,
    'gerar-escala': false,
};

let isNavigating = false;

async function handleDataCorruptionError() {
    // Esconde a splash screen para mostrar o modal de erro
    const splashScreen = $("#splash-screen");
    if (splashScreen) {
        splashScreen.style.display = 'none';
    }

    const action = await showActionModal({
        title: "🚨 Erro ao Carregar Dados",
        message: "Não foi possível carregar suas informações. O arquivo de dados pode estar corrompido, possivelmente devido a um desligamento inesperado ou limpeza de cache. O que você gostaria de fazer?",
        columnLayout: true,
        actions: [
            { id: 'import', text: '📥 Importar um Backup', class: 'primary' },
            { id: 'reset', text: '🔥 Apagar Dados e Recomeçar', class: 'danger' },
        ]
    });

    if (action === 'import') {
        importAllData(); // Função agora é chamada diretamente
    } else if (action === 'reset') {
        const { confirmed } = await showConfirm({
            title: "Tem Certeza?",
            message: "Isso apagará todos os dados corrompidos e iniciará o aplicativo do zero. Esta ação não pode ser desfeita.",
            confirmText: "Sim, Apagar Tudo"
        });
        if (confirmed) {
            await performHardReset(); // Chama a função de reset
        }
    }
}


function updateWelcomeMessage() {
    const welcomeEl = $("#welcomeTitle");
    if (!welcomeEl) return;
    const { config } = store.getState();
    const nome = config.nome;
    welcomeEl.textContent = (nome && nome.trim() !== '') ? `${nome}!` : `Bem-vindo!`;
}

function updateHomeScreenDashboard() {
    const { turnos, cargos, funcionarios, equipes } = store.getState();
    if($("#home-turnos-count")) $("#home-turnos-count").textContent = turnos.filter(t => !t.isSystem).length > 0 ? `${turnos.filter(t => !t.isSystem).length} cadastrado(s)` : '';
    if($("#home-cargos-count")) $("#home-cargos-count").textContent = cargos.length > 0 ? `${cargos.length} cadastrado(s)` : '';
    if($("#home-funcionarios-count")) $("#home-funcionarios-count").textContent = funcionarios.length > 0 ? `${funcionarios.length} cadastrado(s)` : '';
    if($("#home-equipes-count")) $("#home-equipes-count").textContent = equipes.length > 0 ? `${equipes.length} cadastrada(s)` : '';
}

function go(page, options = {}) {
    if (isNavigating) return;

    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;

    if (currentPageId === page && !options.force) return;

    (async () => {
        if (dirtyForms[currentPageId]) {
            const { confirmed } = await showConfirm({
                title: "Descartar Alterações?",
                message: "Você tem alterações não salvas. Deseja sair e perdê-las?",
                confirmText: "Sim, Sair"
            });
            if (!confirmed) return;
        }

        isNavigating = true;

        const transitionLogic = () => {
            if (currentPageEl) {
                currentPageEl.classList.remove('active');
                currentPageEl.classList.remove('fading-out');

                switch (currentPageId) {
                    case 'turnos': cancelEditTurno(); break;
                    case 'cargos': cancelEditCargo(); break;
                    case 'funcionarios': cancelEditFunc(); break;
                    case 'equipes': cancelEditEquipe(); break;
                    case 'gerar-escala':
                        resetGeradorWizard();
                        currentEscala = null;
                        if (typeof cleanupEditor === 'function') cleanupEditor(); // Limpa a toolbox e o padding
                        break;
                }
            }

            const nextPageEl = $(`#page-${page}`);
            if (nextPageEl) {
                nextPageEl.classList.add('active');
            }

            // --- INTEGRAÇÃO DO SISTEMA DE AJUDA ---
            toggleHelpPanel(false); // Garante que o painel feche ao navegar
            loadHelpContent(page);  // Carrega o conteúdo de ajuda para a nova página
            // -----------------------------------------

            $$(".tab-btn").forEach(b => b.classList.remove("active"));
            const activeTab = $(`.tab-btn[data-page="${page}"]`);
            if (activeTab) activeTab.classList.add('active');

            const pageTitleEl = $("#page-title");
            if (page === 'home') {
                pageTitleEl.textContent = `Início`;
            } else if (activeTab) {
                const tabTextEl = activeTab.querySelector('.tab-text');
                if (tabTextEl) pageTitleEl.textContent = tabTextEl.textContent; // Verifica se tabTextEl existe
            }

            window.scrollTo(0, 0);

            switch (page) {
                case 'home':
                    updateWelcomeMessage();
                    updateHomeScreenDashboard();
                    break;
                case 'cargos':
                    renderTurnosSelects();
                    break;
                case 'funcionarios':
                    renderFuncCargoSelect();
                    break;
                case 'equipes':
                    renderEquipeCargoSelect();
                    renderEquipes();
                    break;
                case 'gerar-escala': initGeradorPage(options); break;
                case 'relatorios': renderRelatoriosPage(); break;
                case 'escalas-salvas':
                    renderFiltroEscalasCargo();
                    renderEscalasList();
                    break;
                 case 'configuracoes': // Garante que o form de config seja carregado ao navegar
                    loadConfigForm();
                    break;
            }
            parseEmojisInElement(document.body);
            isNavigating = false;
        };

        if (currentPageEl) {
            currentPageEl.addEventListener('animationend', transitionLogic, { once: true });
            currentPageEl.classList.add('fading-out');
        } else {
            transitionLogic();
        }
    })();
}

function renderRouter(actionName) {
    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;

    updateHomeScreenDashboard();

    switch(actionName) {
        case 'LOAD_STATE':
            renderTurnos(); renderCargos(); renderFuncs(); renderEquipes(); renderEscalasList();
            renderTurnosSelects(); renderFuncCargoSelect(); renderEquipeCargoSelect();
            loadConfigForm(); updateWelcomeMessage();
            break;
        case 'SAVE_TURNO':
        case 'DELETE_TURNO':
            if (currentPageId === 'turnos') renderTurnos();
            if (currentPageId === 'cargos') renderTurnosSelects();
            if (currentPageId === 'equipes') { renderEquipeCargoSelect(); renderEquipes(); }
            break;
        case 'SAVE_CARGO':
        case 'DELETE_CARGO':
            if (currentPageId === 'cargos') renderCargos();
            if (currentPageId === 'funcionarios') renderFuncCargoSelect();
            if (currentPageId === 'equipes') { renderEquipeCargoSelect(); renderEquipes(); }
            break;
        case 'SAVE_FUNCIONARIO':
        case 'DELETE_FUNCIONARIO':
        case 'ARCHIVE_FUNCIONARIO':
        case 'UNARCHIVE_FUNCIONARIO':
            if (currentPageId === 'funcionarios') renderFuncs();
            if (currentPageId === 'equipes') renderEquipes();
            break;
        case 'SAVE_EQUIPE':
        case 'DELETE_EQUIPE':
            if (currentPageId === 'equipes') renderEquipes();
            break;
        case 'DELETE_ESCALA_SALVA':
             if (currentPageId === 'escalas-salvas') renderEscalasList();
             if (currentPageId === 'relatorios') renderRelatoriosPage();
            break;
        case 'SAVE_CONFIG':
            loadConfigForm();
            updateWelcomeMessage();
             // --- MELHORIA: Chama a verificação de backup após salvar config ---
            triggerAutoBackupIfNeeded();
             // ----------------------------------------------------------------
            break;
    }
}

function setupAppListeners() {
    $$(".tab-btn").forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
    $$(".home-card").forEach(c => c.addEventListener('click', (e) => {
        e.preventDefault();
        go(c.dataset.goto);
    }));
    $("#header-settings-btn").addEventListener('click', () => go('configuracoes'));
}

function initMainApp() {
    const splashScreen = $("#splash-screen");
    const splashUserName = $("#splash-user-name");
    const { config } = store.getState();
    const body = document.body;

    body.classList.add('app-loading');

    const nome = config.nome;
    splashUserName.textContent = (nome && nome.trim() !== '') ? nome : 'Usuário';

    splashScreen.classList.add('animate');
    parseEmojisInElement(document.body);

    store.subscribe(renderRouter);
    renderRouter('LOAD_STATE');

    // --- MELHORIA: Chama verificação de backup após carregar estado ---
    triggerAutoBackupIfNeeded();
    // -------------------------------------------------------------

    // [CORREÇÃO] A duração total da animação agora é controlada pelo CSS.
    // O JavaScript apenas inicia a saída e espera ela terminar.
    setTimeout(() => {
        splashScreen.classList.add('closing');

        // Espera a transição de fade-out da splash screen terminar
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.style.display = 'none';
            body.classList.remove('app-loading');

            // Agora, com a splash screen totalmente fora do caminho, navega para a home.
            // Isso garante que a animação dos cards será acionada corretamente.
            go("home", { force: true });
            const pageTitleEl = $("#page-title"); // Garante que pageTitleEl é definido
            if (pageTitleEl) pageTitleEl.textContent = "Início"; // Define o título após a navegação


        }, { once: true });

    }, 4000); // Inicia a saída 1s antes do tempo total para uma transição suave
}

function init() {
    window.addEventListener('mousemove', e => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    // Pega a referência da splash screen
    const splashScreen = $("#splash-screen");

    store.dispatch('LOAD_STATE');

    // Verifica se houve erro de corrupção durante o LOAD_STATE
    if (store.getState().dataCorrupted) {
        handleDataCorruptionError();
        return; // Interrompe a inicialização normal
    }

    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';

    if (!onboardingComplete) {
        // Primeira vez abrindo: esconde a splash screen e mostra o onboarding
        if (splashScreen) {
            splashScreen.style.display = 'none';
        }
        initWelcomeScreen();
    } else {
        // Já usou antes: esconde a tela de boas-vindas (caso exista) e inicia o app com a splash screen
        const welcomeOverlay = $("#welcome-overlay");
        if(welcomeOverlay) {
            welcomeOverlay.style.display = 'none';
        }

        setupAppListeners();
        initMainApp(); // initMainApp agora chama triggerAutoBackupIfNeeded internamente
    }
}

document.addEventListener("DOMContentLoaded", init);