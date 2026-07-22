# Kubernetes Deployment — Axiom

## Layout

```
infra/k8s/
├── base/               # Shared manifests — shape reflects the production footprint
│   ├── redis/ minio/ ollama/ frontend/ api/   # PostgreSQL runs on an external
│   │                                          # self-managed VM, not here — see
│   │                                          # documentation/database/infrastructure.md
│   ├── cluster-issuers.yaml   # cert-manager ClusterIssuers (cluster-scoped, shared)
│   ├── ingress.yaml, configmap.yaml, network-policy.yaml, resource-quota.yaml, ...
│   └── kustomization.yaml
├── overlays/
│   ├── production/     # namespace: axiom — adds blue-green API Deployments,
│   │   ├── api/         # HPA/PDB/backup-cronjob (not applied automatically by CI)
│   │   └── kustomization.yaml
│   └── staging/         # namespace: axiom-staging — patches/ scales resources
│       ├── api/          # down, drops MinIO TLS, single (non-blue-green) API
│       ├── patches/
│       └── kustomization.yaml
└── scripts/             # blue-green-switch.sh (CI) + apply-{staging,production}.sh (one-time bootstrap)
```

Production and staging share almost everything through `base/` — only genuine
behavioral differences (blue-green vs. single Deployment, MinIO TLS on/off,
resource sizing, ConfigMap values) live in each overlay's `patches/`. Render
either environment locally to see exactly what gets applied:

```bash
kubectl kustomize infra/k8s/overlays/production
kubectl kustomize infra/k8s/overlays/staging
```

The `deploy:staging` / `deploy:production` CI jobs apply almost everything
with a single `kubectl apply -k infra/k8s/overlays/<env>`; only the API
(blue-green in production, image-tag substitution in both) stays as bespoke
steps — see the comments in `.gitlab-ci.yml` for why.

## Prerequisites

### 1. cert-manager

cert-manager is required for TLS certificate management. It issues and renews:
- **External TLS** — Let's Encrypt certificates for the public Ingress (`letsencrypt-prod` / `letsencrypt-staging` ClusterIssuers in `infra/k8s/base/cluster-issuers.yaml`).
- **Internal TLS** — Self-signed certificates for service-to-service communication inside the cluster (API → MinIO), managed by the `internal-ca-issuer` ClusterIssuer in `infra/k8s/base/cluster-issuers.yaml`.

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

These steps are run **once** when provisioning the production environment. After this, ongoing deploys are fully managed by the CI/CD pipeline. See `infra/k8s/scripts/apply-production.sh` for the scripted version of this section.

> `DB_NAME`/`DB_USER`/`DB_PASSWORD` must correspond to a real role/database
> already created on the external PostgreSQL VM — see
> [documentation/database/infrastructure.md](../../documentation/database/infrastructure.md).
> `DB_HOST`/`DB_PORT`/`DB_SSLMODE` (in `infra/k8s/base/configmap.yaml`) must
> already point at that VM before applying step 2.

```bash
# 1. Secrets — infra/k8s/base/secrets.yaml uses ${VAR} placeholders
export DB_NAME=axiom_db DB_USER=axiom DB_PASSWORD=... SECRET_KEY=... ENCRYPTION_KEY=... \
       DJANGO_SUPERUSER_USERNAME=admin DJANGO_SUPERUSER_EMAIL=... DJANGO_SUPERUSER_PASSWORD=... \
       REDIS_PASSWORD=... MINIO_ROOT_USER=... MINIO_ROOT_PASSWORD=... SENTRY_DSN=""
envsubst < infra/k8s/base/secrets.yaml | kubectl apply -f -

# 2. Everything else — namespace, RBAC, ClusterIssuers, network-policy, quota,
#    redis, minio (mounts minio-tls once cert-manager issues it),
#    ollama, frontend, ingress. Safe to re-run.
#    PostgreSQL is NOT here — it runs on the external VM (see above).
kubectl apply -k infra/k8s/overlays/production

# Wait for the internal CA / minio-tls Certificate before MinIO needs it
kubectl wait --namespace cert-manager \
  --for=condition=Ready certificate/minio-internal-ca \
  --timeout=60s
kubectl wait --namespace axiom \
  --for=condition=Ready certificate/minio-tls \
  --timeout=60s

# 3. API (blue-green) — not part of the overlay build, applied directly.
#    Mounts ca.crt from minio-tls, so re-run step 1's wait first if needed.
kubectl apply -f infra/k8s/overlays/production/api/deployment-blue.yaml
kubectl apply -f infra/k8s/overlays/production/api/deployment-green.yaml
kubectl apply -f infra/k8s/overlays/production/api/service.yaml

# 4. Optional — not applied automatically by CI
kubectl apply -f infra/k8s/overlays/production/hpa.yaml
kubectl apply -f infra/k8s/overlays/production/pdb.yaml
kubectl apply -f infra/k8s/overlays/production/backup-cronjob.yaml
```

