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
 * FUNÇÃO REESCRITA: Calcula a sequência completa de dias de trabalho, contando corretamente os turnos noturnos.
 */
function calculateFullConsecutiveWorkDays(employeeId, allSlots, targetDate, turnosMap) {
    const employeeShifts = allSlots
        .filter(s => s.assigned === employeeId && turnosMap[s.turnoId] && !turnosMap[s.turnoId].isSystem)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (employeeShifts.length === 0) return 0;

    const targetShiftIndex = employeeShifts.findIndex(s => s.date === targetDate);
    
    // Se a data alvo não tiver um turno, não há sequência a partir dela
    if (targetShiftIndex === -1) return 0;

    let firstShiftIndex = targetShiftIndex;
    // Anda para trás para encontrar o início da sequência
    for (let i = targetShiftIndex; i > 0; i--) {
        const currentShift = employeeShifts[i];
        const prevShift = employeeShifts[i - 1];
        
        const prevTurnoInfo = turnosMap[prevShift.turnoId];
        const prevShiftEndDate = addDays(prevShift.date, (prevTurnoInfo.diasDeDiferenca || 0));
        
        // A data seguinte ao fim do turno anterior
        const dayAfterPrevShiftEnd = addDays(prevShiftEndDate, 1);
        
        // Se a data de início do turno atual for posterior ao primeiro dia livre após o turno anterior,
        // significa que houve uma folga (gap) e a sequência foi quebrada.
        if (currentShift.date > dayAfterPrevShiftEnd) {
            break;
        }
        
        firstShiftIndex = i - 1;
    }

    let lastShiftIndex = targetShiftIndex;
    // Anda para frente para encontrar o fim da sequência
    for (let i = targetShiftIndex; i < employeeShifts.length - 1; i++) {
        const currentShift = employeeShifts[i];
        const nextShift = employeeShifts[i + 1];

        const currentTurnoInfo = turnosMap[currentShift.turnoId];
        const currentShiftEndDate = addDays(currentShift.date, (currentTurnoInfo.diasDeDiferenca || 0));
        
        const dayAfterCurrentShiftEnd = addDays(currentShiftEndDate, 1);

        // Se a data de início do próximo turno for posterior ao primeiro dia livre, a sequência quebrou.
        if (nextShift.date > dayAfterCurrentShiftEnd) {
            break;
        }
        
        lastShiftIndex = i + 1;
    }
    
    // A contagem de dias consecutivos é o número de turnos na sequência encontrada.
    return (lastShiftIndex - firstShiftIndex + 1);
}



function checkMandatoryRestViolation(employee, newShiftTurno, newShiftDate, allSlots, turnosMap) {
    if (newShiftTurno.isSystem) {
        return { violation: false, message: '' };
    }

    const allEmployeeShifts = allSlots.filter(s => s.assigned === employee.id).sort((a, b) => a.date.localeCompare(b.date));
    const newShiftStart = new Date(`${newShiftDate}T${newShiftTurno.inicio}`);
    
    // 1. Verificação para trás (o novo turno viola o descanso de um turno anterior?)
    const shiftsBefore = allEmployeeShifts.filter(s => s.date < newShiftDate);
    const previousShift = shiftsBefore.pop();
    
    if (previousShift) {
        const prevTurnoInfo = turnosMap[previousShift.turnoId];
        if (prevTurnoInfo && !prevTurnoInfo.isSystem && prevTurnoInfo.descansoObrigatorioHoras) {
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
            if (nextTurnoInfo && !nextTurnoInfo.isSystem) {
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