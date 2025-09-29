/**************************************
 * 🚀 Inicialização e Navegação
 **************************************/

// Objeto para controlar o estado "sujo" (dirty) dos formulários
const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
};

function updateWelcomeMessage() {
    const welcomeEl = $("#welcomeTitle");
    if (!welcomeEl) return;

    const { config } = store.getState();
    const nome = config.nome;
    if (nome && nome.trim() !== '') {
        welcomeEl.textContent = `Olá, ${nome}!`;
    } else {
        welcomeEl.textContent = `Bem-vindo ao Gestor de Escalas!`;
    }
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

async function go(page) {
    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;
    
    if (page === 'gerar-escala' && currentPageId === 'gerar-escala') {
        const isViewingScale = !$('#escalaView').classList.contains('hidden');
        if (isViewingScale) {
            const confirmed = await showConfirm({
                title: "Descartar Escala Atual?",
                message: "Você tem uma escala em andamento. Deseja descartá-la e iniciar uma nova geração?",
                confirmText: "Sim, Descartar"
            });
            if (confirmed) {
                resetGeradorEscala();
            }
        }
        return;
    }
    
    if (currentPageId === page) return;

    if (dirtyForms[currentPageId]) {
        const confirmado = await showConfirm({
            title: "Descartar Alterações?",
            message: "Você tem alterações não salvas nesta página. Tem certeza de que deseja sair e perdê-las?",
            confirmText: "Sim, Sair",
            cancelText: "Não, Ficar"
        });
        if (!confirmado) {
            return;
        }
    }

    if (currentPageId === 'gerar-escala' && geradorState.cargoId && !$('#escalaView').classList.contains('hidden')) {
        const confirmado = await showConfirm({
            title: "Sair da Geração de Escala?",
            message: "Você tem certeza que deseja sair? O progresso da escala atual será perdido.",
            confirmText: "Sim, Sair",
            cancelText: "Não, Ficar"
        });
        if (!confirmado) {
            return;
        }
    }
    if (currentPageId === 'montar-escala' && montadorState.cargoId) {
        const confirmado = await showConfirm({
            title: "Sair da Criação Manual?",
            message: "Você tem certeza que deseja sair? As configurações da escala manual serão perdidas.",
            confirmText: "Sim, Sair",
            cancelText: "Não, Ficar"
        });
        if (!confirmado) {
            return;
        }
    }


    // Limpa e reseta os formulários ao sair da página
    switch (currentPageId) {
        case 'turnos':
            cancelEditTurno();
            break;
        case 'cargos':
            cancelEditCargo();
            break;
        case 'funcionarios':
            cancelEditFunc();
            break;
        case 'gerar-escala':
            resetGeradorEscala();
            $('#gerador-escala-titulo').innerHTML = '📅 Geração Automática de Escala ✨';
            break;
        case 'montar-escala':
            resetMontadorState();
            break;
    }

    window.scrollTo(0, 0);
    $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
    $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));

    // Garante que a página de destino seja inicializada corretamente
    switch (page) {
        case 'gerar-escala':
            resetGeradorEscala();
            break;
        case 'montar-escala':
            resetMontadorState();
            break;
        case 'home':
            updateWelcomeMessage();
            break;
        // ADICIONADO: Renderiza a página de relatórios ao navegar para ela
        case 'relatorios':
            renderRelatoriosPage();
            break;
    }
}

/**
 * Roteador de Renderização. Chamado pelo store sempre que o estado muda.
 * Decide quais partes da UI precisam ser atualizadas com base na ação despachada.
 * @param {string} actionName - O nome da ação que causou a atualização do estado.
 */
function renderRouter(actionName) {
    console.log(`Estado atualizado via ação: ${actionName}. Re-renderizando componentes...`);

    const fullRenderActions = ['LOAD_STATE'];
    const turnoActions = ['SAVE_TURNO', 'DELETE_TURNO'];
    const cargoActions = ['SAVE_CARGO', 'DELETE_CARGO', 'DELETE_TURNO'];
    const funcionarioActions = ['SAVE_FUNCIONARIO', 'DELETE_FUNCIONARIO', 'SAVE_CARGO', 'DELETE_CARGO'];
    const escalaActions = ['SAVE_ESCALA', 'DELETE_ESCALA_SALVA', 'DELETE_CARGO', 'DELETE_FUNCIONARIO'];

    if (fullRenderActions.includes(actionName)) {
        renderTurnos();
        renderCargos();
        renderFuncs();
        renderEscalasList();
        renderTurnosSelects();
        renderFuncCargoSelect();
        renderEscCargoSelect();
        renderMontarCargoSelect(); 
        loadConfigForm();
        updateWelcomeMessage();
        return;
    }

    // Renderizações direcionadas
    if (turnoActions.includes(actionName)) {
        renderTurnos();
        renderTurnosSelects(); 
    }
    if (cargoActions.includes(actionName)) {
        renderCargos();
        renderFuncCargoSelect(); 
        renderEscCargoSelect(); 
        renderMontarCargoSelect(); 
    }
    if (funcionarioActions.includes(actionName)) {
        renderFuncs();
    }
    if (escalaActions.includes(actionName)) {
        renderEscalasList();
    }
    if (actionName === 'SAVE_CONFIG') {
        loadConfigForm();
        updateWelcomeMessage();
    }
}


function initMainApp() {
    console.log("Iniciando aplicação principal...");
    store.subscribe(renderRouter);

    const { config } = store.getState();
    applyTheme(config.theme || 'light');

    renderRouter('LOAD_STATE');
    go("home"); // Inicia na página home

    $$(".tab-btn").forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
    $$(".home-card").forEach(c => c.addEventListener('click', (e) => {
        e.preventDefault();
        go(c.dataset.goto)
    }));
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