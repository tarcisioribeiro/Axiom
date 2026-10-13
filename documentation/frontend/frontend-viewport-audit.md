# Auditoria de rolagem — viewport 1920×880

**Data:** 13/10/2026 · **Status:** aguardando revisão do product owner

## Contexto

A regra "sem rolagem" (`design-patterns.md`) tinha sido medida com viewport de 1024 px de altura, considerando 1920×1080 em tela cheia. No uso real (barra de tarefas do Linux Mint + navegador não maximizado, com abas, barra de endereço e favoritos), a viewport útil é menor:

- Monitor ultrawide 2560×1080 (com barra de tarefas): ~911 px de altura (medido com `window.innerHeight`).
- Monitor 1920×1080 (sem barra de tarefas): ~960 px.

A referência do §1 do `design-patterns.md` foi atualizada para **viewport útil ~1920×900, medida a 880 px de altura**.

## Método

- Iframe de 1920×880 na mesma origem (`axiom.localhost`), usuário comum logado.
- Navegação via React Router (sem recarregar), aguardando o carregamento estabilizar.
- Cada rota, cada aba (`[role=tab]`) e cada modal aberto pelos botões "Novo…/Registrar…/Adicionar…" da tela.
- O número é quantos pixels o conteúdo passa da viewport. Telas que dependem de dados podem variar (ex.: Planejamento Semanal deu +47 numa rodada e +147 em outra).
- Modal: limite de altura = 880 − 2rem = **848 px**.

## Telas com rolagem

### A. Listas paginadas que passam por pouco

Mesma estrutura: cabeçalho, abas, filtros, 5 cards e paginação (a paginação é o que fica de fora).

| Tela | Rota | Excesso |
|---|---|---|
| Planejamento Semanal | `/planning/weekly-planning` | +147 |
| Insights de Gastos | `/finance/analytics/spending-insights` | +114 |
| Cartões de Crédito | `/credit-cards/cards` | +113 |
| Sessões de Treino | `/planning/workout/sessions` | +95 |
| Cofres | `/vaults` | +90 |
| Livros › Obras | `/library/books/books` | +64 |
| Valores a Pagar | `/bills/payables` | +46 |
| Patrimônio Líquido | `/finance/financial-health/net-worth` | +45 |
| Objetivos | `/planning/tasks-goals/goals` | +31 |
| Calendário Financeiro | `/finance/agenda/calendar` | +24 |
| Reflexões | `/planning/reflections` | +23 |
| Orçamentos | `/budgets` | +22 |
| Metas Financeiras | `/financial-goals` | +19 |

### B. Dashboards e análises longas

| Tela | Rota | Excesso |
|---|---|---|
| Intelecto › Dashboard | `/library/dashboard` | +3681 |
| Planejador Mensal | `/finance/agenda/monthly-planner` | +1021 |
| Planejador de Dívidas | `/finance/financial-health/debt-payoff` | +895 |
| Comparativo Mensal | `/finance/analytics/month-comparison` | +311 |

### C. Listas sem paginação

| Tela | Rota | Excesso |
|---|---|---|
| Autores | `/library/authors` | +670 |
| Intervenções | `/planning/emotional-wellness/library` | +348 |
| Editoras | `/library/publishers` | +333 |

Numa rodada anterior, o Grafo de Conhecimento (`/library/knowledge-graph`) deu +55, mas não se repetiu na rodada final.

## Telas sem rolagem (a 880 px)

Início, Dashboard, Contas, Transações (3 abas), Gastos/Receitas Fixas, Regras & Tags, Transferências, Empréstimos, Membros, Webhooks, Simulador de Cofres, Flashcards, Cursos, Habilidades, Intelecto Hoje, Treino (Plano de hoje, Calendário, Planos, Exercícios), Dieta, Jornada, Medidas Corporais, Tarefas Rotineiras, Checklist Diário, Agentes IA, Configurações.

## Modais

- **Rolam:** "Novo Livro" (+38) e "Novo Autor" (+44). Os dois batem no máximo de 848 px.
- **Perto do limite, mas cabem:** Novo Valor a Pagar (824 px), Novo Objetivo (810), Novo Registro (796).
- **Cabem com folga:** os outros ~35 modais de criação (ex.: Nova Despesa 722, Nova Transferência 730, Registrar Sessão 698, Nova Conta 648).

## Fora da medição

- **Segurança:** deu 0 em todas as telas, mas provavelmente porque o cofre estava bloqueado. Medir com ele aberto.
- **Modais de edição, detalhe e ação:** não medidos (só os botões de criação de cada tela).

## Proposta de padronização (antes de criar exceções)

1. **Grupo A:** compactar o layout das telas de lista uma vez só, nos componentes comuns (`PageHeader`, abas, `FilterBar`, paginação): espaçamento vertical entre os blocos, altura da barra de filtros e da paginação. Deve resolver excessos de até ~115 px sem cortar registros. Planejamento Semanal (+147) pode precisar de ajuste próprio.
2. **Grupo C:** paginar Autores, Editoras e Intervenções (`LIST_PAGE_SIZE` ou `GRID_PAGE_SIZE`, conforme o layout).
3. **Modais Novo Livro / Novo Autor:** redistribuir os campos em mais colunas (regra §2).
4. **Grupo B (decisão do PO):** documentar dashboards e análises como exceção que rola, ou dividir em abas/seções.
5. Só depois disso avaliar reduzir para 4 registros por página onde ainda não couber.

## Achado à parte

"Plano de hoje" do Treino (`/planning/workout/today`) leva ~25 s para abrir, porque busca as 21 páginas de sessões em sequência (`workout-sessions/?page=N`).
