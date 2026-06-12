#!/usr/bin/env bash
# =============================================================================
# k8s-backup.sh — Backup de produção Kubernetes → arquivo local
# =============================================================================
# Exporta: dump PostgreSQL + arquivos MinIO
# Saída  : backups/backup_YYYYMMDD_HHMMSS.tar.gz
#
# Dependências: kubectl (contexto configurado), mc (MinIO Client)
# Uso: ./scripts/k8s-backup.sh
# =============================================================================

set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────
NAMESPACE="axiom"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_BASE="${REPO_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
WORK_DIR="${BACKUP_BASE}/backup_${TIMESTAMP}"
ARCHIVE="${BACKUP_BASE}/backup_${TIMESTAMP}.tar.gz"
MINIO_PF_PORT=19000  # porta local para port-forward (diferente do MinIO local: 39105)

# ── Funções auxiliares ────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
err()  { echo "[$(date '+%H:%M:%S')] ERRO: $*" >&2; exit 1; }

wait_port() {
    local port="$1" max=15 i
    for i in $(seq 1 "$max"); do
        if (echo >/dev/tcp/localhost/"$port") 2>/dev/null; then return 0; fi
        sleep 1
    done
    return 1
}

cleanup() {
    if [[ -n "${PF_PID:-}" ]]; then
        log "Encerrando port-forward (PID ${PF_PID})..."
        kill "$PF_PID" 2>/dev/null || true
        wait "$PF_PID" 2>/dev/null || true
    fi
    # Remove diretório de trabalho apenas se o arquivo final foi criado
    if [[ -f "$ARCHIVE" && -d "$WORK_DIR" ]]; then
        rm -rf "$WORK_DIR"
    fi
}
trap cleanup EXIT

# ── Verificação de dependências ───────────────────────────────────────────────
for cmd in kubectl mc; do
    command -v "$cmd" &>/dev/null || err "Dependência não encontrada: '$cmd'. Instale antes de continuar."
done

# ── Verificar acesso ao cluster ───────────────────────────────────────────────
log "Verificando acesso ao namespace '${NAMESPACE}'..."
kubectl get namespace "$NAMESPACE" &>/dev/null \
    || err "Namespace '${NAMESPACE}' não encontrado. Verifique o contexto kubectl (kubectl config current-context)."

# ── Ler credenciais dos Secrets K8s ──────────────────────────────────────────
log "Lendo credenciais do Secret 'axiom-secrets'..."

read_secret() {
    local key="$1"
    kubectl get secret axiom-secrets -n "$NAMESPACE" \
        -o jsonpath="{.data.${key}}" 2>/dev/null \
        | base64 -d \
        || err "Chave '${key}' não encontrada em axiom-secrets"
}

DB_NAME="$(read_secret DB_NAME)"
DB_USER="$(read_secret DB_USER)"
DB_PASSWORD="$(read_secret DB_PASSWORD)"
MINIO_USER="$(read_secret MINIO_ROOT_USER)"
MINIO_PASS="$(read_secret MINIO_ROOT_PASSWORD)"

# Bucket definido no ConfigMap (fallback: axiom)
MINIO_BUCKET="$(kubectl get configmap axiom-config -n "$NAMESPACE" \
    -o jsonpath='{.data.MINIO_BUCKET_NAME}' 2>/dev/null || echo 'axiom')"
[[ -z "$MINIO_BUCKET" ]] && MINIO_BUCKET="axiom"

log "Banco de dados : ${DB_NAME} (usuário: ${DB_USER})"
log "Bucket MinIO   : ${MINIO_BUCKET}"

# ── Criar diretório de trabalho ───────────────────────────────────────────────
mkdir -p "${WORK_DIR}/minio"
log "Diretório de trabalho: ${WORK_DIR}"

# ── Backup PostgreSQL ─────────────────────────────────────────────────────────
log "Localizando pod do PostgreSQL no namespace '${NAMESPACE}'..."
POSTGRES_POD="$(kubectl get pod \
    -l app=postgres \
    -n "$NAMESPACE" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"

[[ -z "$POSTGRES_POD" ]] \
    && err "Nenhum pod PostgreSQL em execução encontrado (label app=postgres) no namespace ${NAMESPACE}"

log "Pod PostgreSQL: ${POSTGRES_POD}"
log "Executando pg_dump (formato custom)..."

kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
    env PGPASSWORD="$DB_PASSWORD" \
    pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --no-acl \
        --no-owner \
        --compress=6 \
    > "${WORK_DIR}/database.dump"

DUMP_SIZE="$(du -sh "${WORK_DIR}/database.dump" | cut -f1)"
log "pg_dump concluído — tamanho: ${DUMP_SIZE}"

# ── Backup MinIO via port-forward ─────────────────────────────────────────────
log "Iniciando port-forward para MinIO (localhost:${MINIO_PF_PORT} → minio-service:9000)..."
kubectl port-forward svc/minio-service -n "$NAMESPACE" "${MINIO_PF_PORT}:9000" \
    >/dev/null 2>&1 &
PF_PID=$!

log "Aguardando port-forward ficar disponível..."
wait_port "$MINIO_PF_PORT" \
    || err "Port-forward não ficou disponível após 15 segundos (PID ${PF_PID})"

# MinIO no K8s usa TLS auto-assinado; --insecure ignora validação do certificado
log "Configurando alias mc 'k8s-minio' (HTTPS com cert auto-assinado)..."
mc --insecure alias set k8s-minio \
    "https://localhost:${MINIO_PF_PORT}" \
    "$MINIO_USER" "$MINIO_PASS" \
    --api S3v4 \
    >/dev/null

log "Espelhando bucket '${MINIO_BUCKET}' → ${WORK_DIR}/minio/ ..."
mc --insecure mirror --preserve "k8s-minio/${MINIO_BUCKET}" "${WORK_DIR}/minio/"

MINIO_SIZE="$(du -sh "${WORK_DIR}/minio" | cut -f1)"
log "Mirror MinIO concluído — tamanho: ${MINIO_SIZE}"

# Encerra port-forward antes de comprimir
kill "$PF_PID" 2>/dev/null || true
wait "$PF_PID" 2>/dev/null || true
PF_PID=""

# ── Gravar metadados ──────────────────────────────────────────────────────────
cat > "${WORK_DIR}/metadata.json" <<EOF
{
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "namespace": "${NAMESPACE}",
  "db_name": "${DB_NAME}",
  "db_user": "${DB_USER}",
  "minio_bucket": "${MINIO_BUCKET}",
  "postgres_pod": "${POSTGRES_POD}"
}
EOF

# ── Compactar arquivo final ───────────────────────────────────────────────────
log "Compactando → ${ARCHIVE} ..."
tar -czf "$ARCHIVE" -C "$BACKUP_BASE" "backup_${TIMESTAMP}/"

ARCHIVE_SIZE="$(du -sh "$ARCHIVE" | cut -f1)"

log "══════════════════════════════════════════════════"
log "Backup concluído com sucesso!"
log "Arquivo  : ${ARCHIVE}"
log "Tamanho  : ${ARCHIVE_SIZE}"
log "Banco    : ${DB_NAME} (${DUMP_SIZE})"
log "MinIO    : bucket '${MINIO_BUCKET}' (${MINIO_SIZE})"
log "══════════════════════════════════════════════════"
