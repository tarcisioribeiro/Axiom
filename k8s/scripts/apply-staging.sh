#!/bin/bash
# =============================================================================
# MindLedger — Apply Staging Manifests (k3s single-node VPS)
# =============================================================================
# Usage: bash k8s/scripts/apply-staging.sh
#
# Prerequisites:
#   1. k3s installed WITHOUT Traefik:
#        curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -
#
#   2. nginx-ingress controller installed:
#        kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.0/deploy/static/provider/cloud/deploy.yaml
#        kubectl wait --namespace ingress-nginx \
#          --for=condition=ready pod \
#          --selector=app.kubernetes.io/component=controller \
#          --timeout=120s
#
#   3. cert-manager installed:
#        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
#        kubectl wait --namespace cert-manager --for=condition=ready pod --all --timeout=120s
#
#   4. GitLab registry secret created:
#        kubectl create secret docker-registry gitlab-registry-secret \
#          --docker-server=registry.gitlab.com \
#          --docker-username=YOUR_GITLAB_USERNAME \
#          --docker-password=YOUR_PERSONAL_ACCESS_TOKEN \
#          --namespace mindledger-staging
#
#   5. Secrets file populated with real values and applied:
#        export STAGING_DB_NAME=mindledger_staging
#        export STAGING_DB_USER=mindledger_staging
#        export STAGING_DB_PASSWORD=$(openssl rand -base64 24)
#        export STAGING_SECRET_KEY=$(openssl rand -base64 48)
#        export STAGING_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
#        export STAGING_SUPERUSER_USERNAME=admin
#        export STAGING_SUPERUSER_EMAIL=admin@example.com
#        export STAGING_SUPERUSER_PASSWORD=$(openssl rand -base64 16)
#        export STAGING_MINIO_ROOT_USER=minioadmin
#        export STAGING_MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)
#        export STAGING_SENTRY_DSN=""
#        envsubst < k8s/staging/secrets.yaml | kubectl apply -f -
# =============================================================================

set -euo pipefail

NAMESPACE="mindledger-staging"

echo "==> [1/7] Namespace"
kubectl apply -f k8s/staging/namespace.yaml

echo "==> [2/7] ConfigMap"
kubectl apply -f k8s/staging/configmap.yaml

echo "==> [3/7] PostgreSQL"
kubectl apply -f k8s/staging/postgres/configmap.yaml
kubectl apply -f k8s/staging/postgres/pvc.yaml
kubectl apply -f k8s/staging/postgres/deployment.yaml
kubectl apply -f k8s/staging/postgres/service.yaml
echo "    Waiting for PostgreSQL to be ready..."
kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=120s

echo "==> [4/7] Redis"
kubectl apply -f k8s/staging/redis/pvc.yaml
kubectl apply -f k8s/staging/redis/deployment.yaml
kubectl apply -f k8s/staging/redis/service.yaml
echo "    Waiting for Redis to be ready..."
kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=60s

echo "==> [5/7] MinIO"
kubectl apply -f k8s/staging/minio/pvc.yaml
kubectl apply -f k8s/staging/minio/deployment.yaml
kubectl apply -f k8s/staging/minio/service.yaml
echo "    Waiting for MinIO to be ready..."
kubectl rollout status deployment/minio -n "$NAMESPACE" --timeout=60s

echo "==> [6/7] API + Frontend"
kubectl apply -f k8s/staging/api/pvc.yaml
kubectl apply -f k8s/staging/api/deployment.yaml
kubectl apply -f k8s/staging/api/service.yaml
kubectl apply -f k8s/staging/frontend/deployment.yaml
kubectl apply -f k8s/staging/frontend/service.yaml
echo "    Waiting for API to be ready..."
kubectl rollout status deployment/api -n "$NAMESPACE" --timeout=180s
echo "    Waiting for Frontend to be ready..."
kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=60s

echo "==> [7/7] Ingress"
echo "    NOTE: Update staging domain in k8s/staging/ingress.yaml before applying."
echo "    Apply with: kubectl apply -f k8s/staging/ingress.yaml"
# kubectl apply -f k8s/staging/ingress.yaml

echo ""
echo "Staging deployed successfully!"
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
