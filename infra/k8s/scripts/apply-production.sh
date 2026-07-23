#!/bin/bash
# =============================================================================
# Axiom — Apply Production Manifests (k3s single-node VPS)
# =============================================================================
# Usage: bash infra/k8s/scripts/apply-production.sh
#
# One-time bootstrap only. Day-to-day deploys are handled by the
# deploy:production CI job (blue-green), which applies the same overlay plus
# the real image tags. This script leaves api-blue/api-green and frontend on
# the placeholder 0.0.0 image — expect ImagePullBackOff until the first CI
# deploy runs.
#
# Prerequisites:
#   See infra/k8s/scripts/apply-staging.sh for k3s + nginx-ingress + cert-manager setup.
#
#   GHCR pull secret created (see deploy:production job in .gitlab-ci.yml for
#   the exact command — it is created imperatively, never committed).
#
#   Secrets applied — infra/k8s/base/secrets.yaml uses ${VAR} placeholders;
#   export every variable it references (including MINIO_ENDPOINT/
#   MINIO_EXTERNAL_ENDPOINT — MinIO runs external to the cluster, see
#   documentation/storage/infrastructure.md), then:
#     envsubst < infra/k8s/base/secrets.yaml | kubectl apply -f -
# =============================================================================

set -euo pipefail

NAMESPACE="axiom"

echo "==> Applying production overlay (namespace, rbac, network-policy, quota,"
echo "    redis, frontend, ingress)..."
echo "    PostgreSQL, MinIO and Ollama are NOT applied here — all three run"
echo "    self-managed, external to k3s (see documentation/database/infrastructure.md,"
echo "    documentation/storage/infrastructure.md and documentation/llm/infrastructure.md);"
echo "    axiom-secrets' DB_HOST/DB_PORT/MINIO_ENDPOINT/OLLAMA_BASE_URL (from"
echo "    secrets.yaml) must already point at them before this script runs."
kubectl apply -k infra/k8s/overlays/production

echo "==> Waiting for rollouts..."
kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=60s

echo "==> API (blue-green) + Service — applied separately, like every CI deploy"
kubectl apply -f infra/k8s/overlays/production/api/deployment-blue.yaml
kubectl apply -f infra/k8s/overlays/production/api/deployment-green.yaml
kubectl apply -f infra/k8s/overlays/production/api/service.yaml

echo "==> HPA + PDB (not applied by CI — optional, apply manually if wanted)"
kubectl apply -f infra/k8s/overlays/production/hpa.yaml
kubectl apply -f infra/k8s/overlays/production/pdb.yaml

echo "==> Backup CronJob"
kubectl apply -f infra/k8s/overlays/production/backup-cronjob.yaml

echo ""
echo "Production bootstrap applied. api-blue/api-green and frontend are on"
echo "the placeholder 0.0.0 image until the first CI deploy — trigger"
echo "deploy:production next."
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
