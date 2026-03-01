# Guia de Deploy — MindLedger

Este guia descreve todos os passos necessários para configurar a infraestrutura
e as variáveis do GitLab CI/CD, de forma que o pipeline execute sem erros do
primeiro push.

---

## Visão geral do pipeline

```
lint → typecheck → test → build → scan → deploy-staging → deploy-production
```

| Estágio             | Jobs                                                                            | Quando executa       |
|---------------------|---------------------------------------------------------------------------------|----------------------|
| `lint`              | `lint:backend`, `lint:bandit`, `lint:pip-audit`, `lint:frontend`, `lint:npm-audit` | todo push / MR   |
| `typecheck`         | `typecheck:backend`, `typecheck:frontend`                                       | todo push / MR       |
| `test`              | `test:backend`                                                                  | todo push / MR       |
| `build`             | `build:api`, `build:frontend`                                                   | develop / main / tag |
| `scan`              | `scan:api`, `scan:frontend` (Trivy HIGH/CRITICAL)                               | develop / main / tag |
| `deploy-staging`    | `deploy:staging`                                                                | develop              |
| `deploy-production` | `deploy:production` (**manual**)                                                | main                 |

> **Atenção:** `deploy:staging` e `deploy:production` só são liberados se `scan:api`
> e `scan:frontend` passarem. Uma vulnerabilidade HIGH ou CRITICAL nas imagens
> bloqueia o deploy automaticamente.

---

## Variáveis de CI/CD — referência completa

### Variáveis automáticas (GitLab preenche em ambas as modalidades)

Estas variáveis são injetadas automaticamente pelo GitLab em todo job de CI,
**desde que o Container Registry esteja habilitado** (veja seção seguinte):

| Variável              | Valor típico                                        | Descrição                                    |
|-----------------------|-----------------------------------------------------|----------------------------------------------|
| `CI_REGISTRY`         | `registry.gitlab.com` / `registry.seu-dominio.com` | URL do Container Registry                    |
| `CI_REGISTRY_USER`    | (job token — gerado por pipeline)                   | Usuário para `docker login`                  |
| `CI_REGISTRY_PASSWORD`| (job token — gerado por pipeline)                   | Senha para `docker login`                    |
| `CI_REGISTRY_IMAGE`   | `$CI_REGISTRY/grupo/projeto`                        | Prefixo base das imagens do projeto          |

> No **GitLab.com** o registry já está ativo por padrão.
> No **GitLab self-hosted** o registry pode precisar ser habilitado — consulte a seção abaixo.

### Variáveis manuais (configurar em Settings → CI/CD → Variables)

Configure estas variáveis **antes do primeiro push** para `develop` ou `main`:

| Variável            | Descrição                                                               | Masked | Protected |
|---------------------|-------------------------------------------------------------------------|--------|-----------|
| `KUBE_CONFIG`       | kubeconfig em base64 para o namespace `mindledger-staging`              | ✅     | ✅        |
| `KUBE_CONFIG_PROD`  | kubeconfig em base64 para o namespace `mindledger`                      | ✅     | ✅        |
| `STAGING_URL`       | URL pública do ambiente de staging (ex.: `https://staging.exemplo.com`) | ❌     | ✅        |
| `PRODUCTION_URL`    | URL pública do ambiente de produção (ex.: `https://exemplo.com`)        | ❌     | ✅        |

> Marque **Protected** para que as variáveis só sejam injetadas em pipelines de
> branches protegidas (`main`, `develop`) e tags — evitando exposição em branches
> de feature.

---

## Trilha A: GitLab.com (gerenciado)

Se o projeto está hospedado em **gitlab.com**, o Container Registry já está
disponível globalmente. Você só precisa habilitá-lo **por projeto**:

**Settings → General → Visibility, project features, permissions →
Container Registry → habilitar o toggle → Save changes**

Após isso, as variáveis `CI_REGISTRY*` são preenchidas automaticamente e o
pipeline pode fazer `docker login` / `docker push` sem configuração adicional.

