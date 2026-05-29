# Referência de Variáveis do Painel Admin

Esta página lista todas as chaves gerenciadas pelo `SystemConfig` do painel de administração, com valores padrão, efeitos e observações de segurança.

> As configurações do painel admin têm **prioridade** sobre o `.env` após a primeira inicialização. Para detalhes sobre o mecanismo de carregamento, consulte o [README do painel admin](README.md#como-as-configurações-são-carregadas).

## Índice

- [Categoria: LLM / Agentes](#categoria-llm--agentes)
- [Categoria: Email](#categoria-email)
- [Categoria: Backup](#categoria-backup)
- [Categoria: Aplicação](#categoria-aplicação)
- [Categoria: Segurança](#categoria-segurança)
- [Categoria: Armazenamento (MinIO)](#categoria-armazenamento-minio)
- [Variáveis Apenas no `.env`](#variáveis-apenas-no-env)

---

## Categoria: LLM / Agentes

Configurações do sistema de agentes inteligentes (`api/agents/`).

| Chave | Secret | Restart | Padrão | Descrição |
|-------|:------:|:-------:|--------|-----------|
| `LLM_PROVIDER` | | **Sim** | `ollama` | Provedor ativo: `ollama` (local) ou `anthropic` (nuvem). Trocar este valor requer reiniciar o container. |
| `OLLAMA_BASE_URL` | | | `http://ollama:11434` | Endereço HTTP do servidor Ollama. Dentro do Docker, o valor padrão aponta para o service `ollama`. Fora do Docker, use `http://localhost:11434`. |
| `OLLAMA_MODEL` | | | — | Tag do modelo Ollama para chat. Deve estar baixado localmente. Exemplo: `mistral:7b-instruct`. |
| `OLLAMA_EMBED_MODEL` | | | — | Tag do modelo Ollama para embeddings (RAG). Deve estar baixado localmente. Exemplo: `nomic-embed-text`. |
| `LLM_TIMEOUT_CHAT` | | | `120` | Segundos máximos de espera por uma resposta de chat. Aumente em hardware lento (ex: `300`). |
| `LLM_TIMEOUT_EMBED` | | | `30` | Segundos máximos de espera por um embedding. |
| `ANTHROPIC_API_KEY` | 🔒 | | — | Chave de API Anthropic. Obrigatória quando `LLM_PROVIDER=anthropic`. Começa com `sk-ant-api03-`. |
| `ANTHROPIC_MODEL` | | | — | ID do modelo Claude. Consulte a [documentação oficial](https://docs.anthropic.com/en/docs/about-claude/models) para o ID atualizado. Exemplo: `claude-sonnet-4-6`. |

**Guia completo**: [Configuração LLM / Ollama](llm_ollama_configuration.md)

---

## Categoria: Email

Configurações do servidor SMTP usado para envios transacionais.

| Chave | Secret | Restart | Padrão | Descrição |
|-------|:------:|:-------:|--------|-----------|
| `EMAIL_BACKEND` | | | `django.core.mail.backends.smtp.EmailBackend` | Classe do backend Django. Em desenvolvimento, use `django.core.mail.backends.console.EmailBackend` para imprimir no stdout. |
| `EMAIL_HOST` | | | `localhost` | Hostname do servidor SMTP (ex: `smtp.gmail.com`). |
| `EMAIL_PORT` | | | `587` | Porta SMTP. `587` para STARTTLS, `465` para SSL, `25` para não-criptografado. |
| `EMAIL_USE_TLS` | | | `True` | Ativa STARTTLS. Use com porta `587`. Não defina `True` junto com `EMAIL_USE_SSL=True`. |
| `EMAIL_HOST_USER` | | | — | Usuário de autenticação SMTP (geralmente o endereço de email completo). |
| `EMAIL_HOST_PASSWORD` | 🔒 | | — | Senha SMTP. Para Gmail, use uma App Password, não a senha da conta. |
| `DEFAULT_FROM_EMAIL` | | | `Axiom <noreply@axiom.app>` | Endereço "De" dos emails enviados. Formato: `Nome <email@dominio.com>`. |
| `SITE_URL` | | | — | URL pública do frontend, usada em links de email (ex: `https://axiom.seudominio.com`). |

**Guia completo**: [Configuração de Email](email_configuration.md)

---

## Categoria: Backup

Controla o agendamento e a retenção dos backups automáticos do banco de dados.

| Chave | Secret | Restart | Padrão | Descrição |
|-------|:------:|:-------:|--------|-----------|
| `BACKUP_CRON` | | **Sim** | — | Expressão cron para o backup automático. Exemplo: `0 2 * * *` (diariamente às 02h). Requer reinicialização do serviço de backup para entrar em vigor. |
| `KEEP_DAILY` | | | — | Quantidade de backups diários a manter. Backups mais antigos são excluídos automaticamente. |
| `KEEP_WEEKLY` | | | — | Quantidade de backups semanais a manter (um por semana ISO). |
| `KEEP_MONTHLY` | | | — | Quantidade de backups mensais a manter. |
| `BACKUP_ENCRYPTION_KEY` | 🔒 | | — | Senha AES-256 para criptografar os arquivos de backup. **Atenção**: alterar esta chave invalida a descriptografia de backups anteriores. É independente da `ENCRYPTION_KEY` do aplicativo. |

### Sintaxe cron resumida

```
┌─── minuto (0–59)
│ ┌─── hora (0–23)
│ │ ┌─── dia do mês (1–31)
│ │ │ ┌─── mês (1–12)
│ │ │ │ ┌─── dia da semana (0=Dom, 6=Sáb)
│ │ │ │ │
0 2 * * *   → todo dia às 02:00
0 3 * * 0   → todo domingo às 03:00
0 1 1 * *   → dia 1 de cada mês à 01:00
```

---

## Categoria: Aplicação

Comportamento geral do servidor Django/Gunicorn.

| Chave | Secret | Restart | Padrão | Descrição |
|-------|:------:|:-------:|--------|-----------|
| `DEBUG` | | **Sim** | `False` | Ativa o modo debug do Django. **Nunca use `True` em produção** — expõe tracebacks e desativa otimizações. |
| `LOG_FORMAT` | | **Sim** | `json` | Formato dos logs. `json` para produção (estruturado, integrável com Grafana/Loki); `verbose` para desenvolvimento (legível no terminal). |
| `BUDGET_ENFORCEMENT_MODE` | | | `soft` | Comportamento ao ultrapassar o orçamento. `soft`: retorna HTTP 201 com alerta. `hard`: bloqueia a operação com HTTP 400. |
| `ALLOWED_HOSTS` | | **Sim** | — | Domínios aceitos pelo Django, separados por vírgula (ex: `axiom.com,www.axiom.com`). Em desenvolvimento, `localhost,127.0.0.1`. |
| `CORS_ALLOWED_ORIGINS` | | **Sim** | — | Origens permitidas para requisições CORS, separadas por vírgula (ex: `https://axiom.com,http://localhost:39101`). |
| `GUNICORN_WORKERS` | | **Sim** | `2` | Número de processos worker do Gunicorn. Regra geral: `2 × núcleos_CPU + 1`. |

---

## Categoria: Segurança

> **⚠️ CRÍTICO**: as chaves desta categoria afetam toda a segurança da aplicação. Leia as observações cuidadosamente antes de alterar.

| Chave | Secret | Restart | Padrão | Descrição |
|-------|:------:|:-------:|--------|-----------|
| `SECRET_KEY` | 🔒 | **Sim** | — | Chave secreta do Django. Usada para assinar sessões, tokens CSRF e cookies. **Alterar invalida imediatamente todas as sessões ativas** — todos os usuários serão deslogados. |
| `ENCRYPTION_KEY` | 🔒 | **Sim** | — | Chave Fernet (44 chars base64) para criptografia de campos sensíveis no banco (`Account._account_number`, `CreditCard._card_number/_security_code`, `Member._document`, etc.). **Alterar sem executar `rotate_encryption_key` primeiro torna todos os dados criptografados ilegíveis e irrecuperáveis.** |

### Gerando uma nova SECRET_KEY

```bash
docker compose exec api python -c \
  "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Gerando uma nova ENCRYPTION_KEY

```bash
docker compose exec api python -c \
  "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Rotacionando a ENCRYPTION_KEY com segurança

Nunca troque a `ENCRYPTION_KEY` diretamente pelo painel admin. Use o management command:

```bash
# 1. Faça backup do banco
docker compose exec db pg_dump -U $DB_USER axiom_db > backup_pre_rotation.sql

# 2. Execute a rotação (dry-run primeiro)
docker compose exec api python manage.py rotate_encryption_key \
  --old-key <chave_atual> --new-key <nova_chave> --dry-run

# 3. Execute de verdade
docker compose exec api python manage.py rotate_encryption_key \
  --old-key <chave_atual> --new-key <nova_chave>

# 4. Atualize ENCRYPTION_KEY no .env e no painel admin, depois reinicie
docker compose restart api
```

Consulte a seção [Key Rotation](../../CLAUDE.md#key-rotation) do CLAUDE.md para o procedimento completo.

---

## Categoria: Armazenamento (MinIO)

Configurações do serviço MinIO usado para armazenamento de arquivos de mídia.

| Chave | Secret | Restart | Padrão | Descrição |
|-------|:------:|:-------:|--------|-----------|
| `MINIO_ENDPOINT` | | **Sim** | `minio:9000` | Endereço interno do MinIO (host:porta). Dentro do Docker, o service name `minio` resolve automaticamente. Para acesso externo, use `localhost:39105`. |
| `MINIO_BUCKET_NAME` | | **Sim** | — | Nome do bucket principal para armazenamento de mídia (ex: `axiom-media`). O bucket é criado automaticamente se não existir. |
| `MINIO_ROOT_USER` | | **Sim** | — | Usuário root do MinIO (equivalente a `MINIO_ROOT_USER` no docker-compose). |
| `MINIO_ROOT_PASSWORD` | 🔒 | **Sim** | — | Senha root do MinIO. Armazenada criptografada. |

> **Console MinIO**: disponível em `http://localhost:39106` para gerenciar buckets, políticas e usuários via interface web.

---

## Variáveis Apenas no `.env`

Estas variáveis **não aparecem no painel admin** — são infraestrutura de baixo nível que precisa estar disponível antes do Django iniciar.

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DB_USER` | Usuário PostgreSQL | `axiom_user` |
| `DB_PASSWORD` | Senha PostgreSQL | `senha_segura` |
| `DB_NAME` | Nome do banco | `axiom_db` |
| `DB_HOST` | Host do banco. `db` no Docker; `localhost` localmente | `db` |
| `DB_PORT` | Porta interna do PostgreSQL | `5432` |
| `REDIS_URL` | URL de conexão Redis | `redis://redis:6379/0` |
| `REDIS_PASSWORD` | Senha do Redis | `senha_redis` |
| `VITE_API_BASE_URL` | URL da API para o frontend (build-time) | `http://localhost:39100` |
| `VITE_SENTRY_DSN` | DSN do Sentry para error tracking (opcional) | `https://...@sentry.io/...` |
| `DJANGO_SUPERUSER_USERNAME` | Superusuário criado no primeiro boot | `admin` |
| `DJANGO_SUPERUSER_EMAIL` | Email do superusuário inicial | `admin@axiom.com` |
| `DJANGO_SUPERUSER_PASSWORD` | Senha do superusuário inicial | — |
| `BACKUP_ENCRYPTION_KEY_PREVIOUS` | Chave Fernet anterior após rotação. Mantida 24h para diagnóstico via `vault_recovery` | — |

> Para gerar `SECRET_KEY` e `ENCRYPTION_KEY` iniciais, consulte [development/configuration.md](../development/configuration.md#gerando-chaves-de-segurança).
