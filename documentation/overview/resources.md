# Recursos e Funcionalidades

Este documento detalha todos os recursos e funcionalidades disponíveis no Axiom, organizados por módulo.

## Módulo Finance (ExpenseLit)

### Contas Bancárias

#### Tipos de Conta Suportados
- **Conta Corrente (CC)** - Conta para movimentação diária
- **Conta Salário (CS)** - Conta para recebimento de salário
- **Fundo de Garantia (FG)** - FGTS e reservas
- **Vale Alimentação (VA)** - Vale alimentação/refeição

#### Instituições Financeiras
- Nubank (NUB)
- Sicoob (SIC)
- Mercado Pago (MPG)
- Ifood Benefícios (IFB)
- Caixa Econômica Federal (CEF)

#### Funcionalidades de Contas
- Criação e edição de contas
- Upload de logo/imagem da instituição
- Campos de identificação (agência, número da conta, código do banco)
- **Número de conta criptografado automaticamente**
- Controle de saldo atual e saldo mínimo
- Data de abertura e descrição
- Ativar/desativar contas
- Vinculação ao proprietário (membro)

### Despesas

#### Categorias de Despesas (22)
- Comida e bebida
- Contas e serviços
- Eletrônicos
- Amizades e Família
- Animais de estimação
- Assinaturas digitais
- Casa
- Compras
- Doações
- Educação
- Empréstimos
- Entretenimento
- Impostos
- Investimentos
- Outros
- Roupas
- Saúde e cuidados pessoais
- Serviços profissionais
- Supermercado
- Taxas
- Transporte
- Viagens

#### Funcionalidades de Despesas
- Registro detalhado com valor, data e horário
- Seleção de categoria
- Informação do estabelecimento (merchant) e localização
- **Métodos de pagamento**: dinheiro, débito, crédito, PIX, transferência, cheque
- Upload de comprovante (receipt)
- Despesas recorrentes com configuração de frequência
- Marcação de pagamento (pago/não pago)
- Vinculação a conta bancária
- Notas e observações
- Filtros avançados por:
  - Categoria
  - Data (intervalo)
  - Conta
  - Status de pagamento
  - Estabelecimento

### Receitas

#### Categorias de Receitas (10)
- Depósito
- Prêmio
- Salário
- Vale
- Rendimentos
- Reembolso
- Cashback
- Transferência Recebida
- Empréstimo Recebido
- Devolução de empréstimo

#### Funcionalidades de Receitas
- Registro com valor bruto e líquido
- Cálculo automático de impostos
- Fonte da receita
- Upload de comprovante
- Receitas recorrentes
- Vinculação a conta bancária
- Marcação de recebimento
- Filtros por categoria, data e conta

### Cartões de Crédito

#### Bandeiras Suportadas
- Mastercard (MSC)
- Visa (VSA)
- Elo (ELO)
- American Express (EXP)
- Hipercard (HCD)

#### Funcionalidades de Cartões
- Cadastro com nome e nome impresso no cartão
- **CVV criptografado (nunca retornado pela API)**
- **Número do cartão criptografado e mascarado**
- Data de validade
- Gestão de limites (atual e máximo)
- Dia de fechamento e vencimento
- Taxa de juros e anuidade
- Vinculação a conta bancária
- Ativar/desativar cartões
- Vinculação ao proprietário

#### Faturas de Cartão
- Criação automática por mês/ano
- Cálculo de valor total e pagamento mínimo
- Data de vencimento e pagamento
- Status (aberta, fechada, paga, vencida)
- Juros e multas
- Histórico completo de faturas

#### Despesas de Cartão
- Registro detalhado por cartão
- Suporte a parcelamento (n/x parcelas)
- Vinculação automática a fatura
- Todas as categorias de despesas
- ID da transação
- Comprovante de compra

### Empréstimos

