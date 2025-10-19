/**************************************
 * 🆘 Módulo de Ajuda Contextual (v2)
 **************************************/

// --- Armazenamento do Conteúdo de Ajuda Detalhado ---
const helpContentData = {
    turnos: {
        title: "Ajuda: Cadastro de Turnos",
        content: `
            <div class="help-card">
                <h4>🗂️ Gerenciar Cadastrados</h4>
                <p>Esta é a tela principal onde você visualiza todos os turnos criados. A tabela permite uma consulta rápida das informações mais importantes de cada um.</p>
                <p>Use o botão <strong>✏️ Editar</strong> para modificar um turno existente ou <strong>🔥 Excluir</strong> para removê-lo (só é possível se o turno não estiver em uso).</p>
            </div>
            <div class="help-card">
                <h4>📝 Novo Turno</h4>
                <p>Aqui você define as características de um horário de trabalho.</p>
                <p><strong>Nome e Sigla:</strong> Um nome descritivo (ex: "Noturno 12h") e uma sigla curta de 2 letras (ex: "N1") que será exibida na grade da escala para economizar espaço.</p>
                <p><strong>Cor:</strong> Escolha uma cor para identificar facilmente o turno na escala visual.</p>
            </div>
            <div class="help-card">
                <h4>🕒 Carga Horária</h4>
                <p><strong>Início e Fim:</strong> Horários de entrada e saída. Se um turno "vira o dia" (ex: começa às 19:00 e termina às 07:00), selecione a opção apropriada em <strong>Dia de Término</strong>.</p>
                <p><strong>Almoço:</strong> Informe o intervalo em minutos. Este tempo será descontado da carga horária total.</p>
            </div>
            <div class="help-card">
                <h4>⏸️ Descanso Obrigatório</h4>
                <p>Esta é uma regra crucial para evitar sobrecarga. Defina aqui o número mínimo de horas que um funcionário <strong>precisa</strong> descansar após completar este turno, antes de poder iniciar qualquer outro. O gerador de escala usará essa regra para evitar conflitos.</p>
            </div>
        `
    },
    cargos: {
        title: "Ajuda: Cadastro de Cargos",
        content: `
            <div class="help-card">
                <h4>🏥 O que é um Cargo?</h4>
                <p>Um "Cargo" representa uma função, um setor ou um posto de trabalho (ex: "Enfermeiro Chefe", "Recepção", "Segurança"). Ele funciona como um "agrupador" que conecta <strong>Turnos</strong> e <strong>Funcionários</strong>.</p>
            </div>
            <div class="help-card">
                <h4>📝 Novo Cargo</h4>
                <p>Ao criar um cargo, você define duas coisas essenciais:</p>
                <p><strong>1. Turnos Associados:</strong> Marque todos os turnos que um profissional deste cargo está habilitado a cumprir. Um "Enfermeiro", por exemplo, pode trabalhar em turnos de 6h, 8h ou 12h.</p>
                <p><strong>2. Regras de Funcionamento:</strong> Indique em quais dias da semana e em qual faixa de horário o cargo precisa de cobertura. Se a "Recepção" só funciona de segunda a sexta, das 08:00 às 18:00, o gerador de escala saberá que não precisa alocar ninguém fora desses períodos.</p>
            </div>
        `
    },
    funcionarios: {
        title: "Ajuda: Cadastro de Funcionários",
        content: `
            <div class="help-card">
                <h4>👤 Informações Básicas</h4>
                <p>Cadastre o nome completo do funcionário e, se desejar, um documento de identificação (matrícula, CPF, etc.) para referência.</p>
            </div>
            <div class="help-card">
                <h4>🎯 Cargo e Meta de Trabalho</h4>
                <p><strong>Cargo:</strong> Associe o funcionário a um dos cargos já cadastrados.</p>
                <p><strong>Meta:</strong> Defina como a carga de trabalho contratada é medida. Pode ser por <strong>Horas</strong> (ex: 44h semanais) ou por <strong>Turnos</strong> (ex: 15 plantões mensais). Esta meta é a principal referência que o gerador de escala usará para distribuir o trabalho de forma justa.</p>
            </div>
             <div class="help-card">
                <h4>🗓️ Disponibilidade e Preferências</h4>
                <p>Esta é a seção mais importante para a montagem automática da escala. Para cada turno que o funcionário pode fazer (herdado do cargo dele):</p>
                <p><strong>Ative o Turno:</strong> Clique no nome do turno para habilitá-lo. Ele começará com todos os dias disponíveis.</p>
                <p><strong>Defina os Dias:</strong> Clique repetidamente em cada dia da semana para alternar entre os estados:</p>
                <p>• <strong>Indisponível (cinza):</strong> O funcionário NUNCA será escalado naquele dia.</p>
                <p>• <strong>Disponível (azul):</strong> O funcionário PODE ser escalado naquele dia.</p>
                <p>• <strong>Preferencial (listrado):</strong> O funcionário GOSTARIA de ser escalado naquele dia. O gerador dará prioridade a estes dias.</p>
            </div>
        `
    },
    equipes: {
        title: "Ajuda: Cadastro de Equipes",
        content: `
            <div class="help-card">
                <h4>🤝 O que são Equipes?</h4>
                <p>Equipes são grupos <strong>fixos</strong> de funcionários que sempre trabalham juntos, no mesmo turno. São a ferramenta ideal para criar escalas com padrões de rodízio, como 12x36, 2x2, 24x72, etc.</p>
                <p>Qualquer funcionário que <strong>não</strong> pertencer a uma equipe será considerado um "coringa" pelo sistema, sendo alocado individualmente para preencher as vagas restantes.</p>
            </div>
            <div class="help-card">
                <h4>📝 Nova Equipe</h4>
                <p><strong>1. Nome, Cargo e Turno:</strong> Dê um nome à equipe (ex: "Equipe A - Noturno"), e defina o Cargo e o Turno que este grupo irá cobrir.</p>
                <p><strong>2. Membros:</strong> Selecione os funcionários que farão parte deste grupo. Apenas funcionários do cargo selecionado e que tenham disponibilidade para o turno escolhido aparecerão na lista.</p>
                <p><strong>Importante:</strong> Um funcionário não pode pertencer a mais de uma equipe, para evitar conflitos de alocação.</p>
            </div>
        `
    },
    'gerar-escala': {
        title: "Ajuda: Geração Automática",
        content: `
            <div class="help-card">
                <h4>✨ Assistente de Geração</h4>
                <p>Siga os passos para configurar os parâmetros que o algoritmo inteligente usará para montar a escala perfeita.</p>
                <p><strong>Passo 1: Período:</strong> Escolha o <strong>Cargo</strong> e o <strong>intervalo de datas</strong> da escala. Este é o único passo obrigatório.</p>
                <p><strong>Passo 2: Feriados:</strong> Informe os feriados do período e se eles serão de <strong>Folga Geral</strong> ou não. Você também pode configurar se um feriado de folga deve descontar horas da meta mensal dos funcionários.</p>
                <p><strong>Passo 3: Ausências:</strong> Registre <strong>Férias, Folgas ou Afastamentos</strong> para funcionários específicos. O gerador garantirá que eles não sejam escalados nestas datas.</p>
                <p><strong>Passo 4: Cobertura:</strong> Aqui você informa a "demanda". Defina quantos funcionários são necessários por turno (<strong>Individual</strong>) ou configure o padrão de trabalho das suas <strong>Equipes</strong> (ex: trabalham 2 dias e folgam 2).</p>
            </div>
            <div class="help-card">
                <h4>🎨 Edição Geral e Individual</h4>
                <p>Após a escala ser gerada, você pode fazer ajustes finos. A tela é dividida em duas abas:</p>
                <p><strong>Edição Geral:</strong> Mostra a grade completa da escala e ativa a <strong>Barra de Ferramentas</strong> na parte inferior, permitindo que você selecione um funcionário e "pinte" ou "apague" turnos. O editor avisará sobre possíveis conflitos com as regras.</p>
                <p><strong>Edição Individual:</strong> Oferece uma visão focada em um único funcionário por vez, com um calendário mensal e ferramentas dedicadas para uma edição mais detalhada.</p>
            </div>
        `
    },
    'escalas-salvas': {
        title: "Ajuda: Escalas Salvas",
        content: `
            <div class="help-card">
                <h4>📂 Acessando seu Histórico</h4>
                <p>Esta tela é o seu arquivo de todas as escalas que você gerou e salvou.</p>
                <p><strong>Filtrar por Cargo:</strong> Para começar, selecione um cargo no menu suspenso. O sistema listará todas as escalas salvas para aquele cargo, organizadas por ano e mês.</p>
                <p><strong>Abrir uma Escala:</strong> Simplesmente clique no card da escala que deseja visualizar.</p>
            </div>
            <div class="help-card">
                <h4>⚙️ Ações na Escala</h4>
                <p>Ao abrir uma escala, você terá um painel de resumo e botões de ação:</p>
                <p><strong>✏️ Editar Escala:</strong> Leva você de volta ao Editor Manual, permitindo fazer ajustes na escala salva e salvá-la novamente.</p>
                <p><strong>🔥 Excluir:</strong> Apaga permanentemente a escala do seu histórico.</p>
                <p><strong>🖨️ Exportar para PDF:</strong> Abre as opções para gerar um arquivo PDF da escala, seja no formato de grade completa ou um relatório diário detalhado, pronto para impressão.</p>
            </div>
        `
    },
    relatorios: {
        title: "Ajuda: Relatórios",
        content: `
            <div class="help-card">
                <h4>📊 Analisando o Desempenho</h4>
                <p>Esta seção transforma os dados de uma escala salva em insights visuais, ajudando a verificar se a distribuição de trabalho foi justa e eficiente.</p>
                <p><strong>Como Funciona:</strong> Primeiro, selecione o <strong>Cargo</strong> para listar as escalas salvas. Em seguida, clique na escala que deseja analisar para gerar os relatórios.</p>
            </div>
            <div class="help-card">
                <h4>📈 Gráficos Disponíveis</h4>
                <p><strong>Horas/Turnos vs. Meta:</strong> Compara o total de horas ou turnos que cada funcionário realizou contra a meta que foi definida para ele.</p>
                <p><strong>Distribuição de Turnos:</strong> Mostra um resumo de quantos turnos de cada tipo foram alocados no total.</p>
                <p><strong>Folgas de Fim de Semana:</strong> Exibe a contagem de sábados e domingos de folga para cada funcionário no período.</p>
            </div>
        `
    },
    configuracoes: {
        title: "Ajuda: Configurações",
        content: `
            <div class="help-card">
                <h4>⚙️ Geral</h4>
                <p>Na aba "Geral", você pode definir o nome de usuário ou da empresa que aparece na saudação da tela inicial.</p>
            </div>
            <div class="help-card">
                <h4>💾 Dados (Backup e Restauração)</h4>
                <p><strong>ESSENCIAL:</strong> Seus dados são salvos apenas no seu navegador. Use a função de <strong>Exportar (Backup)</strong> regularmente para criar um arquivo de segurança.</p>
                <p>Se você trocar de computador ou limpar os dados do navegador, poderá usar a função de <strong>Importar</strong> para restaurar tudo a partir desse arquivo.</p>
            </div>
            <div class="help-card">
                <h4>ℹ️ Sobre e Recursos</h4>
                <p>Aqui você encontra links para os Termos de Uso, Política de Privacidade e um atalho para ver os atalhos de teclado do editor manual.</p>
            </div>
            <div class="help-card">
                <h4>⚠️ Avançado (Zona de Perigo)</h4>
                <p>Tenha muito cuidado nesta seção. As opções aqui permitem <strong>apagar permanentemente todos os seus dados</strong> do aplicativo. Use apenas se tiver certeza absoluta do que está fazendo e possuir um backup recente.</p>
            </div>
        `
    }
};

