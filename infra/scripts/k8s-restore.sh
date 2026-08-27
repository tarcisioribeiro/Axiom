#!/usr/bin/env bash
# =============================================================================
# k8s-restore.sh — Replica os dados de PRODUÇÃO em STAGING (Kubernetes)
# =============================================================================
# Copia, no cluster k3s:
#   • PostgreSQL  : dump do banco de produção (namespace `axiom`) e restaura
#                   no banco de staging (namespace `axiom-staging`)
#   • MinIO       : espelha o bucket de produção (`axiom`) no bucket de
#                   staging (`axiom-staging`), objeto a objeto
#
# PostgreSQL e MinIO rodam self-managed, FORA do cluster (veja
# documentation/database/infrastructure.md e
# documentation/storage/infrastructure.md). Esta máquina precisa de acesso de
# rede a AMBOS os Postgres (produção e staging — hoje o mesmo host) e ao
# MinIO externo. O `kubectl` é usado só para ler Secret/ConfigMap e para
# orquestrar os Deployments de staging durante a janela de manutenção.
#
# ── O QUE O SCRIPT FAZ, EM ORDEM ─────────────────────────────────────────────
#   1. Lê credenciais de `axiom-secrets` / `axiom-config` nos dois namespaces
#   2. Suspende o CronJob de backup de staging e escala api/frontend para 0
#   3. pg_dump (produção) → pg_restore --clean (staging)
#   4. mc mirror  prod/axiom → staging/axiom-staging
#   5. Sobe um Pod efêmero com a imagem da api de staging e roda:
#        • manage.py migrate                     (alinha o schema ao código)
#        • manage.py rotate_encryption_key       (só se as ENCRYPTION_KEY
#          --old-key <prod> --new-key <staging>   de prod e staging diferirem)
#        • manage.py fix_storage_config_for_local (reaponta o SystemConfig
#          MinIO para o bucket/endpoint de staging)
#   6. Reescala api/frontend, reativa o CronJob, dá FLUSHALL no Redis de staging
#
# ── LIMITAÇÕES CONHECIDAS ────────────────────────────────────────────────────
#   • `rotate_encryption_key` NÃO cobre os segredos do admin_panel.SystemConfig
#     além das 4 chaves de MinIO (chaves de LLM, e-mail, backup). Se
#     PRODUCTION_ENCRYPTION_KEY != STAGING_ENCRYPTION_KEY, essas linhas ficam
#     ilegíveis em staging e precisam ser reconfiguradas no Django Admin.
#     Para um clone 1:1 sem esse trabalho, defina a variável de CI
#     STAGING_ENCRYPTION_KEY igual à de produção e rode com --no-rotate.
#   • Se o schema de staging (branch develop) estiver à frente de produção
#     (branch main) por uma data-migration que reescreve campos criptografados,
#     rode este script logo após um deploy de produção para minimizar o gap.
#
# Dependências: kubectl (contexto do cluster k3s), pg_dump, pg_restore,
#               mc (MinIO Client — veja resolve_mc abaixo)
# Uso: ./infra/scripts/k8s-restore.sh [opções]
#   --yes                Não pede confirmação interativa
#   --skip-db            Não toca no PostgreSQL
#   --skip-minio         Não toca no MinIO
#   --no-remove          `mc mirror` sem --remove (não apaga objetos órfãos
#                        em staging que não existem em produção)
#   --no-rotate          Não roda rotate_encryption_key mesmo se as chaves
#                        diferirem (use quando STAGING_ENCRYPTION_KEY já é
#                        igual à de produção)
#   --strict             Aborta se o pg_restore reportar qualquer erro
#   --dump-file PATH     Reusa um dump já existente em vez de rodar pg_dump
#   --keep-dump          Não apaga o dump temporário ao final
#   -h | --help          Esta ajuda
# =============================================================================

set -euo pipefail

