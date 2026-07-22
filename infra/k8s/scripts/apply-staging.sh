#!/bin/bash
# =============================================================================
# Axiom — Apply Staging Manifests (k3s single-node VPS)
# =============================================================================
# Usage: bash infra/k8s/scripts/apply-staging.sh
#
# One-time bootstrap only. Day-to-day deploys are handled by the
# deploy:staging CI job, which applies the same overlay plus the real image
# tags (this script leaves the API/frontend Deployments on the placeholder
# 0.0.0 image — expect ImagePullBackOff until the first CI deploy runs).
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
#   4. GHCR pull secret created (see deploy:staging job in .gitlab-ci.yml for
#      the exact command — it is created imperatively, never committed).
#
#   5. Secrets applied — infra/k8s/overlays/staging/secrets.yaml uses
#      ${VAR} placeholders; export every STAGING_* variable it references,
#      then:
#        envsubst < infra/k8s/overlays/staging/secrets.yaml | kubectl apply -f -
# =============================================================================

set -euo pipefail

NAMESPACE="axiom-staging"

echo "==> Applying staging overlay (namespace, rbac, network-policy, quota,"
echo "    postgres, redis, minio, ollama, api, frontend, ingress)..."
kubectl apply -k infra/k8s/overlays/staging

echo "==> Waiting for rollouts..."
kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=120s
kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=60s
kubectl rollout status deployment/minio -n "$NAMESPACE" --timeout=60s

echo ""
echo "Staging bootstrap applied. API and frontend are on the placeholder"
echo "0.0.0 image until the first CI deploy — trigger deploy:staging next."
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
