#!/bin/bash
# =============================================================================
# Axiom — Apply Production Manifests (k3s single-node VPS)
# =============================================================================
# Usage: bash k8s/scripts/apply-production.sh
#
# Prerequisites:
#   See k8s/scripts/apply-staging.sh for k3s + nginx-ingress + cert-manager setup.
#
#   GitLab registry secret for production:
#     kubectl create secret docker-registry gitlab-registry-secret \
#       --docker-server=registry.gitlab.com \
#       --docker-username=YOUR_GITLAB_USERNAME \
#       --docker-password=YOUR_PERSONAL_ACCESS_TOKEN \
#       --namespace axiom
#
#   Required environment variables — set ALL before running:
#     export AXIOM_DOMAIN=axiom.example.com   # your production domain
#     export LETSENCRYPT_EMAIL=admin@example.com        # cert notification email
#     export DB_NAME=axiom_db
#     export DB_USER=axiom
#     export DB_PASSWORD=$(openssl rand -base64 24)
#     export SECRET_KEY=$(openssl rand -base64 48)
#     export ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
#     export DJANGO_SUPERUSER_USERNAME=admin
#     export DJANGO_SUPERUSER_EMAIL=admin@example.com
#     export DJANGO_SUPERUSER_PASSWORD=$(openssl rand -base64 16)
#     export MINIO_ROOT_USER=minioadmin
#     export MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)
#     export SENTRY_DSN=""
#     export BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 48)
#     export MINIO_ENDPOINT=http://minio-service:9000
#     export MINIO_ACCESS_KEY=$MINIO_ROOT_USER
#     export MINIO_SECRET_KEY=$MINIO_ROOT_PASSWORD
#     export GRAFANA_ADMIN_USER=admin
#     export GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24)
#     envsubst < k8s/base/secrets.yaml | kubectl apply -f -
# =============================================================================

set -euo pipefail

NAMESPACE="axiom"

echo "==> [1/10] Namespace"
kubectl apply -f k8s/base/namespace.yaml

echo "==> [2/10] ServiceAccounts + ResourceQuota + NetworkPolicies"
kubectl apply -f k8s/serviceaccounts.yaml
kubectl apply -f k8s/resource-quota.yaml
kubectl apply -f k8s/network-policy.yaml

echo "==> [3/10] ConfigMap"
envsubst < k8s/base/configmap.yaml | kubectl apply -f -

echo "==> [4/10] PostgreSQL"
kubectl apply -f k8s/postgres/configmap.yaml
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml
echo "    Waiting for PostgreSQL..."
kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=120s

echo "==> [5/10] Redis"
kubectl apply -f k8s/redis/pvc.yaml
kubectl apply -f k8s/redis/deployment.yaml
kubectl apply -f k8s/redis/service.yaml
echo "    Waiting for Redis..."
kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=60s

echo "==> [6/10] MinIO"
kubectl apply -f k8s/minio/pvc.yaml
kubectl apply -f k8s/minio/deployment.yaml
kubectl apply -f k8s/minio/service.yaml
echo "    Waiting for MinIO..."
kubectl rollout status deployment/minio -n "$NAMESPACE" --timeout=60s

echo "==> [7/10] API + Frontend (blue-green)"
kubectl apply -f k8s/api/pvc.yaml
kubectl apply -f k8s/api/deployment-blue.yaml
kubectl apply -f k8s/api/deployment-green.yaml
kubectl apply -f k8s/api/service.yaml
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml
echo "    Waiting for API (blue slot — initial bootstrap)..."
kubectl rollout status deployment/api-blue -n "$NAMESPACE" --timeout=180s
echo "    Waiting for Frontend..."
kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=60s

echo "==> [8/10] HPA + PDB"
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml

echo "==> [9/10] Backup CronJob"
kubectl apply -f k8s/backup-cronjob.yaml

echo "==> [10/10] Ingress"
echo "    Applying ingress (AXIOM_DOMAIN=${AXIOM_DOMAIN})..."
envsubst < k8s/ingress.yaml | kubectl apply -f -

echo ""
echo "Production deployed successfully!"
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
