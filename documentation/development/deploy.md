# Guia de Deploy — MindLedger

Este guia descreve todos os passos necessários para configurar a infraestrutura
e as variáveis do GitLab CI/CD, de forma que o pipeline execute sem erros do
primeiro push.

---

## Visão geral do pipeline

```
lint → typecheck → test → build → scan → deploy-staging → deploy-production
```

| Estágio          | Jobs                                                               | Quando executa        |
|-----------------|--------------------------------------------------------------------|-----------------------|
| `lint`          | `lint:backend`, `lint:bandit`, `lint:pip-audit`, `lint:frontend`, `lint:npm-audit` | todo push / MR        |
| `typecheck`     | `typecheck:backend`, `typecheck:frontend`                         | todo push / MR        |
| `test`          | `test:backend`                                                     | todo push / MR        |
| `build`         | `build:api`, `build:frontend`                                      | develop / main / tag  |
| `scan`          | `scan:api`, `scan:frontend` (Trivy HIGH/CRITICAL)                  | develop / main / tag  |
| `deploy-staging`| `deploy:staging`                                                   | develop               |
| `deploy-production` | `deploy:production` (**manual**)                              | main                  |

> **Atenção:** `deploy:staging` e `deploy:production` só são liberados se `scan:api`
> e `scan:frontend` passarem. Uma vulnerabilidade HIGH ou CRITICAL nas imagens
> bloqueia o deploy automaticamente.

---

## Variáveis obrigatórias no GitLab

Configure todas as variáveis abaixo em
**Settings → CI/CD → Variables** antes de fazer o primeiro push para `develop` ou `main`.

| Variável            | Descrição                                                          | Masked | Protected |
|--------------------|--------------------------------------------------------------------|--------|-----------|
| `KUBE_CONFIG`      | kubeconfig em base64 para o namespace `mindledger-staging`         | ✅     | ✅        |
| `KUBE_CONFIG_PROD` | kubeconfig em base64 para o namespace `mindledger`                 | ✅     | ✅        |
| `STAGING_URL`      | URL pública do ambiente de staging (ex.: `https://staging.exemplo.com`) | ❌ | ✅  |
| `PRODUCTION_URL`   | URL pública do ambiente de produção (ex.: `https://exemplo.com`)   | ❌     | ✅        |

> As variáveis `CI_REGISTRY`, `CI_REGISTRY_USER` e `CI_REGISTRY_PASSWORD` são
> preenchidas **automaticamente** pelo GitLab — não é necessário criá-las.

---

## 1. Habilitar o GitLab Container Registry

O pipeline faz push das imagens para `registry.gitlab.com/<grupo>/<projeto>/api` e
`registry.gitlab.com/<grupo>/<projeto>/frontend` usando a variável automática
`$CI_REGISTRY_IMAGE`. O Trivy usa as mesmas credenciais automáticas para fazer
pull e escanear as imagens.

No GitLab: **Settings → General → Visibility, project features, permissions →
Container Registry → Enable**.

---

## 2. Preparar a VPS

Conecte via SSH e execute:

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Abrir portas necessárias no firewall
sudo ufw allow 6443/tcp   # API do Kubernetes (kubectl / CI)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Instalar k3s

```bash
curl -sfL https://get.k3s.io | sh -
```

Aguarde ~1 minuto e verifique:

```bash
kubectl get nodes
```

```
NAME       STATUS   ROLES                  AGE   VERSION
minha-vps  Ready    control-plane,master   1m    v1.32.x+k3s1
```

---

## 4. Criar os namespaces

```bash
kubectl create namespace mindledger-staging
kubectl create namespace mindledger
```

---

## 5. Criar ServiceAccounts para o GitLab CI

Crie uma conta restrita por namespace, sem acesso ao cluster inteiro.

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

---

## 6. Gerar `KUBE_CONFIG` (staging)

```bash
# Token com validade de 1 ano (ajuste conforme necessário)
TOKEN_STAGING=$(kubectl create token gitlab-ci \
  -n mindledger-staging \
  --duration=8760h)

# Endpoint e CA do cluster
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
CA=$(kubectl config view --minify --flatten \
  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

# Substituir 127.0.0.1 pelo IP público da VPS
IP_PUBLICO=$(curl -s ifconfig.me)
SERVER_PUBLICO="https://${IP_PUBLICO}:6443"

# Montar o kubeconfig
cat <<EOF > /tmp/kubeconfig-staging.yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: ${CA}
    server: ${SERVER_PUBLICO}
  name: k3s
contexts:
- context:
    cluster: k3s
    namespace: mindledger-staging
    user: gitlab-ci-staging
  name: gitlab-ci@k3s-staging
current-context: gitlab-ci@k3s-staging
users:
- name: gitlab-ci-staging
  user:
    token: ${TOKEN_STAGING}
EOF

# Gerar o valor em base64 para colar no GitLab (variável KUBE_CONFIG)
cat /tmp/kubeconfig-staging.yaml | base64 -w 0
echo ""
```