---

## Staging — One-time Setup

These steps are run **once** when provisioning the staging environment. The CI/CD pipeline (`deploy:staging` job) only applies the Deployment, Service, and Ingress manifests — **it does not apply TLS certificates, namespaces, or secrets**. Missing any step below will cause the deploy pipeline to fail. See `infra/k8s/scripts/apply-staging.sh` for the scripted version of steps 2 onward.

### Step 1 — Create secrets

The `infra/k8s/overlays/staging/secrets.yaml` file uses `${VAR}` placeholders. Substitute them before applying (or use a tool like `envsubst`):

```bash
envsubst < infra/k8s/overlays/staging/secrets.yaml | kubectl apply -f -
```

Required environment variables for secrets:
| Variable | Description |
|---|---|
| `STAGING_DB_NAME` | PostgreSQL database name (must exist on the external VM — see [documentation/database/infrastructure.md](../../documentation/database/infrastructure.md)) |
| `STAGING_DB_USER` | PostgreSQL user (role already created on the external VM) |
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

### Step 2 — Create the GHCR pull secret

```bash
kubectl -n axiom-staging create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<gitlab-user> \
  --docker-password=<github-pat-or-deploy-token>
```

### Step 3 — Apply everything else

Namespace, RBAC, ClusterIssuers, network-policy, quota, redis, minio, ollama,
api (single Deployment, no TLS — staging never mounts `minio-tls`), frontend,
ingress — all in one shot. PostgreSQL is not applied here — it runs on the
same external VM as production (see
[documentation/database/infrastructure.md](../../documentation/database/infrastructure.md)),
so `axiom-config`'s `DB_HOST` must already point at it:

```bash
kubectl apply -k infra/k8s/overlays/staging
```

### Step 4 — Verify the environment is ready for CI/CD

```bash
# All pods should be Running
kubectl -n axiom-staging get pods

# minio-tls secret must exist (created for every environment, even though
# staging's MinIO/API pods don't mount it — see Internal TLS section below)
kubectl -n axiom-staging get secret minio-tls

# ghcr-pull-secret must exist
kubectl -n axiom-staging get secret ghcr-pull-secret

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

The `minio-tls` Secret contains three keys — **production only**, MinIO and the
API pod mount them; staging's MinIO runs plain HTTP and its API pod never
mounts `ca.crt` (see `overlays/staging/patches/minio-deployment.json`):
| Key | Mounted in | Purpose |
|-----|-----------|---------|
| `tls.crt` | MinIO pod at `/root/.minio/certs/public.crt` | MinIO server certificate |
| `tls.key` | MinIO pod at `/root/.minio/certs/private.key` | MinIO server private key |
| `ca.crt`  | API pod at `/etc/ssl/minio/ca.crt` | CA used by Django to verify MinIO |

The Django setting `AWS_S3_VERIFY` is set to the path `/etc/ssl/minio/ca.crt` via the
`MINIO_CA_BUNDLE` env var in production's ConfigMap (absent in staging's).

cert-manager automatically renews the `minio-tls` certificate 30 days before it expires.
The CA (`minio-internal-ca`) has a 10-year lifetime and must be rotated manually if compromised.

---

## External TLS (Ingress)

External HTTPS is terminated at the nginx Ingress using Let's Encrypt certificates.
See `infra/k8s/base/cluster-issuers.yaml` for the staging → production ClusterIssuer promotion workflow.

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

#### 2. `minio-tls` secret not found (production only)

In production, the API deployment mounts `ca.crt` from the `minio-tls` secret. If cert-manager never issued the certificate, the pod cannot be scheduled. Staging's API pod never mounts this secret, so this only applies to `axiom` (production).

```bash
kubectl -n axiom get secret minio-tls
```

If not found, follow **Production — One-time Setup** above and wait for the `minio-internal-ca` / `minio-tls` Certificates to become Ready.

#### 3. `ghcr-pull-secret` not found or expired

The pod cannot pull its image from the private registry.

```bash
kubectl -n axiom-staging get secret ghcr-pull-secret
```

If missing or expired, recreate it (see **Step 2** above).

#### 4. Resource quota exceeded

```bash
kubectl -n axiom-staging describe resourcequota
```

If the namespace quota is exhausted, clean up unused resources or adjust the values in `infra/k8s/overlays/staging/patches/resource-quota.yaml` (production: `infra/k8s/base/resource-quota.yaml`).

### Inspecting a failed pod

```bash
# Events and conditions
kubectl -n axiom-staging describe pod -l app=api

# Current logs
kubectl -n axiom-staging logs -l app=api

# Logs from a crashed previous instance
kubectl -n axiom-staging logs -l app=api --previous
```
