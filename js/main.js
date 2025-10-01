/**************************************
 * 🚀 Inicialização e Navegação
 **************************************/

const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
    equipes: false,
};

const PAGE_TITLES = {
    'home': 'Início',
    'turnos': '🕒 Turnos',
    'cargos': '🏥 Cargos',
    'funcionarios': '👨‍⚕️ Funcionários',
    'equipes': '🤝 Equipes',
    'gerar-escala': '📅 Geração Automática',
    'montar-escala': '✍️ Criação Manual',
    'escalas-salvas': '🗂️ Escalas Salvas',
    'relatorios': '📊 Relatórios',
    'configuracoes': '⚙️ Configurações',
};

function updateWelcomeMessage() {
    const headerWelcomeEl = $("#welcomeTitle");
    const homeSubtitleEl = $("#welcome-subtitle-personal");

    const { config } = store.getState();
    const nome = config.nome;

    if (nome && nome.trim() !== '') {
        if(headerWelcomeEl) headerWelcomeEl.textContent = `Olá, ${nome}!`;
        if(homeSubtitleEl) homeSubtitleEl.textContent = 'Selecione uma das opções abaixo para começar.';
    } else {
        if(headerWelcomeEl) headerWelcomeEl.textContent = `Bem-vindo(a)!`;
        if(homeSubtitleEl) homeSubtitleEl.textContent = 'Para começar, configure os passos de cadastro ou inicie a criação de uma escala.';
    }
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

async function go(page) {
    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;
    
    if (currentPageId === page) return;

    // Lógica de confirmação para sair com formulários sujos
    if (dirtyForms[currentPageId]) {
        const confirmado = await showConfirm({
            title: "Descartar Alterações?",
            message: "Você tem alterações não salvas. Deseja sair e perdê-las?",
            confirmText: "Sim, Sair"
        });
        if (!confirmado) {
            $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === currentPageId));
            return;
        }
    }
    
    // Reset dos formulários e estados ao sair da página
    switch (currentPageId) {
        case 'turnos': cancelEditTurno(); break;
        case 'cargos': cancelEditCargo(); break;
        case 'funcionarios': cancelEditFunc(); break;
        case 'equipes': cancelEditEquipe(); break;
        case 'gerar-escala': 
        case 'montar-escala':
            const isViewingScale = !$('#escalaView').classList.contains('hidden');
            if(isViewingScale){
                 const confirmado = await showConfirm({
                    title: "Descartar Escala?",
                    message: "Você tem uma escala em andamento. Deseja sair e descartá-la?",
                    confirmText: "Sim, Descartar"
                });
                if(!confirmado) {
                    $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === currentPageId));
                    return;
                }
            }
            resetGeradorEscala(); 
            resetMontadorState();
            break;
    }

    window.scrollTo(0, 0);
    const nextPageEl = $(`#page-${page}`);

    // Fade out da página atual
    if (currentPageEl) {
        currentPageEl.classList.remove('active');
        setTimeout(() => {
            currentPageEl.style.display = 'none';
        }, 300); // Duração da animação de saída
    }

    // Fade in da próxima página
    if (nextPageEl) {
        nextPageEl.style.display = 'flex'; 
        
        requestAnimationFrame(() => {
            nextPageEl.classList.add('active');
        });
    }
    
    $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    
    // Atualiza o título no cabeçalho, exceto para a home
    const pageTitleEl = $("#page-title");
    if (pageTitleEl) {
        pageTitleEl.textContent = (page === 'home') ? '' : PAGE_TITLES[page] || "Página";
    }

    if (page === 'home') updateWelcomeMessage();
    if (page === 'relatorios') renderRelatoriosPage();
}

function renderRouter(actionName) {
    console.log(`Estado atualizado via ação: ${actionName}. Re-renderizando componentes...`);

    const fullRenderActions = ['LOAD_STATE'];
    const turnoActions = ['SAVE_TURNO', 'DELETE_TURNO'];
    const cargoActions = ['SAVE_CARGO', 'DELETE_CARGO', 'DELETE_TURNO'];
    const funcionarioActions = ['SAVE_FUNCIONARIO', 'DELETE_FUNCIONARIO', 'SAVE_CARGO', 'DELETE_CARGO'];
    const equipeActions = ['SAVE_EQUIPE', 'DELETE_EQUIPE', 'DELETE_CARGO', 'DELETE_TURNO', 'DELETE_FUNCIONARIO'];
    const escalaActions = ['SAVE_ESCALA', 'DELETE_ESCALA_SALVA', 'DELETE_CARGO', 'DELETE_FUNCIONARIO'];

    if (fullRenderActions.includes(actionName)) {
        renderTurnos();
        renderCargos();
        renderFuncs();
        renderEquipes();
        renderEscalasList();
        renderTurnosSelects();
        renderFuncCargoSelect();
        renderEquipeCargoSelect();
        renderEscCargoSelect();
        renderMontarCargoSelect(); 
        loadConfigForm();
        updateWelcomeMessage();
        return;
    }

    if (turnoActions.includes(actionName)) {
        renderTurnos();
        renderTurnosSelects(); 
    }
    if (cargoActions.includes(actionName)) {
        renderCargos();
        renderFuncCargoSelect(); 
        renderEquipeCargoSelect();
        renderEscCargoSelect(); 
        renderMontarCargoSelect(); 
    }
    if (funcionarioActions.includes(actionName)) {
        renderFuncs();
    }
    if (equipeActions.includes(actionName)) {
        renderEquipes();
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

    const homePage = $('#page-home');
    homePage.style.display = 'flex';
    homePage.classList.add('active');
    $("#page-title").textContent = ''; // Título inicial é vazio

    renderRouter('LOAD_STATE');

    $$(".tab-btn").forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
    $$(".home-card").forEach(c => c.addEventListener('click', (e) => {
        e.preventDefault();
        go(c.dataset.goto)
    }));
    $('#header-settings-btn').addEventListener('click', () => go('configuracoes'));
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