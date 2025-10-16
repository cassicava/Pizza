/**************************************
 * ✨ Lógica da Tela de Boas-Vindas
 **************************************/

// --- Cache de Elementos DOM ---
const welcomeOverlay = $("#welcome-overlay");
const nomeInput = $("#welcome-nome-input");
const personalizacaoNextBtn = $("#welcome-personalizacao-next");
const finishBtn = $("#welcome-finish-btn");
const termsCard = $("#welcome-terms-card");
const privacyCard = $("#welcome-privacy-card");


// --- Estado do Onboarding ---
let onboardingState = {
    currentStep: 1,
    nome: '',
};
let termsAcceptedState = {
    terms: false,
    privacy: false,
};

// --- Funções de Validação e Controle ---
function validateWelcomeStep2() {
    const nomeValido = nomeInput.value.trim() !== '';
    personalizacaoNextBtn.disabled = !nomeValido;
}

function checkAllTermsAccepted() {
    const allAccepted = termsAcceptedState.terms && termsAcceptedState.privacy;
    finishBtn.disabled = !allAccepted;
}

function saveOnboardingProgress() {
    localStorage.setItem('ge_onboarding_progress', JSON.stringify(onboardingState));
}

function loadOnboardingProgress() {
    const savedState = loadJSON('ge_onboarding_progress', onboardingState);
    if (savedState) {
        onboardingState = savedState;
        nomeInput.value = onboardingState.nome;
    }
}

function showStep(stepNumber, direction = 'forward') {
    const welcomeSteps = $$(".welcome-step");
    const progressDots = $$(".progress-dot");
    const currentStepEl = $(`.welcome-step.active`);
    const nextStepEl = $(`#welcome-step-${stepNumber}`);
    const animOutClass = direction === 'forward' ? 'anim-slide-out-left' : 'anim-slide-out-right';
    const animInClass = direction === 'forward' ? 'anim-slide-in-right' : 'anim-slide-in-left';

    if (currentStepEl) {
        currentStepEl.classList.add(animOutClass);
        setTimeout(() => {
            currentStepEl.classList.remove('active', animOutClass);
        }, 200);
    }

    if (nextStepEl) {
        nextStepEl.classList.remove('anim-slide-in-right', 'anim-slide-in-left');
        nextStepEl.classList.add('active', animInClass);
        parseEmojisInElement(nextStepEl); 
    }

    progressDots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.step == stepNumber);
    });

    onboardingState.currentStep = stepNumber;
    saveOnboardingProgress();

    setTimeout(() => {
        const firstInput = $('input:not([type=checkbox]), button.welcome-btn-primary', nextStepEl);
        if(firstInput && firstInput.id !== 'welcome-nome-input') {
            firstInput.focus();
        }
    }, 200);
}

async function handleWelcomeImport() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            showLoader("Importando seus dados...");
            await new Promise(res => setTimeout(res, 50)); // Permite que o loader apareça

            try {
                const importedData = JSON.parse(event.target.result);
                
                if (!importedData || typeof importedData.turnos === 'undefined' || typeof importedData.cargos === 'undefined') {
                    throw new Error("Arquivo de backup inválido ou corrompido.");
                }

                for (const key in KEYS) {
                    if (importedData.hasOwnProperty(key)) {
                        saveJSON(KEYS[key], importedData[key]);
                    }
                }

                localStorage.setItem('ge_onboarding_complete', 'true');
                localStorage.removeItem('ge_onboarding_progress');
                
                hideLoader();
                showToast("Dados importados com sucesso! Bem-vindo(a) de volta.", 'success');
                
                welcomeOverlay.classList.remove('visible');
                initMainApp();

            } catch (error) {
                console.error("Erro ao importar dados na tela de boas-vindas:", error);
                hideLoader();
                showToast(error.message || "Ocorreu um erro ao ler o arquivo de backup.", 'error');
            }
        };
        reader.readAsText(file);
    };

    fileInput.click();
}


function finishOnboarding() {
    if (personalizacaoNextBtn.disabled) {
        showToast("Por favor, preencha seu nome para continuar.");
        showStep(2, 'backward');
        return;
    }
    if (finishBtn.disabled) {
        showToast("Por favor, aceite ambos os termos para continuar.");
        return;
    }

    onboardingState.nome = nomeInput.value.trim();
    const initialConfig = { nome: onboardingState.nome };
    store.dispatch('SAVE_CONFIG', initialConfig);

    localStorage.setItem('ge_onboarding_complete', 'true');
    localStorage.removeItem('ge_onboarding_progress');
    
    welcomeOverlay.classList.remove('visible');
    initMainApp();
}

function initWelcomeScreen() {
    loadOnboardingProgress();
    welcomeOverlay.classList.add('visible');
    parseEmojisInElement(welcomeOverlay);
    
    showStep(onboardingState.currentStep || 1);

    // --- Event Listeners ---
    $("#welcome-start-fresh").onclick = () => showStep(2, 'forward');
    $("#welcome-import-backup").onclick = handleWelcomeImport;
    personalizacaoNextBtn.onclick = () => showStep(3, 'forward');
    $("#welcome-proposta-next").onclick = () => showStep(4, 'forward');
    finishBtn.onclick = finishOnboarding;
    
    $$('.welcome-btn-back').forEach(btn => {
        btn.onclick = () => showStep(parseInt(btn.dataset.toStep), 'backward');
    });

    termsCard.onclick = async () => {
        const accepted = await exibirTermosDeUso(true);
        if (accepted) {
            termsAcceptedState.terms = true;
            termsCard.classList.add('accepted');
            checkAllTermsAccepted();
        }
    };

    privacyCard.onclick = async () => {
        const accepted = await exibirPoliticaDePrivacidade(true);
        if (accepted) {
            termsAcceptedState.privacy = true;
            privacyCard.classList.add('accepted');
            checkAllTermsAccepted();
        }
    };

    nomeInput.oninput = () => {
        if (nomeInput.value.length > 0) {
            nomeInput.value = nomeInput.value.charAt(0).toUpperCase() + nomeInput.value.slice(1);
        }
        onboardingState.nome = nomeInput.value;
        validateWelcomeStep2();
        saveOnboardingProgress();
    };

    // Estado inicial dos botões
    checkAllTermsAccepted();
    validateWelcomeStep2();
}