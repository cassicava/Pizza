/**************************************
 * 🤝 Funções Utilitárias Compartilhadas
 * (Usado pelo main thread e pelo web worker)
 **************************************/

const uid = () => Math.random().toString(36).slice(2,10);

function parseTimeToMinutes(t) {
    if (!t || typeof t !== 'string') return 0;
    const parts = t.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60) + m;
}

function minutesToHHMM(min){ const h=String(Math.floor(min/60)).padStart(2,"0"); const m=String(min%60).padStart(2,"0"); return `${h}:${m}`; }

function calcCarga(inicio, fim, almocoMin, diasDeDiferenca = 0) {
  const inicioMin = parseTimeToMinutes(inicio);
  const fimMin = parseTimeToMinutes(fim);
  const minutosEmUmDia = 1440;
  let duracaoMin = (fimMin - inicioMin) + (diasDeDiferenca * minutosEmUmDia);
  // ALTERAÇÃO: Garante que a carga horária nunca seja negativa.
  return Math.max(0, duracaoMin - (almocoMin || 0));
}

function addDays(dateISO,n){ const d=new Date(dateISO); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function dateRangeInclusive(startISO,endISO){ const days=[]; let d=startISO; while(d<=endISO){ days.push(d); d=addDays(d,1); } return days; }

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

function calcularMetaHoras(funcionario, inicioEscala, fimEscala) {
    const horasContratadasBase = parseFloat(funcionario.cargaHoraria) || 0;
    if (horasContratadasBase === 0) return 0;
    const dateRange = dateRangeInclusive(inicioEscala, fimEscala);
    if (funcionario.periodoHoras === 'semanal') {
        return (horasContratadasBase / 7) * dateRange.length;
    } 
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
 * NOVA FUNÇÃO: Calcula a meta de turnos proporcional para o período da escala.
 * @param {object} funcionario - O objeto do funcionário.
 * @param {string} inicioEscala - Data de início da escala (ISO).
 * @param {string} fimEscala - Data de fim da escala (ISO).
 * @returns {number} - A meta de turnos para o período.
 */
function calcularMetaTurnos(funcionario, inicioEscala, fimEscala) {
    const metaBase = parseFloat(funcionario.cargaHoraria) || 0;
    if (metaBase === 0) return 0;
    
    const dateRange = dateRangeInclusive(inicioEscala, fimEscala);
    const totalDiasEscala = dateRange.length;

    if (funcionario.periodoHoras === 'semanal') {
        // Proporcional a uma semana de 7 dias
        return (metaBase / 7) * totalDiasEscala;
    } 
    
    // Lógica para meta mensal
    let metaFinal = 0;
    const mesesNaEscala = {};
    dateRange.forEach(d => {
        const mesAno = d.slice(0, 7);
        mesesNaEscala[mesAno] = (mesesNaEscala[mesAno] || 0) + 1;
    });

    for (const mesAno in mesesNaEscala) {
        const [ano, mes] = mesAno.split('-').map(Number);
        const diasNoMesCalendario = new Date(ano, mes, 0).getDate();
        const diasDaEscalaNesseMes = mesesNaEscala[mesAno];
        metaFinal += (metaBase / diasNoMesCalendario) * diasDaEscalaNesseMes;
    }
    return metaFinal;
}


function calculateConsecutiveWorkDays(employeeId, allSlots, targetDate, turnosMap) {
    const turnosDoFuncMap = new Map(allSlots.filter(s => s.assigned === employeeId).map(s => [s.date, s]));
    let streak = 0;
    let currentDate = targetDate;
    while (true) {
        if (turnosDoFuncMap.has(currentDate)) {
            streak++;
        } else {
            const previousDay = addDays(currentDate, -1);
            const previousShiftSlot = turnosDoFuncMap.get(previousDay);
            if (previousShiftSlot && previousShiftSlot.turnoId && turnosMap[previousShiftSlot.turnoId]) {
                const turnoInfo = turnosMap[previousShiftSlot.turnoId];
                if (parseTimeToMinutes(turnoInfo.fim) + (turnoInfo.diasDeDiferenca * 1440) > 1440) {
                    // Turno noturno que terminou no dia 'currentDate', a sequência não é quebrada.
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        currentDate = addDays(currentDate, -1);
    }
    return streak;
}

/**
 * FUNÇÃO CORRIGIDA: Verifica violações de descanso obrigatório para o passado E para o futuro.
 */
function checkMandatoryRestViolation(employee, newShiftTurno, newShiftDate, allSlots, turnosMap) {
    if (employee.tipoContrato !== 'clt' || (!newShiftTurno.descansoObrigatorioHoras && !allSlots.some(s => s.assigned === employee.id && turnosMap[s.turnoId]?.descansoObrigatorioHoras))) {
        return { violation: false, message: '' };
    }

    const allEmployeeShifts = allSlots.filter(s => s.assigned === employee.id).sort((a, b) => a.date.localeCompare(b.date));
    const newShiftStart = new Date(`${newShiftDate}T${newShiftTurno.inicio}`);
    
    // 1. Verificação para trás (o novo turno viola o descanso de um turno anterior?)
    const previousShift = allEmployeeShifts.filter(s => s.date < newShiftDate).pop();
    if (previousShift) {
        const prevTurnoInfo = turnosMap[previousShift.turnoId];
        if (prevTurnoInfo && prevTurnoInfo.descansoObrigatorioHoras) {
            const prevShiftEnd = new Date(`${previousShift.date}T${prevTurnoInfo.fim}`);
            prevShiftEnd.setDate(prevShiftEnd.getDate() + (prevTurnoInfo.diasDeDiferenca || 0));
            const diffHours = (newShiftStart - prevShiftEnd) / (1000 * 60 * 60);
            if (diffHours < prevTurnoInfo.descansoObrigatorioHoras) {
                return { violation: true, message: `Viola descanso de ${prevTurnoInfo.descansoObrigatorioHoras}h do turno anterior.` };
            }
        }
    }

    // 2. Verificação para frente (o novo turno impõe um descanso que é violado por um turno futuro?)
    if (newShiftTurno.descansoObrigatorioHoras) {
        const nextShift = allEmployeeShifts.find(s => s.date > newShiftDate);
        if (nextShift) {
            const nextTurnoInfo = turnosMap[nextShift.turnoId];
            if (nextTurnoInfo) {
                const newShiftEnd = new Date(`${newShiftDate}T${newShiftTurno.fim}`);
                newShiftEnd.setDate(newShiftEnd.getDate() + (newShiftTurno.diasDeDiferenca || 0));
                
                const nextShiftStart = new Date(`${nextShift.date}T${nextTurnoInfo.inicio}`);
                const diffHours = (nextShiftStart - newShiftEnd) / (1000 * 60 * 60);

                if (diffHours < newShiftTurno.descansoObrigatorioHoras) {
                    return { violation: true, message: `Conflito com o turno futuro. O descanso de ${newShiftTurno.descansoObrigatorioHoras}h seria violado.` };
                }
            }
        }
    }

    return { violation: false, message: '' };
}