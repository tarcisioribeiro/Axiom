# Infraestrutura DNS — Axiom

Este documento descreve a configuração de DNS e TLS utilizada nos ambientes de
staging e produção.

---

## Provedor de DNS

O projeto usa **DuckDNS** (`duckdns.org`) como provedor de DNS dinâmico gratuito.
Os hostnames são subdomínios de `tjtux.duckdns.org` e apontam para o IP público
do VPS onde o cluster k3s está instalado.

**Painel DuckDNS:** https://www.duckdns.org (login com conta Google/GitHub)

---

## Hostnames cadastrados

| Ambiente   | Hostname                                  | Serviço           |
|------------|-------------------------------------------|-------------------|
| Produção   | `axiom.tjtux.duckdns.org`            | Frontend + API    |
| Staging    | `axiom-staging.tjtux.duckdns.org`    | Frontend + API    |
| MinIO      | `minio.tjtux.duckdns.org`                 | Object storage    |

---

## Atualização do IP (DDNS)

Se o IP público do VPS mudar, atualize os registros no DuckDNS via API:

```bash
# Substitua TOKEN e DOMAINS pelos valores da sua conta DuckDNS
TOKEN="seu-token-duckdns"
DOMAINS="axiom,axiom-staging,minio"

curl -s "https://www.duckdns.org/update?domains=${DOMAINS}&token=${TOKEN}&ip="
# Resposta esperada: "OK"
```

Para automatizar, adicione um cronjob no VPS:

```bash
# crontab -e
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=axiom,axiom-staging,minio&token=SEU_TOKEN&ip=" > /var/log/duckdns.log 2>&1
```

---

## TLS — cert-manager + Let's Encrypt

Os certificados TLS são gerenciados pelo **cert-manager** usando o protocolo
ACME HTTP-01 do Let's Encrypt.

### Instalação do cert-manager (uma vez por cluster)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --namespace cert-manager \
  --for=condition=ready pod --all \
  --timeout=120s
```

### ClusterIssuers

Os dois ClusterIssuers estão definidos em `k8s/ingress.yaml`:

| ClusterIssuer        | Endpoint ACME                                    | Uso                        |
|----------------------|--------------------------------------------------|----------------------------|
| `letsencrypt-staging`| `acme-staging-v02.api.letsencrypt.org`           | Testes (cert não confiável)|
| `letsencrypt-prod`   | `acme-v02.api.letsencrypt.org`                   | Produção (cert válido)     |

> Os ClusterIssuers são **cluster-scoped** — aplique-os uma única vez pelo
> manifesto de produção. O ingress de staging reutiliza os mesmos issuers.

### Aplicar os issuers

```bash
# Aplica junto com o ingress de produção (contém os ClusterIssuer resources)
kubectl apply -f k8s/ingress.yaml
```

### Secrets TLS gerados automaticamente

| Secret                   | Namespace           | Hostname                               |
|--------------------------|---------------------|----------------------------------------|
| `axiom-tls`         | `axiom`        | `axiom.tjtux.duckdns.org`         |
| `axiom-staging-tls` | `axiom-staging`| `axiom-staging.tjtux.duckdns.org` |

Acompanhe a emissão do certificado:

```bash
# Produção
kubectl get certificate -n axiom
kubectl describe certificaterequest -n axiom

# Staging
kubectl get certificate -n axiom-staging
```

---

## Ingress — roteamento de tráfego

O ingress controller utilizado é o **nginx-ingress** (`ingressClassName: nginx`).
O roteamento segue a ordem de prioridade abaixo (avaliada de cima para baixo):

| Path     | Destino                         |
|----------|---------------------------------|
| `/api`   | `api-service:39100` (Django)    |
| `/admin` | `api-service:39100` (Django)    |
| `/static`| `api-service:39100` (Django)    |
| `/media` | `api-service:39100` (Django)    |
| `/live`  | `api-service:39100` (liveness)  |
| `/health`| `api-service:39100` (health)    |
| `/ready` | `api-service:39100` (readiness) |
| `/`      | `frontend-service:80` (React)   |

O MinIO tem um ingress próprio em `k8s/minio/ingress.yaml` apontando para
`minio-service:9000` com `backend-protocol: HTTPS` (cert auto-assinado interno).

---

## Verificação de DNS e TLS

```bash
# Confirmar que o DNS resolve
dig axiom.tjtux.duckdns.org
dig axiom-staging.tjtux.duckdns.org

# Confirmar que o certificado é válido
curl -I https://axiom.tjtux.duckdns.org/health/
# Esperado: HTTP/2 200

curl -I https://axiom-staging.tjtux.duckdns.org/health/
# Esperado: HTTP/2 200

# Inspecionar o certificado TLS
echo | openssl s_client -connect axiom.tjtux.duckdns.org:443 2>/dev/null \
  | openssl x509 -noout -dates -subject
```

---

## Renovação automática

O cert-manager renova os certificados automaticamente quando eles têm menos de
30 dias de validade (padrão Let's Encrypt: 90 dias). Nenhuma ação manual é
necessária em condições normais.

Para forçar renovação:

```bash
# Deletar o secret faz o cert-manager emitir um novo certificado
kubectl delete secret axiom-tls -n axiom
kubectl delete secret axiom-staging-tls -n axiom-staging
```
