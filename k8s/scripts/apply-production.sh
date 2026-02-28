#!/bin/bash
# =============================================================================
# MindLedger — Apply Production Manifests (k3s single-node VPS)
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
#       --namespace mindledger
#
#   Secrets applied (fill in real values):
#     export DB_NAME=mindledger_db
#     export DB_USER=mindledger
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
#     envsubst < k8s/base/secrets.yaml | kubectl apply -f -
#
#   IMPORTANT: Update domain in k8s/base/configmap.yaml and k8s/ingress.yaml before applying.
# =============================================================================

set -euo pipefail

NAMESPACE="mindledger"

echo "==> [1/9] Namespace"
kubectl apply -f k8s/base/namespace.yaml

echo "==> [2/9] ConfigMap"
kubectl apply -f k8s/base/configmap.yaml

echo "==> [3/9] PostgreSQL"
kubectl apply -f k8s/postgres/configmap.yaml
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml
echo "    Waiting for PostgreSQL..."
kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=120s

echo "==> [4/9] Redis"
kubectl apply -f k8s/redis/pvc.yaml
kubectl apply -f k8s/redis/deployment.yaml
kubectl apply -f k8s/redis/service.yaml
echo "    Waiting for Redis..."
kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=60s

echo "==> [5/9] MinIO"
kubectl apply -f k8s/minio/pvc.yaml
kubectl apply -f k8s/minio/deployment.yaml
kubectl apply -f k8s/minio/service.yaml
echo "    Waiting for MinIO..."
kubectl rollout status deployment/minio -n "$NAMESPACE" --timeout=60s
echo "    Creating MinIO bucket (mindledger)..."
kubectl apply -f k8s/minio/deployment.yaml  # Job is embedded in deployment.yaml

echo "==> [6/9] API + Frontend"
kubectl apply -f k8s/api/pvc.yaml
kubectl apply -f k8s/api/deployment.yaml
kubectl apply -f k8s/api/service.yaml
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml
echo "    Waiting for API..."
kubectl rollout status deployment/api -n "$NAMESPACE" --timeout=180s
echo "    Waiting for Frontend..."
kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=60s

echo "==> [7/9] HPA + PDB"
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml

echo "==> [8/9] Backup CronJob"
kubectl apply -f k8s/backup-cronjob.yaml

echo "==> [9/9] Ingress"
echo "    NOTE: Update your domain in k8s/ingress.yaml before applying."
echo "    Apply with: kubectl apply -f k8s/ingress.yaml"
# kubectl apply -f k8s/ingress.yaml

echo ""
echo "Production deployed successfully!"
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
