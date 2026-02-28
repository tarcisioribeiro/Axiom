
1. Preparar a VPS

Conecte via SSH e execute:

### Atualizar sistema

sudo apt update && sudo apt upgrade -y

### Abrir portas necessárias no firewall

```
sudo ufw allow 6443/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. Instalar k3s

```
curl -sfL https://get.k3s.io | sh -
```

Aguarde ~1 minuto. Verifique se subiu:

```
kubectl get nodes
```

| NAME | STATUS | ROLES | AGE | VERSION |
|---|---|---|---|---|
| minha-vps | Ready | control-plane,master | 1m | v1.32.x+k3s1 |

3. Criar os namespaces do projeto

```
kubectl create namespace mindledger-staging
kubectl create namespace mindledger
```

4. Criar um ServiceAccount para o GitLab CI

Em vez de usar o kubeconfig de root (que tem acesso total), crie uma conta restrita:

### Criar ServiceAccount

```
kubectl create serviceaccount gitlab-ci -n mindledger-staging
kubectl create serviceaccount gitlab-ci -n mindledger
```


### Dar permissão de deploy nos namespaces

```
kubectl create rolebinding gitlab-ci-deploy \
--clusterrole=edit \
--serviceaccount=mindledger-staging:gitlab-ci \
-n mindledger-staging

kubectl create rolebinding gitlab-ci-deploy \
--clusterrole=edit \
--serviceaccount=mindledger:gitlab-ci \
-n mindledger
```

5. Gerar o kubeconfig para o GitLab

### Criar token com validade de 1 ano (ajuste se quiser)
```
TOKEN=$(kubectl create token gitlab-ci \
-n mindledger-staging \
--duration=8760h)
```

### Pegar o endpoint do cluster
```
SERVER=$(kubectl config view \
--minify -o jsonpath='{.clusters[0].cluster.server}')
```

### Pegar o CA do cluster
```
CA=$(kubectl config view \
--minify --flatten \
-o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
```

### Montar o kubeconfig manualmente
```
cat <<EOF > /tmp/gitlab-kubeconfig.yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: ${CA}
    server: ${SERVER}
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
```

### Gerar o valor em base64 para colar no GitLab
```
cat /tmp/gitlab-kubeconfig.yaml | base64 -w 0
echo ""  # linha em branco após o base64
```

Copie o output (string base64 longa) — esse é o valor da variável.

Atenção: o SERVER vai mostrar https://127.0.0.1:6443. Você precisa substituir pelo IP público da VPS:

### Descubra o IP público
```
curl -s ifconfig.me
```

### Substitua no arquivo antes de gerar o base64
```
sed -i 's|https://127.0.0.1:6443|https://SEU_IP_PUBLICO:6443|' /tmp/gitlab-kubeconfig.yaml
```

6. Configurar a variável no GitLab

No GitLab: Settings → CI/CD → Variables → Add variable

| Campo | Valor |
|---|---|
| Key | KUBE_CONFIG_STAGING |
| Value | a string base64 gerada no passo 5 |
| Type | Variable |
| Masked | ✅ sim |
| Protected | ✅ sim (roda só na main) |

7. Criar os Deployments no cluster

O pipeline faz kubectl set image deployment/api ..., então os Deployments precisam existir. Você vai precisar
criar um manifesto base:

### Exemplo mínimo para o API
```
kubectl create deployment api \
--image=registry.gitlab.com/tarcisioribeiro/mindledger/api:latest \
-n mindledger-staging

kubectl create deployment frontend \
--image=registry.gitlab.com/tarcisioribeiro/mindledger/frontend:latest \
-n mindledger-staging
```

Também vai precisar de um Secret para o GitLab Registry:

```
kubectl create secret docker-registry gitlab-registry \
--docker-server=registry.gitlab.com \
--docker-username=SEU_USUARIO_GITLAB \
--docker-password=SEU_PERSONAL_ACCESS_TOKEN \
-n mindledger-staging
```

### Associar o secret ao ServiceAccount padrão
```
kubectl patch serviceaccount default \
-p '{"imagePullSecrets": [{"name": "gitlab-registry"}]}' \
-n mindledger-staging
```

Fluxo completo após isso

Push para main
→ Build das imagens → push para registry.gitlab.com
→ kubectl set image (usa KUBE_CONFIG_STAGING)
→ k3s na VPS baixa a nova imagem e reinicia os pods
