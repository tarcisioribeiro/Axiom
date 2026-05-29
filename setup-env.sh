#!/bin/bash

# ============================================================================
# Axiom - Script de Configuração do Ambiente
# ============================================================================
# Este script cria o arquivo .env interativamente ou automaticamente
# Uso:
#   ./setup-env.sh           # Modo interativo
#   ./setup-env.sh --auto    # Modo automático (gera valores padrão)
#   ./setup-env.sh --help    # Mostra ajuda
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Função de ajuda
show_help() {
    cat << EOF
Axiom - Script de Configuração do Ambiente

Uso: ./setup-env.sh [OPÇÃO]

Opções:
    (sem opção)     Modo interativo - pergunta valores um por um
    --auto          Modo automático - gera valores padrão com chaves seguras
    --help          Mostra esta mensagem de ajuda

Exemplos:
    ./setup-env.sh              # Configuração interativa
    ./setup-env.sh --auto       # Configuração automática
    ./setup-env.sh --help       # Mostra ajuda

O script irá:
    1. Verificar se Python 3 está instalado
    2. Gerar chaves de segurança (SECRET_KEY e ENCRYPTION_KEY)
    3. Criar o arquivo .env com as configurações fornecidas
    4. Validar a chave de criptografia

EOF
}

# Verificar argumentos
MODE="interactive"
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    show_help
    exit 0
elif [ "$1" == "--auto" ] || [ "$1" == "-a" ]; then
    MODE="auto"
fi

# Banner
print_header "Axiom - Configuração do Ambiente"

# Verificar se .env já existe
if [ -f ".env" ]; then
    print_warning "Arquivo .env já existe!"
    read -p "Deseja sobrescrever? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Operação cancelada."
        exit 0
    fi
    print_warning "Criando backup do .env existente..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    print_success "Backup criado!"
fi

# Verificar se Python está instalado
print_info "Verificando dependências..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 não encontrado!"
    print_info "Instale Python 3 para continuar: sudo apt install python3"
    exit 1
fi
print_success "Python 3 encontrado"

# Verificar se cryptography está instalada
if ! python3 -c "import cryptography" &> /dev/null; then
    print_warning "Biblioteca 'cryptography' não encontrada"
    print_info "Instalando cryptography..."
    pip3 install cryptography --quiet
fi

# Escapa $ como $$ para compatibilidade com Docker Compose (.env interpreta $ como variável)
esc() {
    printf '%s' "$1" | sed 's/\$/\$\$/g'
}

# Função para gerar SECRET_KEY do Django
generate_secret_key() {
    python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)') for i in range(50)))"
}

# Função para gerar ENCRYPTION_KEY (Fernet)
generate_encryption_key() {
    python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
}

# Função para validar se uma chave Fernet é válida
validate_fernet_key() {
    python3 -c "from cryptography.fernet import Fernet; import sys;
try:
    Fernet('$1'.encode())
    sys.exit(0)
except:
    sys.exit(1)"
}

print_header "Configuração do Banco de Dados"

