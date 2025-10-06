/**************************************
 * 🏦 Store (Gerenciador de Estado)
 **************************************/

// O store centraliza todos os dados da aplicação, evitando variáveis globais
// e facilitando o gerenciamento e a reatividade dos dados.

const KEYS = {
    turnos: "ge_turnos",
    cargos: "ge_cargos",
    funcs: "ge_funcionarios",
    escalas: "ge_escalas",
    config: "ge_config"
};

const store = {
    // 1. STATE: Onde todos os dados da aplicação residem.
    state: {
        turnos: [],
        cargos: [],
        funcionarios: [],
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
            state.cargos.forEach(cargo => {
                cargo.turnosIds = cargo.turnosIds.filter(id => id !== turnoId);
            });
            state.funcionarios.forEach(func => {
                if (func.disponibilidade && func.disponibilidade[turnoId]) {
                    delete func.disponibilidade[turnoId];
                }
            });
            saveJSON(KEYS.turnos, state.turnos);
            saveJSON(KEYS.cargos, state.cargos);
            saveJSON(KEYS.funcs, state.funcionarios);
        },

        SAVE_CARGO(state, cargo) {
            const index = state.cargos.findIndex(c => c.id === cargo.id);
            if (index > -1) {
                state.cargos[index] = { ...state.cargos[index], ...cargo };
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
            state.funcionarios.forEach(f => { if (f.cargoId === cargoId) f.cargoId = null; });
            state.escalas = state.escalas.filter(e => e.cargoId !== cargoId);

            saveJSON(KEYS.cargos, state.cargos);
            saveJSON(KEYS.funcs, state.funcionarios);
            saveJSON(KEYS.escalas, state.escalas);
        },

        SAVE_FUNCIONARIO(state, func) {
            const index = state.funcionarios.findIndex(f => f.id === func.id);
            if (index > -1) {
                state.funcionarios[index] = { ...state.funcionarios[index], ...func };
            } else {
                // --- INÍCIO DA ALTERAÇÃO ---
                // Garante que novos funcionários sempre sejam 'ativos'
                state.funcionarios.push({ ...func, status: 'ativo' });
                // --- FIM DA ALTERAÇÃO ---
            }
            saveJSON(KEYS.funcs, state.funcionarios);
        },
        DELETE_FUNCIONARIO(state, funcId) {
            state.funcionarios = state.funcionarios.filter(f => f.id !== funcId);
            saveJSON(KEYS.funcs, state.funcionarios);
        },

        // --- INÍCIO DA ALTERAÇÃO ---
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
        // --- FIM DA ALTERAÇÃO ---

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