# ── Configuração ──────────────────────────────────────────────────────────────
PROD_NS="axiom"
STAGING_NS="axiom-staging"
STAGING_BACKUP_CRONJOB="axiom-db-backup-staging"
FIXUP_POD="axiom-clone-fixup"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_BASE="${REPO_ROOT}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# ── Opções ───────────────────────────────────────────────────────────────────
ASSUME_YES=0
SKIP_DB=0
SKIP_MINIO=0
MIRROR_REMOVE=1
DO_ROTATE=1
STRICT=0
DUMP_FILE=""
KEEP_DUMP=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes)        ASSUME_YES=1 ;;
        --skip-db)    SKIP_DB=1 ;;
        --skip-minio) SKIP_MINIO=1 ;;
        --no-remove)  MIRROR_REMOVE=0 ;;
        --no-rotate)  DO_ROTATE=0 ;;
        --strict)     STRICT=1 ;;
        --dump-file)  DUMP_FILE="${2:-}"; shift ;;
        --keep-dump)  KEEP_DUMP=1 ;;
        -h|--help)    sed -n '2,57p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Opção desconhecida: $1 (use --help)"; exit 1 ;;
    esac
    shift
done

# ── Funções auxiliares ────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[$(date '+%H:%M:%S')] AVISO: $*" >&2; }
err()  { echo "[$(date '+%H:%M:%S')] ERRO: $*" >&2; exit 1; }

# MinIO Client pode colidir com o Midnight Commander (/usr/bin/mc).
resolve_mc() {
    local candidates=("$HOME/bin/mc" "$HOME/.local/bin/mc" "/usr/local/bin/mc" \
        "$(command -v mcli 2>/dev/null || true)" "$(command -v mc 2>/dev/null || true)")
    for bin in "${candidates[@]}"; do
        [[ -z "$bin" || ! -x "$bin" ]] && continue
        if "$bin" --version 2>/dev/null | grep -q 'MinIO'; then
            echo "$bin"; return 0
        fi
    done
    return 1
}

read_secret() {  # read_secret <namespace> <key>
    local ns="$1" key="$2" val
    val="$(kubectl get secret axiom-secrets -n "$ns" \
        -o jsonpath="{.data.${key}}" 2>/dev/null | base64 -d 2>/dev/null || true)"
    echo "$val"
}

read_config() {  # read_config <namespace> <key> <default>
    local ns="$1" key="$2" def="${3:-}" val
    val="$(kubectl get configmap axiom-config -n "$ns" \
        -o jsonpath="{.data.${key}}" 2>/dev/null || true)"
    echo "${val:-$def}"
}

