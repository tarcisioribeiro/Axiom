# Guia de Deploy — Axiom

Este guia descreve todos os passos necessários para configurar a infraestrutura
e as variáveis do GitLab CI/CD, de forma que o pipeline execute sem erros do
primeiro push.

---

## Visão geral do pipeline

```
lint → typecheck → test → build → scan → deploy-staging → smoke-staging → test-load → test-e2e → promote → deploy-production → smoke-production
```

| Estágio             | Jobs                                                                                                                                      | Quando executa           |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------------|
| `lint`              | `lint:backend`, `lint:bandit`, `lint:pip-audit`, `lint:frontend`, `lint:npm-audit`, `lint:commits`, `lint:secrets`, `lint:k8s`           | todo push / MR           |
| `typecheck`         | `typecheck:backend`, `typecheck:frontend`                                                                                                 | todo push / MR           |
| `test`              | `test:backend`, `test:frontend`, `build:storybook`                                                                                       | todo push / MR           |
| `build`             | `build:api`, `build:frontend`                                                                                                             | develop / main / tag     |
| `scan`              | `scan:api`, `scan:frontend` (Trivy HIGH/CRITICAL)                                                                                        | develop / main / tag     |
| `deploy-staging`    | `deploy:staging`, `seed:staging`                                                                                                          | develop                  |
| `smoke-staging`     | `smoke:staging`, `backup:staging`, `deploy:rollback:staging` (auto), `rollback:staging` (**manual**)                                     | develop                  |
| `test-load`         | `test:load` (k6)                                                                                                                          | develop                  |
| `test-e2e`          | `test:e2e` (Playwright), `test:backup-restore`                                                                                            | develop                  |
| `promote`           | `promote:to_main` — abre ou atualiza MR develop→main automaticamente via GitLab API                                                       | develop                  |
| `deploy-production` | `deploy:production` (**manual**)                                                                                                          | main                     |
| `smoke-production`  | `smoke:production`, `deploy:rollback:production` (auto), `rollback:production` (**manual**)                                              | main                     |

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

#### `GITLAB_TOKEN`

Personal Access Token ou Project Access Token do GitLab com escopo `api` e papel
Developer (ou superior) no projeto. Usado pelo job `promote:to_main` para criar
ou atualizar o Merge Request develop→main automaticamente via GitLab API.

**Como gerar:** GitLab → User Settings → Access Tokens → Add new token (escopo: `api`)

> **Importante:** NÃO use `$CI_JOB_TOKEN` — ele não tem permissão para criar MRs.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

#### `KUBECONFIG_CONTENT`

Kubeconfig em base64 que permite ao CI autenticar no cluster Kubernetes. Utilizado
pelos jobs `deploy:staging` e `deploy:production`.

**Como gerar** (execute no VPS onde o k3s está instalado):

```bash
# 1. Crie a ServiceAccount e o token de staging (passo único — veja seção k8s abaixo)
TOKEN=$(kubectl create token gitlab-ci -n axiom-staging --duration=8760h)
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
    namespace: axiom-staging
    user: gitlab-ci
  name: gitlab-ci@k3s
current-context: gitlab-ci@k3s
users:
- name: gitlab-ci
  user:
    token: ${TOKEN}
EOF

# 3. Valide antes de encodar
kubectl --kubeconfig /tmp/kubeconfig-ci.yaml get deployments -n axiom-staging

# 4. Gere o valor em base64 — cole este output no GitLab
cat /tmp/kubeconfig-ci.yaml | base64 -w 0
echo ""
```

> **Nota:** O mesmo kubeconfig é usado para staging e produção. A namespace correta
> (`axiom-staging` ou `axiom`) é determinada por cada job de deploy via
> flags do `kubectl`.

| Configuração | Valor |
|---|---|
| Masked | Sim |
| Protected | Sim |

---

#### `STAGING_URL`

URL pública do ambiente de staging. Usada pelo smoke test, load test, E2E e pelo
GitLab Environments.

**Valor:** `https://axiom-staging.tjtux.duckdns.org`

Como confirmar que o DNS está resolvendo:

```bash
curl -I https://axiom-staging.tjtux.duckdns.org/health/
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

**Valor:** URL pública da sua instância de produção (ex.: `https://axiom.tjtux.duckdns.org`)

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `STAGING_SUPERUSER_USERNAME` e `STAGING_SUPERUSER_PASSWORD`

Credenciais do superusuário Django no banco de staging. O smoke test
(`smoke:staging`) faz login via `POST /api/v1/authentication/token/` com essas
credenciais para obter um JWT em cookie HttpOnly e validar o endpoint autenticado
`GET /api/v1/me/`.

