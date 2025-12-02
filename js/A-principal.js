const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
    equipes: false,
    'gerar-escala': false,
};

let isNavigating = false;

const PROGRESS_STEPS = [
    { 
        level: 1, 
        title: 'Vamos começar!', 
        description: 'O primeiro passo é definir os horários de trabalho da sua operação. Crie um turno para começar.',
        unlockText: '🔓 Desbloqueia: Cargos',
        percent: 0 
    },
    { 
        level: 2, 
        title: 'Ótimo começo!', 
        description: 'Agora precisamos criar as funções ou postos de trabalho. Cadastre pelo menos um Cargo e associe o turno que você criou.',
        unlockText: '🔓 Desbloqueia: Funcionários',
        percent: 25 
    },
    { 
        level: 3, 
        title: 'Cadastre seus Funcionários', 
        description: 'Agora é hora de registrar quem trabalha com você. Cadastre seus colaboradores, defina o cargo e a disponibilidade.',
        unlockText: '🔓 Desbloqueia: Gerar Escala',
        percent: 50 
    },
    { 
        level: 4, 
        title: 'Tudo pronto para a mágica', 
        description: 'Você já tem o essencial. Use o Assistente de Geração para criar sua primeira escala automática.',
        unlockText: '🔓 Desbloqueia: Relatórios e Análises',
        percent: 75 
    },
    { 
        level: 5, 
        title: 'Parabéns! Configuração Concluída 🚀', 
        description: 'Você dominou o básico! Agora você pode gerenciar suas escalas, ver relatórios e muito mais. Lembre-se: os botões de 💡 Ajuda estão disponíveis em cada tela se precisar.',
        unlockText: '',
        percent: 100 
    }
];

const PAGE_ACCESS_LEVEL = {
    'home': 1,
    'configuracoes': 1,
    'turnos': 1,
    'cargos': 2,
    'funcionarios': 3,
    'equipes': 3,
    'gerar-escala': 4,
    'escalas-salvas': 5,
    'relatorios': 5
};

function getCurrentDataLevel() {
    const { turnos, cargos, funcionarios, escalas } = store.getState();
    
    const hasTurnos = turnos.filter(t => !t.isSystem && t.status === 'ativo').length > 0;
    const hasCargos = cargos.filter(c => c.status === 'ativo').length > 0;
    const hasFuncs = funcionarios.filter(f => f.status === 'ativo').length > 0;
    const hasEscalas = escalas.length > 0;

    if (hasEscalas) return 5;
    if (hasFuncs) return 4;
    if (hasCargos) return 3;
    if (hasTurnos) return 2;
    return 1;
}

function getEffectiveLevel() {
    const dataLevel = getCurrentDataLevel();
    const savedLevel = parseInt(localStorage.getItem('ge_unlock_level') || '1', 10);
    const finalLevel = Math.max(dataLevel, savedLevel);
    
    if (finalLevel > savedLevel) {
        localStorage.setItem('ge_unlock_level', finalLevel.toString());
        if(finalLevel < 5) {
            setTimeout(() => {
                showToast(`🎉 Passo concluído! Próxima etapa desbloqueada.`, 'success');
            }, 500);
        }
    }
    
    return finalLevel;
}

function dismissTutorial() {
    localStorage.setItem('ge_tutorial_dismissed', 'true');
    const panel = $("#home-progress-section");
    if(panel) {
        panel.style.opacity = '0';
        setTimeout(() => panel.style.display = 'none', 300);
    }
}