# alias mc a partir de MINIO_ENDPOINT / MINIO_USE_SSL do namespace
mc_alias_from_ns() {  # mc_alias_from_ns <alias> <namespace>
    local alias="$1" ns="$2" endpoint user pass use_ssl scheme url
    endpoint="$(read_secret "$ns" MINIO_ENDPOINT)"
    user="$(read_secret "$ns" MINIO_ROOT_USER)"
    pass="$(read_secret "$ns" MINIO_ROOT_PASSWORD)"
    use_ssl="$(read_config "$ns" MINIO_USE_SSL true)"
    [[ -z "$endpoint" ]] && err "MINIO_ENDPOINT não encontrado em axiom-secrets ($ns)"
    [[ -z "$user" || -z "$pass" ]] && err "credenciais MinIO ausentes em axiom-secrets ($ns)"
    url="$endpoint"
    if [[ "$url" != http://* && "$url" != https://* ]]; then
        scheme="https"; [[ "$use_ssl" == "false" ]] && scheme="http"
        url="${scheme}://${endpoint}"
    fi
    "$MC" alias set "$alias" "$url" "$user" "$pass" --api S3v4 >/dev/null \
        || err "falha ao configurar alias mc '$alias' → $url"
    echo "$url"
}

CLEANUP_DONE=0
restore_deployments() {
    [[ "$CLEANUP_DONE" == 1 ]] && return
    CLEANUP_DONE=1
    log "Restaurando estado dos Deployments de staging..."
    kubectl -n "$STAGING_NS" delete pod "$FIXUP_POD" --ignore-not-found --wait=false >/dev/null 2>&1 || true
    if [[ -n "${SCALE_API_ORIG:-}" ]]; then
        kubectl -n "$STAGING_NS" scale deployment/api --replicas="$SCALE_API_ORIG" >/dev/null 2>&1 || true
    fi
    if [[ -n "${SCALE_FRONT_ORIG:-}" ]]; then
        kubectl -n "$STAGING_NS" scale deployment/frontend --replicas="$SCALE_FRONT_ORIG" >/dev/null 2>&1 || true
    fi
    if [[ "${CRONJOB_WAS_SUSPENDED:-}" == "0" ]]; then
        kubectl -n "$STAGING_NS" patch cronjob "$STAGING_BACKUP_CRONJOB" \
            -p '{"spec":{"suspend":false}}' >/dev/null 2>&1 || true
    fi
}
trap 'rc=$?; if [[ $rc -ne 0 ]]; then warn "script interrompido (rc=$rc) — revertendo"; restore_deployments; fi' EXIT

# ── Verificação de dependências ───────────────────────────────────────────────
REQUIRED_CMDS=(kubectl)
[[ "$SKIP_DB" == 0 ]] && REQUIRED_CMDS+=(pg_dump pg_restore psql)
for cmd in "${REQUIRED_CMDS[@]}"; do
    command -v "$cmd" &>/dev/null || err "Dependência não encontrada: '$cmd'."
done
MC=""
if [[ "$SKIP_MINIO" == 0 ]]; then
    MC="$(resolve_mc)" || err "MinIO Client (mc/mcli) não encontrado. Instale de https://min.io/docs/minio/linux/reference/minio-mc.html (ou use --skip-minio)"
fi

# ── Verificar acesso aos dois namespaces ─────────────────────────────────────
log "Contexto kubectl: $(kubectl config current-context 2>/dev/null || echo '?')"
for ns in "$PROD_NS" "$STAGING_NS"; do
    kubectl get namespace "$ns" &>/dev/null || err "Namespace '$ns' não encontrado. Verifique o contexto kubectl."
done

# ── Ler credenciais dos dois ambientes ──────────────────────────────────────
log "Lendo credenciais de produção (ns: $PROD_NS)..."
P_DB_NAME="$(read_secret "$PROD_NS" DB_NAME)"
P_DB_USER="$(read_secret "$PROD_NS" DB_USER)"
P_DB_PASS="$(read_secret "$PROD_NS" DB_PASSWORD)"
P_DB_HOST="$(read_secret "$PROD_NS" DB_HOST)"
P_DB_PORT="$(read_secret "$PROD_NS" DB_PORT)"
P_DB_SSLMODE="$(read_config "$PROD_NS" DB_SSLMODE prefer)"
P_MINIO_BUCKET="$(read_config "$PROD_NS" MINIO_BUCKET_NAME axiom)"
P_ENC_KEY="$(read_secret "$PROD_NS" ENCRYPTION_KEY)"

log "Lendo credenciais de staging (ns: $STAGING_NS)..."
S_DB_NAME="$(read_secret "$STAGING_NS" DB_NAME)"
S_DB_USER="$(read_secret "$STAGING_NS" DB_USER)"
S_DB_PASS="$(read_secret "$STAGING_NS" DB_PASSWORD)"
S_DB_HOST="$(read_secret "$STAGING_NS" DB_HOST)"
S_DB_PORT="$(read_secret "$STAGING_NS" DB_PORT)"
S_DB_SSLMODE="$(read_config "$STAGING_NS" DB_SSLMODE prefer)"
S_MINIO_BUCKET="$(read_config "$STAGING_NS" MINIO_BUCKET_NAME axiom-staging)"
S_ENC_KEY="$(read_secret "$STAGING_NS" ENCRYPTION_KEY)"
S_REDIS_PASS="$(read_secret "$STAGING_NS" REDIS_PASSWORD)"

[[ -z "$P_DB_PORT" ]] && P_DB_PORT="5432"
[[ -z "$S_DB_PORT" ]] && S_DB_PORT="5432"

if [[ "$SKIP_DB" == 0 ]]; then
    for v in P_DB_NAME P_DB_USER P_DB_PASS P_DB_HOST S_DB_NAME S_DB_USER S_DB_PASS S_DB_HOST; do
        [[ -z "${!v}" ]] && err "valor obrigatório ausente: $v (Secret axiom-secrets)"
    done
    if [[ "$P_DB_HOST:$P_DB_PORT/$P_DB_NAME" == "$S_DB_HOST:$S_DB_PORT/$S_DB_NAME" ]]; then
        err "banco de produção e de staging são o MESMO ($S_DB_HOST:$S_DB_PORT/$S_DB_NAME). Abortando para não sobrescrever produção."
    fi
fi

ROTATE_NEEDED=0
if [[ "$SKIP_DB" == 0 && "$DO_ROTATE" == 1 ]]; then
    if [[ -z "$P_ENC_KEY" || -z "$S_ENC_KEY" ]]; then
        warn "Não foi possível ler ENCRYPTION_KEY de um dos ambientes — rotate será PULADO. Dados criptografados podem ficar ilegíveis em staging."
    elif [[ "$P_ENC_KEY" != "$S_ENC_KEY" ]]; then
        ROTATE_NEEDED=1
    fi
fi

# ── Plano + confirmação ─────────────────────────────────────────────────────
echo ""
echo "═══════════════════════ PLANO DE REPLICAÇÃO ═══════════════════════"
if [[ "$SKIP_DB" == 0 ]]; then
    echo "  PostgreSQL"
    echo "    origem  : ${P_DB_USER}@${P_DB_HOST}:${P_DB_PORT}/${P_DB_NAME}  (sslmode=${P_DB_SSLMODE})"
    echo "    destino : ${S_DB_USER}@${S_DB_HOST}:${S_DB_PORT}/${S_DB_NAME}  (sslmode=${S_DB_SSLMODE})"
    echo "    modo    : pg_restore --clean --if-exists --no-owner --no-acl $( [[ $STRICT == 1 ]] && echo '--exit-on-error --single-transaction' || echo '-j 2' )"
    echo "    rotate  : $( [[ $ROTATE_NEEDED == 1 ]] && echo 'SIM (chaves diferem)' || echo 'não' )"
else
    echo "  PostgreSQL : PULADO (--skip-db)"
fi
if [[ "$SKIP_MINIO" == 0 ]]; then
    echo "  MinIO"
    echo "    origem  : bucket '${P_MINIO_BUCKET}' (ns ${PROD_NS})"
    echo "    destino : bucket '${S_MINIO_BUCKET}' (ns ${STAGING_NS})"
    echo "    modo    : mc mirror --overwrite$( [[ $MIRROR_REMOVE == 1 ]] && echo ' --remove' )"
else
    echo "  MinIO      : PULADO (--skip-minio)"
fi
echo ""
echo "  Durante a operação, em ${STAGING_NS}:"
echo "    • CronJob ${STAGING_BACKUP_CRONJOB} suspenso"
echo "    • deployment/api e deployment/frontend escalados para 0"
echo "    • Redis: FLUSHALL ao final (limpa cache/valores decriptados obsoletos)"
echo ""
echo "  ⚠  DADOS ATUAIS DE STAGING SERÃO PERMANENTEMENTE SUBSTITUÍDOS."
echo "═════════════════════════════════════════════════════════════════"
echo ""
if [[ "$ASSUME_YES" == 0 ]]; then
    read -rp "Digite 'staging' para confirmar: " CONFIRM
    [[ "$CONFIRM" == "staging" ]] || { log "Cancelado."; CLEANUP_DONE=1; exit 0; }
fi
echo ""

# ── 1. Dump de produção (antes de mexer em staging) ─────────────────────────
if [[ "$SKIP_DB" == 0 ]]; then
    if [[ -n "$DUMP_FILE" ]]; then
        [[ -f "$DUMP_FILE" ]] || err "--dump-file '$DUMP_FILE' não existe."
        log "Reusando dump existente: $DUMP_FILE"
    else
        mkdir -p "$BACKUP_BASE"
        DUMP_FILE="${BACKUP_BASE}/prod_to_staging_${TIMESTAMP}.dump"
        log "pg_dump de produção → ${DUMP_FILE} ..."
        PGSSLMODE="$P_DB_SSLMODE" PGPASSWORD="$P_DB_PASS" \
            pg_dump -h "$P_DB_HOST" -p "$P_DB_PORT" -U "$P_DB_USER" -d "$P_DB_NAME" \
                --format=custom --no-acl --no-owner --compress=6 \
            > "$DUMP_FILE" \
            || err "pg_dump falhou — verifique conectividade com ${P_DB_HOST}:${P_DB_PORT} (veja documentation/database/infrastructure.md)"
        log "pg_dump concluído — $(du -sh "$DUMP_FILE" | cut -f1)"
    fi
fi

# ── 2. Janela de manutenção em staging ──────────────────────────────────────
CRONJOB_WAS_SUSPENDED=""
if kubectl -n "$STAGING_NS" get cronjob "$STAGING_BACKUP_CRONJOB" &>/dev/null; then
    CRONJOB_WAS_SUSPENDED="$(kubectl -n "$STAGING_NS" get cronjob "$STAGING_BACKUP_CRONJOB" -o jsonpath='{.spec.suspend}' 2>/dev/null || echo '')"
    [[ -z "$CRONJOB_WAS_SUSPENDED" ]] && CRONJOB_WAS_SUSPENDED="false"
    log "Suspendendo CronJob ${STAGING_BACKUP_CRONJOB}..."
    kubectl -n "$STAGING_NS" patch cronjob "$STAGING_BACKUP_CRONJOB" -p '{"spec":{"suspend":true}}' >/dev/null
fi
# guarda a string usada pelo trap de reversão (0 = estava ativo)
[[ "$CRONJOB_WAS_SUSPENDED" == "false" ]] && CRONJOB_WAS_SUSPENDED="0" || CRONJOB_WAS_SUSPENDED="1"

SCALE_API_ORIG="$(kubectl -n "$STAGING_NS" get deployment api -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 1)"
SCALE_FRONT_ORIG="$(kubectl -n "$STAGING_NS" get deployment frontend -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 1)"
[[ -z "$SCALE_API_ORIG" ]] && SCALE_API_ORIG=1
[[ -z "$SCALE_FRONT_ORIG" ]] && SCALE_FRONT_ORIG=1

log "Escalando deployment/api e deployment/frontend para 0 (originais: api=${SCALE_API_ORIG}, frontend=${SCALE_FRONT_ORIG})..."
kubectl -n "$STAGING_NS" scale deployment/api deployment/frontend --replicas=0 >/dev/null
kubectl -n "$STAGING_NS" wait --for=delete pod -l app=api --timeout=120s 2>/dev/null || warn "timeout aguardando pods da api sumirem — seguindo mesmo assim"

# ── 3. Restore PostgreSQL ───────────────────────────────────────────────────
if [[ "$SKIP_DB" == 0 ]]; then
    S_DSN="host=${S_DB_HOST} port=${S_DB_PORT} user=${S_DB_USER} dbname=${S_DB_NAME} sslmode=${S_DB_SSLMODE}"

    log "Encerrando conexões remanescentes em ${S_DB_NAME}..."
    PGPASSWORD="$S_DB_PASS" psql "$S_DSN" -v ON_ERROR_STOP=0 -qtA -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = current_database() AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true

    RESTORE_LOG="${BACKUP_BASE:-/tmp}/restore_${TIMESTAMP}.log"
    mkdir -p "$(dirname "$RESTORE_LOG")"
    log "pg_restore → staging (log: ${RESTORE_LOG}) ..."
    PG_RESTORE_ARGS=(--clean --if-exists --no-owner --no-acl --no-comments)
    if [[ "$STRICT" == 1 ]]; then
        # --single-transaction é incompatível com -j (múltiplos jobs).
        PG_RESTORE_ARGS+=(--exit-on-error --single-transaction)
    else
        PG_RESTORE_ARGS+=(-j 2)
    fi

    set +e
    PGPASSWORD="$S_DB_PASS" pg_restore "${PG_RESTORE_ARGS[@]}" \
        -h "$S_DB_HOST" -p "$S_DB_PORT" -U "$S_DB_USER" -d "$S_DB_NAME" \
        "$DUMP_FILE" > "$RESTORE_LOG" 2>&1
    RESTORE_RC=$?
    set -e

    ERR_COUNT="$(grep -c '^pg_restore: error:' "$RESTORE_LOG" 2>/dev/null || true)"
    ERR_COUNT="${ERR_COUNT:-0}"
    # Erros ignoráveis: DROP de objetos que não existem / extensão vector
    # (pertence ao superusuário) / comentários em extensões.
    IGNORABLE_RE='does not exist|must be owner of extension|extension "vector"|schema "vectors"|permission denied for schema (public|vectors)'
    HARD_ERRORS="$(grep '^pg_restore: error:' "$RESTORE_LOG" 2>/dev/null | grep -viE "$IGNORABLE_RE" | grep -c '' || true)"
    HARD_ERRORS="${HARD_ERRORS:-0}"

    if [[ "$STRICT" == 1 && "$RESTORE_RC" -ne 0 ]]; then
        err "pg_restore falhou em modo --strict (rc=$RESTORE_RC). Veja $RESTORE_LOG"
    fi
    if [[ "$HARD_ERRORS" -gt 0 ]]; then
        warn "pg_restore reportou ${HARD_ERRORS} erro(s) potencialmente relevante(s) (de ${ERR_COUNT} no total). Inspecione: $RESTORE_LOG"
        { grep '^pg_restore: error:' "$RESTORE_LOG" | grep -viE "$IGNORABLE_RE" | head -20 >&2; } || true
    else
        log "pg_restore concluído (${ERR_COUNT} aviso(s) ignorável(is), 0 relevante(s))."
    fi
fi

# ── 4. Mirror MinIO ────────────────────────────────────────────────────────
if [[ "$SKIP_MINIO" == 0 ]]; then
    log "Configurando aliases mc..."
    PROD_URL="$(mc_alias_from_ns axclone-prod "$PROD_NS")"
    STAGING_URL="$(mc_alias_from_ns axclone-staging "$STAGING_NS")"
    log "  prod    : ${PROD_URL}/${P_MINIO_BUCKET}"
    log "  staging : ${STAGING_URL}/${S_MINIO_BUCKET}"

    "$MC" mb --ignore-existing "axclone-staging/${S_MINIO_BUCKET}" >/dev/null 2>&1 || true

    MIRROR_ARGS=(--overwrite)
    [[ "$MIRROR_REMOVE" == 1 ]] && MIRROR_ARGS+=(--remove)
    log "mc mirror ${MIRROR_ARGS[*]} ..."
    "$MC" mirror "${MIRROR_ARGS[@]}" \
        "axclone-prod/${P_MINIO_BUCKET}" "axclone-staging/${S_MINIO_BUCKET}" \
        || err "mc mirror falhou"

    "$MC" alias rm axclone-prod >/dev/null 2>&1 || true
    "$MC" alias rm axclone-staging >/dev/null 2>&1 || true
    log "Mirror MinIO concluído."
fi

# ── 5. Pod efêmero: migrate + rotate + fix_storage_config ───────────────────
if [[ "$SKIP_DB" == 0 ]]; then
    API_IMAGE="$(kubectl -n "$STAGING_NS" get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}')"
    [[ -z "$API_IMAGE" ]] && err "não foi possível resolver a imagem da api de staging."
    log "Subindo Pod efêmero ${FIXUP_POD} (imagem: ${API_IMAGE})..."

    kubectl -n "$STAGING_NS" delete pod "$FIXUP_POD" --ignore-not-found --wait=true >/dev/null 2>&1 || true

    OVERRIDES=$(cat <<JSON
{
  "apiVersion": "v1",
  "spec": {
    "restartPolicy": "Never",
    "activeDeadlineSeconds": 1800,
    "imagePullSecrets": [{"name": "ghcr-pull-secret"}],
    "containers": [{
      "name": "${FIXUP_POD}",
      "image": "${API_IMAGE}",
      "command": ["sleep", "1800"],
      "envFrom": [
        {"configMapRef": {"name": "axiom-config"}},
        {"secretRef": {"name": "axiom-secrets"}}
      ]
    }]
  }
}
JSON
)

    kubectl -n "$STAGING_NS" run "$FIXUP_POD" \
        --image="$API_IMAGE" --restart=Never \
        --override-type=merge --overrides="$OVERRIDES" \
        --command -- sleep 1800 >/dev/null

    log "Aguardando ${FIXUP_POD} ficar Ready (máx. 180s)..."
    kubectl -n "$STAGING_NS" wait --for=condition=Ready pod/"$FIXUP_POD" --timeout=180s \
        || err "Pod ${FIXUP_POD} não ficou pronto. Verifique: kubectl -n ${STAGING_NS} describe pod/${FIXUP_POD}"

    exec_fixup() { kubectl -n "$STAGING_NS" exec "$FIXUP_POD" -- "$@"; }

    log "  manage.py migrate ..."
    exec_fixup python manage.py migrate --noinput \
        || err "migrate falhou no Pod ${FIXUP_POD}. Veja os logs; o Pod foi mantido para inspeção."

    if [[ "$ROTATE_NEEDED" == 1 ]]; then
        log "  manage.py rotate_encryption_key (prod → staging) ..."
        exec_fixup python manage.py rotate_encryption_key \
            --old-key "$P_ENC_KEY" --new-key "$S_ENC_KEY" \
            || err "rotate_encryption_key falhou. Dados podem estar parcialmente rotacionados — inspecione antes de subir a api."
    else
        log "  rotate_encryption_key: não necessário (chaves iguais ou indisponíveis)."
    fi

    log "  manage.py fix_storage_config_for_local (reaponta SystemConfig → MinIO de staging) ..."
    exec_fixup env \
        MINIO_ENDPOINT="$(read_secret "$STAGING_NS" MINIO_ENDPOINT)" \
        MINIO_BUCKET_NAME="$S_MINIO_BUCKET" \
        MINIO_ROOT_USER="$(read_secret "$STAGING_NS" MINIO_ROOT_USER)" \
        MINIO_ROOT_PASSWORD="$(read_secret "$STAGING_NS" MINIO_ROOT_PASSWORD)" \
        python manage.py fix_storage_config_for_local \
        || warn "fix_storage_config_for_local falhou — rode manualmente depois."

    kubectl -n "$STAGING_NS" delete pod "$FIXUP_POD" --ignore-not-found --wait=false >/dev/null 2>&1 || true
fi

# ── 6. Reverter janela de manutenção ───────────────────────────────────────
log "Reescalando api=${SCALE_API_ORIG}, frontend=${SCALE_FRONT_ORIG}..."
kubectl -n "$STAGING_NS" scale deployment/api --replicas="$SCALE_API_ORIG" >/dev/null
kubectl -n "$STAGING_NS" scale deployment/frontend --replicas="$SCALE_FRONT_ORIG" >/dev/null

if [[ "$CRONJOB_WAS_SUSPENDED" == "0" ]] && kubectl -n "$STAGING_NS" get cronjob "$STAGING_BACKUP_CRONJOB" &>/dev/null; then
    log "Reativando CronJob ${STAGING_BACKUP_CRONJOB}..."
    kubectl -n "$STAGING_NS" patch cronjob "$STAGING_BACKUP_CRONJOB" -p '{"spec":{"suspend":false}}' >/dev/null
fi
CLEANUP_DONE=1   # reversão manual concluída; desarma o trap

# Redis FLUSHALL — descarta cache e valores decriptados em cache do estado antigo
if [[ -n "$S_REDIS_PASS" ]] && kubectl -n "$STAGING_NS" get deployment redis &>/dev/null; then
    log "Redis FLUSHALL em staging..."
    kubectl -n "$STAGING_NS" exec deployment/redis -- \
        sh -c "redis-cli -a \"$S_REDIS_PASS\" --no-auth-warning FLUSHALL" >/dev/null 2>&1 \
        || warn "FLUSHALL falhou — rode manualmente se notar dados obsoletos em cache."
fi

log "Aguardando rollout da api (máx. 1440s)..."
kubectl -n "$STAGING_NS" rollout status deployment/api --timeout=1440s || warn "rollout da api não confirmou no prazo — verifique os pods."
kubectl -n "$STAGING_NS" rollout status deployment/frontend --timeout=300s || true

# ── Limpeza do dump ────────────────────────────────────────────────────────
# Só remove o dump gerado por este script (nome prod_to_staging_*); nunca um
# arquivo passado via --dump-file.
if [[ "$SKIP_DB" == 0 && "$KEEP_DUMP" == 0 && -f "${DUMP_FILE:-}" && "$DUMP_FILE" == *prod_to_staging_* ]]; then
    rm -f "$DUMP_FILE"
    log "Dump temporário removido (${DUMP_FILE}). Use --keep-dump para preservar."
fi

log "══════════════════════════════════════════════════"
log "Replicação produção → staging concluída."
[[ "$SKIP_DB" == 0 ]]    && log "  Banco : ${S_DB_NAME} @ ${S_DB_HOST}:${S_DB_PORT}"
[[ "$SKIP_MINIO" == 0 ]] && log "  MinIO : bucket '${S_MINIO_BUCKET}'"
[[ "$ROTATE_NEEDED" == 1 ]] && log "  Chave de criptografia rotacionada para a de staging."
log "  Valide: https://axiom-staging.tjtux.duckdns.org"
log "══════════════════════════════════════════════════"
