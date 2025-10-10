// configuracoes.js
/**************************************
 * ⚙️ Configurações
 **************************************/

function loadConfigForm() {
    const { config } = store.getState();
    $("#configNome").value = config.nome || '';

    const theme = config.theme || 'light';
    $$('#themeToggleGroup .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === theme);
    });
}

function saveConfig() {
    const { config } = store.getState();
    const newConfig = {
        ...config,
        nome: $("#configNome").value.trim()
    };

    store.dispatch('SAVE_CONFIG', newConfig);
    showToast("Preferências salvas com sucesso!");
}

async function exportAllData() {
    showLoader("Preparando arquivo de backup...");
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const allData = {};
        for (const key in KEYS) {
            allData[key] = loadJSON(KEYS[key], null);
        }

        const dataStr = JSON.stringify(allData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });

        const date = new Date();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        triggerDownload(dataBlob, `backup_escala_facil_${dateString}.json`);
    } catch (error) {
        console.error("Erro ao exportar dados:", error);
        showToast("Ocorreu um erro ao gerar o arquivo de backup.");
    } finally {
        hideLoader();
    }
}


async function importAllData() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (!importedData || typeof importedData.turnos === 'undefined' || typeof importedData.cargos === 'undefined') {
                    throw new Error("Arquivo de backup inválido ou corrompido.");
                }

                const confirmado = await showPromptConfirm({
                    title: "Confirmar Importação?",
                    message: "<strong>ATENÇÃO:</strong> Isto irá substituir TODOS os seus dados atuais (turnos, cargos, funcionários, etc.) pelos dados do arquivo. Esta ação é IRREVERSÍVEL.",
                    promptLabel: `Para confirmar, digite a palavra "IMPORTAR":`,
                    requiredWord: "IMPORTAR",
                    confirmText: "Substituir Dados Atuais"
                });

                if (confirmado) {
                    showLoader("Importando dados...");
                    for (const key in KEYS) {
                        if (importedData.hasOwnProperty(key)) {
                            saveJSON(KEYS[key], importedData[key]);
                        }
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    showToast("Dados importados com sucesso! A aplicação será reiniciada.");
                    setTimeout(() => location.reload(), 1500);
                }
            } catch (error) {
                console.error("Erro ao importar dados:", error);
                showToast(error.message || "Ocorreu um erro ao ler o arquivo de backup.");
                hideLoader();
            }
        };
        reader.readAsText(file);
    };

    fileInput.click();
}


