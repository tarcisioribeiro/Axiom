#!/bin/bash

# ============================================================================
# MindLedger - Script de Configuração do Ambiente
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
MindLedger - Script de Configuração do Ambiente

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
print_header "MindLedger - Configuração do Ambiente"

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
    DB_NAME="mindledger_db"
    DB_USER="mindledger_user"
    DB_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-25)"

    DJANGO_SUPERUSER_USERNAME="admin"
    DJANGO_SUPERUSER_EMAIL="admin@mindledger.local"
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
    ENABLE_DEBUG_TOOLBAR="False"
    SHOW_SQL_QUERIES="False"

else
    # Modo interativo
    read -p "Host do banco de dados [db]: " DB_HOST
    DB_HOST=${DB_HOST:-db}

    read -p "Porta do banco de dados [39102]: " DB_PORT
    DB_PORT=${DB_PORT:-39102}

    read -p "Nome do banco de dados [mindledger_db]: " DB_NAME
    DB_NAME=${DB_NAME:-mindledger_db}

    read -p "Usuário do banco de dados [mindledger_user]: " DB_USER
    DB_USER=${DB_USER:-mindledger_user}

    read -sp "Senha do banco de dados: " DB_PASSWORD
    echo
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD="$(openssl rand -base64 32 | tr -d /=+ | cut -c1-25)"
        print_info "Senha gerada automaticamente"
    fi

    print_header "Configuração do Django Superuser"

    read -p "Username do superusuário [admin]: " DJANGO_SUPERUSER_USERNAME
    DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-admin}

    read -p "Email do superusuário [admin@mindledger.local]: " DJANGO_SUPERUSER_EMAIL
    DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-admin@mindledger.local}

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
    ENABLE_DEBUG_TOOLBAR="False"
    SHOW_SQL_QUERIES="False"
fi

# Criar arquivo .env
print_header "Criando arquivo .env"

cat > .env << EOF
# ============================================================================
# MINDLEDGER - Variáveis de Ambiente
# ============================================================================
# Gerado automaticamente em $(date)
# ============================================================================

# ============================================================================
# DATABASE (PostgreSQL)
# ============================================================================
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# ============================================================================
# DJANGO (Backend API)
# ============================================================================
SECRET_KEY=$SECRET_KEY
DEBUG=$DEBUG
ALLOWED_HOSTS=$ALLOWED_HOSTS
CORS_ALLOWED_ORIGINS=$CORS_ALLOWED_ORIGINS

# ============================================================================
# DJANGO SUPERUSER
# ============================================================================
DJANGO_SUPERUSER_USERNAME=$DJANGO_SUPERUSER_USERNAME
DJANGO_SUPERUSER_EMAIL=$DJANGO_SUPERUSER_EMAIL
DJANGO_SUPERUSER_PASSWORD=$DJANGO_SUPERUSER_PASSWORD

# ============================================================================
# ENCRYPTION
# ============================================================================
ENCRYPTION_KEY=$ENCRYPTION_KEY

# ============================================================================
# LOGGING
# ============================================================================
LOG_FORMAT=$LOG_FORMAT
LOG_LEVEL=$LOG_LEVEL

# ============================================================================
# APPLICATION PORTS
# ============================================================================
API_PORT=$API_PORT
FRONTEND_PORT=$FRONTEND_PORT

# ============================================================================
# FRONTEND CONFIGURATION
# ============================================================================
VITE_API_BASE_URL=$VITE_API_BASE_URL

# ============================================================================
# SECURITY SETTINGS
# ============================================================================
SECURE_SSL_REDIRECT=$SECURE_SSL_REDIRECT
SESSION_COOKIE_SECURE=$SESSION_COOKIE_SECURE
CSRF_COOKIE_SECURE=$CSRF_COOKIE_SECURE

# ============================================================================
# BACKUP CONFIGURATION
# ============================================================================
BACKUP_DIR=$BACKUP_DIR

# ============================================================================
# DEVELOPMENT SETTINGS
# ============================================================================
ENABLE_DEBUG_TOOLBAR=$ENABLE_DEBUG_TOOLBAR
SHOW_SQL_QUERIES=$SHOW_SQL_QUERIES
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
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    print_warning "IMPORTANTE: Salve essas credenciais em um local seguro!"
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
