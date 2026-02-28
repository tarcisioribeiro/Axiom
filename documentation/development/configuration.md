# Configuração do Ambiente

Este guia detalha todas as configurações necessárias para executar o MindLedger.

## Índice

- [Visão Geral](#visão-geral)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Gerando Chaves de Segurança](#gerando-chaves-de-segurança)
- [Configuração de Portas](#configuração-de-portas)
- [Configuração de Logging](#configuração-de-logging)
- [Configuração do AI Assistant](#configuração-do-ai-assistant)
- [Configuração Avançada](#configuração-avançada)

## Visão Geral

O MindLedger utiliza variáveis de ambiente para configuração. Existem dois níveis:

1. **Raiz do projeto** (`.env`): Configurações compartilhadas (backend, banco de dados, portas)
2. **Frontend** (`frontend/.env`): Configurações específicas do frontend

## Variáveis de Ambiente

### Arquivo .env (Raiz do Projeto)

Este arquivo contém todas as configurações críticas do sistema.

```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================

# Usuário do banco de dados PostgreSQL
DB_USER=mindledger_user

# Senha do banco de dados (use uma senha forte!)
DB_PASSWORD=sua_senha_segura_aqui

# Nome do banco de dados
DB_NAME=mindledger_db

# Host do banco de dados
# Use "db" para Docker, "localhost" para instalação local
DB_HOST=db

# Porta interna do PostgreSQL (sempre 5432 dentro do Docker)
# Para acesso externo, use DB_PORT abaixo
DB_PORT=5432

# ============================================
# DJANGO SUPERUSER
# ============================================

# Superuser criado automaticamente pelo entrypoint.sh
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mindledger.com
DJANGO_SUPERUSER_PASSWORD=admin123

# ⚠️ IMPORTANTE: Mude estas credenciais em produção!

# ============================================
# DJANGO SECRET KEY
# ============================================

# Chave secreta do Django (50+ caracteres)
# Gere usando: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
SECRET_KEY=django-insecure-exemplo-mude-isso

# ============================================
# ENCRYPTION KEY
# ============================================

# Chave Fernet para criptografia de dados sensíveis (44 caracteres base64)
# Gere usando: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=exemplo-mude-isso-ZXhhbXBsZS1tdWRlLWlzc28=

# ⚠️ CRÍTICO: NUNCA mude esta chave após criptografar dados!
# Se mudar, todos os dados criptografados serão IRRECUPERÁVEIS!

# ============================================
# GROQ API CONFIGURATION
# ============================================

# Chave da API Groq para AI Assistant
# Obtenha gratuitamente em: https://console.groq.com/keys
GROQ_API_KEY=gsk_exemplo_mude_isso

# Opcional: Se não configurar, o AI Assistant não funcionará

# ============================================
# APPLICATION PORTS
# ============================================

# Porta externa do backend (acessível no host)
API_PORT=39100

# Porta externa do frontend (acessível no host)
FRONTEND_PORT=39101

# Porta externa do PostgreSQL (acessível no host)
DB_PORT=39102

# Porta do Redis (cache semântico)
REDIS_PORT=6379

# ============================================
# REDIS CONFIGURATION
# ============================================

# URL de conexão do Redis (usado pelo backend)
# Para Docker: redis://redis:6379/0
# Para local: redis://localhost:6379/0
REDIS_URL=redis://redis:6379/0

# ============================================
# LOGGING CONFIGURATION
# ============================================

# Formato dos logs: "json" (estruturado) ou "plain" (texto simples)
LOG_FORMAT=json

# ============================================
# DEVELOPMENT SETTINGS
# ============================================

# Modo debug do Django (DEVE ser False em produção!)
DEBUG=True

# CORS Origins permitidos (para desenvolvimento local)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:39101

# ============================================
# FRONTEND CONFIGURATION
# ============================================

# URL base da API backend (para o frontend)
VITE_API_BASE_URL=http://localhost:39100
```

### Arquivo frontend/.env (Frontend)

```bash
# URL base da API backend
# Deve apontar para onde o backend está rodando
VITE_API_BASE_URL=http://localhost:39100

# Para produção, use a URL pública:
# VITE_API_BASE_URL=https://api.mindledger.com
```

## Gerando Chaves de Segurança

### SECRET_KEY (Django)

A `SECRET_KEY` é usada pelo Django para assinatura de sessões, tokens CSRF e outros recursos de segurança.

**Método 1: Com Python instalado**

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Método 2: Com Docker**

```bash
docker-compose run --rm api python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Método 3: Online (menos seguro)**

Visite: https://djecrety.ir/

**Exemplo de saída:**

```
django-insecure-x8#m@k3^7n!$9h@vb2*w&e5r6t7y8u9i0o-p1q2w3e4r5t6
```

### ENCRYPTION_KEY (Fernet)

A `ENCRYPTION_KEY` é usada para criptografar dados sensíveis (números de cartão, CVVs, senhas armazenadas, etc.).

**⚠️ MUITO IMPORTANTE:**
- Esta chave **NUNCA** deve ser mudada após criptografar dados
- Se perdida ou alterada, **TODOS** os dados criptografados serão **IRRECUPERÁVEIS**
- Faça backup seguro desta chave
- Use uma chave diferente para cada ambiente (dev/staging/prod)

**Método 1: Com Python instalado**

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Método 2: Com Docker**

```bash
docker-compose run --rm api python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Exemplo de saída:**

```
xKz9jR3mN8qL5wV2hY7tG4bF6cX8nM0pQ1wE3rT5yU9iO=
```

### GROQ_API_KEY (AI Assistant)

A chave da API Groq é necessária para o módulo de AI Assistant funcionar.

**Obter chave gratuita:**

1. Acesse https://console.groq.com
2. Crie uma conta (gratuita)
3. Vá em "API Keys"
4. Clique em "Create API Key"
5. Copie a chave gerada

**Exemplo de chave:**

```
gsk_1234567890abcdefghijklmnopqrstuvwxyzABCDEF
```

**Limites do tier gratuito (Groq):**
- 6.000 requests por minuto
- 30.000 requests por dia
- Totalmente suficiente para uso pessoal e desenvolvimento

**Nota**: Os embeddings são gerados **localmente** usando sentence-transformers, então não há custo adicional de API para essa parte.

## Configuração de Portas

O MindLedger usa as seguintes portas por padrão:

| Serviço | Porta Padrão | Variável | Customizável |
|---------|--------------|----------|--------------|
| Frontend | 39101 | `FRONTEND_PORT` | ✅ Sim |
| Backend API | 39100 | `API_PORT` | ✅ Sim |
| PostgreSQL | 39102 | `DB_PORT` | ✅ Sim |
| Redis | 6379 | `REDIS_PORT` | ✅ Sim |

### Mudando Portas

Edite o `.env`:

```bash
# Exemplo: mudando para portas alternativas
API_PORT=8000
FRONTEND_PORT=3000
DB_PORT=5435
REDIS_PORT=6380
```

**Importante**: Se mudar `API_PORT`, também mude `VITE_API_BASE_URL` no frontend:

```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

### Verificando Portas em Uso

```bash
# Linux
sudo netstat -tulpn | grep :39100

# macOS
lsof -i :39100

# Windows
netstat -ano | findstr :39100
```

## Configuração de Logging

O MindLedger suporta dois formatos de logging:

### JSON (Estruturado)

Ideal para produção, integração com ferramentas de análise de logs.

```bash
LOG_FORMAT=json
```

**Exemplo de log JSON:**

```json
{
  "timestamp": "2026-01-12T10:30:45.123Z",
  "level": "INFO",
  "logger": "django.request",
  "message": "GET /api/v1/accounts/",
  "status_code": 200,
  "user_id": 1
}
```

### Plain (Texto Simples)

Ideal para desenvolvimento, fácil de ler no terminal.

```bash
LOG_FORMAT=plain
```

**Exemplo de log plain:**

```
2026-01-12 10:30:45 INFO [django.request] GET /api/v1/accounts/ - 200
```

### Níveis de Log

Configure o nível de log em `api/app/settings.py`:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'level': 'DEBUG',  # DEBUG, INFO, WARNING, ERROR, CRITICAL
            # ...
        },
    },
}
```

### Visualizando Logs

```bash
# Docker - todos os serviços
docker-compose logs -f

# Docker - apenas erros
docker-compose logs -f | grep ERROR

# Docker - últimas 100 linhas
docker-compose logs --tail=100

# Docker - serviço específico
docker-compose logs -f api
```

## Configuração do AI Assistant

O AI Assistant usa uma arquitetura RAG (Retrieval Augmented Generation) com embeddings locais.

### Componentes

1. **Embeddings**: Gerados localmente com sentence-transformers (`all-MiniLM-L6-v2`)
2. **Armazenamento**: PostgreSQL com pgvector
3. **Cache**: Redis para resultados de busca
4. **LLM**: Groq API (`llama-3.3-70b-versatile`)

### Configuração Básica

```bash
# .env
GROQ_API_KEY=sua_chave_aqui
REDIS_URL=redis://redis:6379/0
```

### Configuração Avançada

Edite `api/ai_assistant/config.py`:

```python
# Modelo de embeddings (local)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # 384 dimensões, rápido

# Modelo de LLM (Groq)
LLM_MODEL = "llama-3.3-70b-versatile"

# Número de resultados para contexto
TOP_K_RESULTS = 5

# Cache TTL (segundos)
CACHE_TTL = 3600  # 1 hora

# Tamanho máximo do contexto
MAX_CONTEXT_LENGTH = 4096
```

### Testando o AI Assistant

```bash
# Docker
docker-compose exec api python manage.py shell

# No shell Python
from ai_assistant.services.rag_service import RAGService

rag = RAGService()
response = rag.ask("Quais são minhas despesas deste mês?")
print(response)
```

### Monitoramento

```bash
# Verificar logs do AI Assistant
docker-compose logs -f api | grep "ai_assistant"

# Verificar cache Redis
docker-compose exec redis redis-cli
> KEYS *
> GET ai:embedding:*
```

## Configuração Avançada

### CORS (Cross-Origin Resource Sharing)

Para permitir requisições do frontend:

```python
# api/app/settings.py

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",      # Vite dev server
    "http://localhost:39101",     # Frontend Docker
    "https://mindledger.com",    # Produção
]

CORS_ALLOW_CREDENTIALS = True  # Necessário para cookies HttpOnly
```

### Cookies HttpOnly

Configuração de autenticação via cookies:

```python
# api/app/settings.py

SIMPLE_JWT = {
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_SECURE': False,  # True em produção (HTTPS)
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',
    'AUTH_COOKIE_PATH': '/',
}
```

### Database Connection Pooling

Para otimizar conexões ao banco:

```python
# api/app/settings.py

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 600,  # 10 minutos
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000'  # 30 segundos
        }
    }
}
```

### Configuração de Produção

**⚠️ Checklist de Produção:**

```bash
# .env (produção)
DEBUG=False
SECRET_KEY=chave_super_secreta_com_50_caracteres_no_minimo
ENCRYPTION_KEY=chave_fernet_diferente_do_desenvolvimento
GROQ_API_KEY=chave_de_producao

# HTTPS obrigatório
AUTH_COOKIE_SECURE=True

# Domínios permitidos
ALLOWED_HOSTS=mindledger.com,www.mindledger.com
CORS_ALLOWED_ORIGINS=https://mindledger.com

# Banco robusto
DB_HOST=banco-producao.rds.amazonaws.com
DB_PORT=5432
```

```python
# api/app/settings.py (produção)

ALLOWED_HOSTS = ['mindledger.com', 'www.mindledger.com']
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
```

## Validando Configuração

### Script de Validação

Crie um script `validate_config.py`:

```python
import os
import sys

def validate():
    errors = []

    # Verificar variáveis obrigatórias
    required_vars = [
        'DB_USER', 'DB_PASSWORD', 'DB_NAME',
        'SECRET_KEY', 'ENCRYPTION_KEY'
    ]

    for var in required_vars:
        if not os.getenv(var):
            errors.append(f"❌ {var} não está definido")

    # Validar SECRET_KEY
    secret_key = os.getenv('SECRET_KEY', '')
    if len(secret_key) < 50:
        errors.append("❌ SECRET_KEY deve ter pelo menos 50 caracteres")

    # Validar ENCRYPTION_KEY
    encryption_key = os.getenv('ENCRYPTION_KEY', '')
    if len(encryption_key) != 44:
        errors.append("❌ ENCRYPTION_KEY deve ter exatamente 44 caracteres")

    # Validar DEBUG em produção
    if os.getenv('DEBUG', 'False') == 'True':
        errors.append("⚠️ DEBUG=True não deve ser usado em produção")

    if errors:
        print("\n".join(errors))
        sys.exit(1)
    else:
        print("✅ Todas as configurações estão válidas!")

if __name__ == '__main__':
    validate()
```

Execute:

```bash
# Docker
docker-compose exec api python validate_config.py

# Local
cd api
python validate_config.py
```

## Próximos Passos

Agora que seu ambiente está configurado:

1. Aprenda os [Comandos do Dia a Dia](./development_workflow.md)
2. Leia o [Guia de Contribuição](./contribution_guide.md)
3. Consulte [Troubleshooting](./troubleshooting.md) se encontrar problemas

---

**Dica**: Mantenha backups seguros do seu `.env`, especialmente da `ENCRYPTION_KEY`!