Configure apenas as [variáveis manuais](#variáveis-manuais-configurar-em-settings--cicd--variables)
e siga direto para a [configuração do cluster](#configuração-do-cluster-kubernetes-k3s).

---

## Trilha B: GitLab Self-Hosted

Em instâncias GitLab hospedadas por você mesmo, o Container Registry pode estar
desabilitado no nível da instância ou não exposto externamente. Siga as etapas
abaixo de acordo com o método de instalação do seu GitLab.

### B.1 Verificar se o registry está ativo

Acesse **Admin Area → Overview → Dashboard**. Se não houver o item
"Container Registry" no menu lateral de Admin, o registry não está habilitado
na instância.

Também é possível verificar via API:

```bash
curl -s --header "PRIVATE-TOKEN: <seu-token-admin>" \
  https://gitlab.seu-dominio.com/api/v4/settings | \
  python3 -m json.tool | grep container_registry
```

Se retornar `"container_registry_enabled": false`, siga o passo B.2.

---

### B.2 Habilitar o Container Registry na instância

Escolha a opção correspondente ao seu método de instalação:

#### Opção 1 — Admin Area (UI)

> Disponível em algumas versões/configurações. Se a opção não aparecer na UI,
> use a Opção 2 ou 3.

1. Acesse **Admin Area → Settings → General**
2. Expanda **"Visibility and access controls"**
3. Localize **"Container Registry"** e marque **"Enable"**
4. Clique em **Save changes**

---

#### Opção 2 — gitlab.rb (instalação Omnibus/pacote Linux)

Edite o arquivo de configuração do GitLab:

```bash
sudo nano /etc/gitlab/gitlab.rb
```

Adicione ou descomente as linhas abaixo, substituindo pelo domínio real:

```ruby
# URL externa do Container Registry (pode ser subdomínio separado ou mesma porta diferente)
registry_external_url 'https://registry.seu-dominio.com'

# Habilitar o registry integrado
gitlab_rails['registry_enabled'] = true

# (Opcional) Porta interna usada pelo registry — padrão é 5000
# registry['registry_http_addr'] = "127.0.0.1:5000"
```

Aplique as alterações:

```bash
sudo gitlab-ctl reconfigure
sudo gitlab-ctl restart registry
```

Verifique se o serviço subiu:

```bash
sudo gitlab-ctl status registry
```

> **DNS**: Certifique-se de que `registry.seu-dominio.com` aponta para o
> mesmo IP da VPS e que a porta 443 está aberta. O Nginx do GitLab gerencia o
> SSL automaticamente via Let's Encrypt se `letsencrypt['enable'] = true`
> estiver configurado.

---

#### Opção 3 — Docker Compose (GitLab via container)

Se o GitLab está rodando com Docker Compose, adicione as variáveis de ambiente
ao serviço `gitlab` no seu `docker-compose.yml`:

```yaml
services:
  gitlab:
    image: gitlab/gitlab-ee:latest   # ou gitlab-ce
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'https://gitlab.seu-dominio.com'
        registry_external_url 'https://registry.seu-dominio.com'
        gitlab_rails['registry_enabled'] = true
    ports:
      - "80:80"
      - "443:443"
      - "5050:5050"   # porta do registry, se não usar subdomínio separado
```

Reinicie o container para aplicar:

```bash
docker compose up -d gitlab
docker compose exec gitlab gitlab-ctl reconfigure
```

---

### B.3 Habilitar o Container Registry por projeto (self-hosted)

Mesmo com o registry habilitado na instância, pode ser necessário habilitá-lo
por projeto:

**Settings → General → Visibility, project features, permissions →
Container Registry → habilitar o toggle → Save changes**

---

### B.4 Configurar runners para Docker-in-Docker (DinD)

O pipeline usa `docker:26` com o serviço `docker:26-dind`. Os runners
self-hosted precisam estar configurados para isso.

Edite a configuração do runner (`/etc/gitlab-runner/config.toml`):

```toml
[[runners]]
  name = "docker-runner"
  executor = "docker"

  [runners.docker]
    image = "docker:26"
    privileged = true          # obrigatório para DinD
    volumes = ["/certs/client", "/cache"]

    # Desativar TLS caso use docker:dind sem certificados
    # environment = ["DOCKER_TLS_CERTDIR="]
```

Reinicie o runner:

```bash
sudo gitlab-runner restart
```

> **Segurança**: O modo `privileged = true` concede acesso root ao host.
> Use runners dedicados e isolados para builds de produção.

---

### B.5 Variáveis automáticas no self-hosted

Com o registry habilitado e configurado corretamente, o GitLab **preenche
automaticamente** as mesmas variáveis do GitLab.com — a única diferença é
o valor de `CI_REGISTRY`:

| Variável          | GitLab.com              | Self-hosted                         |
|-------------------|-------------------------|-------------------------------------|
| `CI_REGISTRY`     | `registry.gitlab.com`   | `registry.seu-dominio.com`          |
| `CI_REGISTRY_USER`| job token (automático)  | job token (automático)              |
| `CI_REGISTRY_PASSWORD` | job token (automático) | job token (automático)         |
| `CI_REGISTRY_IMAGE`| `registry.gitlab.com/grupo/projeto` | `registry.seu-dominio.com/grupo/projeto` |

> Não é necessário criar essas variáveis manualmente em nenhum dos cenários.

---

## Configuração do Cluster Kubernetes (k3s)

### 1. Preparar a VPS

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

### 2. Instalar k3s

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

### 3. Limpeza completa (reset de configuração existente)

Use estes comandos para remover todos os recursos criados pelo guia e recomeçar
do zero. A flag `--ignore-not-found` evita erros caso o recurso não exista.

```bash
# 1. Secrets de registry
kubectl delete secret gitlab-registry -n mindledger-staging --ignore-not-found
kubectl delete secret gitlab-registry -n mindledger --ignore-not-found

# 2. Deployments
kubectl delete deployment api frontend -n mindledger-staging --ignore-not-found
kubectl delete deployment api frontend -n mindledger --ignore-not-found

# 3. RoleBindings (devem ser removidos antes das ServiceAccounts)
kubectl delete rolebinding gitlab-ci-deploy -n mindledger-staging --ignore-not-found
kubectl delete rolebinding gitlab-ci-deploy -n mindledger --ignore-not-found

# 4. ServiceAccounts
kubectl delete serviceaccount gitlab-ci -n mindledger-staging --ignore-not-found
kubectl delete serviceaccount gitlab-ci -n mindledger --ignore-not-found

# 5. Namespaces (apaga TUDO que estiver dentro deles)
kubectl delete namespace mindledger-staging --ignore-not-found
kubectl delete namespace mindledger --ignore-not-found
```

> A remoção dos namespaces aguarda a finalização de todos os pods. Para forçar
> remoção imediata em caso de namespace preso em `Terminating`:
>
> ```bash
> kubectl get namespace mindledger-staging -o json \
>   | python3 -c "import sys, json; d=json.load(sys.stdin); d['spec']['finalizers']=[]; print(json.dumps(d))" \
>   | kubectl replace --raw "/api/v1/namespaces/mindledger-staging/finalize" -f -
> ```

Após a limpeza, prossiga com os passos abaixo para recriar tudo.

---

### 4. Criar os namespaces

```bash
kubectl create namespace mindledger-staging
kubectl create namespace mindledger
```

---

### 5. Criar ServiceAccounts para o GitLab CI

Crie contas restritas por namespace, sem acesso ao cluster inteiro.

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

Verifique:

```bash
kubectl get serviceaccount gitlab-ci -n mindledger-staging
kubectl get rolebinding gitlab-ci-deploy -n mindledger-staging
kubectl get serviceaccount gitlab-ci -n mindledger
kubectl get rolebinding gitlab-ci-deploy -n mindledger
```

---

### 6. Gerar `KUBE_CONFIG` (staging)

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

# Validar antes de gerar o base64
kubectl --kubeconfig /tmp/kubeconfig-staging.yaml get deployments -n mindledger-staging

# Gerar o valor em base64 para colar no GitLab (variável KUBE_CONFIG)
cat /tmp/kubeconfig-staging.yaml | base64 -w 0
echo ""
```

Copie o output e cole como valor da variável **`KUBE_CONFIG`** no GitLab.

---

### 7. Gerar `KUBE_CONFIG_PROD` (produção)

```bash
# Token com validade de 1 ano
TOKEN_PROD=$(kubectl create token gitlab-ci \
  -n mindledger \
  --duration=8760h)

# Reutilize SERVER_PUBLICO e CA do passo anterior (ou execute novamente):
IP_PUBLICO=$(curl -s ifconfig.me)
SERVER_PUBLICO="https://${IP_PUBLICO}:6443"
CA=$(kubectl config view --minify --flatten \
  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

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

# Validar antes de gerar o base64
kubectl --kubeconfig /tmp/kubeconfig-prod.yaml get deployments -n mindledger

# Gerar o valor em base64 para colar no GitLab (variável KUBE_CONFIG_PROD)
cat /tmp/kubeconfig-prod.yaml | base64 -w 0
echo ""
```

Copie o output e cole como valor da variável **`KUBE_CONFIG_PROD`** no GitLab.

---

### 8. Configurar as variáveis no GitLab

**Settings → CI/CD → Variables → Add variable**

| Key                 | Value                              | Type     | Masked | Protected |
|---------------------|------------------------------------|----------|--------|-----------|
| `KUBE_CONFIG`       | base64 gerado no passo 6           | Variable | ✅     | ✅        |
| `KUBE_CONFIG_PROD`  | base64 gerado no passo 7           | Variable | ✅     | ✅        |
| `STAGING_URL`       | `https://staging.seu-dominio.com`  | Variable | ❌     | ✅        |
| `PRODUCTION_URL`    | `https://seu-dominio.com`          | Variable | ❌     | ✅        |

> As branches `main` e `develop` devem estar marcadas como **Protected** em
> **Settings → Repository → Protected branches** para que as variáveis
> protected sejam injetadas nos pipelines dessas branches.

---

### 9. Criar os Deployments iniciais no cluster

O pipeline executa `kubectl set image deployment/api ...`, portanto os
Deployments precisam existir antes do primeiro deploy.

```bash
# Substitua pelo caminho real do seu Container Registry
# GitLab.com:    registry.gitlab.com/seu-usuario/mindledger
# Self-hosted:   registry.seu-dominio.com/seu-usuario/mindledger
REGISTRY="registry.gitlab.com/seu-usuario/mindledger"

# Staging
kubectl create deployment api \
  --image="${REGISTRY}/api:latest" \
  -n mindledger-staging

kubectl create deployment frontend \
  --image="${REGISTRY}/frontend:latest" \
  -n mindledger-staging

# Produção
kubectl create deployment api \
  --image="${REGISTRY}/api:latest" \
  -n mindledger

kubectl create deployment frontend \
  --image="${REGISTRY}/frontend:latest" \
  -n mindledger
```

Verifique:

```bash
kubectl get deployments -n mindledger-staging
kubectl get deployments -n mindledger
```

---

### 10. Configurar o pull secret do GitLab Registry

Os pods precisam de credenciais para baixar imagens do registry.
Crie um **Personal Access Token** (ou **Deploy Token**) no GitLab com o
escopo `read_registry`:

- **Personal Access Token**: **User Settings → Access Tokens → Add new token**
- **Deploy Token** (preferido para CI): **Settings → Repository → Deploy tokens → Add token**

```bash
# GitLab.com:   docker-server=registry.gitlab.com
# Self-hosted:  docker-server=registry.seu-dominio.com
REGISTRY_SERVER="registry.gitlab.com"
GITLAB_USER="seu-usuario-ou-deploy-token-user"
GITLAB_TOKEN="seu-personal-access-token-ou-deploy-token"

# Staging
kubectl create secret docker-registry gitlab-registry \
  --docker-server="${REGISTRY_SERVER}" \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n mindledger-staging

kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "gitlab-registry"}]}' \
  -n mindledger-staging

# Produção
kubectl create secret docker-registry gitlab-registry \
  --docker-server="${REGISTRY_SERVER}" \
  --docker-username="${GITLAB_USER}" \
  --docker-password="${GITLAB_TOKEN}" \
  -n mindledger

kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "gitlab-registry"}]}' \
  -n mindledger
```

Para **recriar** o secret (ex.: após rotacionar o token):

```bash
kubectl delete secret gitlab-registry -n mindledger-staging --ignore-not-found
kubectl delete secret gitlab-registry -n mindledger --ignore-not-found
# Em seguida, execute o kubectl create secret acima novamente
```

---

## Fluxo completo do pipeline após a configuração

```
Push para develop
  → lint (black, isort, flake8, bandit, pip-audit, eslint, prettier, npm audit)
  → typecheck (mypy, tsc)
  → test:backend (pytest + coverage)
  → build:api + build:frontend  ← push para o Container Registry
  → scan:api + scan:frontend    ← Trivy: bloqueia se HIGH/CRITICAL encontrado
  → deploy:staging              ← kubectl set image → k3s reinicia os pods

Push para main (+ aprovação manual)
  → (mesmos estágios acima até scan)
  → deploy:production           ← kubectl set image → k3s reinicia os pods
```

> `scan:api` e `scan:frontend` puxam as imagens do Container Registry usando
> as credenciais automáticas `CI_REGISTRY_USER` / `CI_REGISTRY_PASSWORD`.
> Nenhuma variável extra é necessária para o Trivy.
