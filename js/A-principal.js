const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
    equipes: false,
    'gerar-escala': false,
};

let isNavigating = false;

async function handleDataCorruptionError() {
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
        importAllData();
    } else if (action === 'reset') {
        const { confirmed } = await showConfirm({
            title: "Tem Certeza?",
            message: "Isso apagará todos os dados corrompidos e iniciará o aplicativo do zero. Esta ação não pode ser desfeita.",
            confirmText: "Sim, Apagar Tudo"
        });
        if (confirmed) {
            await performHardReset();
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
    const metricTurnosEl = $("#metric-turnos");
    const metricCargosEl = $("#metric-cargos");
    const metricFuncionariosEl = $("#metric-funcionarios");
    const metricEquipesEl = $("#metric-equipes");

    if (metricTurnosEl) metricTurnosEl.textContent = `🕒 Turnos: ${turnos.filter(t => !t.isSystem).length}`;
    if (metricCargosEl) metricCargosEl.textContent = `🏥 Cargos: ${cargos.length}`;
    if (metricFuncionariosEl) metricFuncionariosEl.textContent = `👨‍⚕️ Funcionários: ${funcionarios.length}`;
    if (metricEquipesEl) metricEquipesEl.textContent = `🤝 Equipes: ${equipes.length}`;

    parseEmojisInElement($(".quick-metrics-panel"));
}

function go(page, options = {}) {
    if (isNavigating) return;

    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;

    if (currentPageId === page && !options.force) return;

    (async () => {
        if (currentPageId && dirtyForms[currentPageId]) {
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
                        if (typeof cleanupEditor === 'function') cleanupEditor();
                        break;
                }
            }

            const nextPageEl = $(`#page-${page}`);
            if (nextPageEl) {
                nextPageEl.classList.add('active');
            }

            toggleHelpPanel(false);
            const helpBtn = $("#context-help-btn");
            const hasHelpContent = loadHelpContent(page);
            if (helpBtn) {
                 helpBtn.style.display = hasHelpContent ? 'flex' : 'none';
            }

            $$(".tab-btn").forEach(b => b.classList.remove("active"));
            const activeTab = $(`.tab-btn[data-page="${page}"]`);
            if (activeTab) activeTab.classList.add('active');

            const pageTitleEl = $("#page-title");
            if (pageTitleEl) {
                if (page === 'home') {
                    pageTitleEl.textContent = `Início`;
                } else if (activeTab) {
                    const tabTextEl = activeTab.querySelector('.tab-text');
                    if (tabTextEl) pageTitleEl.textContent = tabTextEl.textContent;
                }
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
                 case 'configuracoes':
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
            renderTurnos(); renderCargos(); renderFuncs(); renderArchivedFuncs(); renderEquipes(); renderEscalasList();
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
            if (currentPageId === 'funcionarios') {
                 renderFuncs();
                 renderArchivedFuncs();
            }
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
            triggerAutoBackupIfNeeded();
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

    const btnGotoRelatorios = $("#btn-goto-relatorios");
    if(btnGotoRelatorios) {
        btnGotoRelatorios.addEventListener('click', () => go('relatorios'));
    }
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

    triggerAutoBackupIfNeeded();

    setTimeout(() => {
        splashScreen.classList.add('closing');

        splashScreen.addEventListener('transitionend', () => {
            splashScreen.style.display = 'none';
            body.classList.remove('app-loading');

            go("home", { force: true });
            const pageTitleEl = $("#page-title");
            if (pageTitleEl) pageTitleEl.textContent = "Início";

        }, { once: true });

    }, 4000);
}

function init() {
    window.addEventListener('mousemove', e => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    const splashScreen = $("#splash-screen");

    store.dispatch('LOAD_STATE');

    if (store.getState().dataCorrupted) {
        handleDataCorruptionError();
        return;
    }

    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';

    if (!onboardingComplete) {
        if (splashScreen) {
            splashScreen.style.display = 'none';
        }
        initWelcomeScreen();
    } else {
        const welcomeOverlay = $("#welcome-overlay");
        if(welcomeOverlay) {
            welcomeOverlay.style.display = 'none';
        }

        setupAppListeners();
        initMainApp();
    }
}

document.addEventListener("DOMContentLoaded", init);