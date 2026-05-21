# Kubernetes Deployment — Axiom

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

## Production — One-time Setup

These steps are run **once** when provisioning the production environment. After this, ongoing deploys are fully managed by the CI/CD pipeline.

```bash
# 1. Namespace, RBAC, base resources
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/secrets.yaml       # fill in real values first
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/serviceaccounts.yaml

# 2. cert-manager ClusterIssuers + internal CA (must come before MinIO)
#    ClusterIssuers are cluster-scoped and shared between environments.
kubectl apply -f k8s/ingress.yaml            # creates letsencrypt-* ClusterIssuers
kubectl apply -f k8s/minio/tls.yaml          # creates internal-ca-issuer + minio-tls Certificate

# Wait for the internal CA to be ready before MinIO starts
kubectl wait --namespace cert-manager \
  --for=condition=Ready certificate/minio-internal-ca \
  --timeout=60s
kubectl wait --namespace axiom \
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

## Staging — One-time Setup

These steps are run **once** when provisioning the staging environment. The CI/CD pipeline (`deploy:staging` job) only applies the Deployment, Service, and Ingress manifests — **it does not apply TLS certificates, namespaces, or secrets**. Missing any step below will cause the deploy pipeline to fail.

### Step 1 — Apply ClusterIssuers (if not done yet for production)

The ClusterIssuers in `k8s/minio/tls.yaml` are cluster-scoped and shared between environments. Skip this step if they already exist.

```bash
kubectl get clusterissuer internal-ca-issuer 2>/dev/null \
  || kubectl apply -f k8s/minio/tls.yaml

kubectl wait --namespace cert-manager \
  --for=condition=Ready certificate/minio-internal-ca \
  --timeout=60s
```

### Step 2 — Create the staging namespace and base resources

```bash
kubectl apply -f k8s/staging/namespace.yaml
kubectl apply -f k8s/staging/resource-quota.yaml
kubectl apply -f k8s/staging/serviceaccounts.yaml
kubectl apply -f k8s/staging/network-policy.yaml
```

### Step 3 — Create secrets and ConfigMap

The `k8s/staging/secrets.yaml` file uses `${VAR}` placeholders. Substitute them before applying (or use a tool like `envsubst`):

```bash
envsubst < k8s/staging/secrets.yaml | kubectl apply -f -
kubectl apply -f k8s/staging/configmap.yaml
```

Required environment variables for secrets:
| Variable | Description |
|---|---|
| `STAGING_DB_NAME` | PostgreSQL database name |
| `STAGING_DB_USER` | PostgreSQL user |
| `STAGING_DB_PASSWORD` | PostgreSQL password |
| `STAGING_SECRET_KEY` | Django `SECRET_KEY` (generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| `STAGING_ENCRYPTION_KEY` | Fernet key (generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) |
| `STAGING_SUPERUSER_USERNAME` | Django superuser username |
| `STAGING_SUPERUSER_EMAIL` | Django superuser email |
| `STAGING_SUPERUSER_PASSWORD` | Django superuser password |
| `STAGING_REDIS_PASSWORD` | Redis password |
| `STAGING_MINIO_ROOT_USER` | MinIO root user |
| `STAGING_MINIO_ROOT_PASSWORD` | MinIO root password |
| `STAGING_SENTRY_DSN` | Sentry DSN (optional, leave empty to disable) |

### Step 4 — Create the GitLab registry pull secret

```bash
kubectl -n axiom-staging create secret docker-registry gitlab-registry-secret \
  --docker-server=registry.tjtux.duckdns.org \
  --docker-username=<gitlab-user> \
  --docker-password=<gitlab-deploy-token>
```

### Step 5 — Apply the MinIO TLS certificate for staging

> **This is the most commonly missed step.** Without it, the API pod cannot be scheduled because it mounts `ca.crt` from the `minio-tls` secret, which is created by cert-manager only after this manifest is applied.

```bash
kubectl apply -f k8s/staging/minio/tls.yaml
kubectl wait --namespace axiom-staging \
  --for=condition=Ready certificate/minio-tls \
  --timeout=60s

# Confirm the secret exists before proceeding
kubectl -n axiom-staging get secret minio-tls
```

### Step 6 — Apply stateful services

```bash
kubectl apply -f k8s/staging/postgres/
kubectl apply -f k8s/staging/redis/
kubectl apply -f k8s/staging/minio/
```

### Step 7 — Verify the environment is ready for CI/CD

```bash
# All pods should be Running
kubectl -n axiom-staging get pods

# minio-tls secret must exist
kubectl -n axiom-staging get secret minio-tls

# gitlab-registry-secret must exist
kubectl -n axiom-staging get secret gitlab-registry-secret

# axiom-secrets must exist
kubectl -n axiom-staging get secret axiom-secrets

# axiom-config ConfigMap must exist
kubectl -n axiom-staging get configmap axiom-config
```

Once all checks pass, the `deploy:staging` CI/CD job (triggered on every push to `develop`) will manage the Application deployments automatically.

---

## Internal TLS (API ↔ MinIO)

All traffic between the Django API and MinIO runs over TLS inside the cluster.
The certificate chain is:

```
minio-selfsigned-issuer  (ClusterIssuer, self-signed bootstrap)
  └── minio-internal-ca  (Certificate, isCA=true, in cert-manager namespace)
        └── internal-ca-issuer  (ClusterIssuer, CA-backed)
              └── minio-tls  (Certificate, per-namespace)
                    staging:    axiom-staging/minio-tls
                    production: axiom/minio-tls
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

---

## External TLS (Ingress)

External HTTPS is terminated at the nginx Ingress using Let's Encrypt certificates.
See the comments at the top of `k8s/ingress.yaml` for the staging → production promotion workflow.

---

## Troubleshooting

### Deploy pipeline fails: `deployment exceeded its progress deadline`

**Symptom**: The `deploy:staging` CI/CD job times out with:
```
error: deployment "api" exceeded its progress deadline
```

**Diagnosis**:
```bash
kubectl -n axiom-staging describe pod -l app=api
kubectl -n axiom-staging get events --sort-by='.lastTimestamp'
```

**Common causes and fixes**:

#### 1. Pod stuck in `Terminating`

With `strategy: Recreate`, Kubernetes terminates the old pod before creating a new one. If the old pod is stuck (e.g., PVC detach failure), the new pod never starts and the deployment times out.

```bash
# Identify stuck pod
kubectl -n axiom-staging get pods

# Force-delete it
kubectl -n axiom-staging delete pod <pod-name> --force --grace-period=0
```

After force-deleting, re-trigger the pipeline.

#### 2. `minio-tls` secret not found

The API deployment mounts `ca.crt` from the `minio-tls` secret. If cert-manager never issued the certificate, the pod cannot be scheduled.

```bash
kubectl -n axiom-staging get secret minio-tls
```

If not found, follow **Staging — One-time Setup, Step 5** above.

#### 3. `gitlab-registry-secret` not found or expired

The pod cannot pull its image from the private registry.

```bash
kubectl -n axiom-staging get secret gitlab-registry-secret
```

If missing or expired, recreate it (see **Step 4** above).

#### 4. Resource quota exceeded

```bash
kubectl -n axiom-staging describe resourcequota
```

If the namespace quota is exhausted, clean up unused resources or adjust the quota in `k8s/staging/resource-quota.yaml`.

### Inspecting a failed pod

```bash
# Events and conditions
kubectl -n axiom-staging describe pod -l app=api

# Current logs
kubectl -n axiom-staging logs -l app=api

# Logs from a crashed previous instance
kubectl -n axiom-staging logs -l app=api --previous
```
