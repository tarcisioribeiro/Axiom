# Guia de Deploy — MindLedger

Este guia descreve todos os passos necessários para configurar a infraestrutura
e as variáveis do GitLab CI/CD, de forma que o pipeline execute sem erros do
primeiro push.

---

## Visão geral do pipeline

```
lint → typecheck → test → build → scan → deploy-staging → smoke-staging → test-load → test-e2e → deploy-production → smoke-production
```

| Estágio             | Jobs                                                                                        | Quando executa           |
|---------------------|---------------------------------------------------------------------------------------------|--------------------------|
| `lint`              | `lint:backend`, `lint:bandit`, `lint:pip-audit`, `lint:frontend`, `lint:npm-audit`          | todo push / MR           |
| `typecheck`         | `typecheck:backend`, `typecheck:frontend`                                                   | todo push / MR           |
| `test`              | `test:backend`                                                                              | todo push / MR           |
| `build`             | `build:api`, `build:frontend`                                                               | develop / main / tag     |
| `scan`              | `scan:api`, `scan:frontend` (Trivy HIGH/CRITICAL)                                           | develop / main / tag     |
| `deploy-staging`    | `deploy:staging`                                                                            | develop                  |
| `smoke-staging`     | `smoke:staging`, `deploy:rollback:staging` (auto), `rollback:staging` (**manual**)          | develop                  |
| `test-load`         | `test:load` (k6)                                                                            | develop                  |
| `test-e2e`          | `test:e2e` (Playwright)                                                                     | develop                  |
| `deploy-production` | `deploy:production` (**manual**)                                                            | main                     |
| `smoke-production`  | `smoke:production`, `deploy:rollback:production` (auto), `rollback:production` (**manual**) | main                     |

> Para detalhes sobre os procedimentos de rollback consulte o
> [Runbook de Rollback](rollback.md).

> **Atenção:** `deploy:staging` e `deploy:production` só são liberados se `scan:api`
> e `scan:frontend` passarem. Uma vulnerabilidade HIGH ou CRITICAL nas imagens
> bloqueia o deploy automaticamente.

---

## Variáveis de CI/CD — referência completa

### Variáveis automáticas (GitLab preenche automaticamente)

Estas variáveis são injetadas automaticamente pelo GitLab em todo job de CI,
**desde que o Container Registry esteja habilitado**:

| Variável               | Valor típico                                        | Descrição                           |
|------------------------|-----------------------------------------------------|-------------------------------------|
| `CI_REGISTRY`          | `registry.gitlab.com` / `registry.seu-dominio.com` | URL do Container Registry           |
| `CI_REGISTRY_USER`     | (job token — gerado por pipeline)                   | Usuário para `docker login`         |
| `CI_REGISTRY_PASSWORD` | (job token — gerado por pipeline)                   | Senha para `docker login`           |
| `CI_REGISTRY_IMAGE`    | `$CI_REGISTRY/grupo/projeto`                        | Prefixo base das imagens do projeto |
| `API_IMAGE`            | `$CI_REGISTRY_IMAGE/api`                            | Derivado automaticamente pelo CI    |
| `FRONTEND_IMAGE`       | `$CI_REGISTRY_IMAGE/frontend`                       | Derivado automaticamente pelo CI    |

> No **GitLab.com** o registry já está ativo por padrão.
> No **GitLab self-hosted** o registry pode precisar ser habilitado — consulte a seção abaixo.

---

### Variáveis manuais obrigatórias

Configure estas variáveis **antes do primeiro push** para `develop` ou `main` em
**Settings → CI/CD → Variables → Add variable**.

---

#### `KUBECONFIG_CONTENT`

Kubeconfig em base64 que permite ao CI autenticar no cluster Kubernetes. Utilizado
pelos jobs `deploy:staging` e `deploy:production`.

**Como gerar** (execute no VPS onde o k3s está instalado):

```bash
# 1. Crie a ServiceAccount e o token de staging (passo único — veja seção k8s abaixo)
TOKEN=$(kubectl create token gitlab-ci -n mindledger-staging --duration=8760h)
SERVER=$(curl -s ifconfig.me)
CA=$(kubectl config view --minify --flatten \
  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

# 2. Monte o kubeconfig
cat <<EOF > /tmp/kubeconfig-ci.yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: ${CA}
    server: https://${SERVER}:6443
  name: k3s
contexts:
- context:
    cluster: k3s
    namespace: mindledger-staging
    user: gitlab-ci
  name: gitlab-ci@k3s
current-context: gitlab-ci@k3s
users:
- name: gitlab-ci
  user:
    token: ${TOKEN}
EOF

# 3. Valide antes de encodar
kubectl --kubeconfig /tmp/kubeconfig-ci.yaml get deployments -n mindledger-staging

# 4. Gere o valor em base64 — cole este output no GitLab
cat /tmp/kubeconfig-ci.yaml | base64 -w 0
echo ""
```