> O endpoint de autenticação do Axiom devolve o token como cookie HttpOnly
> (não no body da resposta). O smoke test salva o cookie com `curl -c` e extrai
> o `access_token` diretamente do arquivo de cookie.

**Valores:** devem ser idênticos aos usados na provisão do K8s secret
(`STAGING_SUPERUSER_USERNAME` / `STAGING_SUPERUSER_PASSWORD` em `k8s/staging/secrets.yaml`).

**Como confirmar os valores vigentes no cluster:**

```bash
kubectl get secret axiom-secrets -n axiom-staging \
  -o jsonpath='{.data.DJANGO_SUPERUSER_USERNAME}' | base64 -d && echo
kubectl get secret axiom-secrets -n axiom-staging \
  -o jsonpath='{.data.DJANGO_SUPERUSER_PASSWORD}' | base64 -d && echo
```

> **Atenção:** O script `api/createsuperuser.py` **só cria** o superusuário se
> ele ainda não existir. Se o usuário já existe no banco e a senha do K8s secret
> foi alterada posteriormente, o banco e a variável CI ficam dessincronizados —
> o smoke test passará a retornar 401. Para realinhar, redefina a senha no banco:
>
> ```bash
> kubectl exec -n axiom-staging deployment/api -- \
>   python manage.py shell -c "
> from django.contrib.auth import get_user_model
> U = get_user_model()
> u = U.objects.get(username='admin')
> u.set_password('NOVA_SENHA')
> u.save()
> "
> ```

| Variável                       | Masked | Protected |
|-------------------------------|--------|-----------|
| `STAGING_SUPERUSER_USERNAME`  | Não    | Sim       |
| `STAGING_SUPERUSER_PASSWORD`  | Sim    | Sim       |

---

#### `PRODUCTION_SUPERUSER_USERNAME` e `PRODUCTION_SUPERUSER_PASSWORD`

Mesmo papel que as variáveis de staging, mas para o ambiente de produção. Usadas
pelo job `smoke:production`.

**Como confirmar os valores vigentes no cluster:**

```bash
kubectl get secret axiom-secrets -n axiom \
  -o jsonpath='{.data.DJANGO_SUPERUSER_USERNAME}' | base64 -d && echo
kubectl get secret axiom-secrets -n axiom \
  -o jsonpath='{.data.DJANGO_SUPERUSER_PASSWORD}' | base64 -d && echo
```

| Variável                          | Masked | Protected |
|----------------------------------|--------|-----------|
| `PRODUCTION_SUPERUSER_USERNAME`  | Não    | Sim       |
| `PRODUCTION_SUPERUSER_PASSWORD`  | Sim    | Sim       |

---

### Variáveis manuais para testes de carga e E2E

---

#### `K6_TEST_USERNAME` e `K6_TEST_PASSWORD`

Credenciais de um usuário pré-criado no banco de staging para o teste de carga
com k6. Este usuário deve ter dados suficientes para exercitar as rotas do
`k6/load-test.js`.

**Como criar o usuário:**

```bash
kubectl -n axiom-staging exec -it deployment/api -- \
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
kubectl -n axiom-staging exec -it deployment/api -- \
  python manage.py createsuperuser \
  --username e2e-test \
  --email e2e-test@staging.local
```

| Variável      | Masked | Protected |
|---------------|--------|-----------|
| `E2E_USERNAME`| Não    | Sim       |
| `E2E_PASSWORD`| Sim    | Sim       |

---

### Variáveis manuais para backup e validação de backups

Usadas pelos jobs `backup:staging` (dispara o backup no cluster) e
`test:backup-restore` (baixa e restaura o backup para validação).

---

#### `STAGING_MINIO_ROOT_USER` e `STAGING_MINIO_ROOT_PASSWORD`

Credenciais root do MinIO de staging. O job `backup:staging` as usa para criar
(ou atualizar) o secret `axiom-backup-secrets` no Kubernetes antes de
disparar o job de backup.

**Como obter os valores vigentes no cluster:**

```bash
kubectl get secret axiom-secrets -n axiom-staging \
  -o jsonpath='{.data.MINIO_ROOT_USER}' | base64 -d && echo
kubectl get secret axiom-secrets -n axiom-staging \
  -o jsonpath='{.data.MINIO_ROOT_PASSWORD}' | base64 -d && echo
```

| Variável                      | Masked | Protected |
|------------------------------|--------|-----------|
| `STAGING_MINIO_ROOT_USER`    | Não    | Sim       |
| `STAGING_MINIO_ROOT_PASSWORD`| Sim    | Sim       |

---

