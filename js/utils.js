/**************************************
 * 🛠️ Utilidades / Persistência
 **************************************/

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function saveJSON(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function showLoader(message = "Processando...") {
    const overlay = $("#loader-overlay");
    if (overlay) {
        $("#loader-overlay .loader-text").textContent = message;
        overlay.classList.remove("hidden");
    }
}

function hideLoader() {
    const overlay = $("#loader-overlay");
    if (overlay) {
        overlay.classList.add("hidden");
    }
}

function validateInput(inputElement, forceValid = false) {
    if (!inputElement) return true;
    const isSelect = inputElement.tagName.toLowerCase() === 'select';
    const isValid = forceValid || (isSelect ? inputElement.value !== '' : inputElement.value.trim() !== '');
    inputElement.classList.toggle('invalid', !isValid);
    const label = inputElement.closest('label');
    if (label) {
        label.classList.toggle('invalid-label', !isValid);
    }
    const fieldset = inputElement.closest('fieldset');
    if(fieldset) {
         fieldset.classList.toggle('invalid-fieldset', !isValid);
    }
    return isValid;
}

function focusFirstInvalidInput(containerSelector) {
    const formContainer = $(containerSelector);
    if (!formContainer) return;
    const firstInvalid = $('.invalid, .invalid-fieldset', formContainer);
    if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = $('input, select, button', firstInvalid);
        if (focusable) {
            focusable.focus();
        } else {
            firstInvalid.focus();
        }
    }
}

function getContrastingTextColor(hex) {
    if (!hex) return '#000000';
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

let toastTimeoutId = null;

function showToast(message, type = 'info') {
    const toast = $("#toast");
    const toastMessage = $("#toastMessage");

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
        toast.classList.remove("visible", "hiding", "success", "error", "info");
        toast.classList.add("hidden");
    }
    
    toast.classList.remove("hidden");
    toast.classList.add(type, "visible");
    
    toastMessage.textContent = message;

    toastTimeoutId = setTimeout(() => {
        toast.classList.remove("visible");
        toast.classList.add("hiding");
        
        setTimeout(() => {
            toast.classList.add("hidden");
            toast.classList.remove("hiding", type);
            toastTimeoutId = null;
        }, 400); 
    }, 4500); 
}

function showConfirm({ title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");
        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `<p>${message}</p>`;
        modalConfirmBtn.textContent = confirmText;
        modalConfirmBtn.disabled = false;
        modalCancelBtn.textContent = cancelText;
        modalConfirmBtn.style.display = 'inline-flex';
        modalCancelBtn.style.display = 'inline-flex';
        backdrop.classList.remove("hidden");
        const cleanupAndResolve = (value) => {
            modalConfirmBtn.onclick = null;
            modalCancelBtn.onclick = null;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };
        modalConfirmBtn.onclick = () => cleanupAndResolve(true);
        modalCancelBtn.onclick = () => cleanupAndResolve(false);
    });
}

function showActionModal({ title, message, actions = [], columnLayout = false }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalActionsContainer = $(".modal-actions");
        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = message ? `<p>${message}</p>` : '';

        modalActionsContainer.classList.toggle('modal-actions-column', columnLayout);
        
        modalActionsContainer.innerHTML = ''; 
        actions.forEach(action => {
            const button = document.createElement('button');
            button.id = `modal-action-${action.id}`;
            button.textContent = action.text;
            button.className = action.class || 'secondary';
            button.onclick = () => cleanupAndResolve(action.id);
            modalActionsContainer.appendChild(button);
        });

        backdrop.classList.remove("hidden");

        const cleanupAndResolve = (value) => {
            modalActionsContainer.innerHTML = '';
            modalActionsContainer.classList.remove('modal-actions-column');
            modalActionsContainer.innerHTML = `
                <button id="modalCancel" class="secondary">Cancelar</button>
                <button id="modalConfirm" class="primary">✓ Confirmar</button>
            `;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };
        
        const backdropClickHandler = (e) => {
            if (e.target === backdrop) {
                cleanupAndResolve(null);
                backdrop.removeEventListener('click', backdropClickHandler);
            }
        };
        backdrop.addEventListener('click', backdropClickHandler);
    });
}

