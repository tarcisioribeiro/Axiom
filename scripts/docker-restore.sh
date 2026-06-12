#!/usr/bin/env bash
# =============================================================================
# docker-restore.sh — Importa backup K8s nos containers Docker locais
# =============================================================================
# Substitui: banco PostgreSQL + arquivos MinIO
# Fonte    : arquivo gerado pelo k8s-backup.sh
#
# Dependências: docker, mc (MinIO Client)
# Uso: ./scripts/docker-restore.sh <backup.tar.gz>
#      ./scripts/docker-restore.sh <diretório_backup>
# =============================================================================

set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

# Nomes dos containers (conforme docker-compose.yml)
CONTAINER_DB="axiom-db"
CONTAINER_MINIO="axiom-storage"
CONTAINERS_APP=("axiom-api" "axiom-worker" "axiom-queue" "axiom-db-backup")

# ── Funções auxiliares ────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
err()  { echo "[$(date '+%H:%M:%S')] ERRO: $*" >&2; exit 1; }

cleanup() {
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        log "Removendo diretório temporário de extração..."
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# ── Argumento obrigatório ─────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    echo "Uso: $0 <backup.tar.gz | diretório_backup>"
    echo ""
    echo "Exemplos:"
    echo "  $0 backups/backup_20260101_120000.tar.gz"
    echo "  $0 backups/backup_20260101_120000/"
    exit 1
fi
INPUT="$1"

# ── Verificação de dependências ───────────────────────────────────────────────
for cmd in docker mc; do
    command -v "$cmd" &>/dev/null || err "Dependência não encontrada: '$cmd'. Instale antes de continuar."
done

# ── Carregar credenciais do .env local ───────────────────────────────────────
[[ -f "$ENV_FILE" ]] || err "Arquivo .env não encontrado em '${ENV_FILE}'. Está na raiz correta?"

log "Carregando credenciais de ${ENV_FILE}..."
set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Z_]+=' "$ENV_FILE" \
    | grep -E '^(DB_NAME|DB_USER|DB_PASSWORD|MINIO_ROOT_USER|MINIO_ROOT_PASSWORD|MINIO_BUCKET_NAME|MINIO_PORT)=' \
    | sed 's/\r//' \
    | sed "s/^/export /")
set +a

DB_NAME="${DB_NAME:-axiom_db}"
MINIO_BUCKET="${MINIO_BUCKET_NAME:-axiom}"
MINIO_LOCAL_PORT="${MINIO_PORT:-39105}"

# ── Resolver entrada (tar.gz ou diretório) ────────────────────────────────────
WORK_DIR=""
TEMP_DIR=""

if [[ -f "$INPUT" && "$INPUT" == *.tar.gz ]]; then
    TEMP_DIR="$(mktemp -d)"
    log "Extraindo ${INPUT} → ${TEMP_DIR} ..."
    tar -xzf "$INPUT" -C "$TEMP_DIR"
    WORK_DIR="$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)"
elif [[ -d "$INPUT" ]]; then
    WORK_DIR="$(realpath "$INPUT")"
else
    err "Entrada inválida: '${INPUT}' não é um arquivo .tar.gz nem um diretório."
fi

[[ -z "$WORK_DIR" ]] && err "Não foi possível determinar o diretório de trabalho do backup."

# ── Validar estrutura do backup ───────────────────────────────────────────────
[[ -f "${WORK_DIR}/database.dump" ]] \
    || err "Arquivo 'database.dump' não encontrado em '${WORK_DIR}'. Backup corrompido ou incompleto."
[[ -d "${WORK_DIR}/minio" ]] \
    || err "Diretório 'minio/' não encontrado em '${WORK_DIR}'. Backup corrompido ou incompleto."

# ── Exibir metadados do backup ────────────────────────────────────────────────
echo ""
if [[ -f "${WORK_DIR}/metadata.json" ]]; then
    log "Metadados do backup:"
    sed 's/^/  /' "${WORK_DIR}/metadata.json"
    echo ""
fi

DUMP_SIZE="$(du -sh "${WORK_DIR}/database.dump" | cut -f1)"
MINIO_SIZE="$(du -sh "${WORK_DIR}/minio" | cut -f1)"