> **Nota:** O mesmo kubeconfig é usado para staging e produção. A namespace correta
> (`mindledger-staging` ou `mindledger`) é determinada por cada job de deploy via
> flags do `kubectl`.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

#### `STAGING_URL`

URL pública do ambiente de staging. Usada pelo smoke test, load test, E2E e pelo
GitLab Environments.

**Valor:** `https://mindledger-staging.tjtux.duckdns.org`

Como confirmar que o DNS está resolvendo:

```bash
curl -I https://mindledger-staging.tjtux.duckdns.org/health/
# Esperado: HTTP/2 200
```

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `PRODUCTION_URL`

URL pública do ambiente de produção. Usada pelo smoke test de produção e pelo
GitLab Environments.

**Valor:** URL pública da sua instância de produção (ex.: `https://mindledger.tjtux.duckdns.org`)

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `CI_SMOKE_JWT_STAGING`

Bearer JWT de um usuário de serviço no banco de staging. O smoke test usa este
token para verificar o endpoint autenticado `GET /api/v1/me/`.

**Como gerar:**

1. Crie o usuário de serviço no banco de staging (execute após o primeiro deploy):

```bash
kubectl -n mindledger-staging exec -it deployment/api -- \
  python manage.py createsuperuser \
  --username ci-smoke \
  --email ci-smoke@staging.local
```

2. Obtenha o token JWT:

```bash
curl -s -X POST https://mindledger-staging.tjtux.duckdns.org/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "ci-smoke", "password": "SENHA_DO_USUARIO"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['access'])"
```

3. Cole o valor do campo `access` como valor da variável no GitLab.

> **Atenção:** O token de acesso expira em 15 minutos (configuração padrão do projeto).
> Para uso em CI, gere um token de refresh de longa duração ou ajuste
> `ACCESS_TOKEN_LIFETIME` em `settings.py` para o usuário de serviço.
> Alternativamente, use o token de `refresh` e adicione uma etapa de renovação
> no smoke test.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

#### `CI_SMOKE_JWT_PRODUCTION`

Mesmo que `CI_SMOKE_JWT_STAGING`, mas para o banco de produção. Usado pelo
job `smoke:production`.

**Como gerar:**

```bash
# Crie o usuário no banco de produção
kubectl -n mindledger exec -it deployment/api-blue -- \
  python manage.py createsuperuser \
  --username ci-smoke \
  --email ci-smoke@prod.local

# Obtenha o token
curl -s -X POST https://mindledger.tjtux.duckdns.org/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "ci-smoke", "password": "SENHA_DO_USUARIO"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['access'])"
```

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

### Variáveis manuais para testes de carga e E2E

---

#### `K6_TEST_USERNAME` e `K6_TEST_PASSWORD`

Credenciais de um usuário pré-criado no banco de staging para o teste de carga
com k6. Este usuário deve ter dados suficientes para exercitar as rotas do
`k6/load-test.js`.

**Como criar o usuário:**

```bash
kubectl -n mindledger-staging exec -it deployment/api -- \
  python manage.py createsuperuser \
  --username k6-load \
  --email k6-load@staging.local
```

| Variável          | Masked | Protected |
|-------------------|--------|-----------|
| `K6_TEST_USERNAME`| Não    | Sim       |
| `K6_TEST_PASSWORD`| Sim    | Sim       |

---

#### `E2E_USERNAME` e `E2E_PASSWORD`

Credenciais de um usuário pré-criado no banco de staging para os testes E2E com
Playwright. Pode ser o mesmo usuário do k6 ou um separado.

**Como criar o usuário:**

```bash
kubectl -n mindledger-staging exec -it deployment/api -- \
  python manage.py createsuperuser \
  --username e2e-test \
  --email e2e-test@staging.local
```

| Variável      | Masked | Protected |
|---------------|--------|-----------|
| `E2E_USERNAME`| Não    | Sim       |
| `E2E_PASSWORD`| Sim    | Sim       |

---

### Variáveis manuais para validação de backups

Usadas pelo job `test:backup-restore` para baixar e restaurar o backup mais
recente do MinIO de staging.

---

#### `STAGING_MINIO_ENDPOINT`

Endpoint público do MinIO de staging.

