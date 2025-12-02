/**************************************
 * 🔑 Sistema de Ativação e Licenciamento
 **************************************/

// O Segredo dos Gatos (Salt)
const SEGREDO_ATIVACAO = "PACOCA_POMPOM_PRETA_KEY_2025";

const activationState = {
    isActivated: false,
    licenseKey: null
};

// --- Lógica Matemática (Criptografia) ---

function gerarAssinaturaInterna(textoBase) {
    let hash = 0;
    // Mistura o texto da chave com o segredo dos gatos
    const stringMista = textoBase + SEGREDO_ATIVACAO;
    
    for (let i = 0; i < stringMista.length; i++) {
        const char = stringMista.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Converte para integer de 32bit
    }
    
    // Converte para Hexadecimal e pega os 4 últimos caracteres
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0');
    return hex.slice(-4); 
}

function validarSerialKey(serialCompleto) {
    if (!serialCompleto) return false;

    // 1. Limpa a chave (remove traços e espaços, deixa maiúsculo)
    const chaveLimpa = serialCompleto.replace(/[^A-Z0-9]/ig, "").toUpperCase();

    // 2. Verifica tamanho (16 caracteres)
    if (chaveLimpa.length !== 16) return false;

    // 3. Separa o Corpo (12 chars) da Assinatura (4 chars)
    const corpo = chaveLimpa.slice(0, 12); 
    const assinaturaUsuario = chaveLimpa.slice(12, 16);

    // 4. Recalcula a assinatura baseada no segredo interno
    const assinaturaReal = gerarAssinaturaInterna(corpo);

    // 5. Compara
    return assinaturaUsuario === assinaturaReal;
}

// --- Controle da Interface ---

function setupActivationUI() {
    const inputs = document.querySelectorAll('.digit-input');
    const btn = document.getElementById('btn-ativar-sistema');
    
    if (!inputs.length || !btn) return;

    // Configura navegação entre os quadradinhos
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => handleInputNavigation(e, index, inputs));
        input.addEventListener('input', (e) => handleInputEntry(e, index, inputs, btn));
        input.addEventListener('paste', (e) => handlePaste(e, inputs, btn));
        input.addEventListener('focus', (e) => e.target.select());
    });

    btn.onclick = handleActivation;
}

function handleInputEntry(e, index, inputs, btn) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    e.target.value = val;

    // Pula para o próximo se digitou 1 caracter
    if (val.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
    }

    checkCompletion(inputs, btn);
}

function handleInputNavigation(e, index, inputs) {
    // Backspace: apaga e volta
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
    } 
    // Setas para navegar
    else if (e.key === 'ArrowLeft' && index > 0) {
        inputs[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
        inputs[index + 1].focus();
    }
}

function handlePaste(e, inputs, btn) {
    e.preventDefault();
    const pasteData = (e.clipboardData || window.clipboardData).getData('text');
    // Limpa a string colada
    const cleanData = pasteData.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (!cleanData) return;

    // Distribui os caracteres nos inputs
    let dataIndex = 0;
    inputs.forEach((input, index) => {
        if (dataIndex < cleanData.length) {
            input.value = cleanData[dataIndex];
            dataIndex++;
        }
    });

    // Foca no último preenchido ou no próximo vazio
    const nextFocusIndex = Math.min(dataIndex, inputs.length - 1);
    inputs[nextFocusIndex].focus();
    
    checkCompletion(inputs, btn);
}

function checkCompletion(inputs, btn) {
    const fullKey = Array.from(inputs).map(i => i.value).join('');
    if (fullKey.length === 16) {
        btn.disabled = false;
        btn.classList.add('ready');
    } else {
        btn.disabled = true;
        btn.classList.remove('ready');
    }
}

async function handleActivation() {
    const inputs = document.querySelectorAll('.digit-input');
    const btn = document.getElementById('btn-ativar-sistema');
    const statusText = document.getElementById('activation-status-text');
    const card = document.querySelector('.activation-card');
    
    if (!btn) return;

    const fullKey = Array.from(inputs).map(i => i.value).join('');

    // 1. Bloqueia UI e inicia Loading Fake
    inputs.forEach(i => i.disabled = true);
    btn.classList.add('loading');
    btn.innerHTML = '<div class="spinner"></div>';
    
    const messages = ["Verificando integridade...", "Validando hash...", "Liberando acesso..."];
    
    // Troca mensagens
    let msgIndex = 0;
    statusText.style.opacity = 1;
    statusText.innerText = messages[0];
    
    const msgInterval = setInterval(() => {
        msgIndex++;
        if (msgIndex < messages.length) {
            statusText.innerText = messages[msgIndex];
        }
    }, 900);

    // 2. Aguarda 3 segundos (Fake Loading)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    clearInterval(msgInterval);

    // 3. Valida
    const isValid = validarSerialKey(fullKey);

    if (isValid) {
        // SUCESSO
        localStorage.setItem('ge_license_key', fullKey);
        activationState.isActivated = true;
        
        btn.classList.remove('loading');
        btn.classList.add('success');
        btn.innerHTML = '✅';
        statusText.innerText = "Ativação Concluída!";
        statusText.style.color = "#10b981";
        
        // Acorda o gato
        const catIcon = document.querySelector('.cat-lock-icon');
        if(catIcon) catIcon.textContent = '😺';

        // Chuva de confetes
        if (typeof playConfettiAnimation === 'function') {
            playConfettiAnimation(btn);
        }

        // Transição para o App
        setTimeout(() => {
            const screen = document.getElementById('activation-screen');
            if (screen) {
                screen.classList.add('fade-out'); // Fica branco suavemente
                
                // Espera a transição visual terminar para iniciar o fluxo correto
                setTimeout(() => {
                    screen.style.display = 'none';
                    
                    // LÓGICA DE REDIRECIONAMENTO CORRIGIDA
                    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';
                    
                    // Garante que o Splash Screen não atrapalhe se estiver visível
                    const splash = document.getElementById('splash-screen');
                    if (splash) splash.style.display = 'none';

                    if (!onboardingComplete && typeof initWelcomeScreen === 'function') {
                        // Se é instalação nova (sem tutorial feito), vai para o Welcome
                        initWelcomeScreen();
                    } else if (typeof initMainApp === 'function') {
                        // Se já fez o tutorial (reinstalação mantendo dados), vai para Home
                        initMainApp(); 
                    } else {
                        // Fallback de segurança
                        go('home', { force: true });
                    }

                }, 1500);
            }
        }, 1500);

    } else {
        // ERRO
        btn.classList.remove('loading');
        btn.innerHTML = 'Ativar';
        inputs.forEach(i => i.disabled = false);
        statusText.innerText = "Chave inválida. Verifique e tente novamente.";
        statusText.style.color = "#ef4444";
        
        // Efeito de tremer (Shake)
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
        inputs[0].focus();
    }
}

function checkLicenseOnStartup() {
    const savedKey = localStorage.getItem('ge_license_key');
    
    if (savedKey && validarSerialKey(savedKey)) {
        activationState.isActivated = true;
        const screen = document.getElementById('activation-screen');
        if (screen) screen.style.display = 'none';
        return true; // Licenciado
    } else {
        activationState.isActivated = false;
        // Garante que a tela de ativação esteja visível e configurada
        const screen = document.getElementById('activation-screen');
        if (screen) {
            screen.style.display = 'flex';
            setupActivationUI(); // Inicializa os inputs separados
        }
        return false; // Não licenciado
    }
}