# Modo automático
if [ "$MODE" == "auto" ]; then
    print_info "Modo automático ativado - usando valores padrão..."

    DB_HOST="db"
    DB_PORT="39102"
    DB_NAME="axiom_db"
    DB_USER="axiom_user"
    DB_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-25)"

    DJANGO_SUPERUSER_USERNAME="admin"
    DJANGO_SUPERUSER_EMAIL="admin@axiom.local"
    DJANGO_SUPERUSER_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-20)"

    SECRET_KEY="$(generate_secret_key)"
    ENCRYPTION_KEY="$(generate_encryption_key)"

    DEBUG="True"
    ALLOWED_HOSTS="localhost,127.0.0.1"
    CORS_ALLOWED_ORIGINS="http://localhost:39101,http://127.0.0.1:39101"

    LOG_FORMAT="json"
    LOG_LEVEL="INFO"

    API_PORT="39100"
    FRONTEND_PORT="39101"
    VITE_API_BASE_URL="http://localhost:39100"

    SECURE_SSL_REDIRECT="False"
    SESSION_COOKIE_SECURE="False"
    CSRF_COOKIE_SECURE="False"

    BACKUP_DIR="./backups"
    BACKUP_ENCRYPTION_KEY="$(openssl rand -base64 48 | tr -d /=+ | cut -c1-40)"
    ENABLE_DEBUG_TOOLBAR="False"
    SHOW_SQL_QUERIES="False"

    MINIO_ROOT_USER="axiom"
    MINIO_ROOT_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-25)"
    MINIO_BUCKET_NAME="axiom"
    MINIO_ENDPOINT="minio:9000"
    MINIO_EXTERNAL_ENDPOINT="localhost:39105"
    MINIO_USE_SSL="false"
    MINIO_PORT="39105"
    MINIO_CONSOLE_PORT="39106"

    REDIS_PASSWORD="$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")"

    # Email — deixar como placeholder; o usuário deve configurar manualmente
    EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend"
    EMAIL_HOST="smtp.example.com"
    EMAIL_PORT="587"
    EMAIL_USE_TLS="True"
    EMAIL_USE_SSL="False"
    EMAIL_HOST_USER="your-smtp-username@example.com"
    EMAIL_HOST_PASSWORD="your-smtp-password-here"
    DEFAULT_FROM_EMAIL="Axiom <noreply@axiom.app>"
    SITE_URL="http://localhost:39101"

    GUNICORN_WORKERS="4"
    GUNICORN_TIMEOUT="120"