function updateUnlockUI() {
    const currentLevel = getEffectiveLevel();
    const stepInfo = PROGRESS_STEPS.find(s => s.level === currentLevel) || PROGRESS_STEPS[0];
    const isDismissed = localStorage.getItem('ge_tutorial_dismissed') === 'true';

    const progressSection = $("#home-progress-section");
    
    if (progressSection) {
        if (isDismissed) {
            progressSection.style.display = 'none';
        } else {
            progressSection.style.display = 'flex';
            
            const contentHTML = `
                <div class="home-progress-info">
                    <div class="home-progress-header">
                        <div class="home-progress-title">
                            ${currentLevel === 5 ? '🌟' : '📍'} ${stepInfo.title}
                        </div>
                        <div class="home-progress-subtitle">
                            ${stepInfo.description}
                        </div>
                        ${stepInfo.unlockText ? `<div class="home-progress-unlock-badge">${stepInfo.unlockText}</div>` : ''}
                    </div>
                </div>
                <div class="home-progress-visual">
                    ${currentLevel < 5 ? `
                    <div class="home-progress-bar-container">
                        <div id="home-progress-bar" class="home-progress-bar-fill" style="width: ${stepInfo.percent}%"></div>
                        <span id="home-progress-percent" class="home-progress-text">${stepInfo.percent}%</span>
                    </div>` : `
                    <button class="tutorial-close-btn" onclick="dismissTutorial()">👋 Tchau</button>
                    `}
                </div>
            `;
            
            progressSection.innerHTML = contentHTML;
            
            if(currentLevel === 5) {
                progressSection.classList.add('completed');
            }
            parseEmojisInElement(progressSection);
        }
    }

    $$(".tab-btn").forEach(btn => {
        const page = btn.dataset.page;
        const requiredLevel = PAGE_ACCESS_LEVEL[page] || 1;
        const isLocked = currentLevel < requiredLevel;

        if (isLocked) {
            btn.classList.add('locked');
            btn.title = "Complete a etapa anterior para desbloquear.";
        } else {
            btn.classList.remove('locked');
            btn.title = "";
        }
        void btn.offsetWidth; 
    });

    $$(".home-card-wrapper").forEach(wrapper => {
        const link = wrapper.querySelector('.home-card');
        if (link) {
            const page = link.dataset.goto;
            const requiredLevel = PAGE_ACCESS_LEVEL[page] || 1;
            const isLocked = currentLevel < requiredLevel;
            
            if (isLocked) {
                wrapper.classList.add('locked');
            } else {
                wrapper.classList.remove('locked');
            }
            void wrapper.offsetWidth;
        }
    });
}

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
    try {
        const { turnos, cargos, funcionarios, equipes } = store.getState();
        const metricTurnosEl = $("#metric-turnos");
        const metricCargosEl = $("#metric-cargos");
        const metricFuncionariosEl = $("#metric-funcionarios");
        const metricEquipesEl = $("#metric-equipes");

        if (metricTurnosEl) metricTurnosEl.textContent = `🕒 Turnos: ${turnos.filter(t => !t.isSystem).length}`;
        if (metricCargosEl) metricCargosEl.textContent = `🏥 Cargos: ${cargos.length}`;
        if (metricFuncionariosEl) metricFuncionariosEl.textContent = `👨‍⚕️ Funcionários: ${funcionarios.length}`;
        if (metricEquipesEl) metricEquipesEl.textContent = `🤝 Equipes: ${equipes.length}`;

        const metricsPanel = $(".quick-metrics-panel");
        if (metricsPanel) {
            parseEmojisInElement(metricsPanel);
        }
    } catch (e) {
    }
}

function go(page, options = {}) {
    if (isNavigating) return;

    const currentLevel = getEffectiveLevel();
    const requiredLevel = PAGE_ACCESS_LEVEL[page] || 1;

    if (currentLevel < requiredLevel && !options.force) {
        const prevStep = PROGRESS_STEPS.find(s => s.level === requiredLevel - 1);
        const prevStepTitle = prevStep ? prevStep.title : 'etapa anterior';
        showToast(`🔒 Conclua a etapa: "${prevStepTitle}" para desbloquear.`, 'error');
        return;
    }

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

            updateUnlockUI();

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

    updateUnlockUI();
    updateHomeScreenDashboard();

    switch(actionName) {
        case 'LOAD_STATE':
            renderTurnos(); renderCargos(); renderFuncs(); renderArchivedFuncs(); renderEquipes(); renderEscalasList();
            renderTurnosSelects(); renderFuncCargoSelect(); renderEquipeCargoSelect();
            loadConfigForm(); updateWelcomeMessage();
            updateUnlockUI(); 
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
        case 'SAVE_ESCALA':
             break;
        case 'DELETE_ESCALA_SALVA':
             if (currentPageId === 'escalas-salvas') renderEscalasList();
             if (currentPageId === 'relatorios') renderRelatoriosPage();
            break;
        case 'SAVE_CONFIG':
            loadConfigForm();
            updateWelcomeMessage();
            break;
    }

    setTimeout(() => {
        updateUnlockUI();
        updateHomeScreenDashboard();
    }, 50);
}

function setupAppListeners() {
    $$(".tab-btn").forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
    $$(".home-card").forEach(c => c.addEventListener('click', (e) => {
        e.preventDefault();
        go(c.dataset.goto);
    }));

    const btnGotoRelatorios = $("#btn-goto-relatorios");
    if(btnGotoRelatorios) {
        btnGotoRelatorios.addEventListener('click', () => go('relatorios'));
    }
}

function setupGlobalAutocomplete() {
    const enforce = () => {
        document.querySelectorAll('input').forEach(input => {
            if (input.getAttribute('autocomplete') !== 'off') {
                input.setAttribute('autocomplete', 'off');
                if (input.name) {
                    input.setAttribute('autocomplete', 'off'); 
                }
            }
        });
    };

    enforce();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                enforce();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
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

    setTimeout(() => {
        splashScreen.classList.add('closing');

        splashScreen.addEventListener('transitionend', () => {
            splashScreen.style.display = 'none';
            body.classList.remove('app-loading');
            document.body.classList.add('app-ready');

            go("home", { force: true });
            const pageTitleEl = $("#page-title");
            if (pageTitleEl) pageTitleEl.textContent = "Início";

        }, { once: true });

    }, 4000);
}

function init() {
    setupGlobalAutocomplete();

    window.addEventListener('mousemove', e => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    const splashScreen = $("#splash-screen");

    if (typeof checkLicenseOnStartup === 'function') {
        const isLicensed = checkLicenseOnStartup();
        if (!isLicensed) {
            if (splashScreen) splashScreen.style.display = 'none';
            return; 
        }
    }

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