#### Funcionalidades
- Registro de valor total e valor pago
- Taxa de juros configurável
- Número de parcelas
- Frequência de pagamento (diário, semanal, mensal, trimestral, semestral, anual)
- Data de vencimento
- Documento do contrato
- Multa por atraso
- Fiador (opcional)
- Status (ativo, quitado, em atraso, cancelado)
- Vinculação de beneficiado e credor (membros)
- Categorização por tipo de despesa

### Transferências

#### Tipos de Transferência
- DOC
- TED
- PIX

#### Funcionalidades
- Transferência entre contas próprias
- Valor e taxa de transferência
- ID único da transação
- Código de confirmação
- Data/hora de processamento
- Taxa de câmbio (se aplicável)
- Comprovante
- Validação: conta origem ≠ conta destino

### Dashboard Financeiro

#### Métricas Exibidas
- Saldo total de todas as contas
- Total de despesas do mês
- Total de receitas do mês
- Saldo líquido (receitas - despesas)
- Despesas por categoria (gráfico pizza)
- Evolução mensal (gráfico linha)
- Empréstimos pendentes
- Faturas de cartão em aberto
- Próximos vencimentos

#### Visualizações
- Gráficos interativos com Recharts
- Cards de estatísticas
- Listas de transações recentes
- Alertas de vencimentos próximos

### Orçamentos

#### Funcionalidades
- Limite de gasto (`limit_amount`) por categoria de despesa, mês e ano, opcionalmente por membro
- Rolagem de saldo (`rollover_enabled`): saldo não utilizado do mês anterior soma ao limite do mês atual
- Restrição de unicidade por categoria/mês/ano/membro
- Alertas de orçamento (próximo do limite / estourado) via sistema de notificações

### Conciliação Bancária

#### Funcionalidades
- Importação de extrato em OFX, CSV, CNAB 240 ou CNAB 400 (`BankStatementImport`)
- Hash do arquivo para evitar importação duplicada
- Cada lançamento do extrato (`BankStatementEntry`) é comparado com despesas/receitas já registradas
- Status por entrada: pendente, conciliado, divergente, ignorado
- Nível de confiança do match automático: alta, média, baixa ou manual
- Contadores de conciliados/divergentes/ignorados por importação

### Cofres (Poupança com Objetivo)

#### Funcionalidades
- Cofre (`Vault`) vinculado a uma conta bancária, com saldo e rendimento acumulado próprios
- Taxa de rendimento anual configurável manualmente ou indexada a CDI/SELIC (com alíquota de IR sobre o índice)
- Depósito e saque (`deposit`/`withdraw`), com aplicação automática de rendimentos pendentes antes da operação
- Rendimento é lançado como receita (categoria `income`) na conta associada, mantendo o saldo disponível da conta consistente com o valor reservado
- Simulação de próximo rendimento sem persistir nada (`simulate_yield_preview`)
- Recálculo de rendimentos retroativo ao trocar a taxa (`recalculate_yields`)
- Contribuições recorrentes mensais (`VaultRecurringContribution`), geradas via despesa fixa associada e processadas por comando de gestão
- Metas Financeiras (`FinancialGoal`): agregam um ou mais cofres, com valor-alvo, data-alvo, progresso percentual e valor mensal necessário para atingir o objetivo no prazo

### Planejamento Mensal

#### Funcionalidades
- Plano mensal (`MonthlyPlan`) por usuário/mês/ano com overrides específicos daquele mês: receitas extras, despesas extras, limites de orçamento, receitas/despesas fixas e contas (bills) sobrescritas, categorias de orçamento desabilitadas
- Resumo (`summary`) e aplicação (`apply`) dos overrides via endpoints dedicados
- Registro de quando o plano foi efetivamente aplicado (`applied_at`)

### Câmbio

#### Funcionalidades
- Cotações diárias oficiais do Banco Central (PTAX) para 14 moedas/criptoativos (USD, EUR, GBP, ARS, CLP, UYU, JPY, CHF, CAD, AUD, MXN, CNY, BTC, ETH)
- Taxa de compra e venda, com taxa média (`mid_rate`) calculada
- `ExchangeRate.convert()`: conversão cruzada entre quaisquer duas moedas via BRL
- Atualização automática diária via tarefa Celery