**Valor:** `https://mindledger-staging.tjtux.duckdns.org:9000`

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `STAGING_MINIO_ACCESS_KEY`

Access key do MinIO de staging. Corresponde ao valor de `MINIO_ROOT_USER`
configurado no cluster (veja seção de provisionamento do k8s abaixo).

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `STAGING_MINIO_SECRET_KEY`

Secret key do MinIO de staging. Corresponde ao valor de `MINIO_ROOT_PASSWORD`
configurado no cluster.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

#### `STAGING_MINIO_BUCKET`

Nome do bucket MinIO onde os backups de staging são armazenados.

**Valor padrão:** `mindledger-backups` (omita a variável para usar o padrão)

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `BACKUP_ENCRYPTION_KEY`

Passphrase AES-256-CBC usada para encriptar os backups gerados pelo script
`api/scripts/backup.sh`. O job `test:backup-restore` usa esta chave para
descriptografar o backup antes de restaurá-lo.

**Como gerar:**

```bash
openssl rand -base64 32
```

> Guarde este valor com segurança. Sem ele, os backups encriptados não podem
> ser restaurados.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

### Variáveis opcionais para assinatura de imagens (SBOM)

Se não configuradas, a etapa de attestation é silenciosamente pulada — o
pipeline não falha.

---

#### `COSIGN_PRIVATE_KEY`

Chave privada PEM do cosign para assinar as imagens Docker com attestation SBOM.

**Como gerar:**

```bash
# Instale o cosign
brew install cosign   # macOS
# ou: https://docs.sigstore.dev/cosign/system_config/installation/

# Gere o par de chaves
cosign generate-key-pair
# Cria: cosign.key (privada — NUNCA commite) e cosign.pub (pública — commite no repo)

# Cole o conteúdo de cosign.key como valor da variável
cat cosign.key
```

Commite a chave pública no repositório:

```bash
git add cosign.pub
git commit -m "chore(ci): add cosign public key for SBOM attestation"
```

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

#### `COSIGN_PASSWORD`

Passphrase da chave cosign (se definida durante `cosign generate-key-pair`).
Deixe em branco se a chave não tem senha.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

## Configuração do Container Registry

### GitLab.com

O Container Registry já está disponível por padrão. Habilite-o por projeto em:

**Settings → General → Visibility, project features, permissions →
Container Registry → habilitar o toggle → Save changes**

---

### GitLab Self-Hosted

#### Verificar se o registry está ativo

```bash
curl -s --header "PRIVATE-TOKEN: <seu-token-admin>" \
  https://gitlab.seu-dominio.com/api/v4/settings | \
  python3 -m json.tool | grep container_registry
```

Se retornar `"container_registry_enabled": false`, habilite via `gitlab.rb`:

```bash
sudo nano /etc/gitlab/gitlab.rb
```

```ruby
registry_external_url 'https://registry.seu-dominio.com'
gitlab_rails['registry_enabled'] = true
```

```bash
sudo gitlab-ctl reconfigure
sudo gitlab-ctl restart registry
sudo gitlab-ctl status registry
```

#### Configurar runners para Docker-in-Docker (DinD)

Edite `/etc/gitlab-runner/config.toml`:

```toml
[[runners]]
  name = "docker-runner"
  executor = "docker"

  [runners.docker]
    image = "docker:26"
    privileged = true
    volumes = ["/certs/client", "/cache"]
```

```bash
sudo gitlab-runner restart
```

---

## Configuração do Cluster Kubernetes (k3s)

### 1. Preparar a VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo ufw allow 6443/tcp   # API do Kubernetes
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Instalar k3s

```bash
curl -sfL https://get.k3s.io | sh -
kubectl get nodes
```

### 3. Limpeza completa (reset de configuração existente)

```bash
kubectl delete secret gitlab-registry-secret -n mindledger-staging --ignore-not-found
kubectl delete secret gitlab-registry-secret -n mindledger --ignore-not-found
kubectl delete deployment api frontend -n mindledger-staging --ignore-not-found
kubectl delete deployment api-blue api-green frontend -n mindledger --ignore-not-found
kubectl delete rolebinding gitlab-ci-deploy -n mindledger-staging --ignore-not-found
kubectl delete rolebinding gitlab-ci-deploy -n mindledger --ignore-not-found
kubectl delete serviceaccount gitlab-ci -n mindledger-staging --ignore-not-found
kubectl delete serviceaccount gitlab-ci -n mindledger --ignore-not-found
kubectl delete namespace mindledger-staging --ignore-not-found
kubectl delete namespace mindledger --ignore-not-found
```

