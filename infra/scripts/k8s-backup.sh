#!/usr/bin/env bash
# =============================================================================
# k8s-backup.sh — Backup de produção Kubernetes → arquivo local
# =============================================================================
# Exporta: dump PostgreSQL (via rede, no Postgres externo ao cluster) +
#          arquivos MinIO (ainda in-cluster)
# Saída  : backups/backup_YYYYMMDD_HHMMSS.tar.gz
#
# O PostgreSQL roda fora do cluster (VM auto-gerenciada — veja
# documentation/database/infrastructure.md), então esta máquina precisa ter
# acesso de rede a ele (túnel WireGuard ou allowlist de firewall, conforme o
# runbook) para que o pg_dump abaixo funcione.
#
# Dependências: kubectl (contexto configurado, só para MinIO/ConfigMap),
#               pg_dump (cliente PostgreSQL), mc (MinIO Client)
# Uso: ./infra/scripts/k8s-backup.sh
# =============================================================================

set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────
NAMESPACE="axiom"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_BASE="${REPO_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
WORK_DIR="${BACKUP_BASE}/backup_${TIMESTAMP}"
ARCHIVE="${BACKUP_BASE}/backup_${TIMESTAMP}.tar.gz"
MINIO_PF_PORT=19000  # porta local para port-forward (diferente do MinIO local: 39105)

# MinIO Client pode colidir com o Midnight Commander (/usr/bin/mc).
# Procura em ~/bin/mc primeiro; depois mcli; depois mc no PATH verificando a versão.
resolve_mc() {
    local candidates=("$HOME/bin/mc" "$HOME/.local/bin/mc" "/usr/local/bin/mc" "$(command -v mcli 2>/dev/null || true)" "$(command -v mc 2>/dev/null || true)")
    for bin in "${candidates[@]}"; do
        [[ -z "$bin" || ! -x "$bin" ]] && continue
        if "$bin" --version 2>/dev/null | grep -q 'MinIO'; then
            echo "$bin"; return 0
        fi
    done
    return 1
}
MC="$(resolve_mc)" || err "MinIO Client (mc/mcli) não encontrado. Instale de https://min.io/docs/minio/linux/reference/minio-mc.html"

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
for cmd in kubectl pg_dump; do
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

# Host/porta do Postgres self-managed (mesma VPS do k3s), injetados em
# axiom-secrets a partir das variáveis de CI/CD — veja deploy:staging /
# deploy:production em .gitlab-ci.yml. DB_SSLMODE não é sensível e continua
# no ConfigMap axiom-config.
DB_HOST="$(read_secret DB_HOST)"
DB_PORT="$(read_secret DB_PORT)"
DB_SSLMODE="$(kubectl get configmap axiom-config -n "$NAMESPACE" \
    -o jsonpath='{.data.DB_SSLMODE}' 2>/dev/null || echo 'prefer')"
[[ -z "$DB_HOST" ]] && err "DB_HOST não encontrado em axiom-secrets"
[[ -z "$DB_PORT" ]] && DB_PORT="5432"

# Bucket definido no ConfigMap (fallback: axiom)
MINIO_BUCKET="$(kubectl get configmap axiom-config -n "$NAMESPACE" \
    -o jsonpath='{.data.MINIO_BUCKET_NAME}' 2>/dev/null || echo 'axiom')"
[[ -z "$MINIO_BUCKET" ]] && MINIO_BUCKET="axiom"

log "Banco de dados : ${DB_NAME} (usuário: ${DB_USER}) em ${DB_HOST}:${DB_PORT}"
log "Bucket MinIO   : ${MINIO_BUCKET}"

# ── Criar diretório de trabalho ───────────────────────────────────────────────
mkdir -p "${WORK_DIR}/minio"
log "Diretório de trabalho: ${WORK_DIR}"

# ── Backup PostgreSQL ─────────────────────────────────────────────────────────
log "Conectando ao PostgreSQL externo em ${DB_HOST}:${DB_PORT}..."
log "Executando pg_dump (formato custom)..."

PGSSLMODE="$DB_SSLMODE" PGPASSWORD="$DB_PASSWORD" \
    pg_dump \
        -h "$DB_HOST" -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --no-acl \
        --no-owner \
        --compress=6 \
    > "${WORK_DIR}/database.dump" \
    || err "pg_dump falhou — verifique conectividade de rede com ${DB_HOST}:${DB_PORT} (VPN/firewall configurados? veja documentation/database/infrastructure.md)"

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
"$MC" --insecure alias set k8s-minio \
    "https://localhost:${MINIO_PF_PORT}" \
    "$MINIO_USER" "$MINIO_PASS" \
    --api S3v4 \
    >/dev/null

log "Espelhando bucket '${MINIO_BUCKET}' → ${WORK_DIR}/minio/ ..."
"$MC" --insecure mirror --preserve "k8s-minio/${MINIO_BUCKET}" "${WORK_DIR}/minio/"

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
  "db_host": "${DB_HOST}",
  "db_port": "${DB_PORT}",
  "minio_bucket": "${MINIO_BUCKET}"
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
