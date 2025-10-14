/**************************************
 * ⚙️ Configurações (v2 - Layout com Abas)
 **************************************/

function loadConfigForm() {
    const { config } = store.getState();
    const configNomeInput = $("#configNome");
    if(configNomeInput) configNomeInput.value = config.nome || '';

    const theme = config.theme || 'light';
    $$('#themeToggleGroup .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === theme);
    });
}

function saveConfig() {
    const { config } = store.getState();
    const configNomeInput = $("#configNome");
    const newConfig = {
        ...config,
        nome: configNomeInput ? configNomeInput.value.trim() : ''
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

                const { confirmed } = await showPromptConfirm({
                    title: "Confirmar Importação?",
                    message: "<strong>ATENÇÃO:</strong> Isto irá substituir TODOS os seus dados atuais (turnos, cargos, funcionários, etc.) pelos dados do arquivo. Esta ação é IRREVERSÍVEL.",
                    promptLabel: `Para confirmar, digite a palavra "IMPORTAR":`,
                    requiredWord: "IMPORTAR",
                    confirmText: "Substituir Dados Atuais"
                });

                if (confirmed) {
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
            <p><strong>Última atualização:</strong> 14 de Outubro de 2025</p>
            <h4>1. Aceitação dos Termos</h4>
            <p>Bem-vindo(a) ao Escala Fácil ("Software"). Ao utilizar este Software, você ("Usuário") concorda integralmente com estes Termos de Uso ("Termos"). Se você не concorda com qualquer parte destes Termos, não deve utilizar o Software.</p>
            
            <h4>2. Natureza do Software e Armazenamento de Dados</h4>
            <p>O Escala Fácil é uma aplicação que opera <strong>exclusivamente no seu navegador de internet</strong>. Todos os dados inseridos — incluindo, mas не se limitando a, informações de funcionários, turnos, cargos e escalas — são armazenados localmente no seu dispositivo, através da tecnologia <code>localStorage</code> do navegador.</p>
            <p><strong>Nenhum dado inserido por você é enviado, coletado ou armazenado em servidores externos.</strong> O desenvolvedor do Software не tem acesso a nenhuma de suas informações.</p>

            <h4>3. Responsabilidade do Usuário</h4>
            <p><strong>Segurança e Backup:</strong> Você é o único responsável pela segurança e manutenção dos seus dados. O Software oferece uma funcionalidade de exportação ("backup") que deve ser utilizada regularmente para prevenir a perda de dados, que pode ocorrer ao limpar o cache do navegador, trocar de computador ou por falhas no dispositivo.</p>
            <p><strong>Conformidade Legal:</strong> As escalas geradas pelo Software são baseadas nas regras que você define. É sua responsabilidade garantir que as escalas finais estejam em conformidade com todas as leis trabalhistas, acordos coletivos e regulamentações aplicáveis à sua operação.</p>

            <h4>4. Licença de Uso</h4>
            <p>Concedemos a você uma licença limitada, não exclusiva e intransferível para usar o Software para fins pessoais ou de negócios internos. É expressamente proibido redistribuir, revender, modificar ou fazer engenharia reversa do Software.</p>

            <h4>5. Limitação de Responsabilidade e Isenção de Garantias</h4>
            <p>O Software é fornecido "COMO ESTÁ", sem garantias de qualquer tipo, expressas ou implícitas. O desenvolvedor não se responsabiliza por quaisquer danos diretos, indiretos, acidentais ou consequenciais (incluindo perda de dados, interrupção de negócios ou perdas financeiras) resultantes do uso ou da incapacidade de usar o Software.</p>
            
            <h4>6. Contato</h4>
            <p>Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato através do e-mail: <strong>escalafacil.contato@gmail.com</strong></p>
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
            <p><strong>Última atualização:</strong> 14 de Outubro de 2025</p>
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
        { keys: ['↑', '↓', '←', '→'], desc: 'Navegam pela grade da escala.' },
        { keys: ['Q', 'E'], desc: 'Trocam o funcionário focado na Barra de Ferramentas.' },
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
    const page = $("#page-configuracoes");
    if (!page) return;

    // --- Lógica das Abas ---
    const tabs = $$("#config-tabs .painel-tab-btn", page);
    const panes = $$("#config-content .config-pane", page);

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetPane = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            panes.forEach(pane => {
                pane.classList.toggle("active", pane.dataset.pane === targetPane);
            });
        });
    });

    // --- Lógica dos Botões e Controles ---
    const btnSalvar = $("#btnSalvarConfig");
    if(btnSalvar) btnSalvar.onclick = saveConfig;
    
    const termsCard = $("#config-terms-card");
    if(termsCard) termsCard.onclick = () => exibirTermosDeUso();
    
    const privacyCard = $("#config-privacy-card");
    if(privacyCard) privacyCard.onclick = () => exibirPoliticaDePrivacidade();
    
    const shortcutsCard = $("#config-shortcuts-card");
    if(shortcutsCard) shortcutsCard.onclick = () => exibirAtalhosDeTeclado();

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
    
    const btnExport = $("#btn-export-data");
    if(btnExport) btnExport.onclick = exportAllData;
    
    const btnImport = $("#btn-import-data");
    if(btnImport) btnImport.onclick = importAllData;

    const btnCopyPix = $("#btn-copy-pix");
    if (btnCopyPix) {
        btnCopyPix.onclick = () => {
            const pixKeyText = $("#pix-key-text");
            if(pixKeyText){
                navigator.clipboard.writeText(pixKeyText.textContent).then(() => {
                    showToast('Chave PIX copiada! 📋');
                }).catch(err => {
                    console.error('Erro ao copiar a chave PIX: ', err);
                    showToast('Erro ao copiar. Tente manualmente.');
                });
            }
        };
    }

    const btnReiniciar = $("#btnReiniciarOnboarding");
    if(btnReiniciar){
        btnReiniciar.onclick = () => {
            localStorage.removeItem('ge_onboarding_complete');
            localStorage.removeItem('ge_onboarding_progress');
            showToast("Onboarding reiniciado. A página será recarregada.");
            setTimeout(() => location.reload(), 1500);
        };
    }

    const btnReset = $("#btnHardReset");
    if(btnReset){
        btnReset.onclick = async () => {
            const { confirmed } = await showPromptConfirm({
                title: "APAGAR TODOS OS DADOS?",
                message: "Esta ação é IRREVERSÍVEL. Todos os turnos, cargos, funcionários e escalas salvas serão permanentemente excluídos.",
                promptLabel: `Para confirmar, digite a palavra "APAGAR" no campo abaixo:`,
                requiredWord: "APAGAR",
                confirmText: "Confirmar Exclusão"
            });
    
            if (confirmed) {
                Object.values(KEYS).forEach(key => localStorage.removeItem(key));
                localStorage.removeItem('ge_onboarding_complete');
                localStorage.removeItem('ge_onboarding_progress');
                showToast("Todos os dados foram apagados. A aplicação será reiniciada.");
                setTimeout(() => location.reload(), 1500);
            }
        };
    }
    
    // Carrega os dados iniciais no formulário ao abrir a página
    loadConfigForm();
}

document.addEventListener('DOMContentLoaded', initConfiguracoesPage);