#### `STAGING_MINIO_ENDPOINT`

Endpoint do MinIO de staging **acessível a partir do runner de CI**. O runner
roda como container Docker no próprio VPS, portanto deve-se usar o IP público
do VPS na porta NodePort exposta pelo serviço MinIO.

**Como obter:**

```bash
# IP público do VPS
curl -s ifconfig.me

# NodePort do serviço MinIO
kubectl get svc minio-service -n axiom-staging \
  -o jsonpath='{.spec.ports[?(@.port==9000)].nodePort}'
```

**Formato do valor:** `http://<IP_PUBLICO_VPS>:<NODEPORT>`

Exemplo: `http://84.247.184.151:30900`

> Não use `https://` nem a URL do ingress para esta variável — o MinIO interno
> do cluster não serve TLS no NodePort. O ingress não expõe a porta 9000 por
> padrão.

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `STAGING_MINIO_ACCESS_KEY` e `STAGING_MINIO_SECRET_KEY`

Credenciais que o job `test:backup-restore` usa para autenticar no MinIO e
baixar o backup mais recente. Como o MinIO de staging não possui usuários
adicionais configurados além do root, **devem ter o mesmo valor** que
`STAGING_MINIO_ROOT_USER` e `STAGING_MINIO_ROOT_PASSWORD`.

**Como obter:**

```bash
# São os mesmos valores do root user — confirme com:
kubectl get secret axiom-secrets -n axiom-staging \
  -o jsonpath='{.data.MINIO_ROOT_USER}' | base64 -d && echo
kubectl get secret axiom-secrets -n axiom-staging \
  -o jsonpath='{.data.MINIO_ROOT_PASSWORD}' | base64 -d && echo
```

> Se no futuro for criado um usuário MinIO dedicado para CI com policy
> `readonly`, atualize estas variáveis para usar esse usuário em vez do root.

| Variável                   | Masked | Protected |
|---------------------------|--------|-----------|
| `STAGING_MINIO_ACCESS_KEY`| Não    | Sim       |
| `STAGING_MINIO_SECRET_KEY`| Sim    | Sim       |

---

#### `STAGING_MINIO_BUCKET`

Nome do bucket MinIO onde os backups de staging são armazenados.

**Valor padrão:** `axiom-backups` (omita a variável para usar o padrão)

| Configuração | Valor |
|---|---|
| Masked | Não |
| Protected | Sim |

---

#### `BACKUP_ENCRYPTION_KEY`

Passphrase AES-256-CBC usada para encriptar os backups gerados pelo script
`api/scripts/backup.sh`. Os jobs `backup:staging` e `test:backup-restore` usam
esta chave — o primeiro para encriptar, o segundo para descriptografar antes de
restaurar.

**Como gerar:**

```bash
openssl rand -base64 32
```

> Guarde este valor com segurança. Sem ele, os backups encriptados não podem
> ser restaurados. Use um valor diferente para produção.

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
kubectl delete secret gitlab-registry-secret -n axiom-staging --ignore-not-found
kubectl delete secret gitlab-registry-secret -n axiom --ignore-not-found
kubectl delete deployment api frontend -n axiom-staging --ignore-not-found
kubectl delete deployment api-blue api-green frontend -n axiom --ignore-not-found
kubectl delete rolebinding gitlab-ci-deploy -n axiom-staging --ignore-not-found
kubectl delete rolebinding gitlab-ci-deploy -n axiom --ignore-not-found
kubectl delete serviceaccount gitlab-ci -n axiom-staging --ignore-not-found
kubectl delete serviceaccount gitlab-ci -n axiom --ignore-not-found
kubectl delete namespace axiom-staging --ignore-not-found
kubectl delete namespace axiom --ignore-not-found
```

> Para forçar remoção de namespace preso em `Terminating`:
>
> ```bash
> kubectl get namespace axiom-staging -o json \
>   | python3 -c "import sys, json; d=json.load(sys.stdin); d['spec']['finalizers']=[]; print(json.dumps(d))" \
>   | kubectl replace --raw "/api/v1/namespaces/axiom-staging/finalize" -f -
> ```

### 4. Criar os namespaces

```bash
kubectl apply -f k8s/staging/namespace.yaml
kubectl apply -f k8s/namespace.yaml   # produção
```

### 5. Criar ServiceAccounts para o GitLab CI

```bash
# Staging
kubectl create serviceaccount gitlab-ci -n axiom-staging
kubectl create rolebinding gitlab-ci-deploy \
  --clusterrole=edit \
  --serviceaccount=axiom-staging:gitlab-ci \
  -n axiom-staging

