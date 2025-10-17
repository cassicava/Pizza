/**************************************
 * 🤝 Funções Utilitárias Compartilhadas
 * (Usado pelo main thread e pelo web worker)
 **************************************/

const uid = () => Math.random().toString(36).slice(2,10);

const MAX_DIAS_CONSECUTIVOS = 7; // Valor máximo razoável para dias consecutivos

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
    const totalDiasEscala = dateRange.length;

    if (funcionario.periodoHoras === 'semanal') {
        const meta = (horasContratadasBase / 7) * totalDiasEscala;
        return totalDiasEscala < 7 ? Math.ceil(meta) : meta;
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
    return totalDiasEscala < 15 ? Math.ceil(metaHoras) : metaHoras;
}


function calcularMetaTurnos(funcionario, inicioEscala, fimEscala, cargoDiasOperacionais = DIAS_SEMANA.map(d => d.id)) {
    const metaBase = parseFloat(funcionario.cargaHoraria) || 0;
    if (metaBase === 0) return 0;
    
    const dateRange = dateRangeInclusive(inicioEscala, fimEscala);
    
    let diasElegiveis = 0;
    dateRange.forEach(date => {
        const d = new Date(date + 'T12:00:00');
        const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
        if (cargoDiasOperacionais.includes(diaSemanaId)) {
            diasElegiveis++;
        }
    });

    if (diasElegiveis === 0) return 0;
    
    if (funcionario.periodoHoras === 'semanal') {
        const diasElegiveisBase = DIAS_SEMANA.filter(d => cargoDiasOperacionais.includes(d.id)).length;
        if (diasElegiveisBase === 0) return 0;
        
        const meta = (metaBase / diasElegiveisBase) * diasElegiveis;
        return Math.round(meta);

    } 
    
    let metaFinal = 0;
    const mesesNaEscala = {};
    dateRange.forEach(d => {
        const mesAno = d.slice(0, 7);
        mesesNaEscala[mesAno] = (mesesNaEscala[mesAno] || 0) + 1;
    });

    for (const mesAno in mesesNaEscala) {
        const [ano, mes] = mesAno.split('-').map(Number);
        const diasNoMesCalendario = new Date(ano, mes, 0).getDate();
        
        let diasUteisNaEscalaNesseMes = 0;
        const diasDaEscala = dateRange.filter(d => d.startsWith(mesAno));
        diasDaEscala.forEach(date => {
             const d = new Date(date + 'T12:00:00');
             const diaSemanaId = DIAS_SEMANA[d.getUTCDay()].id;
             if (cargoDiasOperacionais.includes(diaSemanaId)) {
                diasUteisNaEscalaNesseMes++;
            }
        });
        
        let diasUteisNoMesCalendario = 0;
        for (let day = 1; day <= diasNoMesCalendario; day++) {
            const date = new Date(Date.UTC(ano, mes - 1, day));
            const diaSemanaId = DIAS_SEMANA[date.getUTCDay()].id;
             if (cargoDiasOperacionais.includes(diaSemanaId)) {
                diasUteisNoMesCalendario++;
            }
        }
        
        if (diasUteisNoMesCalendario === 0) continue;

        metaFinal += (metaBase / diasUteisNoMesCalendario) * diasUteisNaEscalaNesseMes;
    }
    return Math.round(metaFinal);
}

function mergeTimeIntervals(turnos) {
    if (!turnos || turnos.length === 0) return null;

    const minutosEm24h = 1440;
    let intervalos = turnos.map(t => {
        const start = parseTimeToMinutes(t.inicio);
        const end = parseTimeToMinutes(t.fim) + (t.diasDeDiferenca || 0) * minutosEm24h;
        return { start, end };
    });

    const intervalosCiclicos = [...intervalos];
    intervalos.forEach(iv => {
        intervalosCiclicos.push({ start: iv.start + minutosEm24h, end: iv.end + minutosEm24h });
    });
    intervalosCiclicos.sort((a, b) => a.start - b.start);

    const merged = [];
    if (intervalosCiclicos.length > 0) {
        merged.push({ ...intervalosCiclicos[0] });
        for (let i = 1; i < intervalosCiclicos.length; i++) {
            const last = merged[merged.length - 1];
            const current = intervalosCiclicos[i];
            if (current.start <= last.end) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push({ ...current });
            }
        }
    }

    for (const iv of merged) {
        if (iv.end - iv.start >= minutosEm24h) {
            return { is24h: true };
        }
    }

    const minStartMinutes = Math.min(...turnos.map(t => parseTimeToMinutes(t.inicio)));
    const maxEndMinutesTotal = Math.max(...turnos.map(t => parseTimeToMinutes(t.fim) + (t.diasDeDiferenca || 0) * 1440));
    
    const inicio = minutesToHHMM(minStartMinutes);
    const fimModulo = maxEndMinutesTotal % minutosEm24h;
    const fim = minutesToHHMM(fimModulo);

    return { is24h: false, inicio, fim };
}

/**
 * FUNÇÃO CORRIGIDA: Calcula a sequência completa de dias de trabalho, contando corretamente os turnos noturnos.
 */
