#!/bin/bash
# =============================================================================
# MindLedger - Kubernetes Deployment Script
# =============================================================================
# This script:
# 1. Validates/creates local Docker registry
# 2. Creates kind cluster (if not exists)
# 3. Builds Docker images using docker compose
# 4. Tags and pushes images to local registry
# 5. Applies Kubernetes manifests
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY_NAME="kind-registry"
REGISTRY_PORT="5000"
CLUSTER_NAME="mindledger"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="${SCRIPT_DIR}/k8s"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
  if ! command -v "$1" &>/dev/null; then
    log_error "$1 is not installed. Please install it first."
    exit 1
  fi
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
  log_info "Checking prerequisites..."

  check_command "docker"
  check_command "kind"
  check_command "kubectl"

  # Check if Docker is running
  if ! docker info &>/dev/null; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
  fi

  log_success "All prerequisites met."
}

# =============================================================================
# Registry Management
# =============================================================================

check_registry() {
  log_info "Checking if local registry exists..."

  if docker ps -a --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
    # Registry container exists
    if docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
      log_success "Registry '${REGISTRY_NAME}' is already running on port ${REGISTRY_PORT}."
      return 0
    else
      log_warn "Registry '${REGISTRY_NAME}' exists but is not running. Starting it..."
      docker start "${REGISTRY_NAME}"
      log_success "Registry started."
      return 0
    fi
  else
    return 1
  fi
}

create_registry() {
  log_info "Creating local Docker registry..."

  docker run -d \
    --restart=always \
    --name "${REGISTRY_NAME}" \
    -p "${REGISTRY_PORT}:5000" \
    registry:2

  log_success "Registry '${REGISTRY_NAME}' created and running on port ${REGISTRY_PORT}."
}

ensure_registry() {
  if ! check_registry; then
    create_registry
  fi
}

# =============================================================================
# Kind Cluster Management
# =============================================================================

check_cluster() {
  log_info "Checking if kind cluster '${CLUSTER_NAME}' exists..."

  if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    log_success "Cluster '${CLUSTER_NAME}' already exists."
    return 0
  else
    return 1
  fi
}

create_cluster() {
  log_info "Creating kind cluster '${CLUSTER_NAME}'..."

  kind create cluster --config="${SCRIPT_DIR}/kind-config.yaml"

  log_success "Cluster '${CLUSTER_NAME}' created."
}

connect_registry_to_cluster() {
  log_info "Connecting registry to kind network..."

  # Connect the registry to the kind network if not already connected
  if ! docker network inspect kind | grep -q "${REGISTRY_NAME}"; then
    docker network connect kind "${REGISTRY_NAME}" 2>/dev/null || true
  fi

  # Document the local registry
  kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:${REGISTRY_PORT}"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF

  log_success "Registry connected to cluster network."
}

ensure_cluster() {
  if ! check_cluster; then
    create_cluster
  fi

  # Set kubectl context
  kubectl cluster-info --context "kind-${CLUSTER_NAME}" &>/dev/null ||
    kubectl config use-context "kind-${CLUSTER_NAME}"

  connect_registry_to_cluster
}

# =============================================================================
# Image Build and Push
# =============================================================================

build_images() {
  log_info "Building Docker images using docker compose..."

  cd "${SCRIPT_DIR}"
  docker compose build

  log_success "Images built successfully."
}

tag_and_push_images() {
  log_info "Tagging and pushing images to local registry..."

  # Tag images for local registry
  docker tag mindledger-api:latest "localhost:${REGISTRY_PORT}/mindledger-api:latest"
  docker tag mindledger-frontend:latest "localhost:${REGISTRY_PORT}/mindledger-frontend:latest"

  # Push to local registry
  docker push "localhost:${REGISTRY_PORT}/mindledger-api:latest"
  docker push "localhost:${REGISTRY_PORT}/mindledger-frontend:latest"

  log_success "Images pushed to local registry."
}

# =============================================================================
# Kubernetes Deployment
# =============================================================================

load_env_vars() {
  log_info "Loading environment variables from .env..."

  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      # Skip comments and empty lines
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      # Export the variable, quoting the value to handle special chars
      if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
        export "${BASH_REMATCH[1]}=${BASH_REMATCH[2]}"
      fi
    done < "${SCRIPT_DIR}/.env"
    log_success "Environment variables loaded."
  else
    log_error ".env file not found. Please create it from .env.example"
    exit 1
  fi
}

