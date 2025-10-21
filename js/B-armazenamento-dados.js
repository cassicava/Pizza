/**************************************
 * 🏦 Store (Gerenciador de Estado)
 **************************************/

// O store centraliza todos os dados da aplicação, evitando variáveis globais
// e facilitando o gerenciamento e a reatividade dos dados.

const KEYS = {
    turnos: "ge_turnos",
    cargos: "ge_cargos",
    funcs: "ge_funcionarios",
    equipes: "ge_equipes",
    escalas: "ge_escalas",
    config: "ge_config"
};

const store = {
    // 1. STATE: Onde todos os dados da aplicação residem.
    state: {
        turnos: [],
        cargos: [],
        funcionarios: [],
        equipes: [],
        escalas: [],
        config: { nome: '' },
        dataCorrupted: false, // Nova flag para indicar dados corrompidos
    },

    // 2. LISTENERS: Funções que serão chamadas quando o estado mudar.
    listeners: [],

    // 3. GETTERS: Funções para obter o estado atual.
    getState() {
        return this.state;
    },

    // 4. ACTIONS: Funções que modificam o estado. São a única maneira de alterar os dados.
    /**
     * Função central para despachar ações que modificam o estado.
     * @param {string} actionName - O nome da ação a ser executada (ex: 'LOAD_STATE', 'SAVE_TURNO').
     * @param {*} payload - Os dados necessários para a ação.
     */
    dispatch(actionName, payload) {
        // As ações encontram a mutação correspondente para alterar o estado.
        if (typeof this.mutations[actionName] === 'function') {
            this.mutations[actionName](this.state, payload);
            // Após a mutação, notificamos todos os 'listeners' sobre a mudança.
            this.notify(actionName);
        } else {
            console.error(`Ação "${actionName}" não encontrada.`);
        }
    },

    // 5. MUTATIONS: Funções puras que efetivamente alteram o estado.
    mutations: {
        SET_DATA_CORRUPTION_FLAG(state, isCorrupted) {
            state.dataCorrupted = isCorrupted;
        },

        LOAD_STATE(state) {
            try {
                const DATA_VERSION = "1.3"; // Versão incrementada para incluir regras de alocação no cargo
                const currentVersion = localStorage.getItem('ge_data_version');

                // Carregamento e Migração
                state.escalas = loadJSON(KEYS.escalas, []).map(e => ({ ...e, observacoes: e.observacoes || '' }));
                state.funcionarios = loadJSON(KEYS.funcs, []);
                state.cargos = loadJSON(KEYS.cargos, []);

                if (currentVersion !== DATA_VERSION) {
                    // Migração v1.0 -> v1.1: Garante que todos os funcionários tenham um status.
                    state.funcionarios = state.funcionarios.map(f => ({ ...f, status: f.status || 'ativo' }));

                    // Migração v1.2 -> v1.3: Adiciona regras de alocação padrão aos cargos existentes.
                    state.cargos = state.cargos.map(c => {
                        if (!c.regras) c.regras = {};
                        if (!c.regras.hasOwnProperty('maxDiasConsecutivos')) c.regras.maxDiasConsecutivos = 6;
                        if (!c.regras.hasOwnProperty('minFolgasSabados')) c.regras.minFolgasSabados = 1;
                        if (!c.regras.hasOwnProperty('minFolgasDomingos')) c.regras.minFolgasDomingos = 1;
                        return c;
                    });

                    saveJSON(KEYS.funcs, state.funcionarios);
                    saveJSON(KEYS.cargos, state.cargos);
                    localStorage.setItem('ge_data_version', DATA_VERSION);
                }


                state.turnos = loadJSON(KEYS.turnos, []);
                state.equipes = loadJSON(KEYS.equipes, []);
                state.config = loadJSON(KEYS.config, { nome: '' });

                // Garante que os turnos de sistema (folga, férias) estejam sempre presentes e atualizados no estado
                const systemTurnos = Object.values(TURNOS_SISTEMA_AUSENCIA);
                systemTurnos.forEach(systemTurno => {
                    const index = state.turnos.findIndex(t => t.id === systemTurno.id);
                    if (index === -1) {
                        state.turnos.push(systemTurno);
                    } else {
                        state.turnos[index] = systemTurno;
                    }
                });

            } catch (error) {
                console.error("ERRO CRÍTICO AO CARREGAR DADOS:", error);
                this.SET_DATA_CORRUPTION_FLAG(state, true); // Chama a mutação correta
            }
        },


        SAVE_TURNO(state, turno) {
            const index = state.turnos.findIndex(t => t.id === turno.id);
            if (index > -1) {
                state.turnos[index] = { ...state.turnos[index], ...turno };
            } else {
                state.turnos.push(turno);
            }
            saveJSON(KEYS.turnos, state.turnos);
        },
        DELETE_TURNO(state, turnoId) {
            state.turnos = state.turnos.filter(t => t.id !== turnoId);
            saveJSON(KEYS.turnos, state.turnos);
            // LÓGICA EM CASCATA REMOVIDA - Agora é tratada pela UI com bloqueio e aviso.
        },

        SAVE_CARGO(state, cargo) {
            const index = state.cargos.findIndex(c => c.id === cargo.id);
            if (index > -1) {
                state.cargos[index] = { ...state.cargos[index], ...cargo };
                // Cascata: ajusta disponibilidade de funcionários se um turno for removido do cargo
                state.funcionarios.forEach(func => {
                    if (func.cargoId === cargo.id) {
                        for (const turnoId in func.disponibilidade) {
                            if (!cargo.turnosIds.includes(turnoId)) {
                                delete func.disponibilidade[turnoId];
                            }
                        }
                    }
                });
                saveJSON(KEYS.funcs, state.funcionarios);
            } else {
                state.cargos.push(cargo);
            }
            saveJSON(KEYS.cargos, state.cargos);
        },
        DELETE_CARGO(state, cargoId) {
            state.cargos = state.cargos.filter(c => c.id !== cargoId);
            saveJSON(KEYS.cargos, state.cargos);
            // LÓGICA EM CASCATA REMOVIDA - Agora é tratada pela UI com bloqueio e aviso.
        },

        SAVE_FUNCIONARIO(state, func) {
            const index = state.funcionarios.findIndex(f => f.id === func.id);
            if (index > -1) {
                state.funcionarios[index] = { ...state.funcionarios[index], ...func };
            } else {
                state.funcionarios.push({ ...func, status: 'ativo' });
            }
            saveJSON(KEYS.funcs, state.funcionarios);
        },
        DELETE_FUNCIONARIO(state, funcId) {
            state.funcionarios = state.funcionarios.filter(f => f.id !== funcId);
            // Cascata: remove o funcionário de qualquer equipe que ele pertença
            state.equipes.forEach(equipe => {
                equipe.funcionarioIds = equipe.funcionarioIds.filter(id => id !== funcId);
            });
            // Remove equipes que ficaram vazias
            state.equipes = state.equipes.filter(e => e.funcionarioIds.length > 0);

            saveJSON(KEYS.funcs, state.funcionarios);
            saveJSON(KEYS.equipes, state.equipes);
        },

        ARCHIVE_FUNCIONARIO(state, funcId) {
            const index = state.funcionarios.findIndex(f => f.id === funcId);
            if (index > -1) {
                state.funcionarios[index].status = 'arquivado';
            }
            saveJSON(KEYS.funcs, state.funcionarios);
        },
        UNARCHIVE_FUNCIONARIO(state, funcId) {
            const index = state.funcionarios.findIndex(f => f.id === funcId);
            if (index > -1) {
                state.funcionarios[index].status = 'ativo';
            }
            saveJSON(KEYS.funcs, state.funcionarios);
        },

        SAVE_EQUIPE(state, equipe) {
            const index = state.equipes.findIndex(e => e.id === equipe.id);
            if (index > -1) {
                state.equipes[index] = equipe;
            } else {
                state.equipes.push(equipe);
            }
            saveJSON(KEYS.equipes, state.equipes);
        },
        DELETE_EQUIPE(state, equipeId) {
            state.equipes = state.equipes.filter(e => e.id !== equipeId);
            saveJSON(KEYS.equipes, state.equipes);
        },

        SAVE_ESCALA(state, escala) {
            const index = state.escalas.findIndex(e => e.id === escala.id);
            if (index > -1) {
                state.escalas[index] = escala;
            } else {
                state.escalas.push(escala);
            }
            saveJSON(KEYS.escalas, state.escalas);
        },
        DELETE_ESCALA_SALVA(state, escalaId) {
            state.escalas = state.escalas.filter(e => e.id !== escalaId);
            saveJSON(KEYS.escalas, state.escalas);
        },

        SAVE_CONFIG(state, config) {
            state.config = { ...state.config, ...config };
            saveJSON(KEYS.config, state.config);
        }
    },

    subscribe(listener) {
        this.listeners.push(listener);
    },

    notify(actionName) {
        this.listeners.forEach(listener => listener(actionName));
    }
};