function calculateFullConsecutiveWorkDays(employeeId, allSlots, targetDate, turnosMap) {
    const employeeShifts = allSlots
        .filter(s => s.assigned === employeeId && turnosMap[s.turnoId] && !turnosMap[s.turnoId].isSystem)
        .map(s => ({
            ...s,
            startDate: new Date(`${s.date}T${turnosMap[s.turnoId].inicio}`).getTime(),
            endDate: new Date(`${s.date}T${turnosMap[s.turnoId].inicio}`).getTime() + (turnosMap[s.turnoId].cargaMin * 60 * 1000)
        }))
        .sort((a, b) => a.startDate - b.startDate);

    if (employeeShifts.length === 0) return 0;
    
    const targetShift = employeeShifts.find(s => s.date === targetDate);
    if (!targetShift) return 0;

    let currentSequence = [];
    let bestSequence = [];

    for (let i = 0; i < employeeShifts.length; i++) {
        const currentShift = employeeShifts[i];
        
        if (currentSequence.length === 0) {
            currentSequence.push(currentShift);
        } else {
            const lastShiftInSequence = currentSequence[currentSequence.length - 1];
            const lastShiftEndDate = new Date(lastShiftInSequence.date + 'T00:00:00Z');
            lastShiftEndDate.setUTCDate(lastShiftEndDate.getUTCDate() + (turnosMap[lastShiftInSequence.turnoId].diasDeDiferenca || 0));
            
            const nextDayAfterLastShift = new Date(lastShiftEndDate);
            nextDayAfterLastShift.setUTCDate(nextDayAfterLastShift.getUTCDate() + 1);

            const currentShiftDate = new Date(currentShift.date + 'T00:00:00Z');

            if (currentShiftDate > nextDayAfterLastShift) {
                // Quebrou a sequência, começa uma nova
                currentSequence = [currentShift];
            } else {
                // Continua a sequência
                currentSequence.push(currentShift);
            }
        }
        
        // Se a sequência atual contém o turno alvo, ela é a candidata a ser a "melhor"
        if (currentSequence.some(s => s.id === targetShift.id)) {
            bestSequence = [...currentSequence];
        }
    }
    
    return bestSequence.length;
}


/**
 * Helper para obter timestamps UTC de início e fim de um turno.
 * @param {string} date - A data do turno (YYYY-MM-DD).
 * @param {object} turnoInfo - O objeto do turno.
 * @returns {{start: number, end: number}|null} - Objeto com timestamps ou null.
 */
function getShiftTimestampsUTC(date, turnoInfo) {
    if (!date || !turnoInfo || !turnoInfo.inicio || !turnoInfo.fim) return null;

    const [year, month, day] = date.split('-').map(Number);
    const [startHour, startMinute] = turnoInfo.inicio.split(':').map(Number);
    
    const startTimestamp = Date.UTC(year, month - 1, day, startHour, startMinute);
    const duracaoTotalMin = calcCarga(turnoInfo.inicio, turnoInfo.fim, 0, turnoInfo.diasDeDiferenca) + (turnoInfo.almocoMin || 0);
    const endTimestamp = startTimestamp + duracaoTotalMin * 60 * 1000;

    return { start: startTimestamp, end: endTimestamp };
}

/**
 * NOVA FUNÇÃO DE VALIDAÇÃO DE DESCANSO - Mais precisa e robusta.
 */
function checkMandatoryRestViolation(employee, newShiftTurno, newShiftDate, allSlots, turnosMap) {
    if (newShiftTurno.isSystem) {
        return { violation: false, message: '' };
    }

    const allEmployeeShifts = allSlots
        .filter(s => s.assigned === employee.id && turnosMap[s.turnoId] && !turnosMap[s.turnoId].isSystem)
        .sort((a, b) => a.date.localeCompare(b.date));

    const newShiftTimestamps = getShiftTimestampsUTC(newShiftDate, newShiftTurno);
    if (!newShiftTimestamps) return { violation: false, message: '' };

    const newShiftIndex = allEmployeeShifts.findIndex(s => s.date >= newShiftDate);

    // 1. Verificação para trás
    const previousShiftData = (newShiftIndex > 0) 
        ? allEmployeeShifts[newShiftIndex - 1] 
        : allEmployeeShifts.filter(s => s.date < newShiftDate).pop();

    if (previousShiftData) {
        const prevTurnoInfo = turnosMap[previousShiftData.turnoId];
        if (prevTurnoInfo && prevTurnoInfo.descansoObrigatorioHoras) {
            const prevShiftTimestamps = getShiftTimestampsUTC(previousShiftData.date, prevTurnoInfo);
            if (prevShiftTimestamps) {
                const diffHours = (newShiftTimestamps.start - prevShiftTimestamps.end) / (1000 * 60 * 60);
                if (diffHours < prevTurnoInfo.descansoObrigatorioHoras) {
                    return { violation: true, message: `Viola descanso de ${prevTurnoInfo.descansoObrigatorioHoras}h do turno anterior.` };
                }
            }
        }
    }

    // 2. Verificação para frente
    if (newShiftTurno.descansoObrigatorioHoras) {
        const nextShiftData = (newShiftIndex !== -1 && newShiftIndex < allEmployeeShifts.length -1)
            ? allEmployeeShifts[newShiftIndex + 1]
            : allEmployeeShifts.find(s => s.date > newShiftDate);
            
        if (nextShiftData) {
            const nextTurnoInfo = turnosMap[nextShiftData.turnoId];
            if (nextTurnoInfo) {
                const nextShiftTimestamps = getShiftTimestampsUTC(nextShiftData.date, nextTurnoInfo);
                if (nextShiftTimestamps) {
                    const diffHours = (nextShiftTimestamps.start - newShiftTimestamps.end) / (1000 * 60 * 60);
                    if (diffHours < newShiftTurno.descansoObrigatorioHoras) {
                        return { violation: true, message: `Conflito com o turno futuro. O descanso de ${newShiftTurno.descansoObrigatorioHoras}h seria violado.` };
                    }
                }
            }
        }
    }

    return { violation: false, message: '' };
}