apply_manifests() {
  log_info "Applying Kubernetes manifests..."

  # Apply namespace first
  kubectl apply -f "${K8S_DIR}/base/namespace.yaml"

  # Apply secrets with environment variable substitution
  envsubst <"${K8S_DIR}/base/secrets.yaml" | kubectl apply -f -

  # Apply configmap
  kubectl apply -f "${K8S_DIR}/base/configmap.yaml"

  # Apply PostgreSQL
  log_info "Deploying PostgreSQL..."
  kubectl apply -f "${K8S_DIR}/postgres/"

  # Apply Redis
  log_info "Deploying Redis..."
  kubectl apply -f "${K8S_DIR}/redis/"

  # Apply API
  log_info "Deploying API..."
  kubectl apply -f "${K8S_DIR}/api/"

  # Apply Frontend
  log_info "Deploying Frontend..."
  kubectl apply -f "${K8S_DIR}/frontend/"

  # Apply NodePort services for external access
  kubectl apply -f "${K8S_DIR}/base/nodeport-services.yaml"

  log_success "All manifests applied."
}

wait_for_deployments() {
  log_info "Waiting for deployments to be ready..."

  kubectl -n mindledger wait --for=condition=available --timeout=300s deployment/postgres || true
  kubectl -n mindledger wait --for=condition=available --timeout=300s deployment/redis || true
  kubectl -n mindledger wait --for=condition=available --timeout=300s deployment/api || true
  kubectl -n mindledger wait --for=condition=available --timeout=300s deployment/frontend || true

  log_success "All deployments are ready."
}

show_status() {
  echo ""
  log_info "=== Deployment Status ==="
  echo ""

  kubectl -n mindledger get pods
  echo ""
  kubectl -n mindledger get services
  echo ""

  log_success "MindLedger deployed successfully!"
  echo ""
  echo -e "${GREEN}Access the application:${NC}"
  echo -e "  Frontend: ${BLUE}http://localhost:39101${NC}"
  echo -e "  API:      ${BLUE}http://localhost:39100${NC}"
  echo -e "  API Docs: ${BLUE}http://localhost:39100/api/v1/docs/${NC}"
  echo ""
  echo -e "${YELLOW}Useful commands:${NC}"
  echo "  kubectl -n mindledger get pods          # List pods"
  echo "  kubectl -n mindledger logs -f <pod>     # View pod logs"
  echo "  kubectl -n mindledger describe pod <pod> # Describe pod"
  echo "  kind delete cluster --name mindledger   # Delete cluster"
  echo ""
}

# =============================================================================
# Cleanup Function
# =============================================================================

cleanup() {
  log_warn "Cleaning up MindLedger Kubernetes resources..."

  read -p "Are you sure you want to delete the cluster? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    kind delete cluster --name "${CLUSTER_NAME}"
    log_success "Cluster deleted."

    read -p "Also remove the local registry? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker rm -f "${REGISTRY_NAME}" 2>/dev/null || true
      log_success "Registry removed."
    fi
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  echo ""
  echo "============================================="
  echo "  MindLedger - Kubernetes Deployment"
  echo "============================================="
  echo ""

  case "${1:-deploy}" in
  deploy)
    check_prerequisites
    ensure_registry
    ensure_cluster
    build_images
    tag_and_push_images
    load_env_vars
    apply_manifests
    wait_for_deployments
    show_status
    ;;
  build)
    check_prerequisites
    ensure_registry
    build_images
    tag_and_push_images
    ;;
  apply)
    check_prerequisites
    load_env_vars
    apply_manifests
    wait_for_deployments
    show_status
    ;;
  status)
    kubectl -n mindledger get pods,services,pvc
    ;;
  logs)
    if [[ -n "$2" ]]; then
      kubectl -n mindledger logs -f "$2"
    else
      echo "Usage: $0 logs <pod-name>"
      echo "Available pods:"
      kubectl -n mindledger get pods -o name
    fi
    ;;
  cleanup | delete)
    cleanup
    ;;
  *)
    echo "Usage: $0 {deploy|build|apply|status|logs|cleanup}"
    echo ""
    echo "Commands:"
    echo "  deploy  - Full deployment (registry, cluster, build, apply)"
    echo "  build   - Build and push images only"
    echo "  apply   - Apply manifests only (cluster must exist)"
    echo "  status  - Show deployment status"
    echo "  logs    - View pod logs"
    echo "  cleanup - Delete cluster and optionally registry"
    exit 1
    ;;
  esac
}

main "$@"

# Fim do script