function showInfoModal({ title, contentHTML }) {
    const backdrop = $("#modalBackdrop");
    const modalCancelBtn = $("#modalCancel");
    $("#modalTitle").textContent = title;
    $("#modalMessage").innerHTML = contentHTML;
    $("#modalConfirm").style.display = 'none';
    modalCancelBtn.textContent = "Fechar";
    modalCancelBtn.style.display = 'inline-flex';
    backdrop.classList.remove("hidden");
    const closeHandler = () => {
        backdrop.classList.add("hidden");
        modalCancelBtn.onclick = null;
        $("#modalConfirm").style.display = 'inline-flex';
        $("#modalMessage").innerHTML = '';
    };
    modalCancelBtn.onclick = closeHandler;
}

function showScrollableConfirmModal({ title, contentHTML, confirmText = "Li e concordo" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalMessageEl = $("#modalMessage");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");
        $("#modalTitle").textContent = title;
        modalMessageEl.innerHTML = contentHTML;
        modalConfirmBtn.textContent = confirmText;
        modalConfirmBtn.disabled = true;
        modalCancelBtn.textContent = "Voltar";
        modalConfirmBtn.style.display = 'inline-flex';
        modalCancelBtn.style.display = 'inline-flex';
        const enableButtonIfReady = () => {
            const hasScrollbar = modalMessageEl.scrollHeight > modalMessageEl.clientHeight;
            const isAtBottom = modalMessageEl.scrollHeight - modalMessageEl.scrollTop <= modalMessageEl.clientHeight + 5;
            if (!hasScrollbar || isAtBottom) {
                modalConfirmBtn.disabled = false;
                modalMessageEl.removeEventListener('scroll', enableButtonIfReady);
            }
        };
        setTimeout(() => {
            modalMessageEl.scrollTop = 0;
            enableButtonIfReady();
            modalMessageEl.addEventListener('scroll', enableButtonIfReady);
        }, 100);
        backdrop.classList.remove("hidden");
        const cleanupAndResolve = (value) => {
            modalMessageEl.removeEventListener('scroll', enableButtonIfReady);
            modalConfirmBtn.onclick = null;
            modalCancelBtn.onclick = null;
            modalConfirmBtn.disabled = false;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };
        modalConfirmBtn.onclick = () => cleanupAndResolve(true);
        modalCancelBtn.onclick = () => cleanupAndResolve(false);
    });
}

async function showPromptConfirm({ title, message, promptLabel, requiredWord, confirmText = "Confirmar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");
        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `
            <p>${message}</p>
            <div class="form-group" style="align-items: flex-start; margin-top: 16px;">
                <label for="modal-prompt-input" style="font-weight: 500;">${promptLabel}</label>
                <input type="text" id="modal-prompt-input" autocomplete="off" style="width: 100%;">
            </div>
        `;
        modalConfirmBtn.textContent = confirmText;
        modalConfirmBtn.disabled = true;
        modalCancelBtn.style.display = 'inline-flex';
        const promptInput = $("#modal-prompt-input");
        const inputHandler = () => {
            modalConfirmBtn.disabled = promptInput.value !== requiredWord;
        };
        promptInput.addEventListener('input', inputHandler);
        backdrop.classList.remove("hidden");
        const cleanupAndResolve = (value) => {
            promptInput.removeEventListener('input', inputHandler);
            modalConfirmBtn.onclick = null;
            modalCancelBtn.onclick = null;
            modalConfirmBtn.disabled = false;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };
        modalConfirmBtn.onclick = () => cleanupAndResolve(true);
        modalCancelBtn.onclick = () => cleanupAndResolve(false);
    });
}

async function handleDeleteItem({ id, itemName, dispatchAction, additionalInfo = '' }) {
    let message = `Atenção: esta ação é permanente e não pode ser desfeita. Excluir este ${itemName.toLowerCase()} pode afetar outras partes do sistema. ${additionalInfo} Deseja continuar?`;
    const confirmado = await showConfirm({
        title: `Confirmar Exclusão de ${itemName}?`,
        message: message
    });
    if (confirmado) {
        store.dispatch(dispatchAction, id);
        showToast(`${itemName} excluído com sucesso.`, 'success');
    }
    return confirmado;
}

