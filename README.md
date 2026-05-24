# Axiom

[![Backend Coverage](http://gitlab.tjtux.duckdns.org:7000/tarcisioribeiro/Axiom/badges/main/coverage.svg?job=test%3Abackend&key_text=Backend+Coverage&key_width=130)](http://gitlab.tjtux.duckdns.org:7000/tarcisioribeiro/Axiom/-/commits/main)
[![Frontend Coverage](http://gitlab.tjtux.duckdns.org:7000/tarcisioribeiro/Axiom/badges/main/coverage.svg?job=test%3Afrontend&key_text=Frontend+Coverage&key_width=130)](http://gitlab.tjtux.duckdns.org:7000/tarcisioribeiro/Axiom/-/commits/main)

**Axiom** é um sistema completo de gestão pessoal auto-hospedado, com interface em português brasileiro. Reúne finanças, segurança digital, biblioteca pessoal, planejamento de hábitos, saúde e nutrição em um único lugar — com um assistente de IA integrado que entende o contexto de todos esses dados.

---

## O que é o Axiom?

O Axiom foi construído para quem quer ter controle total sobre seus dados pessoais sem depender de aplicativos de terceiros. Por rodar inteiramente na sua própria infraestrutura, nenhuma informação sai do seu servidor.

A interface é organizada em seis grandes módulos, acessíveis pelo menu lateral:

---

## Módulos

### Finanças

O módulo financeiro é o coração do sistema. Tudo começa no **Dashboard**, que exibe um panorama em tempo real da sua situação financeira com gráficos de evolução, comparativos entre períodos e um **Score de Saúde Financeira** (nota de A a F) calculado a partir de quatro dimensões: liquidez, endividamento, poupança e cumprimento de compromissos.

**Contas**
Cadastre contas bancárias, carteiras digitais e qualquer conta onde o dinheiro transite. O sistema acompanha o saldo de cada conta automaticamente conforme as movimentações são registradas.

**Receitas e Despesas**
Registre entradas e saídas com categorias, datas e valores. Há suporte a despesas e receitas fixas (recorrentes) — cadastre uma vez e o sistema as lança automaticamente nos meses seguintes. As despesas também podem ser categorizadas automaticamente por **Regras de Categorização**: basta definir palavras-chave que, quando encontradas na descrição, atribuem a categoria certa sem intervenção manual.

**Cartões de Crédito**
Gerencie todos os seus cartões, com controle de faturas, parcelamentos e gastos por fatura. O sistema identifica quando uma fatura vence, alerta sobre faturas em atraso e permite registrar o pagamento de cada uma.

**Transferências**
Registre movimentações entre suas próprias contas (ex.: do banco para a carteira digital) sem que isso afete o saldo consolidado indevidamente.

**Empréstimos**
Controle empréstimos tomados ou concedidos, com tabela de parcelas e acompanhamento do valor já pago e do saldo devedor.

**Contas a Pagar e a Receber**
Para compromissos financeiros futuros: registre o que você deve pagar (ex.: boleto, parcela avulsa) e o que espera receber (honorários, reembolsos, serviços prestados). Ao registrar o recebimento efetivo, o sistema lança a receita correspondente automaticamente.

**Cofres (Poupança com Objetivo)**
Crie cofres vinculados a uma conta bancária para separar dinheiro com um objetivo específico (viagem, reserva de emergência, compra planejada). Cada cofre tem uma meta de valor e uma data-alvo. O **Simulador de Cofre** projeta quanto você precisa poupar por mês para atingir o objetivo. É possível configurar contribuições recorrentes automáticas.

**Orçamentos**
Defina um limite de gastos por categoria em cada mês. O sistema monitora os gastos em tempo real e dispara alertas quando você se aproxima ou ultrapassa o limite. A função **Sugerir Orçamento** analisa seu histórico de gastos e propõe valores realistas para cada categoria.

**Metas Financeiras**
Registre objetivos financeiros de médio e longo prazo (quitação de dívida, compra de imóvel, aposentadoria) com valor-alvo, prazo e progresso acumulado.

**Conciliação Bancária**
Importe extratos bancários (OFX/CSV) e o sistema confronta automaticamente cada lançamento do extrato com as transações já registradas, destacando divergências e entradas sem correspondência.

**Câmbio**
Consulte as cotações oficiais do Banco Central (PTAX) para as principais moedas e criptomoedas em relação ao Real. As taxas são atualizadas automaticamente todos os dias úteis.

**Exportações**
- **Extrato**: exporte movimentações de qualquer período em CSV ou PDF.
- **Relatório IR**: gera um resumo anual formatado para facilitar a declaração de Imposto de Renda.
- **LGPD**: baixe todos os seus dados pessoais armazenados no sistema em formato portável.

---

### Segurança (Cofre de Senhas)

Todos os dados deste módulo são protegidos por um **cofre criptografado** com senha mestre própria — diferente da senha de login. Sem a senha mestre, nenhum dado do cofre é acessível, nem mesmo para o administrador do servidor.

**Senhas**
Guarde credenciais de sites, serviços e aplicativos. O **Gerador de Senhas** cria senhas aleatórias com parâmetros configuráveis (tamanho, uso de símbolos, números, letras maiúsculas). Você também pode **importar senhas exportadas de navegadores** (Chrome, Firefox, Edge) em um único clique. Cada senha pode ser **compartilhada via link temporário** com outra pessoa — o link expira após o prazo definido e pode ser revogado a qualquer momento.

**Cartões Armazenados**
Armazene dados de cartões físicos (número, validade, CVV) de forma criptografada para consulta rápida.

**Contas Armazenadas**
Guarde credenciais de acesso a sistemas internos, servidores, bancos e qualquer conta que não se enquadre como "site com senha".

**Arquivos Sigilosos**
Anexe e guarde arquivos sensíveis dentro do cofre (documentos digitalizados, chaves, contratos).

**Dashboard de Saúde**
O sistema analisa todas as senhas salvas e gera um relatório de saúde: quantas são fracas, médias ou fortes; quais estão duplicadas; distribuição por categoria. Permite exportar o relatório completo.

**Log de Atividade**
Registro imutável de todas as ações realizadas no cofre (abertura, criação, edição, exclusão, exportação), com data, hora e IP de origem.

---

### Biblioteca

Módulo para quem quer acompanhar sua vida de leitor com mais profundidade que um simples aplicativo de lista.

**Dashboard da Biblioteca**
Visão consolidada com estatísticas do período: livros lidos, páginas percorridas, avaliação média, distribuição por tipo literário, velocidade de leitura, leituras em andamento e próximas na fila. Inclui streak de leitura (sequência de dias consecutivos com registro de progresso).

**Acervo**
Cadastre livros com capa, autor, editora, ano, idioma e tipo (ficção, não-ficção, técnico, etc.). É possível anexar o arquivo PDF do livro diretamente — o **Leitor integrado** permite ler dentro do próprio Axiom, sem precisar de outro aplicativo.

**Leituras**
Registre o início e o fim de cada leitura de um livro, com avaliação em estrelas e notas. O sistema calcula automaticamente a velocidade média de leitura (páginas por dia) e projeta a data de conclusão com base no ritmo atual.

**Fila de Leitura**
Monte sua fila de próximos livros e reordene com arrastar-e-soltar. Quando terminar um livro, mova o próximo da fila para leitura em andamento.

**Metas de Leitura**
Defina quantos livros de cada tipo literário você quer ler por ano. O sistema acompanha o progresso em tempo real e exibe alertas de prazo.

**Highlights e Anotações**
Registre trechos marcados durante a leitura com a página de origem. Exporte todos os highlights de um livro em formato texto para usar em resumos ou revisões.

**Resumos**
Escreva e armazene resumos livres de cada livro lido para consulta futura.

**Autores e Editoras**
Cadastros auxiliares para manter o acervo organizado e permitir filtros e estatísticas por autor ou editora.

---

### Planejamento Pessoal

**Dashboard de Planejamento**
Painel com métricas de progresso: taxa de conclusão de tarefas, sequência atual de hábitos, metas em andamento, distribuição de tarefas por categoria e **insights automáticos** (ex.: "Você é 40% mais produtivo às terças-feiras").

**Tarefas Rotineiras e Hábitos**
Crie tarefas com recorrência (diária, semanal, mensal) e horário alvo. O sistema gera automaticamente as instâncias do dia conforme você acessa o calendário — sem criar registros para datas futuras ainda não chegadas. O **Heatmap de Hábitos** exibe o histórico de conclusões no estilo "contribuições do GitHub", revelando padrões de consistência ao longo do ano.

**Tarefas de Hoje**
Visão diária com todas as instâncias geradas para o dia corrente, organizadas por horário. Marque como concluída, parcial ou ignorada.

**Templates de Rotina**
Crie pacotes de rotinas prontos (ex.: "Rotina matinal", "Semana de estudo") e importe em bloco sempre que quiser reestruturar seus hábitos.

**Metas Pessoais**
Defina objetivos com prazo, tipo (hábito, projeto, resultado) e métricas de progresso. Associe tarefas rotineiras a uma meta para acompanhar a contribuição de cada hábito ao objetivo maior.

**Reflexões Diárias**
Um diário estruturado com perguntas de reflexão configuráveis. Os registros ficam armazenados e pesquisáveis por data.

**Checklist Diário**
Lista de verificação rápida para os itens fixos do dia (tomar remédio, beber água, meditar) com marcação rápida pela interface.

**Treinos**
Monte planos de treino com dias, grupos musculares e exercícios específicos (séries, repetições, carga). Registre sessões de treino realizadas, com séries individuais e carga utilizada. O histórico de cargas por exercício permite acompanhar a progressão ao longo do tempo.

**Nutrição**
Cadastre alimentos com macronutrientes (proteína, carboidrato, gordura, calorias). Monte cardápios (opções de refeição com ingredientes e quantidades). Registre o que você comeu em cada refeição do dia (café da manhã, almoço, lanche, jantar) com controle calórico e de macros.

---

### Assistente de IA

O Axiom tem um assistente conversacional integrado que conhece todos os seus dados financeiros, de planejamento e de biblioteca. Você faz perguntas em linguagem natural e o assistente responde com contexto real — sem precisar exportar planilhas ou lembrar de números.

**Agentes especializados** (selecionados automaticamente conforme o tema da pergunta):
- **Finance** — análise de gastos, receitas, saldo e movimentações
- **Budget** — situação dos orçamentos, categorias acima do limite, sugestões
- **Forecast** — projeções de saldo futuro, simulações de cenário
- **Insight** — padrões de comportamento financeiro, anomalias, tendências
- **Library** — estatísticas de leitura, próximos livros, progresso de metas
- **Planning** — hábitos, metas pessoais, consistência de rotinas

As respostas são entregues em streaming (você vê o texto sendo digitado em tempo real). O histórico de conversas é preservado por sessão.

O assistente funciona com diferentes backends de IA: **Ollama** (auto-hospedado, sem custo e sem envio de dados para fora), **Groq** ou **Anthropic Claude** — configurável pelo administrador.

---

### Membros

O Axiom suporta múltiplos usuários no mesmo servidor, cada um com seus próprios dados isolados. O módulo de **Membros** permite ao administrador gerenciar quem tem acesso e quais permissões cada usuário possui.

**Relatório Financeiro por Membro**
O administrador (ou o próprio usuário) pode gerar um relatório detalhado das movimentações de um membro em qualquer período — útil para famílias que compartilham finanças ou pequenos grupos.

**Permissões Granulares**
Cada usuário pode ter acesso permitido ou negado por módulo e por operação (visualizar, criar, editar, excluir). Um membro pode, por exemplo, ter acesso à biblioteca mas não às finanças.

---

### Notificações

O sistema envia notificações internas para alertar sobre eventos relevantes: fatura prestes a vencer, orçamento estourado, meta de leitura atrasada, meta financeira atingida. As notificações aparecem no sino do topo da interface e podem ser configuradas por tipo nas **Preferências de Notificação**.

---

### Webhooks

Para quem quer integrar o Axiom com outros sistemas (n8n, Zapier, scripts próprios), é possível configurar **webhooks outbound**: URLs que recebem um payload assinado toda vez que um evento específico acontece no sistema (nova despesa, fatura fechada, orçamento excedido, depósito em cofre, etc.). Cada entrega é assinada com HMAC-SHA256 e pode ser verificada pelo destinatário.

---

## Conta e Segurança de Acesso

**Cadastro e Login**
O acesso é feito com e-mail e senha. A sessão é mantida via cookies HttpOnly — o token nunca fica exposto no JavaScript da página.

**Verificação de E-mail**
Ao criar a conta, o sistema envia um e-mail de verificação. Funcionalidades sensíveis ficam bloqueadas até a confirmação.

**Autenticação de Dois Fatores (2FA)**
Ative o 2FA com qualquer aplicativo compatível com TOTP (Google Authenticator, Authy, Bitwarden, etc.). O sistema fornece códigos de recuperação para uso em caso de perda do dispositivo.

**Perfil de Usuário**
Altere nome, senha e foto de perfil. Gerencie o status da verificação de e-mail e da autenticação de dois fatores em um único lugar.

---

## Painel Administrativo

Disponível apenas para administradores do servidor. Oferece:

- **Visão geral de saúde**: status em tempo real de todos os serviços dependentes (banco de dados, Redis, e-mail, LLM, MinIO).
- **Configurações do sistema**: ajuste variáveis como provedor de IA, credenciais de e-mail e parâmetros de armazenamento diretamente pela interface, sem precisar reiniciar o servidor manualmente para a maioria das configurações.
- **Logs da aplicação**: visualize e filtre logs em tempo real.
- **Integrações**: veja o status de cada integração ativa (MinIO, Ollama, e-mail SMTP, etc.).

---

## Documentação Técnica

A documentação completa para desenvolvedores está disponível em [`documentation/`](documentation/README.md).

## Licença

Este projeto é privado e proprietário.