else
    # Modo interativo
    read -p "Host do banco de dados [db]: " DB_HOST
    DB_HOST=${DB_HOST:-db}

    read -p "Porta do banco de dados [39102]: " DB_PORT
    DB_PORT=${DB_PORT:-39102}

    read -p "Nome do banco de dados [axiom_db]: " DB_NAME
    DB_NAME=${DB_NAME:-axiom_db}

    read -p "Usuário do banco de dados [axiom_user]: " DB_USER
    DB_USER=${DB_USER:-axiom_user}

    read -sp "Senha do banco de dados: " DB_PASSWORD
    echo
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-25)"
        print_info "Senha gerada automaticamente"
    fi

    print_header "Configuração do Django Superuser"

    read -p "Username do superusuário [admin]: " DJANGO_SUPERUSER_USERNAME
    DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-admin}

    read -p "Email do superusuário [admin@axiom.local]: " DJANGO_SUPERUSER_EMAIL
    DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-admin@axiom.local}

    read -sp "Senha do superusuário: " DJANGO_SUPERUSER_PASSWORD
    echo
    if [ -z "$DJANGO_SUPERUSER_PASSWORD" ]; then
        DJANGO_SUPERUSER_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-20)"
        print_info "Senha gerada automaticamente"
    fi

    print_header "Gerando Chaves de Segurança"

    print_info "Gerando SECRET_KEY do Django..."
    SECRET_KEY="$(generate_secret_key)"
    print_success "SECRET_KEY gerada"

    print_info "Gerando ENCRYPTION_KEY (Fernet)..."
    ENCRYPTION_KEY="$(generate_encryption_key)"
    print_success "ENCRYPTION_KEY gerada"

    print_header "Configuração da Aplicação"

    read -p "Modo debug [True]: " DEBUG
    DEBUG=${DEBUG:-True}

    read -p "Hosts permitidos [localhost,127.0.0.1]: " ALLOWED_HOSTS
    ALLOWED_HOSTS=${ALLOWED_HOSTS:-localhost,127.0.0.1}

    read -p "Origens CORS [http://localhost:39101,http://127.0.0.1:39101]: " CORS_ALLOWED_ORIGINS
    CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost:39101,http://127.0.0.1:39101}

    read -p "Porta da API [39100]: " API_PORT
    API_PORT=${API_PORT:-39100}

    read -p "Porta do Frontend [39101]: " FRONTEND_PORT
    FRONTEND_PORT=${FRONTEND_PORT:-39101}

    VITE_API_BASE_URL="http://localhost:${API_PORT}"

    LOG_FORMAT="json"
    LOG_LEVEL="INFO"
    SECURE_SSL_REDIRECT="False"
    SESSION_COOKIE_SECURE="False"
    CSRF_COOKIE_SECURE="False"
    BACKUP_DIR="./backups"
    BACKUP_ENCRYPTION_KEY="$(openssl rand -base64 48 | tr -d /=+ | cut -c1-40)"
    print_info "BACKUP_ENCRYPTION_KEY gerada automaticamente (salve em local seguro!)"
    ENABLE_DEBUG_TOOLBAR="False"
    SHOW_SQL_QUERIES="False"

    print_header "Configuração do MinIO (Object Storage)"

    read -p "Endpoint interno do MinIO [minio:9000]: " MINIO_ENDPOINT
    MINIO_ENDPOINT=${MINIO_ENDPOINT:-minio:9000}

    read -p "Endpoint externo do MinIO [localhost:39105]: " MINIO_EXTERNAL_ENDPOINT
    MINIO_EXTERNAL_ENDPOINT=${MINIO_EXTERNAL_ENDPOINT:-localhost:39105}

    read -p "Usuário do MinIO [axiom]: " MINIO_ROOT_USER
    MINIO_ROOT_USER=${MINIO_ROOT_USER:-axiom}

    read -sp "Senha do MinIO (Enter para gerar aleatoriamente): " MINIO_ROOT_PASSWORD
    echo
    if [ -z "$MINIO_ROOT_PASSWORD" ]; then
        MINIO_ROOT_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-25)"
        print_info "Senha gerada automaticamente"
    fi

    read -p "Nome do bucket [axiom]: " MINIO_BUCKET_NAME
    MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME:-axiom}

    MINIO_USE_SSL="false"
    MINIO_PORT="39105"
    MINIO_CONSOLE_PORT="39106"

    print_header "Configuração do Redis"

    read -sp "Senha do Redis (Enter para gerar aleatoriamente): " REDIS_PASSWORD
    echo
    if [ -z "$REDIS_PASSWORD" ]; then
        REDIS_PASSWORD="$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")"
        print_info "Senha do Redis gerada automaticamente"
    fi

    print_header "Configuração de E-mail (Redefinição de Senha / Verificação)"

    print_info "Para desenvolvimento, use o backend console (imprime e-mails no terminal)."
    print_info "Para produção, configure um servidor SMTP real."
    read -p "Backend de e-mail [django.core.mail.backends.console.EmailBackend]: " EMAIL_BACKEND
    EMAIL_BACKEND=${EMAIL_BACKEND:-django.core.mail.backends.console.EmailBackend}

    read -p "Host SMTP [smtp.example.com]: " EMAIL_HOST
    EMAIL_HOST=${EMAIL_HOST:-smtp.example.com}

    read -p "Porta SMTP [587]: " EMAIL_PORT
    EMAIL_PORT=${EMAIL_PORT:-587}

    read -p "Usar TLS [True]: " EMAIL_USE_TLS
    EMAIL_USE_TLS=${EMAIL_USE_TLS:-True}

    EMAIL_USE_SSL="False"

    read -p "Usuário SMTP: " EMAIL_HOST_USER
    EMAIL_HOST_USER=${EMAIL_HOST_USER:-your-smtp-username@example.com}

    read -sp "Senha SMTP: " EMAIL_HOST_PASSWORD
    echo
    EMAIL_HOST_PASSWORD=${EMAIL_HOST_PASSWORD:-your-smtp-password-here}

    read -p "Remetente padrão [Axiom <noreply@axiom.app>]: " DEFAULT_FROM_EMAIL
    DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL:-Axiom <noreply@axiom.app>}

    read -p "URL pública do site (usada em links de e-mail) [http://localhost:39101]: " SITE_URL
    SITE_URL=${SITE_URL:-http://localhost:39101}

    GUNICORN_WORKERS="4"
    GUNICORN_TIMEOUT="120"
fi

# Criar arquivo .env
print_header "Criando arquivo .env"

cat > .env << EOF
# ============================================================================
# AXIOM - Variáveis de Ambiente
# ============================================================================
# Gerado automaticamente em $(date)
# ============================================================================

# ============================================================================
# DATABASE (PostgreSQL)
# ============================================================================
DB_HOST=$(esc "$DB_HOST")
DB_PORT=$(esc "$DB_PORT")
DB_NAME=$(esc "$DB_NAME")
DB_USER=$(esc "$DB_USER")
DB_PASSWORD=$(esc "$DB_PASSWORD")

# ============================================================================
# DJANGO (Backend API)
# ============================================================================
SECRET_KEY=$(esc "$SECRET_KEY")
DEBUG=$(esc "$DEBUG")
ALLOWED_HOSTS=$(esc "$ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS=$(esc "$CORS_ALLOWED_ORIGINS")

# ============================================================================
# DJANGO SUPERUSER
# ============================================================================
DJANGO_SUPERUSER_USERNAME=$(esc "$DJANGO_SUPERUSER_USERNAME")
DJANGO_SUPERUSER_EMAIL=$(esc "$DJANGO_SUPERUSER_EMAIL")
DJANGO_SUPERUSER_PASSWORD=$(esc "$DJANGO_SUPERUSER_PASSWORD")

# ============================================================================
# ENCRYPTION
# ============================================================================
ENCRYPTION_KEY=$(esc "$ENCRYPTION_KEY")

# ============================================================================
# LOGGING
# ============================================================================
LOG_FORMAT=$(esc "$LOG_FORMAT")
LOG_LEVEL=$(esc "$LOG_LEVEL")

# ============================================================================
# APPLICATION PORTS
# ============================================================================
API_PORT=$(esc "$API_PORT")
FRONTEND_PORT=$(esc "$FRONTEND_PORT")

# ============================================================================
# FRONTEND CONFIGURATION
# ============================================================================
VITE_API_BASE_URL=$(esc "$VITE_API_BASE_URL")

# ============================================================================
# SECURITY SETTINGS
# ============================================================================
SECURE_SSL_REDIRECT=$(esc "$SECURE_SSL_REDIRECT")
SESSION_COOKIE_SECURE=$(esc "$SESSION_COOKIE_SECURE")
CSRF_COOKIE_SECURE=$(esc "$CSRF_COOKIE_SECURE")

# ============================================================================
# BACKUP CONFIGURATION
# ============================================================================
BACKUP_DIR=$(esc "$BACKUP_DIR")
# AES-256 passphrase para criptografia dos backups.
# Para rotacionar: incremente BACKUP_KEY_VERSION e use rekey-backups.sh.
BACKUP_ENCRYPTION_KEY=$(esc "$BACKUP_ENCRYPTION_KEY")
BACKUP_KEY_VERSION=v1
# Chaves históricas (adicionar ao rotacionar):
# BACKUP_ENCRYPTION_KEY_V1=<chave-anterior>

# ============================================================================
# MinIO / S3 Object Storage
# ============================================================================
MINIO_ROOT_USER=$(esc "$MINIO_ROOT_USER")
MINIO_ROOT_PASSWORD=$(esc "$MINIO_ROOT_PASSWORD")
MINIO_BUCKET_NAME=$(esc "$MINIO_BUCKET_NAME")
MINIO_ENDPOINT=$(esc "$MINIO_ENDPOINT")
MINIO_EXTERNAL_ENDPOINT=$(esc "$MINIO_EXTERNAL_ENDPOINT")
MINIO_USE_SSL=$(esc "$MINIO_USE_SSL")
MINIO_PORT=$(esc "$MINIO_PORT")
MINIO_CONSOLE_PORT=$(esc "$MINIO_CONSOLE_PORT")

# ============================================================================
# REDIS
# ============================================================================
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
REDIS_PASSWORD=$(esc "$REDIS_PASSWORD")

# ============================================================================
# EMAIL (Redefinição de senha / Verificação de e-mail)
# Para desenvolvimento: EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
# Para produção: configure um servidor SMTP real.
# ============================================================================
EMAIL_BACKEND=$(esc "$EMAIL_BACKEND")
EMAIL_HOST=$(esc "$EMAIL_HOST")
EMAIL_PORT=$(esc "$EMAIL_PORT")
EMAIL_USE_TLS=$(esc "$EMAIL_USE_TLS")
EMAIL_USE_SSL=$(esc "$EMAIL_USE_SSL")
EMAIL_HOST_USER=$(esc "$EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD=$(esc "$EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL=$(esc "$DEFAULT_FROM_EMAIL")
# URL pública do frontend — usada em links de e-mail (reset de senha, verificação)
SITE_URL=$(esc "$SITE_URL")

# ============================================================================
# GUNICORN (Production Server)
# ============================================================================
GUNICORN_WORKERS=$(esc "$GUNICORN_WORKERS")
GUNICORN_TIMEOUT=$(esc "$GUNICORN_TIMEOUT")

# ============================================================================
# DEVELOPMENT SETTINGS
# ============================================================================
ENABLE_DEBUG_TOOLBAR=$(esc "$ENABLE_DEBUG_TOOLBAR")
SHOW_SQL_QUERIES=$(esc "$SHOW_SQL_QUERIES")
EOF

print_success "Arquivo .env criado com sucesso!"

# Validar a chave de criptografia
print_info "Validando ENCRYPTION_KEY..."
if validate_fernet_key "$ENCRYPTION_KEY"; then
    print_success "ENCRYPTION_KEY é válida!"
else
    print_error "ENCRYPTION_KEY inválida! Gerando uma nova..."
    ENCRYPTION_KEY="$(generate_encryption_key)"
    sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    print_success "Nova ENCRYPTION_KEY gerada e salva"
fi

# Criar diretório de backups se não existir
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    print_success "Diretório de backups criado: $BACKUP_DIR"
fi

# Corrigir permissões do diretório de media para o container Docker (appuser uid=1000)
print_info "Corrigindo permissões do diretório de media..."
if [ -d "./api/media" ]; then
    sudo chown -R 1000:1000 ./api/media
    print_success "Permissões do diretório de media corrigidas"
else
    mkdir -p ./api/media
    sudo chown -R 1000:1000 ./api/media
    print_success "Diretório de media criado com permissões corretas"
fi

# Resumo
print_header "Resumo da Configuração"

if [ "$MODE" == "auto" ]; then
    echo -e "${GREEN}Configuração automática concluída!${NC}"
    echo ""
    echo "Credenciais geradas:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Banco de Dados:${NC}"
    echo "  Usuário: $DB_USER"
    echo "  Senha: $DB_PASSWORD"
    echo ""
    echo -e "${CYAN}Django Superuser:${NC}"
    echo "  Username: $DJANGO_SUPERUSER_USERNAME"
    echo "  Email: $DJANGO_SUPERUSER_EMAIL"
    echo "  Senha: $DJANGO_SUPERUSER_PASSWORD"
    echo ""
    echo -e "${CYAN}Redis:${NC}"
    echo "  Senha: $REDIS_PASSWORD"
    echo ""
    echo -e "${CYAN}Backup Encryption:${NC}"
    echo "  BACKUP_ENCRYPTION_KEY: $BACKUP_ENCRYPTION_KEY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    print_warning "IMPORTANTE: Salve essas credenciais em um local seguro!"
    print_warning "BACKUP_ENCRYPTION_KEY: ao rotacionar, incremente BACKUP_KEY_VERSION e use rekey-backups.sh para re-encriptar backups antigos."
fi

echo ""
print_success "Configuração concluída!"
echo ""
print_info "Próximos passos:"
echo "  1. Revise o arquivo .env e ajuste conforme necessário"
echo "  2. Execute: docker-compose up -d"
echo "  3. Execute: docker-compose exec api python manage.py migrate"
echo "  4. Acesse http://localhost:$FRONTEND_PORT para o frontend"
echo "  5. Acesse http://localhost:$API_PORT/admin para o admin Django"
echo ""
print_warning "LEMBRE-SE: Nunca commite o arquivo .env no git!"
echo ""