Copie o output e cole como valor da variável **`KUBE_CONFIG`** no GitLab.

---

## 7. Gerar `KUBE_CONFIG_PROD` (produção)

```bash
# Token com validade de 1 ano
TOKEN_PROD=$(kubectl create token gitlab-ci \
  -n mindledger \
  --duration=8760h)

# Reutilize SERVER_PUBLICO e CA do passo anterior (ou execute novamente)

# Montar o kubeconfig
cat <<EOF > /tmp/kubeconfig-prod.yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: ${CA}
    server: ${SERVER_PUBLICO}
  name: k3s
contexts:
- context:
    cluster: k3s
    namespace: mindledger
    user: gitlab-ci-prod
  name: gitlab-ci@k3s-prod
current-context: gitlab-ci@k3s-prod
users:
- name: gitlab-ci-prod
  user:
    token: ${TOKEN_PROD}
EOF

# Gerar o valor em base64 para colar no GitLab (variável KUBE_CONFIG_PROD)
cat /tmp/kubeconfig-prod.yaml | base64 -w 0
echo ""
```

Copie o output e cole como valor da variável **`KUBE_CONFIG_PROD`** no GitLab.

---

## 8. Configurar as variáveis no GitLab

**Settings → CI/CD → Variables → Add variable**

| Key                | Value                              | Type     | Masked | Protected |
|-------------------|------------------------------------|----------|--------|-----------|
| `KUBE_CONFIG`     | base64 gerado no passo 6           | Variable | ✅     | ✅        |
| `KUBE_CONFIG_PROD`| base64 gerado no passo 7           | Variable | ✅     | ✅        |
| `STAGING_URL`     | `https://staging.seu-dominio.com`  | Variable | ❌     | ✅        |
| `PRODUCTION_URL`  | `https://seu-dominio.com`          | Variable | ❌     | ✅        |

> Marque **Protected** para que as variáveis só sejam injetadas em pipelines de
> branches protegidas (`main`, `develop`) e tags — evitando exposição em branches
> de feature.

---

## 9. Criar os Deployments iniciais no cluster

O pipeline executa `kubectl set image deployment/api ...`, portanto os Deployments
precisam existir antes do primeiro deploy.

### Staging

```bash
# Substitua pelo caminho real do seu Container Registry no GitLab
REGISTRY="registry.gitlab.com/seu-usuario/mindledger"

kubectl create deployment api \
  --image="${REGISTRY}/api:latest" \
  -n mindledger-staging

kubectl create deployment frontend \
  --image="${REGISTRY}/frontend:latest" \
  -n mindledger-staging
```

### Produção

```bash
kubectl create deployment api \
  --image="${REGISTRY}/api:latest" \
  -n mindledger

kubectl create deployment frontend \
  --image="${REGISTRY}/frontend:latest" \
  -n mindledger
```

---

## 10. Configurar o pull secret do GitLab Registry

Os pods precisam de credenciais para baixar imagens do `registry.gitlab.com`.
Crie um **Personal Access Token** no GitLab com o escopo `read_registry` e execute:

```bash
GITLAB_USER="seu-usuario-gitlab"
GITLAB_TOKEN="seu-personal-access-token"

# Staging
kubectl create secret docker-registry gitlab-registry \
  --docker-server=registry.gitlab.com \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n mindledger-staging

kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "gitlab-registry"}]}' \
  -n mindledger-staging

# Produção
kubectl create secret docker-registry gitlab-registry \
  --docker-server=registry.gitlab.com \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n mindledger

kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "gitlab-registry"}]}' \
  -n mindledger
```

---

## Fluxo completo do pipeline após a configuração

```
Push para develop
  → lint (black, isort, flake8, bandit, pip-audit, eslint, prettier, npm audit)
  → typecheck (mypy, tsc)
  → test:backend (pytest + coverage)
  → build:api + build:frontend  ← push para registry.gitlab.com
  → scan:api + scan:frontend    ← Trivy: bloqueia se HIGH/CRITICAL encontrado
  → deploy:staging              ← kubectl set image → k3s reinicia os pods

Push para main (+ aprovação manual)
  → (mesmos estágios acima até scan)
  → deploy:production           ← kubectl set image → k3s reinicia os pods
```

> **scan:api** e **scan:frontend** puxam as imagens do GitLab Container Registry
> usando as credenciais automáticas `CI_REGISTRY_USER` / `CI_REGISTRY_PASSWORD`.
> Nenhuma variável extra é necessária para o Trivy.
