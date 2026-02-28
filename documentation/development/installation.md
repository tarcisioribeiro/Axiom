# Guia de Instalação

Este guia detalha como configurar o ambiente de desenvolvimento do MindLedger.

## Índice

- [Requisitos do Sistema](#requisitos-do-sistema)
- [Instalação com Docker (Recomendado)](#instalação-com-docker-recomendado)
- [Instalação Local](#instalação-local)
- [Primeiro Acesso](#primeiro-acesso)
- [Verificação da Instalação](#verificação-da-instalação)

## Requisitos do Sistema

### Requisitos Mínimos

- **Sistema Operacional**: Linux, macOS ou Windows 10/11
- **RAM**: 4GB mínimo, 8GB recomendado
- **Espaço em Disco**: 5GB livre
- **Conexão Internet**: Para download de dependências

### Software Necessário

#### Para instalação com Docker (Recomendado)

- **Docker**: versão 20.10 ou superior
- **Docker Compose**: versão 2.0 ou superior
- **Git**: versão 2.0 ou superior

#### Para instalação local

- **Python**: versão 3.11 ou superior
- **Node.js**: versão 18 ou superior
- **npm**: versão 9 ou superior
- **PostgreSQL**: versão 16 ou superior (com extensão pgvector)
- **Redis**: versão 7 ou superior
- **Git**: versão 2.0 ou superior

### Verificando Versões

```bash
# Docker
docker --version
docker-compose --version

# Python (local)
python --version
python3 --version

# Node.js (local)
node --version
npm --version

# PostgreSQL (local)
psql --version

# Redis (local)
redis-server --version

# Git
git --version
```

## Instalação com Docker (Recomendado)

A instalação com Docker é a forma mais simples e consistente de executar o MindLedger em qualquer ambiente.

### Passo 1: Clonar o Repositório

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/MindLedger.git

# Entre no diretório do projeto
cd MindLedger
```

### Passo 2: Configurar Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo (se existir)
# cp .env.example .env

# Crie o arquivo .env na raiz do projeto
touch .env
```

Edite o arquivo `.env` e adicione as seguintes variáveis:

```bash
# Database Configuration
DB_USER=mindledger_user
DB_PASSWORD=sua_senha_segura_aqui
DB_NAME=mindledger_db
DB_HOST=db
DB_PORT=5432

# Django Superuser (criado automaticamente)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mindledger.com
DJANGO_SUPERUSER_PASSWORD=admin123

# Django Secret Key (gere usando o comando abaixo)
SECRET_KEY=sua_secret_key_aqui

# Encryption Key (gere usando o comando abaixo)
ENCRYPTION_KEY=sua_encryption_key_aqui

# Groq API Key para AI Assistant (opcional)
GROQ_API_KEY=sua_groq_api_key_aqui

# Application Ports
API_PORT=39100
FRONTEND_PORT=39101
DB_PORT=39102
REDIS_PORT=6379

# Logging
LOG_FORMAT=json

# Development Settings
DEBUG=True

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:39100
```

### Passo 3: Gerar Chaves de Segurança

**IMPORTANTE**: Você precisa gerar chaves de segurança únicas. Siga as instruções em [Configuração](./configuration.md#gerando-chaves-de-segurança) ou use os comandos rápidos abaixo:

```bash
# Gerar SECRET_KEY (requer Python)
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Gerar ENCRYPTION_KEY (requer cryptography)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copie as chaves geradas e adicione ao arquivo `.env`.

### Passo 4: Iniciar os Containers

```bash
# Inicie todos os serviços em modo detached
docker-compose up -d

# Aguarde os serviços iniciarem (cerca de 30-60 segundos)
# Acompanhe os logs em tempo real
docker-compose logs -f
```

### Passo 5: Executar Migrations

Após os containers estarem rodando e saudáveis:

```bash
# Execute as migrations do banco de dados
docker-compose exec api python manage.py migrate

# Verifique o status das migrations
docker-compose exec api python manage.py showmigrations
```

### Passo 6: Criar Dados Iniciais (Opcional)

```bash
# Configurar permissões de usuários e grupos
docker-compose exec api python manage.py setup_permissions

# Ou crie um superuser manualmente (se não usou DJANGO_SUPERUSER_* no .env)
docker-compose exec api python manage.py createsuperuser
```

### Passo 7: Coletar Arquivos Estáticos (Opcional)

```bash
# Coletar arquivos estáticos para servir via Django Admin
docker-compose exec api python manage.py collectstatic --noinput
```

### Verificar Instalação

Abra seu navegador e acesse:

- **Frontend**: http://localhost:39101
- **Backend API**: http://localhost:39100/api/v1/
- **Django Admin**: http://localhost:39100/admin

Se tudo estiver funcionando, você verá as interfaces carregando corretamente!

## Instalação Local

A instalação local é útil para desenvolvimento com debugging avançado ou quando você não pode/quer usar Docker.

### Passo 1: Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/MindLedger.git
cd MindLedger
```

### Passo 2: Instalar e Configurar PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (com Homebrew)
brew install postgresql

# Iniciar PostgreSQL
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS

# Criar banco de dados
sudo -u postgres psql
```

No shell do PostgreSQL:

```sql
-- Criar usuário
CREATE USER mindledger_user WITH PASSWORD 'sua_senha_aqui';

-- Criar banco de dados
CREATE DATABASE mindledger_db OWNER mindledger_user;

-- Dar privilégios
GRANT ALL PRIVILEGES ON DATABASE mindledger_db TO mindledger_user;

-- Instalar extensão pgvector
\c mindledger_db
CREATE EXTENSION IF NOT EXISTS vector;

-- Sair
\q
```

### Passo 3: Instalar Redis

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# macOS (com Homebrew)
brew install redis
brew services start redis

# Verificar se está rodando
redis-cli ping  # Deve retornar: PONG
```

### Passo 4: Configurar Backend (Django)

```bash
# Entre no diretório da API
cd api

# Crie um ambiente virtual
python3 -m venv venv

# Ative o ambiente virtual
source venv/bin/activate  # Linux/macOS
# OU
venv\Scripts\activate  # Windows

# Atualize pip
pip install --upgrade pip

# Instale as dependências
pip install -r requirements.txt
```

### Passo 5: Configurar Variáveis de Ambiente do Backend

Crie um arquivo `.env` na raiz do projeto (não dentro de `api/`):

```bash
# Database Configuration
DB_USER=mindledger_user
DB_PASSWORD=sua_senha_aqui
DB_NAME=mindledger_db
DB_HOST=localhost
DB_PORT=5432

# Django Superuser
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mindledger.com
DJANGO_SUPERUSER_PASSWORD=admin123

# Django Secret Key
SECRET_KEY=sua_secret_key_aqui

# Encryption Key
ENCRYPTION_KEY=sua_encryption_key_aqui

# Groq API Key (opcional)
GROQ_API_KEY=sua_groq_api_key_aqui

# Application Ports
API_PORT=39100
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_FORMAT=json

# Development
DEBUG=True
```

### Passo 6: Executar Migrations e Criar Superuser

```bash
# Ainda dentro de api/ com venv ativado
python manage.py migrate
python manage.py setup_permissions
python manage.py createsuperuser  # Se não configurou DJANGO_SUPERUSER_*
python manage.py collectstatic --noinput
```

### Passo 7: Iniciar Backend

```bash
# Ainda dentro de api/ com venv ativado
python manage.py runserver 0.0.0.0:39100
```

O backend estará rodando em http://localhost:39100

### Passo 8: Configurar Frontend (React)

Em um **novo terminal**:

```bash
# Entre no diretório do frontend
cd frontend

# Instale as dependências
npm install
```

### Passo 9: Configurar Variáveis de Ambiente do Frontend

Crie um arquivo `.env` em `frontend/`:

```bash
VITE_API_BASE_URL=http://localhost:39100
```

### Passo 10: Iniciar Frontend

```bash
# Ainda dentro de frontend/
npm run dev
```

O frontend estará rodando em http://localhost:3000

### Verificar Instalação Local

Abra seu navegador e acesse:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:39100/api/v1/
- **Django Admin**: http://localhost:39100/admin

## Primeiro Acesso

### Login no Sistema

1. Acesse http://localhost:39101 (Docker) ou http://localhost:3000 (local)
2. Use as credenciais do superuser:
   - **Username**: admin (ou o que você configurou)
   - **Password**: admin123 (ou o que você configurou)

### Django Admin

1. Acesse http://localhost:39100/admin
2. Use as mesmas credenciais do superuser
3. Explore os modelos cadastrados

### Testando o AI Assistant

1. Faça login no sistema
2. Navegue até a seção "AI Assistant"
3. Faça uma pergunta como: "Quais são minhas despesas deste mês?"
4. O sistema deve retornar uma resposta contextualizada

**Nota**: O AI Assistant requer que você tenha configurado o `GROQ_API_KEY`. Se não tiver, obtenha uma chave gratuita em https://console.groq.com/keys

## Verificação da Instalação

### Health Checks

Verifique se todos os serviços estão saudáveis:

```bash
# Com Docker
docker-compose ps

# Todos devem estar "healthy" ou "running"

# Health check endpoints
curl http://localhost:39100/health/    # Database check
curl http://localhost:39100/ready/     # Readiness probe
curl http://localhost:39100/live/      # Liveness probe
```

### Verificar Logs

```bash
# Docker - todos os serviços
docker-compose logs -f

# Docker - apenas backend
docker-compose logs -f api

# Docker - apenas frontend
docker-compose logs -f frontend

# Docker - apenas banco de dados
docker-compose logs -f db

# Local - os logs aparecem no terminal onde você iniciou os serviços
```

### Verificar Banco de Dados

```bash
# Docker
docker-compose exec db psql -U mindledger_user -d mindledger_db

# Local
psql -U mindledger_user -d mindledger_db

# No psql, verifique as tabelas
\dt

# Verifique a extensão pgvector
\dx
```

### Verificar Redis

```bash
# Docker
docker-compose exec redis redis-cli ping

# Local
redis-cli ping

# Deve retornar: PONG
```

### Executar Testes

```bash
# Backend - Docker
docker-compose exec api python manage.py test
docker-compose exec api pytest

# Backend - Local (com venv ativado)
cd api
python manage.py test
pytest

# Frontend
cd frontend
npm run test
npm run lint
npm run build  # Verifica erros de TypeScript
```

## Problemas Comuns

### Docker não inicia

```bash
# Verifique se o Docker está rodando
docker info

# Reinicie o Docker
sudo systemctl restart docker  # Linux
# Ou reinicie o Docker Desktop (Windows/macOS)
```

### Porta já em uso

```bash
# Verifique quais portas estão em uso
sudo netstat -tulpn | grep :39100
sudo netstat -tulpn | grep :39101
sudo netstat -tulpn | grep :39102

# Altere as portas no .env ou pare o processo que está usando
```

### Erro de conexão com banco de dados

```bash
# Docker - verifique se o container db está saudável
docker-compose ps

# Aguarde o healthcheck passar (pode levar até 30 segundos)
docker-compose logs db

# Local - verifique se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list  # macOS
```

### Erro ao instalar dependências Python

```bash
# Certifique-se de usar Python 3.11+
python --version

# Atualize pip
pip install --upgrade pip

# Instale build dependencies (Linux)
sudo apt install python3-dev libpq-dev
```

### Erro ao instalar dependências npm

```bash
# Limpe o cache e reinstale
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

Para mais detalhes sobre solução de problemas, consulte [Troubleshooting](./troubleshooting.md).

## Próximos Passos

Após a instalação bem-sucedida:

1. Leia a [Configuração](./configuration.md) para ajustes avançados
2. Familiarize-se com o [Workflow de Desenvolvimento](./development_workflow.md)
3. Consulte o [Guia de Contribuição](./contribution_guide.md) antes de fazer alterações

---

**Dica**: Use sempre Docker para desenvolvimento. É mais simples, consistente e isola completamente o ambiente.