// --- Referências do DOM ---
const contextHelpBtn = document.getElementById('context-help-btn');
const helpPanel = document.getElementById('help-panel');
const helpPanelBackdrop = document.getElementById('help-panel-backdrop');
const helpPanelTitle = document.getElementById('help-panel-title');
const helpPanelContent = document.getElementById('help-panel-content');
const helpPanelCloseBtn = document.getElementById('help-panel-close-btn');
const body = document.body;

/**
 * Mostra ou esconde o painel de ajuda com animação.
 * @param {boolean} show - True para mostrar, false para esconder.
 */
function toggleHelpPanel(show) {
    if (show) {
        body.classList.remove('help-panel-hiding');
        body.classList.add('help-panel-active');
    } else {
        body.classList.add('help-panel-hiding');
        // Espera a animação de fechamento terminar para remover a classe principal
        setTimeout(() => {
            body.classList.remove('help-panel-active');
            body.classList.remove('help-panel-hiding');
        }, 400); // Mesmo tempo da transição no CSS
    }
}

/**
 * Carrega o conteúdo de ajuda específico para a página atual.
 * @param {string} pageId - O ID da página (ex: 'turnos', 'cargos').
 */
function loadHelpContent(pageId) {
    const helpData = helpContentData[pageId];

    if (helpData) {
        helpPanelTitle.textContent = helpData.title;
        helpPanelContent.innerHTML = helpData.content;
        parseEmojisInElement(helpPanelContent); // Garante que emojis sejam renderizados corretamente
        contextHelpBtn.style.display = 'flex';
    } else {
        // Esconde o botão se não houver conteúdo de ajuda para a página
        contextHelpBtn.style.display = 'none';
    }
}

// --- Event Listeners ---
if (contextHelpBtn) {
    contextHelpBtn.addEventListener('click', () => toggleHelpPanel(true));
}

if (helpPanelCloseBtn) {
    helpPanelCloseBtn.addEventListener('click', () => toggleHelpPanel(false));
}

// Fecha o painel se o usuário clicar no fundo (backdrop)
if (helpPanelBackdrop) {
    helpPanelBackdrop.addEventListener('click', () => toggleHelpPanel(false));
}