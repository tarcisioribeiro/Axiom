#!/bin/bash
# =============================================================================
# Axiom — Blue-Green Deployment Switch
# =============================================================================
#
# Implements zero-downtime production deploys:
#   1. Reads which slot (blue / green) is currently receiving traffic from
#      the api-service Service selector.
#   2. Scales the INACTIVE slot's Deployment to the desired replica count
#      and updates its image to NEW_IMAGE.
#   3. Waits for all pods in the inactive slot to become Ready.
#   4. Atomically patches api-service to route traffic to the new slot.
#   5. Scales the OLD (previously active) slot down to 0 replicas to free
#      resources. It is NOT deleted so rollback is instant:
#        kubectl scale deployment/api-<old-slot> --replicas=1 -n <namespace>
#        kubectl patch svc api-service -n <namespace> \
#          -p '{"spec":{"selector":{"app":"api","slot":"<old-slot>"}}}'
#
# Usage:
#   blue-green-switch.sh NEW_IMAGE [NAMESPACE] [SERVICE] [REPLICAS]
#
#   NEW_IMAGE   Full image reference, e.g.
#               registry.gitlab.com/org/axiom/api:abc1234
#   NAMESPACE   Kubernetes namespace (default: axiom)
#   SERVICE     Service name whose selector is toggled (default: api-service)
#   REPLICAS    Replica count for the new slot (default: 1)
#
# Prerequisites:
#   - kubectl configured and pointing at the target cluster.
#   - Deployments api-blue and api-green already exist in the namespace.
#   - api-service selector initially contains slot: blue or slot: green.
#
# =============================================================================

set -euo pipefail

NEW_IMAGE="${1:?Usage: $0 NEW_IMAGE [NAMESPACE] [SERVICE] [REPLICAS]}"
NAMESPACE="${2:-axiom}"
SERVICE="${3:-api-service}"
REPLICAS="${4:-1}"

TIMEOUT="${BLUE_GREEN_TIMEOUT:-780}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()   { echo "[$(date '+%H:%M:%S')] $*"; }
error() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

kube() { kubectl -n "$NAMESPACE" "$@"; }

# ── 1. Determine active slot ──────────────────────────────────────────────────
log "Reading active slot from Service/$SERVICE ..."
ACTIVE_SLOT=$(kube get svc "$SERVICE" \
  -o jsonpath='{.spec.selector.slot}' 2>/dev/null || true)

if [[ "$ACTIVE_SLOT" == "blue" ]]; then
  NEW_SLOT="green"
elif [[ "$ACTIVE_SLOT" == "green" ]]; then
  NEW_SLOT="blue"
else
  # Service has no slot selector yet (initial bootstrap).
  # Deploy to green and point traffic there.
  log "No slot selector found — bootstrapping; targeting slot: green"
  ACTIVE_SLOT="blue"
  NEW_SLOT="green"
fi

log "Active slot : $ACTIVE_SLOT"
log "New slot    : $NEW_SLOT"
log "New image   : $NEW_IMAGE"

# ── 2. Update image + scale up the inactive slot ──────────────────────────────
log "Updating Deployment/api-$NEW_SLOT image ..."
kube set image "deployment/api-$NEW_SLOT" "api=$NEW_IMAGE"

log "Scaling Deployment/api-$NEW_SLOT to $REPLICAS replica(s) ..."
kube scale "deployment/api-$NEW_SLOT" --replicas="$REPLICAS"

# ── 3. Wait for the new slot to be fully ready ────────────────────────────────
log "Waiting for Deployment/api-$NEW_SLOT rollout (timeout: ${TIMEOUT}s) ..."
if ! kube rollout status "deployment/api-$NEW_SLOT" --timeout="${TIMEOUT}s"; then
  error "Deployment/api-$NEW_SLOT did not become ready within ${TIMEOUT}s. \
Aborting — traffic still points to slot: $ACTIVE_SLOT."
fi
log "Deployment/api-$NEW_SLOT is ready."

# ── 4. Switch Service selector ────────────────────────────────────────────────
log "Switching $SERVICE selector to slot: $NEW_SLOT ..."
kube patch svc "$SERVICE" \
  --type=merge \
  -p "{\"spec\":{\"selector\":{\"app\":\"api\",\"slot\":\"$NEW_SLOT\"}}}"

log "Traffic now routed to slot: $NEW_SLOT."

# ── 5. Scale down old slot (keep at 0 for instant rollback) ──────────────────
log "Scaling down Deployment/api-$ACTIVE_SLOT to 0 ..."
kube scale "deployment/api-$ACTIVE_SLOT" --replicas=0

log "════════════════════════════════════════════════════════"
log "Blue-green deploy complete."
log "  Active slot  : $NEW_SLOT  (image: $NEW_IMAGE)"
log "  Standby slot : $ACTIVE_SLOT  (replicas: 0 — ready for rollback)"
log ""
log "  Rollback command:"
log "    kubectl scale deployment/api-$ACTIVE_SLOT --replicas=1 -n $NAMESPACE"
log "    kubectl patch svc $SERVICE -n $NAMESPACE \\"
log "      -p '{\"spec\":{\"selector\":{\"app\":\"api\",\"slot\":\"$ACTIVE_SLOT\"}}}'"
log "════════════════════════════════════════════════════════"
