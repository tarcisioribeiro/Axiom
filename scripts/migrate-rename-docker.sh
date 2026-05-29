#!/usr/bin/env bash
# =============================================================================
# Axiom — Migração de rename MindLedger → Axiom (Docker Compose)
# =============================================================================
# O que este script faz:
#   1. Backup completo do PostgreSQL antes de qualquer alteração
#   2. Para apenas os serviços da aplicação (API, workers) — DB e MinIO ficam up
#   3. Renomeia o banco de dados: mindledger_db → axiom_db
#   4. Copia bucket MinIO:  mindledger       → axiom
#   5. Copia bucket backup: mindledger-backups → axiom-backups
#   6. Sobe todos os serviços com a nova configuração
#
# Pré-requisitos:
#   - docker compose up -d  (serviços rodando)
#   - .env já atualizado com DB_NAME=axiom_db e MINIO_BUCKET_NAME=axiom
#   - Rodar a partir da raiz do repositório
#
# Uso:
#   bash scripts/migrate-rename-docker.sh [--dry-run]
# =============================================================================

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
dry_run() { echo -e "${YELLOW}[DRY-RUN]${NC} Executaria: $*"; }

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
OLD_DB="${OLD_DB_NAME:-mindledger_db}"
NEW_DB="${DB_NAME:-axiom_db}"
OLD_BUCKET="${OLD_MINIO_BUCKET:-mindledger}"
NEW_BUCKET="${MINIO_BUCKET_NAME:-axiom}"
OLD_BACKUP_BUCKET="${OLD_BACKUP_BUCKET:-mindledger-backups}"
NEW_BACKUP_BUCKET="${BACKUP_MINIO_BUCKET:-axiom-backups}"
DB_USER="${DB_USER:?Variável DB_USER não definida. Exporte-a ou verifique o .env.}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:?Variável MINIO_ROOT_USER não definida.}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?Variável MINIO_ROOT_PASSWORD não definida.}"
MINIO_USE_SSL="${MINIO_USE_SSL:-false}"
MC_IMAGE="minio/mc:RELEASE.2025-02-15T10-36-16Z@sha256:9ae9ed28d04f7c36ee6b84c36b2c0168f1be28350d54344c3e5088a631f4c603"

# Detecta nome da rede Docker Compose
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)")}"
DOCKER_NETWORK="${COMPOSE_PROJECT}_network"

info "Configuração detectada:"
echo "  OLD_DB:           $OLD_DB"
echo "  NEW_DB:           $NEW_DB"
echo "  OLD_BUCKET:       $OLD_BUCKET"
echo "  NEW_BUCKET:       $NEW_BUCKET"
echo "  OLD_BACKUP_BUCKET:$OLD_BACKUP_BUCKET"
echo "  NEW_BACKUP_BUCKET:$NEW_BACKUP_BUCKET"
echo "  DOCKER_NETWORK:   $DOCKER_NETWORK"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    warn "Modo DRY-RUN ativado — nenhuma alteração será feita."
    echo ""
fi

# ---------------------------------------------------------------------------
# Verifica pré-requisitos
# ---------------------------------------------------------------------------
info "[0/6] Verificando pré-requisitos..."

docker compose ps --services | grep -q "db" \
    || error "Serviço 'db' não está rodando. Execute 'docker compose up -d' primeiro."