> Para forçar remoção de namespace preso em `Terminating`:
>
> ```bash
> kubectl get namespace mindledger-staging -o json \
>   | python3 -c "import sys, json; d=json.load(sys.stdin); d['spec']['finalizers']=[]; print(json.dumps(d))" \
>   | kubectl replace --raw "/api/v1/namespaces/mindledger-staging/finalize" -f -
> ```

### 4. Criar os namespaces

```bash
kubectl apply -f k8s/staging/namespace.yaml
kubectl apply -f k8s/namespace.yaml   # produção
```

### 5. Criar ServiceAccounts para o GitLab CI

```bash
# Staging
kubectl create serviceaccount gitlab-ci -n mindledger-staging
kubectl create rolebinding gitlab-ci-deploy \
  --clusterrole=edit \
  --serviceaccount=mindledger-staging:gitlab-ci \
  -n mindledger-staging

# Produção
kubectl create serviceaccount gitlab-ci -n mindledger
kubectl create rolebinding gitlab-ci-deploy \
  --clusterrole=edit \
  --serviceaccount=mindledger:gitlab-ci \
  -n mindledger
```

### 6. Gerar `KUBECONFIG_CONTENT`

```bash
TOKEN=$(kubectl create token gitlab-ci -n mindledger-staging --duration=8760h)
IP_PUBLICO=$(curl -s ifconfig.me)
CA=$(kubectl config view --minify --flatten \
  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

cat <<EOF > /tmp/kubeconfig-ci.yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: ${CA}
    server: https://${IP_PUBLICO}:6443
  name: k3s
contexts:
- context:
    cluster: k3s
    namespace: mindledger-staging
    user: gitlab-ci
  name: gitlab-ci@k3s
current-context: gitlab-ci@k3s
users:
- name: gitlab-ci
  user:
    token: ${TOKEN}
EOF

# Valide
kubectl --kubeconfig /tmp/kubeconfig-ci.yaml get deployments -n mindledger-staging

# Gere o base64 — cole este output no GitLab como KUBECONFIG_CONTENT
cat /tmp/kubeconfig-ci.yaml | base64 -w 0
echo ""
```

### 7. Configurar o pull secret do Container Registry

Crie um **Deploy Token** no GitLab com escopo `read_registry`:
**Settings → Repository → Deploy tokens → Add token**

```bash
REGISTRY_SERVER="registry.gitlab.com"   # ou registry.seu-dominio.com
GITLAB_USER="<nome-do-deploy-token>"
GITLAB_TOKEN="<valor-do-deploy-token>"

# Staging
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server="${REGISTRY_SERVER}" \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n mindledger-staging

# Produção
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server="${REGISTRY_SERVER}" \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n mindledger
```

> Para recriar após rotacionar o token:
>
> ```bash
> kubectl delete secret gitlab-registry-secret -n mindledger-staging --ignore-not-found
> kubectl delete secret gitlab-registry-secret -n mindledger --ignore-not-found
> # Execute o kubectl create secret acima novamente
> ```

### 8. Provisionar os secrets do Kubernetes (staging)

Os secrets do k8s são aplicados **manualmente uma única vez** e não são gerenciados
pelo CI. O arquivo `k8s/staging/secrets.yaml` usa placeholders `${VAR}` que
precisam ser substituídos via `envsubst` antes de aplicar.

Gere e exporte cada variável no terminal:

```bash
# Credenciais do banco de dados
export STAGING_DB_NAME="mindledger_staging"
export STAGING_DB_USER="mindledger_staging"
export STAGING_DB_PASSWORD="$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)"

# Chaves Django
export STAGING_SECRET_KEY="$(openssl rand -base64 50)"
export STAGING_ENCRYPTION_KEY="$(python3 -c \
  'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"

# Superusuário inicial
export STAGING_SUPERUSER_USERNAME="admin"
export STAGING_SUPERUSER_EMAIL="admin@staging.local"
export STAGING_SUPERUSER_PASSWORD="$(openssl rand -base64 24 | tr -d '=+/')"

# Redis
export STAGING_REDIS_PASSWORD="$(openssl rand -base64 24 | tr -d '=+/')"

# MinIO
export STAGING_MINIO_ROOT_USER="minioadmin"
export STAGING_MINIO_ROOT_PASSWORD="$(openssl rand -base64 24 | tr -d '=+/')"

# Sentry (opcional — deixe vazio para desabilitar)
export STAGING_SENTRY_DSN=""
```

> **Guarde estes valores com segurança** — você precisará de
> `STAGING_MINIO_ROOT_USER` e `STAGING_MINIO_ROOT_PASSWORD` para configurar
> `STAGING_MINIO_ACCESS_KEY` e `STAGING_MINIO_SECRET_KEY` no GitLab.

