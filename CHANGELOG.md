# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.0] — 2026-05-23

### Added
- **Módulo Intelecto**: renomeação do módulo Leitura para Intelecto com escopo expandido
- Cursos com Módulos e Aulas (Course / Module / Lesson / Session)
- Habilidades (Skill) com radar chart no dashboard
- Métricas de cursos e habilidades integradas ao dashboard do Intelecto
- Unificação do planejamento de tarefas com skills, cursos e treinos

---

## [1.5.2] — 2026-05-22

### Added
- Upload e remoção de foto de perfil do usuário

---

## [1.5.1] — 2026-05-21

### Added
- **Módulo de Treino e Nutrição**: planos de treino, dias, sessões, séries (WorkoutPlan / WorkoutDay / WorkoutSession / ExerciseSet)
- Registro de refeições e opções de cardápio (MealLog / MenuOption / MealType / Food)
- UI redesenhada com animações e FormSection para treino e nutrição

---

## [1.5.0] — 2026-04-29

### Added
- **Sistema de Agentes LLM** com suporte a múltiplos provedores (Ollama, Groq, Anthropic)
- Roteamento inteligente de queries entre 6 agentes de domínio (finance, budget, forecast, insight, library, planning)
- RAG via pgvector para contexto financeiro
- Streaming SSE de respostas
- Memória de conversação persistida em Redis + PostgreSQL
- Circuit breaker para Ollama com fallback automático
- Auditoria técnica completa de performance, segurança e qualidade

### Fixed
- Correção de modelo Ollama não instalado com fallback para Groq
- Nomes de índices auto-gerados e related_name em migrações de agentes

---

## [1.4.2] — 2026-05-06

### Added
- **2FA / TOTP**: autenticação de dois fatores com backup codes (SHA-256)
- Banner de verificação de e-mail no frontend
- Importação de extrato bancário (bank statement import flow)
- Página de saúde do vault
- Suporte a i18n completo para painel admin, integrações, logs e overview

---

## [1.4.1] — 2026-05-02

### Added
- Redesign da página de Membros com layout em cards
- Melhorias visuais em telas financeiras (lote 1 e 2)
- Sistema de notificações em tempo real
- Relatório financeiro de membros com filtro por data e gráficos atualizados

---

## [1.4.0] — 2026-04-18

### Added
- **Melhorias no Planejamento Pessoal**: tipos de meta, prioridade, prazo e analytics de progresso
- **14 melhorias no módulo de Segurança**: vault, senhas armazenadas, cartões e arquivos

---

## [1.3.0] — 2026-04-01

### Added
- Novos temas escuros (Dracula / Alucard) e temas claros
- Fluxo de redefinição de senha e verificação de e-mail
- Empty state icons e page header icons em todas as páginas
- Foto de perfil de autores na Biblioteca
- Novas nacionalidades de autores

### Fixed
- Múltiplas correções de UX e acessibilidade

---

## [1.2.0] — 2026-03-01

### Added
- **Suporte a múltiplos idiomas** (pt-BR / en-US) via react-i18next
- Simulador de rendimento do vault
- Healthchecks nos Dockerfiles (API, frontend, Celery)
- Pipeline de CI/CD com blue-green deploy no Kubernetes
- Backups automáticos do banco de dados
- Linting de migrações e verificação de schema drift no entrypoint

---

## [1.1.0] — 2026-02-28

### Added
- Previsão de fluxo de caixa (cash flow forecast) com gráfico no dashboard
- Heatmap de consistência de hábitos
- Metas anuais de leitura com progresso e métricas
- Estimativa de progresso e conclusão de leitura no BookSerializer
- Auditoria de saúde de senhas
- Exportação de extrato mensal (despesas + receitas)
- Orçamento mensal por categoria
- Cobertura de testes com thresholds no CI (70% → 80%)
- Healthcheck no endpoint MinIO

---

## [1.0.0] — 2026-02-27

### Added
- **Core financeiro**: contas bancárias, despesas, receitas, transferências, cartões de crédito, empréstimos, contas a pagar, contas a receber, cofres (vaults), orçamentos, dashboard
- **Módulo Biblioteca**: livros, autores, editoras, leituras, resumos
- **Módulo Segurança**: vault criptografado, senhas armazenadas, cartões armazenados, arquivos, logs de atividade
- **Planejamento Pessoal**: metas, hábitos, rotinas, reflexões diárias, gamificação
- **Webhooks**: sistema de eventos assinados com HMAC-SHA256
- **Taxas de câmbio**: integração com BCB PTAX para conversão BRL/moeda estrangeira
- **Painel Admin**: configuração de sistema com criptografia de campos sensíveis
- Multi-tenancy via grupos de membros com permissões granulares
- Autenticação JWT em cookies HttpOnly com refresh automático
- Soft delete, audit fields e encriptação de campos sensíveis (Fernet)
- Deploy containerizado com Docker Compose e Kubernetes