### Contas a Pagar e a Receber

#### Funcionalidades
- `Payable`: valores a pagar que não são empréstimos (ex.: dentista, conserto), com valor total/pago, parcelamento (`PayableInstallment`), dívida cumulativa e status (ativo, quitado, em atraso, cancelado)
- `Receivable`: espelho de `Payable` para receitas a receber (honorários, reembolsos), com parcelamento (`ReceivableInstallment`) e status (ativo, recebido, em atraso, cancelado)
- Registrar o pagamento/recebimento não cria o `Payable`/`Receivable` em si — ele já existe; o pagamento/recebimento dispara a despesa/receita correspondente
- Atualização automática de status para quitado/recebido quando o valor pago/recebido atinge o valor total

## Módulo Security (StreamFort)

### Senhas

#### Categorias
- E-mail
- Redes Sociais
- Bancos
- Trabalho
- Pessoal
- Compras
- Entretenimento
- Outros

#### Funcionalidades
- Armazenamento criptografado (Fernet)
- Título e URL do site
- Nome de usuário
- **Senha criptografada (não retornada em listagens)**
- Endpoint dedicado para revelar senha
- Data da última alteração
- Categorização
- Notas e observações
- Vinculação ao proprietário
- Log de auditoria ao revelar

### Cartões Armazenados

#### Funcionalidades
- Armazenamento separado do módulo Finance
- **Número completo criptografado**
- **CVV criptografado**
- Nome do titular
- Mês e ano de expiração
- Bandeira do cartão
- Vinculação opcional ao cartão do Finance
- Número mascarado para listagem (************1234)
- Endpoint dedicado para revelar dados completos

### Contas Bancárias Armazenadas

#### Funcionalidades
- Nome e instituição financeira
- Tipo de conta
- **Número da conta criptografado**
- Agência
- **Senha bancária criptografada**
- **Senha digital/PIN criptografada**
- Número mascarado para listagem
- Vinculação opcional à conta do Finance
- Endpoint dedicado para revelar credenciais

### Arquivos Confidenciais

#### Tipos de Arquivo
- Texto (armazenamento criptografado direto)
- Arquivo (upload com criptografia)

#### Categorias
- Pessoal
- Financeiro
- Trabalho
- Saúde
- Legal
- Outros

#### Funcionalidades
- **Conteúdo de texto criptografado**
- **Arquivos criptografados antes do upload**
- Título e categoria
- Sistema de tags
- Cálculo automático de tamanho
- Notas adicionais
- Endpoint dedicado para revelar/download

### Logs de Atividade

#### Tipos de Ação Registrados
- Visualização
- Criação
- Atualização
- Exclusão
- Revelação de senha/credencial
- Download de arquivo
- Login
- Logout
- Tentativa de login falha
- Outras ações

#### Informações Registradas
- Usuário que executou a ação
- Tipo de ação
- Modelo e ID do objeto
- Descrição da ação
- Endereço IP
- User Agent (navegador)
- Data e hora

#### Funcionalidades
- Logs read-only (somente consulta)
- Filtragem por usuário, ação, data
- Rastreamento completo de acessos sensíveis
- Auditoria de segurança

## Módulo Library (CodexDB)

### Livros

#### Metadados Completos
- Título e subtítulo
- ISBN
- Número de páginas
- Ano de publicação
- Idioma
- Edição
- Formato (físico, e-book, audiobook)
- Status de leitura (não lido, lendo, concluído, abandonado)

#### Funcionalidades
- Cadastro completo de livros
- Vinculação com autores (muitos-para-muitos)
- Vinculação com editora
- Upload de capa do livro
- Data de aquisição
- Localização física (estante)
- Avaliação (1-5 estrelas)
- Notas pessoais
- Proprietário do livro

### Autores

