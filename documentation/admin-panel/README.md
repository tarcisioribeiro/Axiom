# Painel de Administração

O **Painel de Administração** do Axiom permite gerenciar configurações do sistema em tempo real, sem editar arquivos `.env` nem reconstruir containers. As configurações ficam salvas no banco de dados, com valores secretos criptografados via Fernet e todas as alterações auditadas (quem mudou o quê e quando).

## Índice

- [Visão Geral](#visão-geral)
- [Acesso](#acesso)
- [Endpoints da API](#endpoints-da-api)
- [Como as Configurações São Carregadas](#como-as-configurações-são-carregadas)
- [Categorias de Configuração](#categorias-de-configuração)
- [Guias Detalhados](#guias-detalhados)

## Visão Geral

O modelo `SystemConfig` (em `api/admin_panel/models.py`) armazena pares chave-valor organizados em categorias. Cada entrada possui:

| Campo | Descrição |
|-------|-----------|
| `key` | Identificador único (ex: `EMAIL_HOST`) |
| `label` | Nome legível exibido na UI |
| `description` | Explicação do propósito e valores válidos |
| `category` | Agrupamento (`llm`, `email`, `backup`, `app`, `security`, `storage`) |
| `is_secret` | Se `True`, o valor é criptografado no banco e exibido como `••••••••` |
| `requires_restart` | Se `True`, a mudança só entra em vigor após reiniciar o container |
| `updated_by` / `updated_at` | Auditoria automática |

## Acesso

Apenas usuários com `is_staff=True` (superusuários ou staff) podem acessar as rotas de administração.

- **Frontend**: `http://localhost:39101/admin` (componente `AdminRoute`)
- **API**: `http://localhost:39100/api/v1/admin/`

Para conceder acesso de staff a um usuário:

```bash
docker compose exec api python manage.py shell -c "
from django.contrib.auth.models import User
u = User.objects.get(username='seu_usuario')
u.is_staff = True
u.save()
"
```

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/admin/config/` | Lista todas as configurações (valores secretos mascarados) |
| `PATCH` | `/api/v1/admin/config/<KEY>/` | Atualiza o valor de uma configuração |
| `GET` | `/api/v1/admin/health/` | Health check de todos os serviços (DB, Redis, armazenamento, Ollama, email, disco) |
| `GET` | `/api/v1/admin/integrations/` | Status em tempo real das integrações LLM e email |
| `GET` | `/api/v1/admin/logs/` | Activity logs paginados (filtrável por usuário, ação, data) |
| `POST` | `/api/v1/admin/email/test/` | Envia um email de teste para verificar as configurações SMTP |
| `GET` | `/api/v1/admin/agents/status/` | Status do sistema de agentes LLM |

### Exemplo: atualizar uma configuração via curl

```bash
curl -X PATCH http://localhost:39100/api/v1/admin/config/EMAIL_HOST/ \
  -H "Content-Type: application/json" \
  -d '{"value": "smtp.gmail.com"}' \
  -b "access_token=<seu_token>"
```

### Exemplo: verificar saúde dos serviços

```bash
curl http://localhost:39100/api/v1/admin/health/ \
  -b "access_token=<seu_token>"
```

Resposta:

```json
{
  "status": "healthy",
  "timestamp": "2026-04-29T14:00:00-03:00",
  "checks": {
    "database": {"status": "healthy", "message": "Conexão bem-sucedida"},
    "cache":    {"status": "healthy", "message": "Redis operacional"},
    "storage":  {"status": "healthy", "message": "MinIO acessível"},
    "ollama":   {"status": "healthy", "message": "2 modelo(s) disponível(is)", "models": ["mistral:7b-instruct", "nomic-embed-text"]},
    "email":    {"status": "healthy", "message": "SMTP smtp.gmail.com:587 acessível"},
    "disk":     {"status": "healthy", "message": "42.3% livre"}
  }
}
```

## Como as Configurações São Carregadas

Na primeira execução, `populate_default_configs()` (chamado em `AppConfig.ready()`) lê as variáveis de ambiente atuais e cria as entradas no banco — **sem sobrescrever entradas já existentes**.

A partir daí, o valor no banco **tem prioridade** sobre o `.env`. Isso significa que:

- Mudanças feitas no painel admin entram em vigor imediatamente (salvo `requires_restart=True`).
- Mudar o `.env` depois da primeira execução **não afeta** os valores já salvos no banco.

Para redefinir uma chave ao valor do `.env`:

```bash
# Apaga a entrada do banco (ela será recriada na próxima inicialização)
docker compose exec api python manage.py shell -c "
from admin_panel.models import SystemConfig
SystemConfig.objects.filter(key='EMAIL_HOST').delete()
"
# Reinicia o container para o populate_default_configs rodar novamente
docker compose restart api
```

## Categorias de Configuração

| Categoria | Descrição | Requer restart? |
|-----------|-----------|----------------|
| `email` | Servidor SMTP, credenciais, remetente padrão | Não |
| `llm` | Provedor LLM, modelos Ollama, API Anthropic | Parcial (ver chave) |
| `backup` | Agendamento cron, retenção, chave AES | Parcial |
| `app` | Debug, logging, CORS, workers Gunicorn | Sim (maioria) |
| `security` | Django `SECRET_KEY`, Fernet `ENCRYPTION_KEY` | Sim |
| `storage` | MinIO endpoint, bucket, credenciais | Sim |

## Guias Detalhados

- **[Configuração de Email](email_configuration.md)** — SMTP, provedores (Gmail, Outlook, SES, SendGrid) e teste de envio
- **[Configuração LLM / Ollama](llm_ollama_configuration.md)** — Ollama local, Anthropic Claude e monitoramento de agentes
- **[Referência de Variáveis](environment_variables.md)** — Tabela completa de todas as chaves, valores padrão e efeitos