function exibirTermosDeUso(requireScrollableConfirm = false) {
    const termosDeUsoHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <p><strong>Última atualização:</strong> 25 de setembro de 2025</p>
            <h4>1. Introdução e Aceitação dos Termos</h4>
            <p>Bem-vindo(a) ao Escala Fácil ("Software"). Estes Termos de Uso ("Termos") representam um contrato legal entre você ("Usuário") e o desenvolvedor do Escala Fácil. Ao adquirir e/ou utilizar o Software, você confirma que leu, entendeu e concorda em estar vinculado a estes Termos.</p>
            <h4>2. Licença de Uso</h4>
            <p>Sujeito ao pagamento do valor aplicável, concedemos a você uma licença limitada, não exclusiva e intransferível para usar o Software para seus fins pessoais ou de negócios internos. Você concorda em não revender, redistribuir ou fazer engenharia reversa do Software.</p>
            <h4>3. Descrição do Serviço</h4>
            <p>O Escala Fácil é uma ferramenta de software que funciona inteiramente no seu navegador. Todos os dados inseridos são armazenados exclusivamente no seu dispositivo local. Nós não temos acesso, não coletamos e não armazenamos nenhuma de suas informações.</p>
            <h4>4. Responsabilidades do Usuário</h4>
            <p>Ao utilizar o Software, você concorda que é o único responsável por garantir a exatidão dos dados inseridos e por proteger e fazer cópias de segurança (backup) regulares de seus dados, pois não temos como recuperá-los em caso de perda.</p>
            <h4>5. Limitação de Responsabilidade e Isenção de Garantias</h4>
            <p>O Software é fornecido "COMO ESTÁ", sem garantias de qualquer tipo. O desenvolvedor NÃO SERÁ RESPONSÁVEL POR QUAISQUER DANOS diretos ou indiretos decorrentes do uso ou da incapacidade de usar o Software.</p>
            <h4>6. Modificações nos Termos</h4>
            <p>Reservamo-nos o direito de modificar estes Termos a qualquer momento. O uso continuado do Software após quaisquer alterações constitui sua aceitação dos novos Termos.</p>
            <h4>7. Disposições Gerais</h4>
            <p>Estes Termos serão regidos pelas leis da República Federativa do Brasil.</p>
            <h4>8. Contato</h4>
            <p>Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através do e-mail: <strong>escalafacil.contato@gmail.com</strong>.</p>
        </div>
    `;

    if (requireScrollableConfirm) {
        return showScrollableConfirmModal({
            title: "Termos de Uso do Escala Fácil",
            contentHTML: termosDeUsoHTML,
            confirmText: "Li e concordo com os Termos"
        });
    } else {
        showInfoModal({
            title: "Termos de Uso do Escala Fácil",
            contentHTML: termosDeUsoHTML
        });
        return Promise.resolve(false);
    }
}

function exibirPoliticaDePrivacidade(requireScrollableConfirm = false) {
    const politicaHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <p><strong>Última atualização:</strong> 26 de setembro de 2025</p>
            <h4>1. O Princípio Fundamental: Seus Dados São Apenas Seus</h4>
            <p>O Escala Fácil foi projetado com a privacidade em sua essência. Nós <strong>não coletamos, não armazenamos, não transmitimos e não temos acesso a absolutamente nenhuma informação pessoal ou de negócio</strong> que você insere no software.</p>
            <p>Isso inclui, mas não se limita a: Nomes de funcionários, cargos, detalhes de turnos, escalas de trabalho geradas, feriados, férias, ou qualquer outra informação inserida.</p>
            <h4>2. Como Suas Informações São Armazenadas</h4>
            <p>Todos os dados que você cadastra no Escala Fácil são salvos diretamente no armazenamento local (<code>localStorage</code>) do seu navegador de internet, no seu próprio computador ou dispositivo. Isso significa que seus dados nunca saem do seu controle.</p>
            <h4>3. Segurança dos Dados</h4>
            <p>Como seus dados são armazenados localmente, a segurança deles está diretamente ligada à segurança do dispositivo que você utiliza. Você é o único responsável por garantir que seu computador e navegador estejam seguros.</p>
            <h4>4. Cookies e Serviços de Terceiros</h4>
            <p>O software Escala Fácil <strong>não utiliza cookies de rastreamento</strong>, pixels, ou qualquer serviço de análise de terceiros (como Google Analytics) para monitorar seu uso.</p>
            <h4>5. Alterações a Esta Política de Privacidade</h4>
            <p>Podemos atualizar nossa Política de Privacidade periodicamente. Recomendamos que você revise esta página de tempos em tempos para quaisquer alterações.</p>
            <h4>6. Contato</h4>
            <p>Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato conosco através do e-mail: <strong>escalafacil.contato@gmail.com</strong></p>
        </div>
    `;

    if (requireScrollableConfirm) {
        return showScrollableConfirmModal({
            title: "Política de Privacidade do Escala Fácil",
            contentHTML: politicaHTML,
            confirmText: "Li e concordo com a Política"
        });
    } else {
        showInfoModal({
            title: "Política de Privacidade do Escala Fácil",
            contentHTML: politicaHTML
        });
        return Promise.resolve(false);
    }
}