#### Funcionalidades
- Nome completo
- Nacionalidade
- Data de nascimento e falecimento
- Biografia
- Foto do autor
- Site/URL oficial
- Relacionamento com múltiplos livros
- Contagem automática de livros

### Editoras

#### Funcionalidades
- Nome e país
- Ano de fundação
- Site oficial
- Descrição
- Logo da editora
- Relacionamento com múltiplos livros

### Resumos de Leitura

#### Funcionalidades Especiais
- Resumo detalhado do livro
- **Vetorização automática via `nomic-embed-text` (Ollama, 768 dims)**
- **Busca semântica via pgvector**
- Citações favoritas
- Insights e aprendizados
- Data do resumo
- Vinculação ao livro
- Busca por similaridade de conteúdo

### Dashboard da Biblioteca

#### Métricas Exibidas
- Total de livros na biblioteca
- Livros lidos vs. não lidos
- Livros por idioma
- Livros por formato
- Autores favoritos (mais livros)
- Editoras mais presentes
- Progresso de leitura anual
- Média de avaliações

## Módulo Agents (IA Conversacional)

### Agentes Especializados

| Agente | Domínio | Descrição |
|---|---|---|
| `FinanceAgent` | Finanças | Análise de gastos, categorias, evolução temporal |
| `BudgetAgent` | Orçamentos | Status de orçamentos, desvios, projeções de estouro |
| `ForecastAgent` | Projeções | Saldo projetado, fluxo de caixa, despesas fixas |
| `PlanningAgent` | Planejamento | Rotinas, metas, reflexões diárias |
| `LibraryAgent` | Biblioteca | Resumos de livros via RAG (pgvector) |
| `InsightAgent` | Geral | Orquestrador, briefing diário, perguntas gerais |
| `PersonalAgent` | Planejamento pessoal | Visão combinada de hábitos, metas e bem-estar |
| `FinancialAgent` | Finanças (módulo consolidado) | Complementar ao `FinanceAgent`/`BudgetAgent`/`ForecastAgent` |
| `SecurityAgent` | Cofre de senhas | Saúde das senhas, duplicadas, alertas de segurança |
| `IntellectAgent` | Intelecto (Biblioteca) | Cursos, habilidades e flashcards |

`NoAccessAgent` é um agente de fallback (não selecionável) usado quando o usuário não tem acesso à tela/módulo correspondente.

### Tecnologia

- **Embeddings**: `nomic-embed-text` via Ollama — **768 dimensões**, armazenados em `vectors.agent_embeddings` (pgvector)
- **Busca vetorial**: operador `<=>` (distância coseno) — TOP-5 chunks mais similares
- **LLM Providers**: `LLM_PROVIDER=ollama` (padrão), `groq`, `anthropic` ou `openai` (com `LLM_FALLBACK_PROVIDERS` para encadear fallbacks)
- **Seleção de agente**: score por palavras-chave + similaridade semântica (peso 0.15)
- **Memória**: Redis (TTL 1h, últimos 10 turnos) + PostgreSQL (histórico permanente)
- **Segurança**: validação de prompt injection server-side (padrões em PT-BR e EN)

### Interface de Chat

#### Funcionalidades
- Respostas em streaming (SSE) token a token
- Histórico de sessões com `session_id`
- Exibição de fontes de dados usadas pelo agente
- Cancelamento de stream via AbortController
- Modo síncrono (`/ask/`) para integrações programáticas

### Casos de Uso

#### Exemplos de Perguntas
- "Quanto gastei com supermercado em janeiro?"
- "Como está meu orçamento de alimentação este mês?"
- "Qual meu saldo projetado para o final do mês?"
- "Quais rotinas tenho pendentes hoje?"
- "Resuma o livro X da minha biblioteca"
- "Dê um briefing geral das minhas finanças"

### Documentação Detalhada

Consulte [`backend/agents.md`](../backend/agents.md) para pipeline completo (diagramas de sequência, roteador, providers, RAG, endpoints e configuração).

## Módulo Personal Planning

### Tarefas Rotineiras e Hábitos