function navigateWizardWithAnimation(containerSelector, targetStepId, direction) {
    const container = $(containerSelector);
    if (!container) return;

    const currentStepEl = $('.wizard-step.active', container);
    const nextStepEl = $(`#${targetStepId}`, container);

    const animOutClass = direction === 'forward' ? 'anim-slide-out-left' : 'anim-slide-out-right';
    const animInClass = direction === 'forward' ? 'anim-slide-in-right' : 'anim-slide-in-left';

    if (currentStepEl) {
        currentStepEl.classList.add(animOutClass);
        setTimeout(() => {
            currentStepEl.classList.remove('active', animOutClass);
        }, 200);
    }

    if (nextStepEl) {
        nextStepEl.classList.remove('anim-slide-in-right', 'anim-slide-in-left', 'anim-slide-out-right', 'anim-slide-out-left');
        nextStepEl.classList.add('active', animInClass);
    }
}

function playConfettiAnimation(sourceElement) {
    const rect = sourceElement.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const confettiCount = 50;
    const colors = ['#00BFFF', '#FF00FF', '#FFD700', '#32CD32', '#FF4500'];

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-particle';
        confetti.style.left = `${startX}px`;
        confetti.style.top = `${startY}px`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        const angle = Math.random() * 360;
        const velocity = Math.random() * 300 + 150;
        const translateX = Math.cos(angle * Math.PI / 180) * velocity;
        const translateY = Math.sin(angle * Math.PI / 180) * velocity - (velocity * 0.5);
        
        const rotation = Math.random() * 720 - 360;
        const scale = Math.random() * 0.5 + 0.5;
        const duration = Math.random() * 1 + 1.5;

        confetti.style.setProperty('--tx', `${translateX}px`);
        confetti.style.setProperty('--ty', `${translateY}px`);
        confetti.style.setProperty('--r', `${rotation}deg`);
        confetti.style.setProperty('--s', scale);
        confetti.style.animationDuration = `${duration}s`;

        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, duration * 1000);
    }
}

function triggerDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

function renderAnoSelect(selector, startYear = 2025, futureYears = 2) {
    const selectEl = $(selector);
    if (!selectEl) return;

    const currentValue = selectEl.value;
    const currentYear = new Date().getFullYear();
    selectEl.innerHTML = '<option value="" selected>Selecione um ano</option>';

    for (let year = startYear; year <= currentYear + futureYears; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        selectEl.appendChild(option);
    }
    
    selectEl.value = currentValue;
}

function playEmojiBurst(event) {
    const button = event.currentTarget;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const catEmojis = ['😺', '😸', '😻', '🐾', '😽', '🧡', '✨'];
    const burstCount = 12;

    for (let i = 0; i < burstCount; i++) {
        const emoji = document.createElement('span');
        emoji.className = 'burst-emoji';
        emoji.textContent = catEmojis[Math.floor(Math.random() * catEmojis.length)];
        
        emoji.style.left = `${rect.left + rect.width / 2}px`;
        emoji.style.top = `${rect.top + rect.height / 2}px`;

        const angle = Math.random() * 360;
        const distance = Math.random() * 60 + 50;
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        const rotation = Math.random() * 360 - 180;

        emoji.style.setProperty('--tx', `${tx}px`);
        emoji.style.setProperty('--ty', `${ty}px`);
        emoji.style.setProperty('--r', `${rotation}deg`);

        document.body.appendChild(emoji);

        emoji.addEventListener('animationend', () => {
            emoji.remove();
        });
    }
}

/* --- NOVO: Efeito de Explosão de Estrelas --- */
function playStarBurst(event) {
    const button = event.currentTarget;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const burstCount = 15;

    for (let i = 0; i < burstCount; i++) {
        const star = document.createElement('span');
        star.className = 'star-burst-particle';
        star.textContent = '✨';
        
        star.style.left = `${rect.left + rect.width / 2}px`;
        star.style.top = `${rect.top + rect.height / 2}px`;

        const angle = Math.random() * 360;
        const distance = Math.random() * 70 + 60; // Voa um pouco mais longe
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        const rotation = Math.random() * 360 - 180;

        star.style.setProperty('--tx', `${tx}px`);
        star.style.setProperty('--ty', `${ty}px`);
        star.style.setProperty('--r', `${rotation}deg`);

        document.body.appendChild(star);

        star.addEventListener('animationend', () => {
            star.remove();
        });
    }
}