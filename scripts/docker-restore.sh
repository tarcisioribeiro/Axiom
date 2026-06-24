#!/usr/bin/env bash
# =============================================================================
# docker-restore.sh — Importa backup K8s nos containers Docker locais
# =============================================================================
# Substitui: banco PostgreSQL + arquivos MinIO
# Fonte    : arquivo gerado pelo k8s-backup.sh
#
# Dependências: docker (MinIO Client executado via imagem minio/mc)
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
CONTAINER_API="axiom-api"
CONTAINERS_APP=("axiom-api" "axiom-worker" "axiom-queue" "axiom-db-backup")

# ── Funções auxiliares ────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
err()  { echo "[$(date '+%H:%M:%S')] ERRO: $*" >&2; exit 1; }

cleanup() {
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        log "Removendo diretório temporário de extração..."
        rm -rf "$TEMP_DIR"
    fi
    if [[ -n "${MC_CONFIG_DIR:-}" && -d "$MC_CONFIG_DIR" ]]; then
        rm -rf "$MC_CONFIG_DIR"
    fi
}
trap cleanup EXIT

# MinIO Client via Docker (evita dependência de binário local)
MC_CONFIG_DIR=""  # inicializado antes do uso para o cleanup

mc_cmd() {
    docker run --rm \
        --network host \
        -v "${MC_CONFIG_DIR}:/root/.mc" \
        minio/mc "$@"
}

mc_mirror() {
    local src_dir="$1"; shift
    docker run --rm \
        --network host \
        -v "${MC_CONFIG_DIR}:/root/.mc" \
        -v "${src_dir}:/mnt/backup:ro" \
        minio/mc "$@"
}

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
command -v docker &>/dev/null || err "Dependência não encontrada: 'docker'. Instale antes de continuar."

# ── Carregar credenciais do .env local ───────────────────────────────────────
[[ -f "$ENV_FILE" ]] || err "Arquivo .env não encontrado em '${ENV_FILE}'. Está na raiz correta?"

log "Carregando credenciais de ${ENV_FILE}..."
set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Z_]+=' "$ENV_FILE" \
    | grep -E '^(DB_NAME|DB_USER|DB_PASSWORD|MINIO_ROOT_USER|MINIO_ROOT_PASSWORD|MINIO_BUCKET_NAME|MINIO_PORT|MINIO_ENDPOINT)=' \
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

MC_CONFIG_DIR="$(mktemp -d)"

log "  Configurando alias mc 'local-minio' (porta ${MINIO_LOCAL_PORT})..."
mc_cmd alias set local-minio \
    "http://localhost:${MINIO_LOCAL_PORT}" \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
    --api S3v4 \
    >/dev/null

log "  Garantindo existência do bucket '${MINIO_BUCKET}'..."
mc_cmd mb --ignore-existing "local-minio/${MINIO_BUCKET}" >/dev/null

log "  Sincronizando arquivos (--overwrite --remove para substituição completa)..."
mc_mirror "${WORK_DIR}/minio" mirror \
    --preserve \
    --overwrite \
    --remove \
    /mnt/backup/ \
    "local-minio/${MINIO_BUCKET}"

log "MinIO restaurado com sucesso."

# ── Corrigir SystemConfig para ambiente Docker ────────────────────────────────
# O dump restaurado pode conter valores do ambiente de origem (ex: K8s) que
# sobrescrevem o .env via cfg(). Aqui sincronizamos as chaves MinIO do
# SystemConfig com as credenciais locais antes de subir os containers.
if docker inspect "$CONTAINER_API" &>/dev/null 2>&1; then
    log "Sincronizando SystemConfig com credenciais locais (${ENV_FILE})..."

    log "  Iniciando '${CONTAINER_API}' temporariamente..."
    docker start "$CONTAINER_API" &>/dev/null

    log "  Aguardando Django inicializar (máx. 30s)..."
    _django_ready=0
    for _i in $(seq 1 30); do
        if docker exec "$CONTAINER_API" \
                python -c "import django; django.setup()" &>/dev/null 2>&1; then
            _django_ready=1
            break
        fi
        sleep 1
    done

    if [[ $_django_ready -eq 1 ]]; then
        docker exec -i "$CONTAINER_API" python - \
            "${MINIO_ROOT_USER}" \
            "${MINIO_ROOT_PASSWORD}" \
            "${MINIO_ENDPOINT:-minio:9000}" \
            "${MINIO_BUCKET_NAME:-axiom}" <<'PYEOF'
import sys, os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()
from admin_panel.models import SystemConfig

minio_user, minio_pass, minio_endpoint, minio_bucket = sys.argv[1:]

updates = {
    'MINIO_ROOT_USER':     minio_user,
    'MINIO_ENDPOINT':      minio_endpoint,
    'MINIO_ROOT_PASSWORD': minio_pass,
    'MINIO_BUCKET_NAME':   minio_bucket,
}

for key, val in updates.items():
    if not val:
        continue
    try:
        obj = SystemConfig.objects.get(key=key)
        obj.set_value(val)
        obj.save()
        masked = '***' if 'PASSWORD' in key else val
        print(f'  Atualizado: {key} = {masked}')
    except SystemConfig.DoesNotExist:
        pass  # chave ausente no SystemConfig — .env já serve de fallback
    except Exception as e:
        print(f'  AVISO: {key}: {e}', file=sys.stderr)
PYEOF
        log "SystemConfig sincronizado."
    else
        log "AVISO: timeout aguardando Django. Atualize manualmente via Django Admin:"
        log "  MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, MINIO_ENDPOINT, MINIO_BUCKET_NAME"
    fi

    log "  Parando '${CONTAINER_API}'..."
    docker stop "$CONTAINER_API" &>/dev/null || true
fi

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