#### Funcionalidades
- `RoutineTask` com recorrência (diária, semanal, mensal) e horário alvo
- `TaskInstance` gerado sob demanda (lazy) por dia, conforme o usuário acessa o calendário — sem instâncias para datas futuras ainda não chegadas
- Status por instância: pendente, em progresso, concluída, parcial, ignorada
- Templates de rotina (`UserRoutineTemplate`) para importar pacotes de hábitos em bloco
- Blocos de foco (`FocusBlock`/`FocusBlockTask`) para agrupar tarefas em um período dedicado

### Metas Pessoais

#### Funcionalidades
- `Goal`: objetivos com prazo, tipo e progresso, incluindo metas do tipo "evitar hábito" (`avoid_habit`)
- `GoalFailure`: registro de recaída em metas de hábito a evitar, por data
- Associação de tarefas rotineiras a uma meta para acompanhar a contribuição de cada hábito

### Reflexões Diárias

#### Funcionalidades
- `DailyReflection`: diário estruturado com perguntas de reflexão configuráveis, pesquisável por data

### Gamificação

#### Funcionalidades
- `GamificationProfile`: nível, XP acumulado, sequência atual e maior sequência já alcançada
- `XPTransaction`: histórico de pontos ganhos por tarefa concluída, meta atingida ou reflexão registrada
- `Badge`/`UserBadge`: conquistas desbloqueadas, com marcos especiais (7, 30, 100 dias)

### Treinos e Métricas Corporais

#### Funcionalidades
- `WorkoutPlan`/`WorkoutDay`/`WorkoutExercise`: planos de treino por dia e grupo muscular, com exercícios de um catálogo (`Exercise`, imagens apenas via `ExerciseDatasetEntry`)
- `WorkoutSession`/`WorkoutSessionExercise`/`WorkoutSessionSet`: sessões realizadas, com séries individuais e carga utilizada, permitindo acompanhar a progressão por exercício
- `BodyMetric`: medidas antropométricas (peso, circunferências, dobras cutâneas) com cálculo de percentual de gordura corporal (protocolos Navy ou Pollock de 7 dobras)

### Nutrição

#### Funcionalidades
- `Food`: alimentos com macronutrientes (proteína, carboidrato, gordura, calorias)
- `MealType`/`MenuOption`/`MenuOptionIngredient`: cardápios com ingredientes e quantidades, incluindo ingredientes alternativos entre si
- `MealLog`: refeições registradas por dia com controle calórico e de macros
- `HydrationGoal`/`WaterLog`: meta diária de hidratação e registro de consumo de água

### Bem-Estar Emocional

#### Funcionalidades
- `EmotionalCheckin`: check-ins diários (solidão, ansiedade, motivação, energia)
- `SelfEsteemAssessment`: avaliação padronizada de autoestima (Escala de Rosenberg)
- `CrisisImpulseLog`: registro de impulso (compulsão, procrastinação etc.) no Modo Crise, com resposta de apoio gerada por IA
- `WellnessIntervention`/`WellnessInterventionCompletion`: catálogo de intervenções (exercícios/técnicas breves) a seguir e avaliar
- `WellnessWeeklyReport`: relatório semanal gerado por IA resumindo padrões emocionais

### Revisão Diária

#### Funcionalidades
- Modal bloqueante (app `daily_review`) que percorre as pendências do dia anterior antes de liberar o uso normal do app: reflexão, tarefas, metas de hábito a evitar, treino, refeições, hidratação, check-in emocional, autoestima, estudos (cursos do módulo Intelecto) e flashcards vencidos
- Etapas "por dia" olham uma data específica; etapas "contínuas" (bem-estar da última semana, pesagem, flashcards) olham o estado atual e só aparecem na revisão do dia mais recente
- `ReviewProgress`: último dia revisado por membro
- `ReviewResolution`: justificativa de pular (`skip`) ou manter pendente (`keep_pending`) um item, por etapa/data/item

## Módulo Admin Panel