# ── Confirmação do usuário ────────────────────────────────────────────────────
echo "⚠  ATENÇÃO: Esta operação vai SUBSTITUIR permanentemente:"
echo "   • Banco de dados '${DB_NAME}' no container '${CONTAINER_DB}'"
echo "   • Bucket '${MINIO_BUCKET}' no container '${CONTAINER_MINIO}'"
echo ""
echo "   Dados locais existentes serão perdidos."
echo ""
read -rp "Confirma a restauração? [s/N] " CONFIRM
[[ "${CONFIRM,,}" == "s" ]] || { log "Operação cancelada pelo usuário."; exit 0; }
echo ""

# ── Verificar containers de infraestrutura ────────────────────────────────────
log "Verificando containers de infraestrutura..."
docker inspect "$CONTAINER_DB" &>/dev/null \
    || err "Container '${CONTAINER_DB}' não encontrado. Execute 'docker compose up -d' primeiro."
docker inspect "$CONTAINER_MINIO" &>/dev/null \
    || err "Container '${CONTAINER_MINIO}' não encontrado. Execute 'docker compose up -d' primeiro."

# ── Parar containers de aplicação ────────────────────────────────────────────
log "Parando containers de aplicação para evitar escritas durante a restauração..."
for c in "${CONTAINERS_APP[@]}"; do
    if docker inspect "$c" &>/dev/null 2>&1; then
        docker stop "$c" &>/dev/null && log "  Parado: ${c}" || log "  Já parado ou inexistente: ${c}"
    fi
done

# ── Restaurar PostgreSQL ──────────────────────────────────────────────────────
log "Restaurando banco de dados (tamanho do dump: ${DUMP_SIZE})..."

# Encerra conexões ativas para permitir o drop
log "  Encerrando conexões ativas em '${DB_NAME}'..."
docker exec "$CONTAINER_DB" \
    psql -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true

log "  Removendo banco '${DB_NAME}'..."
docker exec "$CONTAINER_DB" \
    psql -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" \
    >/dev/null

log "  Recriando banco '${DB_NAME}'..."
docker exec "$CONTAINER_DB" \
    psql -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE \"${DB_NAME}\" ENCODING='UTF8' LC_COLLATE='C.UTF-8' LC_CTYPE='C.UTF-8' TEMPLATE=template0;" \
    >/dev/null

log "  Copiando dump para o container..."
docker cp "${WORK_DIR}/database.dump" "${CONTAINER_DB}:/tmp/restore.dump"

log "  Executando pg_restore..."
docker exec "$CONTAINER_DB" \
    env PGPASSWORD="$DB_PASSWORD" \
    pg_restore \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-acl \
        --no-owner \
        --exit-on-error \
        /tmp/restore.dump

docker exec "$CONTAINER_DB" rm -f /tmp/restore.dump
log "Banco de dados restaurado com sucesso."

# ── Restaurar MinIO ───────────────────────────────────────────────────────────
log "Restaurando arquivos MinIO (tamanho: ${MINIO_SIZE})..."

log "  Configurando alias mc 'local-minio' (porta ${MINIO_LOCAL_PORT})..."
mc alias set local-minio \
    "http://localhost:${MINIO_LOCAL_PORT}" \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
    --api S3v4 \
    >/dev/null

log "  Garantindo existência do bucket '${MINIO_BUCKET}'..."
mc mb --ignore-existing "local-minio/${MINIO_BUCKET}" >/dev/null

log "  Sincronizando arquivos (--overwrite --remove para substituição completa)..."
mc mirror \
    --preserve \
    --overwrite \
    --remove \
    "${WORK_DIR}/minio/" \
    "local-minio/${MINIO_BUCKET}"

log "MinIO restaurado com sucesso."

# ── Reiniciar containers de aplicação ─────────────────────────────────────────
log "Reiniciando containers de aplicação..."
for c in "${CONTAINERS_APP[@]}"; do
    if docker inspect "$c" &>/dev/null 2>&1; then
        docker start "$c" &>/dev/null && log "  Iniciado: ${c}" || log "  Não foi possível iniciar: ${c}"
    fi
done

log "══════════════════════════════════════════════════"
log "Restauração concluída com sucesso!"
log "Banco   : ${DB_NAME} (container: ${CONTAINER_DB})"
log "MinIO   : bucket '${MINIO_BUCKET}' (container: ${CONTAINER_MINIO})"
log "══════════════════════════════════════════════════"
