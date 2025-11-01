const KEYS = {
    turnos: "ge_turnos",
    cargos: "ge_cargos",
    funcs: "ge_funcionarios",
    equipes: "ge_equipes",
    escalas: "ge_escalas",
    config: "ge_config"
};

const store = {
    state: {
        turnos: [],
        cargos: [],
        funcionarios: [],
        equipes: [],
        escalas: [],
        config: { nome: '' },
        dataCorrupted: false,
    },

    listeners: [],

    getState() {
        return this.state;
    },

    dispatch(actionName, payload) {
        if (typeof this.mutations[actionName] === 'function') {
            this.mutations[actionName](this.state, payload);
            this.notify(actionName);
        } else {
            console.error(`Ação "${actionName}" não encontrada.`);
        }
    },

    mutations: {
        SET_DATA_CORRUPTION_FLAG(state, isCorrupted) {
            state.dataCorrupted = isCorrupted;
        },

        LOAD_STATE(state) {
            try {
                const DATA_VERSION = "1.4";
                const currentVersion = localStorage.getItem('ge_data_version');

                state.escalas = loadJSON(KEYS.escalas, []).map(e => ({ ...e, observacoes: e.observacoes || '' }));
                state.funcionarios = loadJSON(KEYS.funcs, []);
                state.cargos = loadJSON(KEYS.cargos, []);
                state.turnos = loadJSON(KEYS.turnos, []);

                if (currentVersion !== DATA_VERSION) {
                    state.funcionarios = state.funcionarios.map(f => ({ ...f, status: f.status || 'ativo' }));
                    state.cargos = state.cargos.map(c => {
                        if (!c.regras) c.regras = {};
                        if (!c.regras.hasOwnProperty('maxDiasConsecutivos')) c.regras.maxDiasConsecutivos = 6;
                        if (!c.regras.hasOwnProperty('minFolgasSabados')) c.regras.minFolgasSabados = 1;
                        if (!c.regras.hasOwnProperty('minFolgasDomingos')) c.regras.minFolgasDomingos = 1;
                        c.status = c.status || 'ativo';
                        return c;
                    });
                    state.turnos = state.turnos.map(t => ({ ...t, status: t.status || 'ativo' }));

                    saveJSON(KEYS.funcs, state.funcionarios);
                    saveJSON(KEYS.cargos, state.cargos);
                    saveJSON(KEYS.turnos, state.turnos);
                    localStorage.setItem('ge_data_version', DATA_VERSION);
                }

                state.equipes = loadJSON(KEYS.equipes, []);
                state.config = loadJSON(KEYS.config, { nome: '' });
                delete state.config.autobackup;

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
                this.SET_DATA_CORRUPTION_FLAG(state, true);
            }
        },

        SAVE_TURNO(state, turno) {
            const index = state.turnos.findIndex(t => t.id === turno.id);
            if (index > -1) {
                state.turnos[index] = { ...state.turnos[index], ...turno };
            } else {
                state.turnos.push({ ...turno, status: 'ativo' });
            }
            saveJSON(KEYS.turnos, state.turnos);
        },
        DELETE_TURNO(state, turnoId) {
            state.turnos = state.turnos.filter(t => t.id !== turnoId);
            saveJSON(KEYS.turnos, state.turnos);
        },
        ARCHIVE_TURNO(state, turnoId) {
            const index = state.turnos.findIndex(t => t.id === turnoId);
            if (index > -1) {
                state.turnos[index].status = 'arquivado';
            }
            saveJSON(KEYS.turnos, state.turnos);
        },
        UNARCHIVE_TURNO(state, turnoId) {
            const index = state.turnos.findIndex(t => t.id === turnoId);
            if (index > -1) {
                state.turnos[index].status = 'ativo';
            }
            saveJSON(KEYS.turnos, state.turnos);
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
                state.cargos.push({ ...cargo, status: 'ativo' });
            }
            saveJSON(KEYS.cargos, state.cargos);
        },
        DELETE_CARGO(state, cargoId) {
            state.cargos = state.cargos.filter(c => c.id !== cargoId);
            saveJSON(KEYS.cargos, state.cargos);
        },
        ARCHIVE_CARGO(state, cargoId) {
            const index = state.cargos.findIndex(c => c.id === cargoId);
            if (index > -1) {
                state.cargos[index].status = 'arquivado';
            }
            saveJSON(KEYS.cargos, state.cargos);
        },
        UNARCHIVE_CARGO(state, cargoId) {
            const index = state.cargos.findIndex(c => c.id === cargoId);
            if (index > -1) {
                state.cargos[index].status = 'ativo';
            }
            saveJSON(KEYS.cargos, state.cargos);
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
            state.equipes.forEach(equipe => {
                equipe.funcionarioIds = equipe.funcionarioIds.filter(id => id !== funcId);
            });
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
            delete config.autobackup;
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