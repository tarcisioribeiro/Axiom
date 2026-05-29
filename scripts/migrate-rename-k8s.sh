#!/usr/bin/env bash
# =============================================================================
# Axiom — Migração de rename MindLedger → Axiom (Kubernetes / k3s)
# =============================================================================
# O que este script faz:
#   Detecta se o namespace 'mindledger' existe no cluster. Se sim:
#     1. Dump do PostgreSQL do namespace antigo (mindledger)
#     2. Copia dados do MinIO do namespace antigo para o novo
#     3. Aplica os manifests no namespace novo (axiom)
#     4. Restaura o dump no PostgreSQL do namespace novo
#     5. Escala para zero o namespace antigo
#     6. Instrui a troca do Ingress
#   Se não existir namespace antigo, aplica direto os manifests.
#
# Pré-requisitos:
#   - kubectl configurado e com acesso ao cluster
#   - envsubst disponível (apt install gettext-base)
#   - Variáveis de ambiente do k8s/scripts/apply-production.sh exportadas
#   - Para staging: variáveis do k8s/scripts/apply-staging.sh exportadas
#
# Uso:
#   bash scripts/migrate-rename-k8s.sh [production|staging] [--dry-run]
#
# Exemplos:
#   bash scripts/migrate-rename-k8s.sh production
#   bash scripts/migrate-rename-k8s.sh staging --dry-run
# =============================================================================

set -euo pipefail

TARGET="${1:-production}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}    $*"; }
error()   { echo -e "${RED}[ERROR]${NC}   $*"; exit 1; }
step()    { echo -e "${CYAN}[STEP]${NC}    $*"; }
dry_run() { echo -e "${YELLOW}[DRY-RUN]${NC} Executaria: $*"; }

# ---------------------------------------------------------------------------
# Configuração por ambiente
# ---------------------------------------------------------------------------
if [[ "$TARGET" == "production" ]]; then
    OLD_NAMESPACE="mindledger"
    NEW_NAMESPACE="axiom"
    OLD_DB_NAME="${OLD_DB_NAME:-mindledger_db}"
    NEW_DB_NAME="${DB_NAME:-axiom_db}"
    OLD_BUCKET="${OLD_MINIO_BUCKET:-mindledger}"
    NEW_BUCKET="${MINIO_BUCKET_NAME:-axiom}"
    DB_USER="${DB_USER:?Exporte DB_USER}"
    DB_PASSWORD="${DB_PASSWORD:?Exporte DB_PASSWORD}"
    MINIO_ROOT_USER="${MINIO_ROOT_USER:?Exporte MINIO_ROOT_USER}"
    MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?Exporte MINIO_ROOT_PASSWORD}"
    MANIFEST_NAMESPACE_FILE="k8s/base/namespace.yaml"
    APPLY_SCRIPT="k8s/scripts/apply-production.sh"
elif [[ "$TARGET" == "staging" ]]; then
    OLD_NAMESPACE="mindledger-staging"
    NEW_NAMESPACE="axiom-staging"
    OLD_DB_NAME="${OLD_STAGING_DB_NAME:-mindledger_staging}"
    NEW_DB_NAME="${STAGING_DB_NAME:-axiom_staging}"
    OLD_BUCKET="${OLD_STAGING_MINIO_BUCKET:-mindledger-staging}"
    NEW_BUCKET="${STAGING_MINIO_BUCKET:-axiom-staging}"
    DB_USER="${STAGING_DB_USER:?Exporte STAGING_DB_USER}"
    DB_PASSWORD="${STAGING_DB_PASSWORD:?Exporte STAGING_DB_PASSWORD}"
    MINIO_ROOT_USER="${STAGING_MINIO_ROOT_USER:?Exporte STAGING_MINIO_ROOT_USER}"
    MINIO_ROOT_PASSWORD="${STAGING_MINIO_ROOT_PASSWORD:?Exporte STAGING_MINIO_ROOT_PASSWORD}"
    MANIFEST_NAMESPACE_FILE="k8s/staging/namespace.yaml"
    APPLY_SCRIPT="k8s/scripts/apply-staging.sh"
else
    error "Target inválido: '$TARGET'. Use 'production' ou 'staging'."
fi

