/**************************************
 * 🏛️ Constantes Globais
 **************************************/

const DIAS_SEMANA = [
    { id: 'dom', nome: 'Domingo', abrev: 'Dom' }, 
    { id: 'seg', nome: 'Segunda', abrev: 'Seg' },
    { id: 'ter', nome: 'Terça', abrev: 'Ter' }, 
    { id: 'qua', nome: 'Quarta', abrev: 'Qua' },
    { id: 'qui', nome: 'Quinta', abrev: 'Qui' },
    { id: 'sex', nome: 'Sexta', abrev: 'Sex' },
    { id: 'sab', nome: 'Sábado', abrev: 'Sab' }
];

// NOVOS TURNOS DE SISTEMA PARA AUSÊNCIAS
const TURNO_FOLGA_ID = 'turno_folga_system_id';
const TURNO_FERIAS_ID = 'turno_ferias_system_id';
const TURNO_AFASTAMENTO_ID = 'turno_afastamento_system_id';

const TURNOS_SISTEMA_AUSENCIA = {
    [TURNO_FOLGA_ID]: {
        id: TURNO_FOLGA_ID,
        nome: "Folga",
        sigla: "FO",
        cor: "#d1fae5", // Verde Menta
        isSystem: true,
        cargaMin: 0,
    },
    [TURNO_FERIAS_ID]: {
        id: TURNO_FERIAS_ID,
        nome: "Férias",
        sigla: "FÉ",
        cor: "#cffafe", // Ciano Suave
        isSystem: true,
        cargaMin: 0,
    },
    [TURNO_AFASTAMENTO_ID]: {
        id: TURNO_AFASTAMENTO_ID,
        nome: "Afast.", // Abreviação para caber no pincel
        sigla: "AF",
        cor: "#ffedd5", // Laranja Suave
        isSystem: true,
        cargaMin: 0,
    },
};