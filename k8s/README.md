# Kubernetes Deployment — MindLedger

## Prerequisites

### 1. cert-manager

cert-manager is required for TLS certificate management. It issues and renews:
- **External TLS** — Let's Encrypt certificates for the public Ingress (`letsencrypt-prod` / `letsencrypt-staging` ClusterIssuers in `k8s/ingress.yaml`).
- **Internal TLS** — Self-signed certificates for service-to-service communication inside the cluster (API → MinIO), managed by the `internal-ca-issuer` ClusterIssuer in `k8s/minio/tls.yaml`.

Install cert-manager before applying any other manifests:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --namespace cert-manager \
  --for=condition=ready pod --all \
  --timeout=120s
```

### 2. nginx Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

---

## Apply Order

```bash
# 1. Namespace, RBAC, base resources
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/secrets.yaml       # fill in real values first
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/serviceaccounts.yaml

# 2. cert-manager ClusterIssuers + internal CA (must come before MinIO)
kubectl apply -f k8s/ingress.yaml            # creates letsencrypt-* ClusterIssuers
kubectl apply -f k8s/minio/tls.yaml          # creates internal-ca-issuer + minio-tls Certificate

# Wait for the internal CA to be ready before MinIO starts
kubectl wait --namespace cert-manager \
  --for=condition=Ready certificate/minio-internal-ca \
  --timeout=60s
kubectl wait --namespace mindledger \
  --for=condition=Ready certificate/minio-tls \
  --timeout=60s

# 3. Stateful services
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/minio/         # deployment.yaml mounts the minio-tls Secret

# 4. Application
kubectl apply -f k8s/api/           # deployment.yaml mounts ca.crt from minio-tls
kubectl apply -f k8s/frontend/
```

---

## Internal TLS (API ↔ MinIO)

All traffic between the Django API and MinIO runs over TLS inside the cluster.
The certificate chain is:

```
minio-selfsigned-issuer  (ClusterIssuer, self-signed bootstrap)
  └── minio-internal-ca  (Certificate, isCA=true, in cert-manager namespace)
        └── internal-ca-issuer  (ClusterIssuer, CA-backed)
              └── minio-tls  (Certificate, in mindledger namespace)
```

The `minio-tls` Secret contains three keys:
| Key | Mounted in | Purpose |
|-----|-----------|---------|
| `tls.crt` | MinIO pod at `/root/.minio/certs/public.crt` | MinIO server certificate |
| `tls.key` | MinIO pod at `/root/.minio/certs/private.key` | MinIO server private key |
| `ca.crt`  | API pod at `/etc/ssl/minio/ca.crt` | CA used by Django to verify MinIO |

The Django setting `AWS_S3_VERIFY` is set to the path `/etc/ssl/minio/ca.crt` via the
`MINIO_CA_BUNDLE` env var in the ConfigMap.

cert-manager automatically renews the `minio-tls` certificate 30 days before it expires.
The CA (`minio-internal-ca`) has a 10-year lifetime and must be rotated manually if compromised.

### Staging

The staging environment shares the same ClusterIssuers. Apply the staging certificate separately:

```bash
kubectl apply -f k8s/staging/minio/tls.yaml
kubectl wait --namespace mindledger-staging \
  --for=condition=Ready certificate/minio-tls \
  --timeout=60s
```

---

## External TLS (Ingress)

External HTTPS is terminated at the nginx Ingress using Let's Encrypt certificates.
See the comments at the top of `k8s/ingress.yaml` for the staging → production promotion workflow.
