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

function updateWelcomeMessage() {
    const welcomeEl = $("#welcomeTitle");
    if (!welcomeEl) return;
    const { config } = store.getState();
    const nome = config.nome;
    welcomeEl.textContent = (nome && nome.trim() !== '') ? `Olá, ${nome}!` : `Bem-vindo!`;
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
            
            $$(".tab-btn").forEach(b => b.classList.remove("active"));
            const activeTab = $(`.tab-btn[data-page="${page}"]`);
            if (activeTab) activeTab.classList.add('active');

            const pageTitleEl = $("#page-title");
            if (page === 'home') {
                pageTitleEl.innerHTML = `Bem-vindo ao <span class="animated-brand-text" style="font-size: inherit;">Escala Fácil</span>!`;
            } else if (activeTab) {
                pageTitleEl.textContent = activeTab.querySelector('.tab-text').textContent;
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
            break;
    }
}

function initMainApp() {
    store.subscribe(renderRouter);

    renderRouter('LOAD_STATE');
    go("home"); 

    $$(".tab-btn").forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
    $$(".home-card").forEach(c => c.addEventListener('click', (e) => {
        e.preventDefault();
        go(c.dataset.goto)
    }));
    $("#header-settings-btn").addEventListener('click', () => go('configuracoes'));

    parseEmojisInElement(document.body);
}

function init() {
    store.dispatch('LOAD_STATE');
    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';
    if (!onboardingComplete) {
        initWelcomeScreen();
    } else {
        const welcomeOverlay = $("#welcome-overlay");
        if(welcomeOverlay) welcomeOverlay.style.display = 'none';
        initMainApp();
    }
}

document.addEventListener("DOMContentLoaded", init);