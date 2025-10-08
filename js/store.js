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
        config: { nome: '', theme: 'light' },
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
        LOAD_STATE(state) {
            state.turnos = loadJSON(KEYS.turnos, []);
            state.cargos = loadJSON(KEYS.cargos, []);
            state.funcionarios = loadJSON(KEYS.funcs, []);
            state.equipes = loadJSON(KEYS.equipes, []);
            state.escalas = loadJSON(KEYS.escalas, []);
            state.config = loadJSON(KEYS.config, { nome: '', theme: 'light' });
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
            // Cascata: remove o turno de cargos e a disponibilidade de funcionários
            state.cargos.forEach(cargo => {
                cargo.turnosIds = cargo.turnosIds.filter(id => id !== turnoId);
            });
            state.funcionarios.forEach(func => {
                if (func.disponibilidade && func.disponibilidade[turnoId]) {
                    delete func.disponibilidade[turnoId];
                }
            });
            // Cascata: remove equipes associadas ao turno para manter a integridade dos dados
            state.equipes = state.equipes.filter(e => e.turnoId !== turnoId);

            saveJSON(KEYS.turnos, state.turnos);
            saveJSON(KEYS.cargos, state.cargos);
            saveJSON(KEYS.funcs, state.funcionarios);
            saveJSON(KEYS.equipes, state.equipes);
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
                
                // CORREÇÃO DE INTEGRIDADE: Remove equipes que se tornaram "órfãs"
                // porque o turno delas foi removido do cargo.
                const equipesInvalidas = state.equipes.filter(equipe => 
                    equipe.cargoId === cargo.id && !cargo.turnosIds.includes(equipe.turnoId)
                ).map(e => e.id);

                if (equipesInvalidas.length > 0) {
                    state.equipes = state.equipes.filter(equipe => !equipesInvalidas.includes(equipe.id));
                    saveJSON(KEYS.equipes, state.equipes);
                }

                saveJSON(KEYS.funcs, state.funcionarios);
            } else {
                state.cargos.push(cargo);
            }
            saveJSON(KEYS.cargos, state.cargos);
        },
        DELETE_CARGO(state, cargoId) {
            state.cargos = state.cargos.filter(c => c.id !== cargoId);
            // Cascata: desassocia funcionários e remove equipes
            state.funcionarios.forEach(f => { if (f.cargoId === cargoId) f.cargoId = null; });
            state.equipes = state.equipes.filter(e => e.cargoId !== cargoId);
            state.escalas = state.escalas.filter(e => e.cargoId !== cargoId);

            saveJSON(KEYS.cargos, state.cargos);
            saveJSON(KEYS.funcs, state.funcionarios);
            saveJSON(KEYS.equipes, state.equipes);
            saveJSON(KEYS.escalas, state.escalas);
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