Aplique os secrets no cluster:

```bash
envsubst < k8s/staging/secrets.yaml | kubectl apply -f -
```

Verifique:

```bash
kubectl get secret mindledger-secrets -n mindledger-staging
```

### 9. Aplicar os demais recursos de infraestrutura (staging)

```bash
kubectl apply -f k8s/staging/serviceaccounts.yaml
kubectl apply -f k8s/staging/resource-quota.yaml
kubectl apply -f k8s/staging/network-policy.yaml
kubectl apply -f k8s/staging/configmap.yaml
kubectl apply -f k8s/staging/postgres/pvc.yaml
kubectl apply -f k8s/staging/postgres/configmap.yaml
kubectl apply -f k8s/staging/postgres/deployment.yaml
kubectl apply -f k8s/staging/postgres/service.yaml
kubectl apply -f k8s/staging/redis/pvc.yaml
kubectl apply -f k8s/staging/redis/deployment.yaml
kubectl apply -f k8s/staging/redis/service.yaml
kubectl apply -f k8s/staging/minio/pvc.yaml
kubectl apply -f k8s/staging/minio/tls.yaml
kubectl apply -f k8s/staging/minio/deployment.yaml
kubectl apply -f k8s/staging/minio/service.yaml
kubectl apply -f k8s/staging/api/pvc.yaml
kubectl apply -f k8s/staging/ingress.yaml
```

> Os manifestos `api/deployment.yaml` e `frontend/deployment.yaml` são aplicados
> pelo job `deploy:staging` a cada pipeline — não é necessário aplicá-los manualmente.

---

## Checklist completo antes do primeiro push

```
[ ] Container Registry habilitado no projeto GitLab
[ ] Branches main e develop marcadas como Protected
[ ] k3s instalado e acessível via IP público na porta 6443
[ ] Namespaces mindledger-staging e mindledger criados
[ ] ServiceAccounts gitlab-ci criadas em ambos os namespaces
[ ] Pull secret gitlab-registry-secret criado em ambos os namespaces
[ ] Secrets do k8s de staging aplicados via envsubst
[ ] Demais recursos de infraestrutura de staging aplicados
[ ] Variável KUBECONFIG_CONTENT configurada no GitLab
[ ] Variável STAGING_URL configurada no GitLab
[ ] Variável PRODUCTION_URL configurada no GitLab
[ ] Variável CI_SMOKE_JWT_STAGING configurada no GitLab *
[ ] Variável CI_SMOKE_JWT_PRODUCTION configurada no GitLab *
[ ] Variável K6_TEST_USERNAME configurada no GitLab
[ ] Variável K6_TEST_PASSWORD configurada no GitLab
[ ] Variável E2E_USERNAME configurada no GitLab
[ ] Variável E2E_PASSWORD configurada no GitLab
[ ] Variável STAGING_MINIO_ENDPOINT configurada no GitLab
[ ] Variável STAGING_MINIO_ACCESS_KEY configurada no GitLab
[ ] Variável STAGING_MINIO_SECRET_KEY configurada no GitLab
[ ] Variável BACKUP_ENCRYPTION_KEY configurada no GitLab
```

> (*) `CI_SMOKE_JWT_STAGING` e `CI_SMOKE_JWT_PRODUCTION` só podem ser gerados
> após o primeiro deploy bem-sucedido, pois dependem do banco estar disponível.
> O smoke test falhará na primeira execução se não estiverem configurados — isso
> é esperado. Configure-os após o deploy inicial e reexecute o pipeline.

---

## Fluxo completo do pipeline após a configuração

```
Push para develop
  → lint (black, isort, flake8, bandit, pip-audit, eslint, prettier, npm audit)
  → typecheck (mypy, tsc)
  → test:backend (pytest + coverage)
  → build:api + build:frontend  ← push para o Container Registry + SBOM
  → scan:api + scan:frontend    ← Trivy: bloqueia se HIGH/CRITICAL encontrado
  → deploy:staging              ← kubectl apply + set image → k3s reinicia os pods
  → smoke:staging               ← curl /health/, /ready/, /api/v1/me/
  → test:load                   ← k6 contra staging
  → test:e2e                    ← Playwright contra staging
  → test:backup-restore         ← baixa backup do MinIO, restaura, valida schema

Push para main (+ aprovação manual)
  → (mesmos estágios acima até scan)
  → deploy:production           ← blue-green switch + kubectl set image frontend
  → smoke:production            ← curl /health/, /ready/, /api/v1/me/
```