function exibirAtalhosDeTeclado() {
    const shortcuts = [
        { keys: ['🖱️', 'Arrastar'], desc: 'Move um turno para uma célula vazia ou o troca com outro turno.' },
        { keys: ['↑', '↓', '←', '→'], desc: 'Navegam pela grade da escala.' },
        { keys: ['Q', 'E'], desc: 'Trocam o funcionário focado na Caixa de Ferramentas.' },
        { keys: ['1', '...', '9'], desc: 'Selecionam o pincel de turno correspondente.' },
        { keys: ['Enter'], desc: 'Pinta a célula focada com o pincel selecionado.' },
        { keys: ['Delete', 'Backspace'], desc: 'Apagam o turno da célula focada.' },
    ];

    const shortcutsHTML = `
        <div class="shortcuts-modal-content">
            <ul class="shortcuts-list">
                ${shortcuts.map((sc, index) => `
                    <li class="shortcut-item" style="animation-delay: ${index * 0.15}s;">
                        <div class="keys">
                            ${sc.keys.map(key => `<span class="key">${key}</span>`).join('')}
                        </div>
                        <div class="description">${sc.desc}</div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    showInfoModal({
        title: "⌨️ Atalhos do Editor Manual",
        contentHTML: shortcutsHTML
    });

    setTimeout(() => {
        const items = $$('.shortcut-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('animate-keys');
            }, (index * 200) + 300);
        });
    }, 200);
}


function initConfiguracoesPage() {
    $("#btnSalvarConfig").onclick = saveConfig;
    
    $("#config-terms-card").onclick = (e) => {
        e.preventDefault();
        exibirTermosDeUso();
    };
    $("#config-privacy-card").onclick = (e) => {
        e.preventDefault();
        exibirPoliticaDePrivacidade();
    };
    $("#config-shortcuts-card").onclick = (e) => {
        e.preventDefault();
        exibirAtalhosDeTeclado();
    };

    const themeToggleButtons = $$('#themeToggleGroup .toggle-btn');
    themeToggleButtons.forEach(button => {
        button.onclick = () => {
            const selectedTheme = button.dataset.value;
            const { config } = store.getState();

            applyTheme(selectedTheme);
            themeToggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            store.dispatch('SAVE_CONFIG', { ...config, theme: selectedTheme });
        };
    });
    
    $("#btn-export-data").onclick = exportAllData;
    $("#btn-import-data").onclick = importAllData;

    const btnCopyPix = $("#btn-copy-pix");
    const pixKeyText = $("#pix-key-text");

    if (btnCopyPix && pixKeyText) {
        btnCopyPix.onclick = () => {
            navigator.clipboard.writeText(pixKeyText.textContent).then(() => {
                showToast('Chave PIX copiada!');
            }).catch(err => {
                console.error('Erro ao copiar a chave PIX: ', err);
                showToast('Erro ao copiar. Tente manualmente.');
            });
        };
    }

    const btnReiniciarOnboarding = $("#btnReiniciarOnboarding");
    const btnHardReset = $("#btnHardReset");

    if (btnReiniciarOnboarding) {
        btnReiniciarOnboarding.onclick = () => {
            localStorage.removeItem('ge_onboarding_complete');
            localStorage.removeItem('ge_onboarding_progress');
            showToast("Onboarding reiniciado. A página será recarregada.");
            setTimeout(() => location.reload(), 1500);
        };
    }

    if (btnHardReset) {
        btnHardReset.onclick = async () => {
            const confirmado = await showPromptConfirm({
                title: "APAGAR TODOS OS DADOS?",
                message: "Esta ação é IRREVERSÍVEL. Todos os turnos, cargos, funcionários e escalas salvas serão permanentemente excluídos.",
                promptLabel: `Para confirmar, digite a palavra "APAGAR" no campo abaixo:`,
                requiredWord: "APAGAR",
                confirmText: "Confirmar Exclusão"
            });

            if (confirmado) {
                Object.values(KEYS).forEach(key => localStorage.removeItem(key));
                localStorage.removeItem('ge_onboarding_complete');
                localStorage.removeItem('ge_onboarding_progress');
                showToast("Todos os dados foram apagados. A aplicação será reiniciada.");
                setTimeout(() => location.reload(), 1500);
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', initConfiguracoesPage);