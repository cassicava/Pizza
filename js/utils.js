/**************************************
 * 🛠️ Utilidades / Persistência
 **************************************/

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,10);

function saveJSON(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

/**
 * Gera um nome padronizado para a escala.
 * Formato: "Nome do Cargo Mês DD-DD" ou "Nome do Cargo MêsIni-MêsFim DD-DD".
 * @param {string} cargoName - O nome do cargo.
 * @param {string} inicio - A data de início (YYYY-MM-DD).
 * @param {string} fim - A data de fim (YYYY-MM-DD).
 * @returns {string} O nome gerado para a escala.
 */
function generateEscalaNome(cargoName, inicio, fim) {
    const dIni = new Date(inicio + 'T12:00:00');
    const dFim = new Date(fim + 'T12:00:00');

    const options = { month: 'long' };
    const mesIniNome = dIni.toLocaleString('pt-BR', options).replace(/^\w/, c => c.toUpperCase());
    const mesFimNome = dFim.toLocaleString('pt-BR', options).replace(/^\w/, c => c.toUpperCase());

    const diaIni = String(dIni.getDate()).padStart(2, '0');
    const diaFim = String(dFim.getDate()).padStart(2, '0');

    let mesStr = mesIniNome;
    if (mesIniNome !== mesFimNome) {
        mesStr = `${mesIniNome}-${mesFimNome}`;
    }

    return `${cargoName} ${mesStr} ${diaIni}-${diaFim}`;
}


// --- LOADER: Funções para controlar o indicador de carregamento ---
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
// --- FIM DO LOADER ---


/**
 * Função de validação de input consolidada e melhorada.
 * Verifica se um campo (input ou select) tem valor.
 * Adiciona/remove classes 'invalid' do campo e 'invalid-label' do seu label pai.
 * @param {HTMLElement} inputElement - O elemento de input ou select a ser validado.
 * @param {boolean} [forceValid=false] - Se true, força o campo a ser considerado válido.
 * @returns {boolean} - Retorna true se o campo for válido, false caso contrário.
 */
function validateInput(inputElement, forceValid = false) {
    if (!inputElement) return true; // Se o elemento não existe, não valida.

    const isSelect = inputElement.tagName.toLowerCase() === 'select';
    const isValid = forceValid || (isSelect ? inputElement.value !== '' : inputElement.value.trim() !== '');

    inputElement.classList.toggle('invalid', !isValid);
    const label = inputElement.closest('label');
    if (label) {
        label.classList.toggle('invalid-label', !isValid);
    }
    return isValid;
}


function parseTimeToMinutes(t){ if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minutesToHHMM(min){ const h=String(Math.floor(min/60)).padStart(2,"0"); const m=String(min%60).padStart(2,"0"); return `${h}:${m}`; }

/**
 * Calcula a carga horária de um turno em minutos, considerando turnos que ultrapassam 24 horas.
 * @param {string} inicio - Horário de início (HH:MM).
 * @param {string} fim - Horário de fim (HH:MM).
 * @param {number} almocoMin - Duração do almoço em minutos.
 * @param {number} diasDeDiferenca - A diferença em dias entre o início e o fim (0 para mesmo dia, 1 para dia seguinte, etc.).
 * @returns {number} A carga total em minutos.
 */
function calcCarga(inicio, fim, almocoMin, diasDeDiferenca = 0) {
  const inicioMin = parseTimeToMinutes(inicio);
  const fimMin = parseTimeToMinutes(fim);
  const minutosEmUmDia = 1440; // 24 * 60

  let duracaoMin = (fimMin - inicioMin) + (diasDeDiferenca * minutosEmUmDia);
  
  return duracaoMin - (almocoMin || 0);
}

function addDays(dateISO,n){ const d=new Date(dateISO); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function dateRangeInclusive(startISO,endISO){ const days=[]; let d=startISO; while(d<=endISO){ days.push(d); d=addDays(d,1); } return days; }

/**
 * NOVA FUNÇÃO CENTRALIZADA
 * Calcula a carga horária esperada (meta) de um funcionário para um determinado período.
 * @param {object} funcionario - O objeto do funcionário.
 * @param {string} inicioEscala - A data de início da escala (YYYY-MM-DD).
 * @param {string} fimEscala - A data de fim da escala (YYYY-MM-DD).
 * @returns {number} - A meta de horas para o período.
 */
function calcularMetaHoras(funcionario, inicioEscala, fimEscala) {
    const horasContratadasBase = parseFloat(funcionario.cargaHoraria) || 0;
    if (horasContratadasBase === 0) return 0;

    const dateRange = dateRangeInclusive(inicioEscala, fimEscala);
    if (funcionario.periodoHoras === 'semanal') {
        // Lógica para carga horária semanal
        return (horasContratadasBase / 7) * dateRange.length;
    } 
    
    // Lógica para carga horária mensal (proporcional aos dias da escala em cada mês)
    let metaHoras = 0;
    const mesesNaEscala = {};
    dateRange.forEach(d => {
        const mesAno = d.slice(0, 7);
        mesesNaEscala[mesAno] = (mesesNaEscala[mesAno] || 0) + 1;
    });

    for (const mesAno in mesesNaEscala) {
        const [ano, mes] = mesAno.split('-').map(Number);
        const diasNoMesCalendario = new Date(ano, mes, 0).getDate();
        const diasDaEscalaNesseMes = mesesNaEscala[mesAno];
        metaHoras += (horasContratadasBase / diasNoMesCalendario) * diasDaEscalaNesseMes;
    }
    return metaHoras;
}

/**
 * FUNÇÃO UNIFICADA: Calcula os dias de trabalho consecutivos para um funcionário.
 * Conta para trás a partir da `targetDate`, incluindo o trabalho nesse dia.
 * @param {string} employeeId - ID do funcionário.
 * @param {Array} allSlots - Array com todos os slots da escala.
 * @param {string} targetDate - Data final da contagem (YYYY-MM-DD).
 * @param {Object} turnosMap - Um mapa de turnos (id => objeto turno).
 * @returns {number} - O número de dias consecutivos de trabalho.
 */
function calculateConsecutiveWorkDays(employeeId, allSlots, targetDate, turnosMap) {
    const turnosDoFuncMap = new Map(
        allSlots.filter(s => s.assigned === employeeId).map(s => [s.date, s])
    );

    let streak = 0;
    let currentDate = targetDate;

    while (true) {
        if (turnosDoFuncMap.has(currentDate)) {
            streak++;
        } else {
            // Se o dia está vazio, verifica se foi um descanso obrigatório de turno noturno
            const previousDay = addDays(currentDate, -1);
            const previousShiftSlot = turnosDoFuncMap.get(previousDay);

            if (previousShiftSlot && previousShiftSlot.turnoId && turnosMap[previousShiftSlot.turnoId]) {
                const turnoInfo = turnosMap[previousShiftSlot.turnoId];
                if (turnoInfo.fim < turnoInfo.inicio) { // É um turno noturno
                    // A sequência não é quebrada, mas não incrementamos o streak e paramos a verificação para trás
                } else {
                    break; // Folga real, quebra a sequência.
                }
            } else {
                break; // Dois dias vazios seguidos, quebra a sequência.
            }
        }
        currentDate = addDays(currentDate, -1); // Continua para o dia anterior
    }
    return streak;
}


function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getFimDeSemanaNoMes(mesAno) {
    const [ano, mes] = mesAno.split('-').map(Number);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const finsDeSemana = [];
    const semanas = new Set();

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = new Date(ano, mes - 1, dia);
        if (data.getDay() === 0 || data.getDay() === 6) { // 0 = Domingo, 6 = Sábado
            const semanaId = getWeekNumber(data);
            const fimDeSemanaId = `${mesAno}-${semanaId}`;
            if (!semanas.has(fimDeSemanaId)) {
                finsDeSemana.push({ id: fimDeSemanaId, dates: [] });
                semanas.add(fimDeSemanaId);
            }
            finsDeSemana.find(fs => fs.id === fimDeSemanaId).dates.push(data.toISOString().slice(0, 10));
        }
    }
    return finsDeSemana;
}

/**
 * NOVO: Calcula a cor de texto (preto ou branco) com melhor contraste para um fundo hexadecimal.
 * @param {string} hex - A cor de fundo em formato hexadecimal (ex: '#fef08a').
 * @returns {'#000000'} (preto) ou {'#FFFFFF'} (branco).
 */
function getContrastingTextColor(hex) {
    if (!hex) return '#000000';
    
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Fórmula de luminosidade percebida
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}


function showToast(message) {
    const toast = $("#toast");
    $("#toastMessage").textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

// --- FUNÇÕES DE MODAL ---

function showConfirm({ title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) {
    return new Promise((resolve) => {
        const backdrop = $("#modalBackdrop");
        const modalConfirmBtn = $("#modalConfirm");
        const modalCancelBtn = $("#modalCancel");

        $("#modalTitle").textContent = title;
        $("#modalMessage").innerHTML = `<p>${message}</p>`; // Usando innerHTML para permitir tags como <strong>
        modalConfirmBtn.textContent = confirmText;
        modalConfirmBtn.disabled = false;
        modalCancelBtn.textContent = cancelText;

        modalConfirmBtn.style.display = 'inline-flex';
        modalCancelBtn.style.display = 'inline-flex';

        backdrop.classList.remove("hidden");

        const cleanupAndResolve = (value) => {
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            $("#modalMessage").innerHTML = ''; // Limpa o conteúdo
            backdrop.classList.add("hidden");
            resolve(value);
        };

        const confirmHandler = () => cleanupAndResolve(true);
        const cancelHandler = () => cleanupAndResolve(false);

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
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
        modalCancelBtn.removeEventListener('click', closeHandler);
        // Reseta o estado dos botões
        $("#modalConfirm").style.display = 'inline-flex';
        $("#modalMessage").innerHTML = '';
    };

    modalCancelBtn.addEventListener('click', closeHandler);
}

/**
 * Lógica de verificação de rolagem aprimorada.
 * Mostra um modal cujo botão de confirmação só é ativado após o scroll até o final.
 */
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
        
        // CORREÇÃO: A redefinição do scroll agora é feita dentro do timeout,
        // garantindo que o DOM foi atualizado antes de a posição ser zerada.
        setTimeout(() => {
            modalMessageEl.scrollTop = 0; // Força o scroll para o topo
            enableButtonIfReady(); // Faz a verificação inicial
            modalMessageEl.addEventListener('scroll', enableButtonIfReady);
        }, 100); // Um delay mínimo é suficiente

        backdrop.classList.remove("hidden");

        const cleanupAndResolve = (value) => {
            modalMessageEl.removeEventListener('scroll', enableButtonIfReady);
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };

        const confirmHandler = () => cleanupAndResolve(true);
        const cancelHandler = () => cleanupAndResolve(false);

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
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
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            modalConfirmBtn.disabled = false;
            $("#modalMessage").innerHTML = '';
            backdrop.classList.add("hidden");
            resolve(value);
        };

        const confirmHandler = () => cleanupAndResolve(true);
        const cancelHandler = () => cleanupAndResolve(false);

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
    });
}

// --- FUNÇÃO MELHORADA PARA EXCLUSÃO ---
async function handleDeleteItem({ id, itemName, dispatchAction, additionalInfo = '' }) {
    let message = `Atenção: esta ação é permanente e não pode ser desfeita. Excluir este ${itemName.toLowerCase()} pode afetar outras partes do sistema. ${additionalInfo} Deseja continuar?`;

    const confirmado = await showConfirm({
        title: `Confirmar Exclusão de ${itemName}?`,
        message: message
    });

    if (confirmado) {
        store.dispatch(dispatchAction, id);
        showToast(`${itemName} excluído com sucesso.`);
    }
}