DB_EXISTS=$(docker compose exec -T db psql -U "$DB_USER" postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='$OLD_DB'" 2>/dev/null || echo "")

if [[ -z "$DB_EXISTS" ]]; then
    warn "Banco '$OLD_DB' não encontrado. Verificando se '$NEW_DB' já existe..."
    NEW_EXISTS=$(docker compose exec -T db psql -U "$DB_USER" postgres \
        -tAc "SELECT 1 FROM pg_database WHERE datname='$NEW_DB'" 2>/dev/null || echo "")
    [[ -n "$NEW_EXISTS" ]] \
        && info "Banco '$NEW_DB' já existe — etapa de rename será pulada." \
        || error "Nem '$OLD_DB' nem '$NEW_DB' encontrados. Verifique o estado do banco."
fi

info "Pré-requisitos OK."

# ---------------------------------------------------------------------------
# Etapa 1 — Backup
# ---------------------------------------------------------------------------
info "[1/6] Criando backup de segurança do PostgreSQL..."
mkdir -p backups
BACKUP_FILE="backups/pre_rename_$(date +%Y%m%d_%H%M%S).sql"

if [[ "$DRY_RUN" == "false" ]]; then
    docker compose exec -T db pg_dump -U "$DB_USER" "$OLD_DB" > "$BACKUP_FILE" \
        && info "Backup salvo em: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))" \
        || error "Falha ao criar backup. Abortando."
else
    dry_run "pg_dump $OLD_DB > $BACKUP_FILE"
fi

# ---------------------------------------------------------------------------
# Etapa 2 — Para serviços da aplicação
# ---------------------------------------------------------------------------
info "[2/6] Parando serviços da aplicação (DB e MinIO permanecem ativos)..."
APP_SERVICES="api worker queue"

if [[ "$DRY_RUN" == "false" ]]; then
    # Para apenas os serviços que existem
    for svc in $APP_SERVICES; do
        docker compose stop "$svc" 2>/dev/null && info "  Parado: $svc" || warn "  Serviço não encontrado (ignorado): $svc"
    done
else
    dry_run "docker compose stop $APP_SERVICES"
fi

# ---------------------------------------------------------------------------
# Etapa 3 — Renomeia banco de dados
# ---------------------------------------------------------------------------
info "[3/6] Renomeando banco: $OLD_DB → $NEW_DB..."

DB_EXISTS=$(docker compose exec -T db psql -U "$DB_USER" postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='$OLD_DB'" 2>/dev/null || echo "")

if [[ -n "$DB_EXISTS" ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
        docker compose exec -T db psql -U "$DB_USER" postgres \
            -c "ALTER DATABASE \"$OLD_DB\" RENAME TO \"$NEW_DB\";" \
            && info "Banco renomeado com sucesso." \
            || error "Falha ao renomear banco. Verifique conexões ativas."
    else
        dry_run "psql: ALTER DATABASE \"$OLD_DB\" RENAME TO \"$NEW_DB\";"
    fi
else
    warn "Banco '$OLD_DB' não encontrado — etapa de rename pulada."
fi

# ---------------------------------------------------------------------------
# Etapa 4 — Copia bucket MinIO principal
# ---------------------------------------------------------------------------
_run_mc() {
    local SCHEME="http"
    local INSECURE="--insecure"
    [[ "$MINIO_USE_SSL" == "true" ]] && { SCHEME="https"; INSECURE=""; }

    docker run --rm \
        --network "$DOCKER_NETWORK" \
        --entrypoint sh \
        "$MC_IMAGE" -c "
            mc $INSECURE alias set local $SCHEME://minio:9000 '$MINIO_ROOT_USER' '$MINIO_ROOT_PASSWORD' >/dev/null 2>&1
            $1
        "
}

info "[4/6] Verificando e copiando bucket MinIO: $OLD_BUCKET → $NEW_BUCKET..."
OLD_BUCKET_EXISTS=$(_run_mc "mc ls local/$OLD_BUCKET >/dev/null 2>&1 && echo yes || echo no" 2>/dev/null || echo "no")

if [[ "$OLD_BUCKET_EXISTS" == *"yes"* ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
        _run_mc "mc mb --ignore-existing local/$NEW_BUCKET && mc cp --recursive local/$OLD_BUCKET/ local/$NEW_BUCKET/" \
            && info "Bucket '$NEW_BUCKET' criado/atualizado com sucesso." \
            || error "Falha ao copiar bucket MinIO."
    else
        dry_run "mc cp --recursive local/$OLD_BUCKET/ local/$NEW_BUCKET/"
    fi
else
    NEW_BUCKET_EXISTS=$(_run_mc "mc ls local/$NEW_BUCKET >/dev/null 2>&1 && echo yes || echo no" 2>/dev/null || echo "no")
    if [[ "$NEW_BUCKET_EXISTS" == *"yes"* ]]; then
        info "Bucket '$NEW_BUCKET' já existe — etapa pulada."
    else
        warn "Bucket '$OLD_BUCKET' não encontrado — será criado vazio como '$NEW_BUCKET'."
        [[ "$DRY_RUN" == "false" ]] && _run_mc "mc mb --ignore-existing local/$NEW_BUCKET"
    fi
fi

# ---------------------------------------------------------------------------
# Etapa 5 — Copia bucket de backups
# ---------------------------------------------------------------------------
info "[5/6] Verificando e copiando bucket de backups: $OLD_BACKUP_BUCKET → $NEW_BACKUP_BUCKET..."
OLD_BACKUP_EXISTS=$(_run_mc "mc ls local/$OLD_BACKUP_BUCKET >/dev/null 2>&1 && echo yes || echo no" 2>/dev/null || echo "no")

if [[ "$OLD_BACKUP_EXISTS" == *"yes"* ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
        _run_mc "mc mb --ignore-existing local/$NEW_BACKUP_BUCKET && mc cp --recursive local/$OLD_BACKUP_BUCKET/ local/$NEW_BACKUP_BUCKET/" \
            && info "Bucket de backups copiado com sucesso." \
            || warn "Falha ao copiar bucket de backups (não crítico — backups históricos permanecem no bucket antigo)."
    else
        dry_run "mc cp --recursive local/$OLD_BACKUP_BUCKET/ local/$NEW_BACKUP_BUCKET/"
    fi
else
    warn "Bucket '$OLD_BACKUP_BUCKET' não encontrado — etapa pulada."
    [[ "$DRY_RUN" == "false" ]] && _run_mc "mc mb --ignore-existing local/$NEW_BACKUP_BUCKET" || true
fi

# ---------------------------------------------------------------------------
# Etapa 6 — Sobe todos os serviços
# ---------------------------------------------------------------------------
info "[6/6] Iniciando todos os serviços com a nova configuração..."

if [[ "$DRY_RUN" == "false" ]]; then
    docker compose up -d \
        && info "Todos os serviços iniciados." \
        || error "Falha ao iniciar serviços."

    echo ""
    info "Aguardando API ficar saudável (até 60s)..."
    for i in $(seq 1 12); do
        STATUS=$(docker compose ps --format json api 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health','unknown'))" 2>/dev/null || echo "unknown")
        [[ "$STATUS" == "healthy" ]] && { info "API saudável."; break; }
        [[ $i -eq 12 ]] && warn "API ainda não reportou healthy — verifique: docker compose logs api"
        sleep 5
    done
else
    dry_run "docker compose up -d"
fi

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
if [[ "$DRY_RUN" == "false" ]]; then
    info "Migração concluída com sucesso!"
    echo ""
    echo "  Banco de dados : $NEW_DB"
    echo "  Bucket MinIO   : $NEW_BUCKET"
    echo "  Backup salvo   : $BACKUP_FILE"
    echo ""
    echo "Próximos passos:"
    echo "  1. Verifique os logs:       docker compose logs -f api"
    echo "  2. Teste a aplicação em:    http://localhost:39101"
    echo "  3. Após validar, remova os buckets antigos no MinIO Console (porta 39106)"
    echo "     Buckets para remover: $OLD_BUCKET, $OLD_BACKUP_BUCKET"
else
    warn "Dry-run concluído — nenhuma alteração foi feita."
    echo "Execute sem --dry-run para aplicar as mudanças."
fi
echo "============================================================"
