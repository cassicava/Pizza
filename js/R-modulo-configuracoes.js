/**************************************
 * ⚙️ Configurações (v2 - Layout com Abas)
 **************************************/

function loadConfigForm() {
    const { config } = store.getState();
    const configNomeInput = $("#configNome");
    if(configNomeInput) configNomeInput.value = config.nome || '';
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
            <h3>🔒 ESCALA FÁCIL — TERMOS DE USO E LICENÇA DE SOFTWARE (VENDA ÚNICA)</h3>
            <p><strong>Última atualização:</strong> 15/10/2025<br>
            <strong>Licenciante:</strong> Escala Fácil<br>
            <strong>Contato:</strong> escalafacil.contato@gmail.com</p>
            <hr>

            <h4>1. Aceitação dos Termos</h4>
            <p>Ao utilizar o software <strong>Escala Fácil</strong> (“Software”), o usuário (“Usuário”) concorda integralmente com estes <strong>Termos de Uso e Licença</strong> (“Termos”). Se você não concorda com qualquer parte destes Termos, <strong>não deve utilizar o Software</strong>.</p>
            <hr>

            <h4>2. Natureza do Software e Armazenamento de Dados</h4>
            <p><strong>2.1.</strong> O Escala Fácil é uma aplicação que opera <strong>exclusivamente no navegador de internet</strong>.</p>
            <p><strong>2.2.</strong> <strong>Todos os dados inseridos</strong> (como informações de funcionários, turnos, cargos e escalas) são <strong>armazenados localmente</strong> no dispositivo do Usuário, por meio do <strong>localStorage do navegador</strong>.</p>
            <p><strong>2.3.</strong> Nenhum dado é enviado, coletado ou armazenado em servidores externos. O desenvolvedor <strong>não tem acesso a nenhuma informação</strong> inserida pelo Usuário.</p>
            <hr>

            <h4>3. Licença de Uso e Propriedade Intelectual</h4>
            <p><strong>3.1. Licença:</strong> O Licenciante concede ao Usuário uma <strong>licença perpétua, não exclusiva e intransferível</strong> para uso do Software. Esta é uma <strong>venda única</strong> — não há cobrança recorrente, suporte ou atualizações incluídas.</p>
            <p><strong>3.2. Cessão e Transferência:</strong> Esta licença é pessoal e intransferível. O Usuário não pode revender, alugar ou ceder o software a terceiros.</p>
            <p><strong>3.3. Restrições de Uso:</strong> É <strong>expressamente proibido</strong>:</p>
            <ul>
                <li>Redistribuir, revender ou sublicenciar o Software;</li>
                <li>Modificar, copiar, traduzir ou criar versões derivadas;</li>
                <li>Realizar engenharia reversa, descompilação ou tentativa de acesso ao código-fonte.</li>
            </ul>
            <p><strong>3.4. Propriedade Intelectual:</strong> O Escala Fácil é protegido pelas leis de direitos autorais e propriedade intelectual. Nenhum direito, título ou interesse é transferido ao usuário além do direito limitado de uso descrito nestes Termos.</p>
            <p><strong>3.5. Uso Indevido:</strong> O uso, cópia ou distribuição não autorizada do Escala Fácil, no todo ou em parte, poderá resultar em medidas legais e indenizações previstas pela Lei nº 9.609/98 (Lei de Software).</p>
            <hr>

            <h4>4. Responsabilidade do Usuário</h4>
            <p><strong>4.1. Segurança e Backup:</strong> O Usuário é <strong>único responsável pela segurança e manutenção dos seus dados</strong>. O Software disponibiliza ferramenta de exportação (“backup”) que deve ser usada <strong>regularmente</strong>. A perda de dados causada por limpeza de cache, falha no dispositivo ou troca de computador é de responsabilidade exclusiva do Usuário.</p>
            <p><strong>4.2. Conformidade Legal e Resultados:</strong> As escalas e informações geradas são baseadas nas regras inseridas pelo Usuário. É de sua exclusiva responsabilidade garantir que as escalas estejam <strong>em conformidade com leis trabalhistas, acordos coletivos e regulamentações aplicáveis</strong>. O Licenciante não se responsabiliza por decisões de gestão ou interpretações incorretas da legislação trabalhista. O Software é uma ferramenta de auxílio e, embora projetado para ser preciso, está sujeito a erros. É de responsabilidade do Usuário revisar e validar todas as escalas geradas para garantir sua exatidão e conformidade.</p>
            <hr>
            
            <h4>5. Suporte e Atualizações</h4>
            <p><strong>5.1.</strong> O Licenciante <strong>não é obrigado a fornecer suporte técnico</strong>, correções, manutenções ou atualizações futuras.</p>
            <p><strong>5.2.</strong> Qualquer atualização ou versão aprimorada será considerada produto separado, sujeito a novo licenciamento.</p>
            <hr>

            <h4>6. Isenção de Garantias</h4>
            <p>O Software é fornecido <strong>“COMO ESTÁ” (“AS IS”)</strong>, sem garantias de qualquer tipo, expressas ou implícitas, incluindo, sem limitação, garantias de comerciabilidade, adequação a uma finalidade específica, precisão ou ausência de falhas. O Licenciante <strong>não garante</strong> que o Software atenderá a requisitos específicos, nem que funcionará de forma ininterrupta, livre de erros ou segura.</p>
            <hr>

            <h4>7. Limitação de Responsabilidade</h4>
            <p>Em nenhuma circunstância o Licenciante será responsável por <strong>quaisquer danos diretos, indiretos, acidentais, consequenciais ou punitivos</strong>, incluindo perda de dados, lucros cessantes, interrupção de negócios ou outras perdas resultantes do uso ou incapacidade de uso do Software. A responsabilidade total do Licenciante fica <strong>limitada ao valor efetivamente pago pela licença</strong>.</p>
            <hr>

            <h4>8. Rescisão e Alterações dos Termos</h4>
            <p><strong>8.1. Rescisão:</strong> O Licenciante poderá rescindir esta licença a qualquer momento em caso de violação destes Termos. Em caso de rescisão, o Usuário deve <strong>cessar imediatamente o uso</strong> e remover todas as cópias do Software.</p>
            <p><strong>8.2. Alterações:</strong> O Licenciante poderá modificar estes Termos a qualquer momento, publicando nova versão. O uso continuado após a atualização implica aceitação integral das alterações.</p>
            <hr>

            <h4>9. Legislação e Foro</h4>
            <p>Estes Termos são regidos pelas <strong>leis brasileiras</strong>. Fica eleito o foro da <strong>comarca de [CIDADE - UF]</strong> como competente para resolver quaisquer controvérsias, com renúncia a qualquer outro.</p>
            <hr>

            <h4>10. Contato</h4>
            <p>Dúvidas sobre estes Termos podem ser enviadas para:<br>
            📩 escalafacil.contato@gmail.com</p>
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
            <h3>🛡️ POLÍTICA DE PRIVACIDADE — ESCALA FÁCIL</h3>
            <p><strong>Última atualização:</strong> 15/10/2025<br>
            <strong>Contato:</strong> escalafacil.contato@gmail.com</p>
            <hr>
            
            <h4>1. Princípio Fundamental: Seus Dados São Apenas Seus</h4>
            <p>O <strong>Escala Fácil</strong> foi desenvolvido com o princípio de <strong>privacidade total</strong>:</p>
            <ul>
                <li>✅ Nenhum dado é coletado, armazenado, transmitido ou acessado pelo desenvolvedor.</li>
                <li>Tudo que você insere no sistema permanece <strong>apenas no seu dispositivo</strong>.</li>
            </ul>
            <hr>

            <h4>2. Como e Onde Seus Dados São Armazenados</h4>
            <p><strong>2.1.</strong> Todos os dados inseridos são salvos <strong>no armazenamento local (localStorage)</strong> do seu navegador, dentro do seu próprio computador ou dispositivo.</p>
            <p><strong>2.2.</strong> Isso significa que <strong>nenhum dado sai do seu controle</strong> — o Software não envia informações a nenhum servidor externo.</p>
            <hr>
            
            <h4>3. Segurança dos Dados</h4>
            <p><strong>3.1.</strong> Como os dados ficam armazenados localmente, a segurança depende <strong>diretamente da proteção do seu dispositivo e navegador</strong>.</p>
            <p><strong>3.2.</strong> O Usuário é responsável por manter seu computador livre de vírus, realizar backups periódicos e evitar exclusão acidental dos dados.</p>
            <hr>

            <h4>4. Cookies e Serviços de Terceiros</h4>
            <p>O Escala Fácil <strong>não utiliza cookies de rastreamento, pixels, nem serviços de terceiros</strong> (como Google Analytics ou APIs externas).</p>
            <hr>
            
            <h4>5. Alterações desta Política</h4>
            <p>Podemos atualizar esta Política de Privacidade ocasionalmente. As alterações serão publicadas nesta mesma página, e a data da última modificação será atualizada.</p>
            <hr>

            <h4>6. Contato</h4>
            <p>Em caso de dúvidas sobre esta Política de Privacidade, entre em contato pelo e-mail:<br>
            📩 escalafacil.contato@gmail.com</p>
            <hr>

            <h4>📘 Resumo simples</h4>
            <ul>
                <li>O Escala Fácil não coleta <strong>nenhum dado</strong>.</li>
                <li>Todos os dados ficam <strong>no seu computador</strong>.</li>
                <li>Você é responsável por <strong>backup e segurança</strong>.</li>
                <li>Nenhum suporte ou atualização está incluído na licença.</li>
                <li>O uso do software implica <strong>aceite integral</strong> dos termos.</li>
            </ul>
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

    // Atualiza o ano do copyright dinamicamente
    const currentYear = new Date().getFullYear();
    const copyrightYearEl = $("#copyright-year");
    if (copyrightYearEl) copyrightYearEl.textContent = currentYear;
}

document.addEventListener('DOMContentLoaded', initConfiguracoesPage);