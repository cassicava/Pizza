const helpContentData = {
    home: {
        title: "Ajuda: Tela Inicial",
        content: `
            <div class="help-card">
                <h4>🏠 Bem-vindo ao PlantãoPro!</h4>
                <p>Esta é a sua central de controle. A partir daqui, você acessa todas as funcionalidades para criar e gerenciar suas escalas.</p>
                <p>O fluxo recomendado para começar é seguir os passos indicados nos cards de <strong>Cadastros Essenciais</strong>.</p>
            </div>
            <div class="help-card">
                <h4>📝 Cadastros Essenciais (Passos 1-3)</h4>
                <p><strong>Passo 1: 🕒 Turnos:</strong> Defina os horários de trabalho da sua operação. Ex: Turno Diurno (07:00-19:00), Turno Noturno (19:00-07:00), Turno Manhã (08:00-14:00).</p>
                <p><strong>Passo 2: 🏥 Cargos:</strong> Crie as funções ou postos de trabalho (ex: Enfermeiro, Técnico, Recepcionista) e associe a eles os turnos que podem cumprir. Defina também os dias e horários em que cada cargo precisa de cobertura.</p>
                <p><strong>Passo 3: 👨‍⚕️ Funcionários:</strong> Cadastre as pessoas da sua equipe, atribuindo a cada uma um cargo e definindo sua disponibilidade e preferências para cada turno que ela pode realizar.</p>
            </div>
             <div class="help-card">
                <h4>👥 Equipes (Opcional)</h4>
                <p><strong>🤝 Equipes:</strong> Se você trabalha com grupos fixos que sempre se revezam juntos (ex: Equipe A, Equipe B em um regime 12x36), cadastre-os aqui. Isso simplifica a montagem de escalas de rodízio.</p>
            </div>
            <div class="help-card">
                <h4>⚙️ Crie e Gerencie suas Escalas</h4>
                <p>Após realizar os cadastros essenciais, você está pronto para:</p>
                <p><strong>✨ Geração Automática:</strong> Use o assistente inteligente para criar uma nova escala. O sistema distribuirá os funcionários (ou equipes) de acordo com as regras, disponibilidade e cobertura definidas por você.</p>
                <p><strong>🗂️ Escalas Salvas:</strong> Acesse, visualize, edite ou exporte todas as escalas que você já criou e salvou.</p>
                <p><strong>📈 Relatórios:</strong> Analise as métricas das suas escalas salvas, como distribuição de horas, folgas e cumprimento de metas.</p>
            </div>
            <div class="help-card">
                <h4>💡 Dica</h4>
                <p>Mantenha seus cadastros (principalmente a disponibilidade dos funcionários) sempre atualizados para garantir que o gerador automático crie as escalas mais precisas e eficientes possíveis!</p>
            </div>
        `
    },
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
                <p><strong>Início e Fim:</strong> Horários de entrada e saída. Se um turno "vira o dia" (ex: começa às 19:00 e termina às 07:00), selecione a opção apropriada em <strong>Dia de Término</strong>. O indicador <strong>🌙</strong> aparecerá.</p>
                <p><strong>Almoço:</strong> Informe o intervalo em minutos. Este tempo será descontado da carga horária total.</p>
                <p><strong>Carga Calculada:</strong> O sistema mostra a duração real do turno após descontar o almoço. Se a duração for maior que 24h, o indicador <strong>🔁</strong> (Longa Duração) será exibido.</p>
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
                <p>Um "Cargo" representa uma função, um setor ou um posto de trabalho (ex: "Enfermeiro Chefe", "Recepção", "Segurança"). Ele funciona como um "agrupador" que conecta <strong>Turnos</strong>, <strong>Funcionários</strong> e <strong>Regras</strong>.</p>
            </div>
            <div class="help-card">
                <h4>📝 Novo Cargo</h4>
                <p>Ao criar ou editar um cargo, você define:</p>
                <p><strong>1. Turnos Associados:</strong> Marque todos os turnos que um profissional deste cargo está habilitado a cumprir. Um "Enfermeiro", por exemplo, pode trabalhar em turnos de 6h, 8h ou 12h.</p>
                <p><strong>2. Regras de Funcionamento:</strong> Indique em quais dias da semana e em qual faixa de horário o cargo precisa de cobertura. Se a "Recepção" só funciona de segunda a sexta, das 08:00 às 18:00, o gerador de escala saberá que não precisa alocar ninguém fora desses períodos.</p>
                <p><strong>3. Regras de Alocação Individual:</strong> Defina limites como o número máximo de dias de trabalho consecutivos e o mínimo de Sábados/Domingos de folga por mês. Estas regras se aplicam apenas aos funcionários que <strong>não</strong> fazem parte de equipes fixas.</p>
            </div>
        `
    },
    funcionarios: {
        title: "Ajuda: Cadastro de Funcionários",
        content: `
            <div class="help-card">
                <h4>🗂️ Gerenciar Cadastrados</h4>
                <p>Visualize e filtre seus funcionários. Use os botões de ação para <strong>Editar</strong>, <strong>Arquivar</strong> (remove o funcionário das listas de seleção, mas mantém o histórico) ou <strong>Reativar</strong> um funcionário arquivado.</p>
            </div>
            <div class="help-card">
                <h4>👤 Informações Básicas</h4>
                <p>Cadastre o nome completo do funcionário e, se desejar, um documento de identificação (matrícula, CPF, etc.) para referência.</p>
            </div>
            <div class="help-card">
                <h4>🎯 Cargo e Meta de Trabalho</h4>
                <p><strong>Cargo:</strong> Associe o funcionário a um dos cargos já cadastrados.</p>
                <p><strong>Meta:</strong> Defina como a carga de trabalho contratada é medida. Pode ser por <strong>Horas</strong> (ex: 44h semanais) ou por <strong>Turnos</strong> (ex: 15 plantões mensais). Esta meta é a principal referência que o gerador de escala usará para distribuir o trabalho de forma justa.</p>
                <p><strong>Exceder Meta (Hora Extra):</strong> Indique se o funcionário pode ser escalado além da meta definida. Útil para quem pode fazer horas extras.</p>
            </div>
             <div class="help-card">
                <h4>🗓️ Disponibilidade e Preferências</h4>
                <p>Esta é a seção mais importante para a montagem automática da escala. Para cada turno que o funcionário pode fazer (herdado do cargo dele):</p>
                <p><strong>Ative o Turno:</strong> Clique no nome do turno para habilitá-lo. Ele começará com todos os dias disponíveis (considerando os dias de operação do cargo).</p>
                <p><strong>Defina os Dias:</strong> Clique repetidamente em cada dia da semana para alternar entre os estados:</p>
                <p>• <strong>Indisponível (cinza):</strong> O funcionário NUNCA será escalado naquele dia/turno.</p>
                <p>• <strong>Disponível (azul):</strong> O funcionário PODE ser escalado naquele dia/turno.</p>
                <p>• <strong>Preferencial (listrado):</strong> O funcionário GOSTARIA de ser escalado naquele dia/turno. O gerador dará prioridade a estes.</p>
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
                <p>Siga os passos para configurar os parâmetros que o algoritmo inteligente usará para montar a escala.</p>
                <p><strong>Passo 1: Período e Metas:</strong> Escolha o <strong>Cargo</strong> e o <strong>intervalo de datas</strong>. O sistema calculará automaticamente o <strong>total de horas/turnos</strong> que sua equipe deve cumprir (Metas) para esse período, agrupado por tipo de contrato (ex: 30h/semana, 15 turnos/mês).</p>
                <p>Você pode <strong>ajustar o total</strong> de cada grupo clicando em '✏️ Ajustar Total'. O sistema distribuirá esse ajuste proporcionalmente entre os funcionários daquele grupo. Clique em <strong>✔️ Confirmar Metas</strong> para habilitar os próximos passos.</p>
                <p><strong>Passo 2: Feriados:</strong> Informe os feriados do período e se eles serão de <strong>Folga Geral</strong> ou não. As folgas configuradas aqui irão <strong>atualizar a 'Meta Líquida'</strong> (disponibilidade real) da sua equipe.</p>
                <p><strong>Passo 3: Ausências:</strong> Registre <strong>Férias, Folgas ou Afastamentos</strong> para funcionários específicos. O gerador garantirá que eles não sejam escalados e as ausências também serão <strong>descontadas da 'Meta Líquida'</strong> total.</p>
                <p><strong>Passo 4: Cobertura:</strong> Informe a "demanda" (quantos funcionários você precisa em cada turno/dia).</p>
                <p>Observe o <strong>Balanço da Escala</strong> no topo da tela. Esta barra única mostra, em tempo real, se a sua demanda (o que você *pede*) está alinhada com a sua 'Meta Líquida' (o que sua equipe *pode entregar* após descontar feriados e ausências).</p>
                <p>• <strong>Barra Azul/Verde (OK):</strong> Sua demanda está dentro da capacidade da equipe.</p>
                <p>• <strong>Barra Laranja (Hora Extra):</strong> Sua demanda excede a capacidade, resultando em horas extras.</p>
            </div>
            <div class="help-card">
                <h4>🎨 Visualização e Edição</h4>
                <p>Após a escala ser gerada, você pode fazer ajustes finos usando duas abas:</p>
                <p><strong>Edição Geral:</strong> Mostra a grade completa da escala e ativa a <strong>Barra de Ferramentas</strong> (geralmente na base da tela). Com ela, você seleciona um funcionário e "pinta" turnos na grade usando os pincéis, ou usa a borracha para apagar. O editor avisará sobre possíveis conflitos com as regras.</p>
                <p><strong>Edição Individual:</strong> Oferece uma visão focada em um único funcionário por vez, com um calendário mensal dedicado e as mesmas ferramentas de pincel/borracha para uma edição mais detalhada e visualização clara da carga e dias consecutivos.</p>
            </div>
        `
    },
    'escalas-salvas': {
        title: "Ajuda: Escalas Salvas",
        content: `
            <div class="help-card">
                <h4>📂 Acessando seu Histórico</h4>
                <p>Esta tela é o seu arquivo de todas as escalas que você gerou e salvou.</p>
                <p><strong>Filtrar:</strong> Para começar, selecione um <strong>Cargo</strong> e depois o <strong>Ano</strong> desejado. O sistema listará todas as escalas salvas que correspondem aos filtros, organizadas por mês.</p>
                <p><strong>Abrir uma Escala:</strong> Simplesmente clique no card da escala que deseja visualizar. O ícone ⚠️ indica escalas com turnos vagos, enquanto ✅ indica escalas completas.</p>
            </div>
            <div class="help-card">
                <h4>⚙️ Ações na Escala</h4>
                <p>Ao abrir uma escala, você terá um painel de resumo (com abas para Carga Horária, Estatísticas e Observações) e botões de ação:</p>
                <p><strong>✏️ Editar Escala:</strong> Leva você de volta ao Editor Manual (igual ao da Geração Automática), permitindo fazer ajustes na escala salva e salvá-la novamente.</p>
                <p><strong>🔥 Excluir:</strong> Apaga permanentemente a escala do seu histórico.</p>
                <p><strong>🖨️ Exportar para PDF:</strong> Abre as opções para gerar um arquivo PDF da escala, seja no formato de grade completa (Visão Geral) ou um relatório diário detalhado, prontos para impressão ou compartilhamento.</p>
            </div>
        `
    },
    relatorios: {
        title: "Ajuda: Relatórios",
        content: `
            <div class="help-card">
                <h4>📊 Analisando o Desempenho</h4>
                <p>Esta seção transforma os dados de uma escala salva em insights visuais, ajudando a verificar se a distribuição de trabalho foi justa e eficiente.</p>
                <p><strong>Como Funciona:</strong> Primeiro, selecione o <strong>Cargo</strong> e o <strong>Ano</strong> para listar as escalas salvas. Em seguida, clique na escala que deseja analisar para gerar o dashboard de relatórios.</p>
            </div>
            <div class="help-card">
                <h4>📈 Dashboard de Análise</h4>
                <p>O dashboard possui duas abas principais:</p>
                <p><strong>Visão Geral:</strong> Apresenta KPIs (indicadores chave) como total de horas, horas extras e ausências. Inclui uma tabela de ranking de funcionários (ordenável por diferentes métricas) e gráficos sobre a distribuição geral de turnos e folgas de fim de semana.</p>
                <p><strong>Análise Individual:</strong> Permite aprofundar nos dados de um funcionário específico (selecionado na tabela da Visão Geral). Mostra os KPIs individuais, um resumo dos tipos de turnos realizados e um calendário visual da atividade do funcionário naquela escala.</p>
            </div>
        `
    },
    configuracoes: {
        title: "Ajuda: Configurações",
        content: `
            <div class="help-card">
                <h4>⚙️ Geral</h4>
                <p>Na aba "Geral", você pode definir o nome de usuário que aparece na saudação da tela inicial e na tela de carregamento.</p>
            </div>
            <div class="help-card">
                <h4>💾 Dados (Backup e Restauração)</h4>
                <p><strong>ESSENCIAL:</strong> Seus dados (turnos, funcionários, escalas, etc.) são salvos <strong>apenas neste programa</strong>, no seu computador. Use a função de <strong>📤 Exportar (Backup)</strong> regularmente para criar um arquivo de segurança (<code>.json</code>). Guarde este arquivo em local seguro!</p>
                <p>Se você trocar de computador, limpar os dados do programa, ou ocorrer algum problema, poderá usar a função de <strong>📥 Importar</strong> para restaurar tudo a partir do seu arquivo de backup. <strong>Atenção:</strong> A importação substitui todos os dados atuais.</p>
                 <p><strong>⚠️ Ações Irreversíveis:</strong> Tenha muito cuidado nesta seção. A opção de <strong>🔥 Apagar Todos os Dados</strong> remove permanentemente tudo do aplicativo neste programa. Use apenas se tiver certeza absoluta e possuir um backup recente.</p>
            </div>
            <div class="help-card">
                <h4>ℹ️ Sobre e Recursos</h4>
                <p>Aqui você encontra links úteis:</p>
                <p>• <strong>Termos de Uso e Política de Privacidade:</strong> Documentos legais sobre o uso do software.</p>
                <p>• <strong>Atalhos de Teclado:</strong> Lista os comandos de teclado disponíveis no Editor Manual da escala.</p>
                <p>• <strong>Reportar um Problema:</strong> Abre seu cliente de e-mail para enviar um feedback ou relatar um erro.</p>
                <p>• <strong>Apoiar o Projeto (PIX):</strong> Se o PlantãoPro te ajudou, considere apoiar o desenvolvimento!</p>
            </div>

        `
    }
};

const contextHelpBtn = document.getElementById('context-help-btn');
const helpPanel = document.getElementById('help-panel');
const helpPanelBackdrop = document.getElementById('help-panel-backdrop');
const helpPanelTitle = document.getElementById('help-panel-title');
const helpPanelContent = document.getElementById('help-panel-content');
const helpPanelCloseBtn = document.getElementById('help-panel-close-btn');
const body = document.body;

function toggleHelpPanel(show) {
    if (show) {
        body.classList.remove('help-panel-hiding');
        body.classList.add('help-panel-active');
        if(helpPanelContent) helpPanelContent.scrollTop = 0;
    } else {
        body.classList.add('help-panel-hiding');
        setTimeout(() => {
            body.classList.remove('help-panel-active');
            body.classList.remove('help-panel-hiding');
        }, 400); 
    }
}

function loadHelpContent(pageId) {
    const helpData = helpContentData[pageId];

    if (helpData) {
        helpPanelTitle.textContent = helpData.title;
        helpPanelContent.innerHTML = helpData.content;
        parseEmojisInElement(helpPanelContent); 
        return true; 
    } else {
        helpPanelTitle.textContent = 'Ajuda';
        helpPanelContent.innerHTML = '<p class="muted">Não há ajuda disponível para esta seção.</p>';
        return false; 
    }
}

if (contextHelpBtn) {
    contextHelpBtn.addEventListener('click', () => toggleHelpPanel(true));
}

if (helpPanelCloseBtn) {
    helpPanelCloseBtn.addEventListener('click', () => toggleHelpPanel(false));
}

if (helpPanelBackdrop) {
    helpPanelBackdrop.addEventListener('click', () => toggleHelpPanel(false));
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('help-panel-active')) {
        toggleHelpPanel(false);
    }
});
