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

const TIPOS_FOLGA = [
    { nome: "Folga Normal", sigla: "FN" },
    { nome: "Folga Abonada", sigla: "FA" },
    { nome: "Atestado Médico", sigla: "AM" },
    { nome: "Folga Aniversário", sigla: "ANIV" }
];

// ALTERAÇÃO: Adicionadas siglas a todos os tipos de afastamento
const TIPOS_AFASTAMENTO = [
    { nome: "Atestado Médico", sigla: "AM" },
    { nome: "Licença Médica", sigla: "LM" },
    { nome: "Licença Maternidade/Paternidade", sigla: "LP" },
    { nome: "Curso/Treinamento", sigla: "CT" },
    { nome: "Outro", sigla: "OU" }
];