info "Ambiente: $TARGET"
info "Namespace antigo: $OLD_NAMESPACE  →  Novo: $NEW_NAMESPACE"
info "DB antigo: $OLD_DB_NAME  →  Novo: $NEW_DB_NAME"
info "Bucket antigo: $OLD_BUCKET  →  Novo: $NEW_BUCKET"
[[ "$DRY_RUN" == "true" ]] && warn "Modo DRY-RUN ativado — nenhuma alteração será feita."
echo ""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
kube_exec_db() {
    # kube_exec_db <namespace> <command>
    local ns="$1"; shift
    local DB_POD
    DB_POD=$(kubectl get pod -n "$ns" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    [[ -z "$DB_POD" ]] && error "Pod postgres não encontrado no namespace '$ns'."
    kubectl exec -n "$ns" "$DB_POD" -- bash -c "$@"
}

kube_exec_minio() {
    local ns="$1"; shift
    local MINIO_POD
    MINIO_POD=$(kubectl get pod -n "$ns" -l app=minio -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    [[ -z "$MINIO_POD" ]] && error "Pod minio não encontrado no namespace '$ns'."
    kubectl exec -n "$ns" "$MINIO_POD" -- sh -c "$@"
}

wait_for_deployment() {
    local ns="$1" deploy="$2" timeout="${3:-180}"
    info "  Aguardando deployment/$deploy em $ns (timeout: ${timeout}s)..."
    kubectl rollout status "deployment/$deploy" -n "$ns" --timeout="${timeout}s"
}

# ---------------------------------------------------------------------------
# Verifica se namespace antigo existe
# ---------------------------------------------------------------------------
OLD_NS_EXISTS=$(kubectl get namespace "$OLD_NAMESPACE" --no-headers 2>/dev/null | wc -l || echo "0")

if [[ "$OLD_NS_EXISTS" -eq 0 ]]; then
    info "Namespace '$OLD_NAMESPACE' não encontrado no cluster."
    info "Não há dados para migrar — aplicando manifests diretamente no namespace '$NEW_NAMESPACE'."
    echo ""

    if [[ "$DRY_RUN" == "false" ]]; then
        bash "$APPLY_SCRIPT"
    else
        dry_run "bash $APPLY_SCRIPT"
    fi
    exit 0
fi

info "Namespace '$OLD_NAMESPACE' encontrado — iniciando migração de dados."
echo ""

# ---------------------------------------------------------------------------
# Etapa 1 — Backup do PostgreSQL do namespace antigo
# ---------------------------------------------------------------------------
step "[1/7] Dump do PostgreSQL: $OLD_NAMESPACE/$OLD_DB_NAME..."
mkdir -p backups
DUMP_FILE="backups/k8s_${TARGET}_pre_rename_$(date +%Y%m%d_%H%M%S).sql"

if [[ "$DRY_RUN" == "false" ]]; then
    kube_exec_db "$OLD_NAMESPACE" \
        "PGPASSWORD='$DB_PASSWORD' pg_dump -U '$DB_USER' '$OLD_DB_NAME'" \
        > "$DUMP_FILE" \
        && info "Dump salvo: $DUMP_FILE ($(du -sh "$DUMP_FILE" | cut -f1))" \
        || error "Falha no pg_dump. Abortando."
else
    dry_run "kubectl exec postgres/$OLD_NAMESPACE — pg_dump $OLD_DB_NAME > $DUMP_FILE"
fi

# ---------------------------------------------------------------------------
# Etapa 2 — Coleta dados de conexão do MinIO antigo
# ---------------------------------------------------------------------------
step "[2/7] Exportando dados do MinIO: $OLD_NAMESPACE/$OLD_BUCKET..."
MINIO_DUMP_DIR="backups/minio_${TARGET}_$(date +%Y%m%d_%H%M%S)"

if [[ "$DRY_RUN" == "false" ]]; then
    mkdir -p "$MINIO_DUMP_DIR"
    # Usa kubectl cp para copiar os dados binários do volume MinIO para host
    MINIO_POD=$(kubectl get pod -n "$OLD_NAMESPACE" -l app=minio -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [[ -n "$MINIO_POD" ]]; then
        kubectl cp "$OLD_NAMESPACE/$MINIO_POD:/data/$OLD_BUCKET" "$MINIO_DUMP_DIR/$OLD_BUCKET" 2>/dev/null \
            && info "Dados MinIO copiados para: $MINIO_DUMP_DIR/" \
            || warn "Falha ao copiar dados MinIO via kubectl cp — será feita cópia direta entre pods após deploy."
    fi
else
    dry_run "kubectl cp $OLD_NAMESPACE/minio-pod:/data/$OLD_BUCKET $MINIO_DUMP_DIR/"
fi

# ---------------------------------------------------------------------------
# Etapa 3 — Escala para zero o namespace antigo (modo manutenção)
# ---------------------------------------------------------------------------
step "[3/7] Entrando em modo manutenção: escalando deployments para 0 em '$OLD_NAMESPACE'..."

if [[ "$DRY_RUN" == "false" ]]; then
    for deploy in $(kubectl get deployments -n "$OLD_NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
        kubectl scale deployment "$deploy" -n "$OLD_NAMESPACE" --replicas=0 \
            && info "  Escalado para 0: $deploy" \
            || warn "  Falha ao escalar $deploy (ignorado)"
    done
else
    dry_run "kubectl scale deployment --all --replicas=0 -n $OLD_NAMESPACE"
fi

# ---------------------------------------------------------------------------
# Etapa 4 — Aplica manifests no namespace novo
# ---------------------------------------------------------------------------
step "[4/7] Aplicando manifests no namespace '$NEW_NAMESPACE'..."

if [[ "$DRY_RUN" == "false" ]]; then
    # Aplica apenas infraestrutura base (sem API/frontend ainda)
    kubectl apply -f "$MANIFEST_NAMESPACE_FILE"

    if [[ "$TARGET" == "production" ]]; then
        kubectl apply -f k8s/serviceaccounts.yaml
        kubectl apply -f k8s/resource-quota.yaml
        kubectl apply -f k8s/network-policy.yaml
        envsubst < k8s/base/configmap.yaml | kubectl apply -f -
        kubectl apply -f k8s/postgres/configmap.yaml
        kubectl apply -f k8s/postgres/pvc.yaml
        kubectl apply -f k8s/postgres/deployment.yaml
        kubectl apply -f k8s/postgres/service.yaml
        kubectl apply -f k8s/redis/pvc.yaml
        kubectl apply -f k8s/redis/deployment.yaml
        kubectl apply -f k8s/redis/service.yaml
        kubectl apply -f k8s/minio/pvc.yaml
        kubectl apply -f k8s/minio/deployment.yaml
        kubectl apply -f k8s/minio/service.yaml
    else
        kubectl apply -f k8s/staging/namespace.yaml
        envsubst < k8s/staging/configmap.yaml | kubectl apply -f -
        kubectl apply -f k8s/staging/postgres/configmap.yaml
        kubectl apply -f k8s/staging/postgres/pvc.yaml
        kubectl apply -f k8s/staging/postgres/deployment.yaml
        kubectl apply -f k8s/staging/postgres/service.yaml
        kubectl apply -f k8s/staging/redis/pvc.yaml
        kubectl apply -f k8s/staging/redis/deployment.yaml
        kubectl apply -f k8s/staging/redis/service.yaml
        kubectl apply -f k8s/staging/minio/pvc.yaml
        kubectl apply -f k8s/staging/minio/deployment.yaml
        kubectl apply -f k8s/staging/minio/service.yaml
    fi

    wait_for_deployment "$NEW_NAMESPACE" "postgres" 120
    wait_for_deployment "$NEW_NAMESPACE" "minio" 90
    info "Infraestrutura base pronta em '$NEW_NAMESPACE'."
else
    dry_run "kubectl apply -f $MANIFEST_NAMESPACE_FILE + infra (postgres, redis, minio)"
fi

# ---------------------------------------------------------------------------
# Etapa 5 — Restaura dump no novo PostgreSQL
# ---------------------------------------------------------------------------
step "[5/7] Restaurando banco '$NEW_DB_NAME' em '$NEW_NAMESPACE'..."

if [[ "$DRY_RUN" == "false" ]]; then
    # Cria o banco se não existir
    kube_exec_db "$NEW_NAMESPACE" \
        "PGPASSWORD='$DB_PASSWORD' psql -U '$DB_USER' postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$NEW_DB_NAME'\" | grep -q 1 || PGPASSWORD='$DB_PASSWORD' createdb -U '$DB_USER' '$NEW_DB_NAME'"

    # Restaura
    kubectl exec -n "$NEW_NAMESPACE" \
        "$(kubectl get pod -n "$NEW_NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')" \
        -i -- bash -c "PGPASSWORD='$DB_PASSWORD' psql -U '$DB_USER' '$NEW_DB_NAME'" \
        < "$DUMP_FILE" \
        && info "Banco restaurado com sucesso." \
        || error "Falha ao restaurar dump. Verifique '$DUMP_FILE'."
else
    dry_run "kubectl exec postgres/$NEW_NAMESPACE — psql $NEW_DB_NAME < $DUMP_FILE"
fi

# ---------------------------------------------------------------------------
# Etapa 6 — Copia dados MinIO entre namespaces
# ---------------------------------------------------------------------------
step "[6/7] Copiando dados MinIO: $OLD_BUCKET → $NEW_BUCKET em '$NEW_NAMESPACE'..."

if [[ "$DRY_RUN" == "false" ]]; then
    NEW_MINIO_POD=$(kubectl get pod -n "$NEW_NAMESPACE" -l app=minio -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [[ -n "$NEW_MINIO_POD" ]] && [[ -d "$MINIO_DUMP_DIR/$OLD_BUCKET" ]]; then
        # Cria bucket no novo MinIO
        kubectl exec -n "$NEW_NAMESPACE" "$NEW_MINIO_POD" -- \
            sh -c "mkdir -p /data/$NEW_BUCKET"

        # Copia dados do host para o novo pod
        kubectl cp "$MINIO_DUMP_DIR/$OLD_BUCKET/." "$NEW_NAMESPACE/$NEW_MINIO_POD:/data/$NEW_BUCKET/" \
            && info "Dados MinIO copiados para '$NEW_BUCKET' em '$NEW_NAMESPACE'." \
            || warn "Falha ao copiar dados MinIO — verifique manualmente em $MINIO_DUMP_DIR/"
    else
        warn "Dados locais do MinIO não encontrados em '$MINIO_DUMP_DIR/$OLD_BUCKET'."
        warn "Copie manualmente: kubectl cp $MINIO_DUMP_DIR/$OLD_BUCKET $NEW_NAMESPACE/$NEW_MINIO_POD:/data/$NEW_BUCKET/"
    fi
else
    dry_run "kubectl cp $MINIO_DUMP_DIR/$OLD_BUCKET $NEW_NAMESPACE/minio-pod:/data/$NEW_BUCKET/"
fi

# ---------------------------------------------------------------------------
# Etapa 7 — Sobe API, Frontend e demais recursos
# ---------------------------------------------------------------------------
step "[7/7] Subindo API, Frontend e recursos restantes em '$NEW_NAMESPACE'..."

if [[ "$DRY_RUN" == "false" ]]; then
    bash "$APPLY_SCRIPT"
else
    dry_run "bash $APPLY_SCRIPT"
fi

# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------
echo ""
echo "================================================================"
if [[ "$DRY_RUN" == "false" ]]; then
    info "Migração concluída!"
    echo ""
    echo "  Namespace ativo : $NEW_NAMESPACE"
    echo "  Banco de dados  : $NEW_DB_NAME"
    echo "  Bucket MinIO    : $NEW_BUCKET"
    echo "  Dump salvo em   : $DUMP_FILE"
    echo ""
    echo "Próximos passos manuais:"
    echo ""
    echo "  1. Verifique os pods:"
    echo "     kubectl get pods -n $NEW_NAMESPACE"
    echo ""
    echo "  2. Verifique os logs da API:"
    echo "     kubectl logs -n $NEW_NAMESPACE -l app=api --tail=50"
    echo ""
    echo "  3. Confirme que a aplicação está funcionando no domínio."
    echo ""
    echo "  4. Após validar completamente, remova o namespace antigo:"
    echo "     kubectl delete namespace $OLD_NAMESPACE"
    echo ""
    echo "  ATENÇÃO: O namespace '$OLD_NAMESPACE' foi escalado para 0 mas"
    echo "  NÃO foi deletado. Os dados originais ainda estão lá como fallback."
else
    warn "Dry-run concluído — nenhuma alteração foi feita."
    echo "Execute sem --dry-run para aplicar."
fi
echo "================================================================"
