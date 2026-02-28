# Solução de Problemas

Este guia ajuda a diagnosticar e resolver problemas comuns no MindLedger.

## Índice

- [Problemas com Docker](#problemas-com-docker)
- [Erros de Banco de Dados](#erros-de-banco-de-dados)
- [Conflitos de Migrations](#conflitos-de-migrations)
- [Problemas de Autenticação](#problemas-de-autenticação)
- [Erros de Criptografia](#erros-de-criptografia)
- [Problemas de CORS](#problemas-de-cors)
- [Troubleshooting do AI Assistant](#troubleshooting-do-ai-assistant)
- [Problemas de Performance](#problemas-de-performance)
- [Erros de Build](#erros-de-build)

## Problemas com Docker

### Container não inicia

**Sintomas:**
```bash
docker-compose ps
# Container está "Exit 1" ou "Restarting"
```

**Diagnóstico:**
```bash
# Ver logs do container
docker-compose logs api
docker-compose logs db
docker-compose logs frontend

# Ver logs em tempo real
docker-compose logs -f
```

**Soluções:**

1. **Verificar se há erros nos logs**
   ```bash
   docker-compose logs api | grep -i error
   ```

2. **Reconstruir containers**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

3. **Limpar volumes (⚠️ apaga dados)**
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

4. **Verificar .env**
   ```bash
   cat .env | grep -v "^#" | grep -v "^$"
   # Todas as variáveis críticas devem estar definidas
   ```

### Porta já em uso

**Sintomas:**
```
Error: Bind for 0.0.0.0:39100 failed: port is already allocated
```

**Diagnóstico:**
```bash
# Linux/macOS
sudo lsof -i :39100
sudo netstat -tulpn | grep 39100

# Windows
netstat -ano | findstr :39100
```

**Soluções:**

1. **Parar o processo que está usando a porta**
   ```bash
   # Linux/macOS
   kill -9 <PID>

   # Windows
   taskkill /PID <PID> /F
   ```

2. **Mudar a porta no .env**
   ```bash
   # .env
   API_PORT=8000  # Em vez de 39100
   FRONTEND_PORT=3000
   DB_PORT=5435
   ```

3. **Parar todos os containers e tentar novamente**
   ```bash
   docker-compose down
   docker ps -a  # Verificar se não há containers órfãos
   docker-compose up -d
   ```

### Container "unhealthy"

**Sintomas:**
```bash
docker-compose ps
# Status: "unhealthy"
```

**Diagnóstico:**
```bash
# Ver health check logs
docker inspect mindledger-api | grep -A 10 "Health"
docker inspect mindledger-db | grep -A 10 "Health"
```

**Soluções:**

1. **Aguardar start period**
   ```bash
   # Containers podem levar até 40s para ficarem healthy
   docker-compose logs -f db
   # Aguarde: "database system is ready to accept connections"
   ```

2. **Verificar dependências**
   ```bash
   # API depende do DB estar healthy
   docker-compose restart api
   ```

3. **Testar health check manualmente**
   ```bash
   # Database
   docker-compose exec db pg_isready -U mindledger_user -d mindledger_db

   # API
   curl http://localhost:39100/health/
   ```

### Volumes com permissões incorretas

**Sintomas:**
```
PermissionError: [Errno 13] Permission denied
```

**Soluções:**

```bash
# Linux - ajustar permissões
sudo chown -R $USER:$USER api/media api/logs api/staticfiles

# Ou rodar container como seu usuário
docker-compose exec -u $(id -u):$(id -g) api bash
```

### Docker out of disk space

**Sintomas:**
```
no space left on device
```

**Diagnóstico:**
```bash
# Ver uso de disco do Docker
docker system df

# Ver containers/images/volumes
docker ps -a
docker images
docker volume ls
```

**Soluções:**

```bash
# Limpar containers parados
docker container prune

# Limpar images não utilizadas
docker image prune -a

# Limpar volumes não utilizados (⚠️ cuidado!)
docker volume prune

# Limpar tudo (⚠️ apaga tudo não utilizado!)
docker system prune -a --volumes
```

## Erros de Banco de Dados

### Conexão recusada

**Sintomas:**
```
django.db.utils.OperationalError: could not connect to server: Connection refused
```

**Diagnóstico:**
```bash
# Verificar se container db está rodando
docker-compose ps db

# Verificar logs do PostgreSQL
docker-compose logs db
```

**Soluções:**

1. **Aguardar DB inicializar**
   ```bash
   docker-compose logs -f db
   # Aguarde: "database system is ready to accept connections"
   ```

2. **Verificar credenciais no .env**
   ```bash
   # .env
   DB_USER=mindledger_user
   DB_PASSWORD=sua_senha
   DB_NAME=mindledger_db
   DB_HOST=db  # "db" para Docker, "localhost" para local
   ```

3. **Testar conexão manualmente**
   ```bash
   docker-compose exec db psql -U mindledger_user -d mindledger_db
   # Se funcionar, problema é na config do Django
   ```

4. **Recriar banco de dados**
   ```bash
   docker-compose down
   docker volume rm mindledger_postgres_data
   docker-compose up -d
   ```

### Tabelas não existem

**Sintomas:**
```
django.db.utils.ProgrammingError: relation "accounts_account" does not exist
```

**Solução:**
```bash
# Executar migrations
docker-compose exec api python manage.py migrate

# Verificar status
docker-compose exec api python manage.py showmigrations
```

### Extensão pgvector não instalada

**Sintomas:**
```
django.db.utils.ProgrammingError: type "vector" does not exist
```

**Solução:**
```bash
# Acessar PostgreSQL
docker-compose exec db psql -U mindledger_user -d mindledger_db

# No psql, instalar extensão
CREATE EXTENSION IF NOT EXISTS vector;
\q

# Executar migrations novamente
docker-compose exec api python manage.py migrate
```

### Banco está bloqueado

**Sintomas:**
```
database is locked
```

**Soluções:**

```bash
# Verificar conexões ativas
docker-compose exec db psql -U mindledger_user -d mindledger_db -c "
  SELECT pid, usename, application_name, state
  FROM pg_stat_activity
  WHERE datname = 'mindledger_db';
"

# Matar conexões ociosas (⚠️ cuidado em produção!)
docker-compose exec db psql -U mindledger_user -d mindledger_db -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'mindledger_db' AND pid <> pg_backend_pid();
"
```

### Queries muito lentas

**Diagnóstico:**
```bash
# Habilitar log de queries lentas
docker-compose exec db psql -U mindledger_user -d mindledger_db -c "
  ALTER DATABASE mindledger_db SET log_min_duration_statement = 1000;
"

# Ver queries lentas nos logs
docker-compose logs db | grep "duration"
```

**Soluções:**

1. **Adicionar índices**
   ```python
   # Em models.py
   class Account(models.Model):
       user = models.ForeignKey(User, on_delete=models.CASCADE)

       class Meta:
           indexes = [
               models.Index(fields=['user', 'created_at']),
           ]
   ```

2. **Usar select_related / prefetch_related**
   ```python
   # ❌ RUIM - N+1 queries
   accounts = Account.objects.all()
   for account in accounts:
       print(account.user.username)  # Query para cada account

   # ✅ BOM - 1 query
   accounts = Account.objects.select_related('user').all()
   ```

3. **Analisar query plan**
   ```bash
   docker-compose exec api python manage.py shell
   ```
   ```python
   from accounts.models import Account
   print(Account.objects.filter(user_id=1).explain())
   ```

## Conflitos de Migrations

### Migration já existe

**Sintomas:**
```
django.db.migrations.exceptions.InconsistentMigrationHistory:
Migration accounts.0002_auto_20260112_1234 is applied before its dependency
```

**Soluções:**

1. **Fake migration (se já aplicada manualmente)**
   ```bash
   docker-compose exec api python manage.py migrate accounts --fake 0002
   ```

2. **Resetar migrations (⚠️ perde dados!)**
   ```bash
   # Remover arquivos de migration (exceto __init__.py)
   rm api/accounts/migrations/0*.py

   # Recriar migrations
   docker-compose exec api python manage.py makemigrations
   docker-compose exec api python manage.py migrate --fake-initial
   ```

3. **Squash migrations (avançado)**
   ```bash
   docker-compose exec api python manage.py squashmigrations accounts 0001 0010
   ```

### Conflitos de merge em migrations

**Sintomas:**
```
Conflicting migrations detected; multiple leaf nodes in the migration graph
```

**Solução:**
```bash
# Django cria migration de merge automaticamente
docker-compose exec api python manage.py makemigrations --merge
docker-compose exec api python manage.py migrate
```

### Tabela já existe

**Sintomas:**
```
django.db.utils.ProgrammingError: relation "accounts_account" already exists
```

**Solução:**
```bash
# Fake initial migration
docker-compose exec api python manage.py migrate --fake-initial
```

## Problemas de Autenticação

### Token inválido/expirado

**Sintomas:**
```
401 Unauthorized
{"detail": "Given token not valid for any token type"}
```

**Diagnóstico:**
```bash
# Verificar cookies no navegador (F12 > Application > Cookies)
# Deve haver: access_token, refresh_token, user_data, user_permissions
```

**Soluções:**

1. **Limpar cookies**
   ```javascript
   // Console do navegador
   document.cookie.split(";").forEach(c => {
     document.cookie = c.trim().split("=")[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
   });
   ```

2. **Fazer logout e login novamente**

3. **Verificar configuração de JWT**
   ```python
   # api/app/settings.py
   SIMPLE_JWT = {
       'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
       'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
       'ROTATE_REFRESH_TOKENS': True,
       'BLACKLIST_AFTER_ROTATION': True,
   }
   ```

### Loop infinito de refresh

**Sintomas:**
- Requisições infinitas para `/api/v1/auth/refresh/`
- Console cheio de erros 401

**Solução:**

Verificar `api-client.ts`:

```typescript
// ✅ BOM - não tenta refresh em endpoints de auth
if (error.config.url?.includes('/auth/')) {
  return Promise.reject(error);
}

// Tenta refresh apenas se não for endpoint de auth
const newAccessToken = await refreshAccessToken();
```

### CSRF token missing

**Sintomas:**
```
403 Forbidden
{"detail": "CSRF Failed: CSRF token missing or incorrect."}
```

**Soluções:**

1. **Desabilitar CSRF para API (já configurado)**
   ```python
   # api/app/settings.py
   REST_FRAMEWORK = {
       'DEFAULT_AUTHENTICATION_CLASSES': [
           'rest_framework_simplejwt.authentication.JWTAuthentication',
       ],
   }
   ```

2. **Verificar que está usando JWT, não session auth**

### Usuário não tem permissão

**Sintomas:**
```
403 Forbidden
{"detail": "You do not have permission to perform this action."}
```

**Diagnóstico:**
```bash
# Verificar permissões do usuário
docker-compose exec api python manage.py shell
```
```python
from django.contrib.auth.models import User
user = User.objects.get(username='admin')
print(user.get_all_permissions())
print(user.groups.all())
```

**Solução:**
```bash
# Configurar permissões
docker-compose exec api python manage.py setup_permissions

# Ou adicionar manualmente
docker-compose exec api python manage.py shell
```
```python
from django.contrib.auth.models import User, Permission
user = User.objects.get(username='admin')
user.is_staff = True
user.is_superuser = True
user.save()
```

## Erros de Criptografia

### InvalidToken ao descriptografar

**Sintomas:**
```
cryptography.fernet.InvalidToken
```

**Causas:**
1. `ENCRYPTION_KEY` foi alterada
2. Dados foram corrompidos
3. Chave incorreta no .env

**⚠️ IMPORTANTE:** Se a chave foi perdida/alterada, dados são **IRRECUPERÁVEIS**!

**Soluções:**

1. **Verificar .env**
   ```bash
   cat .env | grep ENCRYPTION_KEY
   # Deve ter exatamente 44 caracteres
   ```

2. **Restaurar backup da chave**
   ```bash
   # Se você fez backup do .env, restaure
   # Não há outra forma de recuperar dados criptografados!
   ```

3. **Resetar dados (⚠️ perde tudo criptografado)**
   ```bash
   # Opção nuclear: dropar tabelas afetadas
   docker-compose exec db psql -U mindledger_user -d mindledger_db
   ```
   ```sql
   TRUNCATE credit_cards_creditcard CASCADE;
   TRUNCATE security_password CASCADE;
   ```

### ENCRYPTION_KEY inválida

**Sintomas:**
```
ValueError: Fernet key must be 32 url-safe base64-encoded bytes
```

**Solução:**
```bash
# Gerar nova chave válida
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Adicionar ao .env
# ⚠️ Só faça isso se ainda NÃO houver dados criptografados!
```

## Problemas de CORS

### Blocked by CORS policy

**Sintomas:**
```
Access to XMLHttpRequest at 'http://localhost:39100/api/v1/accounts/'
from origin 'http://localhost:3000' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

**Diagnóstico:**
```bash
# Verificar configuração CORS
docker-compose exec api python manage.py shell
```
```python
from django.conf import settings
print(settings.CORS_ALLOWED_ORIGINS)
print(settings.CORS_ALLOW_CREDENTIALS)
```

**Soluções:**

1. **Adicionar origem ao .env**
   ```bash
   # .env
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:39101
   ```

2. **Verificar settings.py**
   ```python
   # api/app/settings.py
   CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
   CORS_ALLOW_CREDENTIALS = True  # Necessário para cookies HttpOnly
   ```

3. **Reiniciar API**
   ```bash
   docker-compose restart api
   ```

### Cookies não sendo enviados

**Sintomas:**
- Cookies aparecem no navegador
- Mas não são enviados nas requisições

**Soluções:**

1. **Verificar withCredentials no axios**
   ```typescript
   // frontend/src/services/api-client.ts
   const apiClient = axios.create({
     baseURL: import.meta.env.VITE_API_BASE_URL,
     withCredentials: true,  // ✅ Deve estar true
   });
   ```

2. **Verificar SameSite**
   ```python
   # api/app/settings.py
   SIMPLE_JWT = {
       'AUTH_COOKIE_SAMESITE': 'Lax',  # 'Strict' pode bloquear
       'AUTH_COOKIE_SECURE': False,    # True apenas em HTTPS
   }
   ```

3. **Verificar domínios**
   - Frontend e Backend devem estar no mesmo domínio (localhost)
   - Ou configurar CORS corretamente para cross-origin

## Troubleshooting do AI Assistant

### Groq API key inválida

**Sintomas:**
```
groq.APIError: Invalid API key
```

**Solução:**
```bash
# Verificar key no .env
cat .env | grep GROQ_API_KEY

# Obter nova key em: https://console.groq.com/keys
# Adicionar ao .env
GROQ_API_KEY=gsk_sua_chave_aqui

# Reiniciar API
docker-compose restart api
```

### Erro ao gerar embeddings

**Sintomas:**
```
OSError: Can't load tokenizer for 'sentence-transformers/all-MiniLM-L6-v2'
```

**Soluções:**

1. **Verificar conexão com internet** (para download inicial do modelo)

2. **Baixar modelo manualmente**
   ```bash
   docker-compose exec api python -c "
   from sentence_transformers import SentenceTransformer
   model = SentenceTransformer('all-MiniLM-L6-v2')
   print('Modelo baixado com sucesso!')
   "
   ```

3. **Limpar cache e tentar novamente**
   ```bash
   docker-compose exec api rm -rf /root/.cache/torch
   docker-compose restart api
   ```

### Redis connection failed

**Sintomas:**
```
redis.exceptions.ConnectionError: Error connecting to Redis
```

**Diagnóstico:**
```bash
# Verificar se Redis está rodando
docker-compose ps redis

# Testar conexão
docker-compose exec redis redis-cli ping
# Deve retornar: PONG
```

**Solução:**
```bash
# Reiniciar Redis
docker-compose restart redis

# Verificar URL no .env
cat .env | grep REDIS_URL
# Deve ser: redis://redis:6379/0
```

### AI Assistant muito lento

**Diagnóstico:**
```bash
# Verificar logs para identificar gargalo
docker-compose logs -f api | grep "ai_assistant"

# Verificar uso de CPU/memória
docker stats mindledger-api
```

**Soluções:**

1. **Reduzir número de resultados**
   ```python
   # api/ai_assistant/config.py
   TOP_K_RESULTS = 3  # Em vez de 5
   ```

2. **Aumentar cache TTL**
   ```python
   # api/ai_assistant/config.py
   CACHE_TTL = 3600  # 1 hora
   ```

3. **Verificar se cache está funcionando**
   ```bash
   docker-compose exec redis redis-cli
   > KEYS ai:*
   > TTL ai:embedding:12345
   ```

### Respostas irrelevantes

**Causa:** Poucos dados para contexto ou embeddings não indexados

**Soluções:**

1. **Regenerar embeddings**
   ```bash
   docker-compose exec api python manage.py shell
   ```
   ```python
   from ai_assistant.services.embedding_service import EmbeddingService
   service = EmbeddingService()
   service.generate_all_embeddings()
   ```

2. **Adicionar mais dados**
   - Cadastre mais transações, senhas, livros
   - Quanto mais dados, melhor o contexto

3. **Ajustar similaridade threshold**
   ```python
   # api/ai_assistant/config.py
   SIMILARITY_THRESHOLD = 0.5  # Reduzir para incluir mais resultados
   ```

## Problemas de Performance

### Frontend lento para carregar

**Diagnóstico:**
```bash
# Verificar tamanho do bundle
cd frontend
npm run build
ls -lh dist/assets/*.js
```

**Soluções:**

1. **Code splitting**
   ```typescript
   // Usar lazy loading
   import { lazy, Suspense } from 'react';

   const AccountsPage = lazy(() => import('./pages/AccountsPage'));

   <Suspense fallback={<Loading />}>
     <AccountsPage />
   </Suspense>
   ```

2. **Otimizar imagens**
   - Use formatos modernos (WebP)
   - Comprima imagens grandes
   - Use lazy loading para imagens

3. **Remover dependências não utilizadas**
   ```bash
   npm uninstall pacote-nao-usado
   ```

### Backend consumindo muita memória

**Diagnóstico:**
```bash
docker stats mindledger-api
# Ver MEMORY coluna
```

**Soluções:**

1. **Limitar connection pooling**
   ```python
   # api/app/settings.py
   DATABASES = {
       'default': {
           'CONN_MAX_AGE': 60,  # Reduzir de 600 para 60
       }
   }
   ```

2. **Desabilitar debug em produção**
   ```bash
   # .env
   DEBUG=False
   ```

3. **Limitar workers do Gunicorn (produção)**
   ```python
   # api/gunicorn.conf.py
   workers = 2  # Em vez de 4
   ```

## Erros de Build

### Falha ao instalar dependências Python

**Sintomas:**
```
ERROR: Could not find a version that satisfies the requirement
```

**Soluções:**

1. **Atualizar pip**
   ```bash
   docker-compose exec api pip install --upgrade pip
   ```

2. **Limpar cache**
   ```bash
   docker-compose exec api pip cache purge
   docker-compose up -d --build api
   ```

3. **Verificar Python version**
   ```bash
   docker-compose exec api python --version
   # Deve ser 3.11+
   ```

### Falha ao instalar dependências npm

**Sintomas:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
```

**Soluções:**

1. **Limpar cache**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

2. **Usar --legacy-peer-deps**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Verificar Node version**
   ```bash
   node --version
   # Deve ser 18+
   ```

### Build muito lento

**Soluções:**

1. **Usar .dockerignore**
   ```bash
   # api/.dockerignore
   __pycache__
   *.pyc
   *.pyo
   .git
   venv

   # frontend/.dockerignore
   node_modules
   dist
   .git
   ```

2. **Multi-stage builds (já implementado)**

3. **Build cache**
   ```bash
   # Usar BuildKit
   DOCKER_BUILDKIT=1 docker-compose build
   ```

## Logs de Debug Úteis

### Habilitar debug SQL

```python
# api/app/settings.py
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',  # Mostra todas as queries SQL
        },
    },
}
```

### Habilitar debug de requests

```python
# api/app/settings.py
LOGGING = {
    'loggers': {
        'django.request': {
            'level': 'DEBUG',
        },
    },
}
```

### Monitorar em tempo real

```bash
# Terminal 1: Logs da API
docker-compose logs -f api

# Terminal 2: Logs do DB
docker-compose logs -f db

# Terminal 3: Stats de recursos
watch -n 1 'docker stats --no-stream mindledger-api mindledger-db'
```

## Quando Pedir Ajuda

Se nada disso resolver:

1. **Coletar informações**
   ```bash
   # Versões
   docker --version
   docker-compose --version
   python --version
   node --version

   # Logs
   docker-compose logs > logs.txt

   # Status
   docker-compose ps
   docker stats --no-stream
   ```

2. **Abrir issue no GitHub**
   - Descreva o problema
   - Cole logs relevantes
   - Informe versões
   - Passos para reproduzir

3. **Documentar a solução**
   - Quando resolver, adicione à esta documentação
   - Ajude outros com o mesmo problema

---

**Dica**: Mantenha sempre logs (`docker-compose logs -f`) abertos durante desenvolvimento!