#### Funcionalidades
- Visão geral de saúde em tempo real dos serviços dependentes (banco de dados, Redis, e-mail, LLM, MinIO)
- `SystemConfig`: configurações do sistema editáveis via UI (LLM, e-mail, backup, armazenamento, segurança), com segredos criptografados (Fernet) e auditoria de quem alterou
- Acesso por tela (`UserScreenAccess`/`ScreenDefault`): ações (visualizar/criar/editar/excluir) concedidas por usuário e por tela; `ScreenDefault` define o padrão para novos usuários
- Logs da aplicação em tempo real, com filtros
- Status de integrações ativas (MinIO, Ollama, e-mail SMTP etc.)

## Sistema de Membros Unificado

### Funcionalidades
- Cadastro único para todas as pessoas relacionadas
- Flags configuráveis:
  - `user` (vínculo opcional com o usuário do sistema)
  - `is_creditor` - Pode ser credor em empréstimos
  - `is_benefited` - Pode ser beneficiário
- Documento único (CPF/CNPJ)
- Dados pessoais completos:
  - Nome, email, telefone
  - Data de nascimento
  - Endereço
  - Foto de perfil
  - Contato de emergência
  - Renda mensal
  - Ocupação
- Vinculação opcional a usuário Django
- Cálculo automático de idade

## Recursos Transversais

### Webhooks

#### Funcionalidades
- Webhooks outbound configuráveis pelo usuário, com URL de destino, lista de eventos e assinatura HMAC-SHA256 (`X-Axiom-Signature`)
- Eventos disponíveis: criação/atualização/exclusão de despesa, receita, transferência, empréstimo; orçamento excedido; depósito/saque de cofre; notificação criada; score de saúde atualizado
- `WebhookDelivery`: registro de cada tentativa de entrega (status, código HTTP de resposta, duração, nº da tentativa, erro), com retentativas configuráveis (`max_retries`, `timeout_seconds`)

### Notificações

#### Funcionalidades
- Mais de 20 tipos de notificação (tarefa do dia/atrasada, contas a pagar/receber e faturas a vencer/atrasadas, orçamento, meta financeira, insight de agente, meta de leitura, reconciliação bancária pendente, cartão armazenado a vencer, credencial acessada via link, senha comprometida/anomalia no cofre, recomendações de aprendizado etc.)
- Preferência por tipo e por canal (`NotificationPreference`): somente no app, somente e-mail, ou ambos
- Restrição de unicidade por proprietário/tipo/objeto, evitando notificações duplicadas para o mesmo evento

### Autenticação e Autorização

- JWT com refresh tokens
- Tokens em HttpOnly cookies
- Sistema de permissões granular
- Grupos de usuários
- Renovação automática de tokens

### Soft Delete

- Exclusão lógica em todos os modelos
- Flag `is_deleted` e timestamp `deleted_at`
- Preservação de histórico
- Filtros automáticos para não mostrar deletados

### Auditoria

- Campos `created_by` e `updated_by`
- Timestamps `created_at` e `updated_at`
- UUID único para cada registro
- Logs de atividade no módulo Security

### Interface do Usuário

- Design responsivo
- 14 temas (7 variantes dark + 7 light: Dracula, Catppuccin, Tokyo Night/Day, Gruvbox, Everforest, Ubuntu, Mint), selecionáveis pelo `ThemeToggle`
- Ícones Lucide React
- Componentes shadcn/ui
- Feedback visual em todas as ações
- Validações em tempo real
- Mensagens de erro claras

### Performance

- Índices otimizados no banco
- Lazy loading de componentes
- Queries otimizadas com `select_related` / `prefetch_related`
- Cache estratégico (Redis) com TTLs alinhados ao frontend (TanStack Query)
- Paginação `PAGE_SIZE=50` com `PageNumberPagination`

## Links Relacionados

- [Arquitetura do Sistema](../architecture/overview.md)
- [Documentação da API](../api/endpoints.md)
- [Guia de Desenvolvimento](../development/development_workflow.md)
