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

### Tecnologia

- **Embeddings**: `nomic-embed-text` via Ollama — **768 dimensões**, armazenados em `vectors.agent_embeddings` (pgvector)
- **Busca vetorial**: operador `<=>` (distância coseno) — TOP-5 chunks mais similares
- **LLM Providers**: `LLM_PROVIDER=ollama` (padrão), `groq` ou `anthropic`
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

## Sistema de Membros Unificado

### Funcionalidades
- Cadastro único para todas as pessoas relacionadas
- Flags configuráveis:
  - `is_user` - Usuário do sistema
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
- Tema Dracula (dark mode)
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

## Funcionalidades Pendentes de Implementação

Consulte [`development/pending_features.md`](../development/pending_features.md) para guias detalhados de como implementar cada item.

| Funcionalidade | Status |
|---|---|
| Notificações por email | ✅ Backend pronto — só falta configurar SMTP no `.env` |
| Import de extrato bancário (frontend) | 🚧 Backend pronto — falta UI de 3 etapas |
| Export ZIP do cofre (Security) | 📋 Planejado |
| Reset de senha | 📋 Planejado |
| Confirmação de email | 📋 Planejado |
| 2FA / TOTP | 📋 Planejado |

## Links Relacionados

- [Arquitetura do Sistema](../02-architecture/visao-geral.md)
- [Documentação da API](../05-api/endpoints.md)
- [Guia de Desenvolvimento](../08-development/guia-desenvolvimento.md)