# Produção
kubectl create serviceaccount gitlab-ci -n axiom
kubectl create rolebinding gitlab-ci-deploy \
  --clusterrole=edit \
  --serviceaccount=axiom:gitlab-ci \
  -n axiom
```

### 6. Gerar `KUBECONFIG_CONTENT`

```bash
TOKEN=$(kubectl create token gitlab-ci -n axiom-staging --duration=8760h)
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
    namespace: axiom-staging
    user: gitlab-ci
  name: gitlab-ci@k3s
current-context: gitlab-ci@k3s
users:
- name: gitlab-ci
  user:
    token: ${TOKEN}
EOF

# Valide
kubectl --kubeconfig /tmp/kubeconfig-ci.yaml get deployments -n axiom-staging

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
  -n axiom-staging

# Produção
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server="${REGISTRY_SERVER}" \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n axiom
```

> Para recriar após rotacionar o token:
>
> ```bash
> kubectl delete secret gitlab-registry-secret -n axiom-staging --ignore-not-found
> kubectl delete secret gitlab-registry-secret -n axiom --ignore-not-found
> # Execute o kubectl create secret acima novamente
> ```

### 8. Provisionar os secrets do Kubernetes (staging)

Os secrets do k8s são aplicados **manualmente uma única vez** e não são gerenciados
pelo CI. O arquivo `k8s/staging/secrets.yaml` usa placeholders `${VAR}` que
precisam ser substituídos via `envsubst` antes de aplicar.

Gere e exporte cada variável no terminal:

```bash
# Credenciais do banco de dados
export STAGING_DB_NAME="axiom_staging"
export STAGING_DB_USER="axiom_staging"
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
kubectl get secret axiom-secrets -n axiom-staging
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
[ ] Namespaces axiom-staging e axiom criados
[ ] ServiceAccounts gitlab-ci criadas em ambos os namespaces
[ ] Pull secret gitlab-registry-secret criado em ambos os namespaces
[ ] Secrets do k8s de staging aplicados via envsubst
[ ] Demais recursos de infraestrutura de staging aplicados

Variáveis de CI/CD no GitLab (Settings → CI/CD → Variables):
[ ] GITLAB_TOKEN
[ ] KUBECONFIG_CONTENT
[ ] STAGING_URL
[ ] PRODUCTION_URL
[ ] STAGING_SUPERUSER_USERNAME   *
[ ] STAGING_SUPERUSER_PASSWORD   *
[ ] PRODUCTION_SUPERUSER_USERNAME  **
[ ] PRODUCTION_SUPERUSER_PASSWORD  **
[ ] K6_TEST_USERNAME             *
[ ] K6_TEST_PASSWORD             *
[ ] E2E_USERNAME                 *
[ ] E2E_PASSWORD                 *
[ ] STAGING_MINIO_ENDPOINT
[ ] STAGING_MINIO_ROOT_USER
[ ] STAGING_MINIO_ROOT_PASSWORD
[ ] STAGING_MINIO_ACCESS_KEY
[ ] STAGING_MINIO_SECRET_KEY
[ ] BACKUP_ENCRYPTION_KEY
[ ] COSIGN_PRIVATE_KEY           (opcional)
[ ] COSIGN_PASSWORD              (opcional)
```

> (*) Requerem o primeiro `deploy:staging` bem-sucedido para que o banco de
> staging esteja disponível. Configure antes do segundo push e reexecute o pipeline.
>
> (**) Requerem o primeiro `deploy:production` bem-sucedido. O job
> `smoke:production` só executa em pushes para `main`.

---

## Fluxo completo do pipeline após a configuração

```
Push para develop
  → lint (black, isort, flake8, bandit, pip-audit, eslint, prettier, npm audit, commitlint)
  → typecheck (mypy, tsc)
  → test:backend (pytest + coverage)
  → build:api + build:frontend    ← push para o Container Registry + SBOM
  → scan:api + scan:frontend       ← Trivy: bloqueia se HIGH/CRITICAL encontrado
  → deploy:staging                 ← kubectl apply + set image → k3s reinicia os pods
  → smoke:staging                  ← curl /health/, /ready/ + login cookie + /api/v1/me/
  → backup:staging                 ← cria job K8s a partir do CronJob; aguarda conclusão
  → test:load                      ← k6 contra staging
  → test:e2e + test:backup-restore ← Playwright / baixa dump MinIO, pg_restore, manage.py check

Push para main (+ aprovação manual)
  → (mesmos estágios acima até scan)
  → deploy:production              ← blue-green switch + kubectl set image frontend
  → smoke:production               ← curl /health/, /ready/ + login cookie + /api/v1/me/
```
