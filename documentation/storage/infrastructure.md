# Infraestrutura de Storage (MinIO)

Este documento descreve onde e como o MinIO de produção e staging roda, por
que ele está fora do cluster Kubernetes, e o procedimento operacional
completo (setup do host, CORS, TLS, backup e restore).

## Topologia

O MinIO **não roda dentro do cluster k3s**. Ele roda auto-gerenciado (não é
um serviço gerenciado como AWS S3/R2/Backblaze), fora do cluster — mesma
filosofia adotada para o PostgreSQL (veja
[documentation/database/infrastructure.md](../database/infrastructure.md)).
Isso elimina a necessidade de manter uma cadeia de TLS interna via
cert-manager só para tráfego API↔MinIO, e evita competir por recursos com os
pods da aplicação.

Um único servidor MinIO hospeda os buckets de todos os ambientes, isolados
por nome de bucket:

| Ambiente  | Bucket            | Namespace k8s     |
|-----------|-------------------|--------------------|
| Produção  | `axiom`            | `axiom`            |
| Staging   | `axiom-staging`    | `axiom-staging`    |

Backups (banco de dados + mídia) usam um bucket separado, `axiom-backups`
(veja `infra/k8s/overlays/*/backup-cronjob.yaml`).

A aplicação Django e os scripts de backup são agnósticos de onde o MinIO
está — tudo é lido de `MINIO_ENDPOINT`/`MINIO_EXTERNAL_ENDPOINT`/
`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`/`MINIO_BUCKET_NAME`/`MINIO_USE_SSL`
via variáveis de ambiente. No k8s, `MINIO_ENDPOINT`/`MINIO_EXTERNAL_ENDPOINT`
vêm do Secret `axiom-secrets` (injetado a partir das variáveis de CI/CD
`STAGING_MINIO_*`/`PRODUCTION_MINIO_*` — nunca commitados em arquivo); só
`MINIO_BUCKET_NAME`/`MINIO_USE_SSL` (não sensíveis) vivem no ConfigMap
`axiom-config`. Localmente, tudo vem do `.env` e aponta para o MinIO
containerizado do `docker-compose` (esse continua local, veja
[Fora de escopo](#fora-de-escopo)).

### Por que dois endpoints (`MINIO_ENDPOINT` / `MINIO_EXTERNAL_ENDPOINT`)?

O backend Django (`storage/backends.py:MinIOStorage`) mantém dois clientes
boto3 porque as URLs pré-assinadas (presigned URLs) precisam ser assinadas
com o mesmo host que o navegador vai usar para acessar o arquivo — caso
contrário o MinIO rejeita a requisição (o cabeçalho `Host` não bate com o
valor embutido na assinatura SigV4). Com o MinIO externo, os dois valores
tendem a apontar para o mesmo host público em produção; a distinção só
importa em staging, onde `MINIO_EXTERNAL_ENDPOINT` pode ficar vazio para que
o Django faça proxy dos arquivos (`storage/media_proxy.py:MediaProxyView`)
em vez de expor o MinIO diretamente ao navegador.

## Setup manual do host externo (runbook)

Passos executados uma única vez pelo administrador, no host que vai hospedar
o MinIO:

1. **Instalar o binário do MinIO server** (download direto do site oficial,
   ou pacote da distro) e configurá-lo como serviço systemd, com um volume
   dedicado para `/data`.
2. **Definir credenciais root** via `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`
   no ambiente do serviço systemd — nunca as credenciais padrão
   (`minioadmin`/`minioadmin`).
3. **Criar os buckets**, um por ambiente, usando o cliente `mc`:
   ```bash
   mc alias set axiom-minio https://minio.example.com <MINIO_ROOT_USER> <MINIO_ROOT_PASSWORD>
   mc mb --ignore-existing axiom-minio/axiom
   mc mb --ignore-existing axiom-minio/axiom-staging
   mc mb --ignore-existing axiom-minio/axiom-backups
   ```
4. **Configurar CORS** no bucket de produção, para que o navegador possa
   baixar arquivos diretamente via URL pré-assinada. Salve como `cors.json`:
   ```json
   {
     "CORSRules": [
       {
         "AllowedOrigin": ["https://axiom.tjtux.duckdns.org"],
         "AllowedMethod": ["GET", "HEAD"],
         "AllowedHeader": ["*"],
         "ExposeHeader": ["Content-Disposition", "Content-Length"],
         "MaxAgeSeconds": 3600
       }
     ]
   }
   ```
   e aplique com:
   ```bash
   mc cors set axiom-minio/axiom cors.json
   ```
   Repita para `axiom-staging` trocando `AllowedOrigin` pelo domínio de
   staging.
5. **Certificado TLS público confiável** — Let's Encrypt via `certbot`
   rodando no próprio host, ou terminação TLS por um reverse proxy externo já
   existente na frente da VPS (ex.: Nginx Proxy Manager). Isso é obrigatório:
   as URLs pré-assinadas fazem o navegador acessar o MinIO diretamente pela
   internet, então o certificado precisa ser confiável por padrão — sem isso
   não há como evitar avisos de segurança no navegador. Não há mais CA
   interna via cert-manager (removida junto com o Deployment in-cluster).

## Rede e segurança (runbook)

A conectividade entre o cluster k3s e o MinIO **não é resolvida
automaticamente por nenhum código deste repositório** — é uma etapa de
infraestrutura executada manualmente, na mesma linha do runbook de rede do
PostgreSQL (veja
[documentation/database/infrastructure.md#rede-e-segurança-runbook](../database/infrastructure.md#rede-e-segurança-runbook)).

Se o MinIO rodar na mesma VPS que hospeda o k3s (mesma abordagem hoje usada
para o Postgres), os pods alcançam o MinIO pelo IP público/hostname da VPS,
sem necessidade de túnel adicional. Se for movido para um host separado no
futuro, as mesmas duas opções descritas no doc do banco se aplicam: túnel
WireGuard (recomendado, por causa do IP público dinâmico via DuckDNS) ou
allowlist de firewall (só seguro com IP fixo).

`MINIO_ENDPOINT`/`MINIO_EXTERNAL_ENDPOINT` vêm das variáveis de CI/CD
`STAGING_MINIO_ENDPOINT`/`STAGING_MINIO_EXTERNAL_ENDPOINT` e
`PRODUCTION_MINIO_ENDPOINT`/`PRODUCTION_MINIO_EXTERNAL_ENDPOINT` (masked no
GitLab), nunca de um arquivo commitado.

### `MINIO_USE_SSL` — referência

Definido em `infra/k8s/base/configmap.yaml`, lido em `apps/api/app/settings.py`
e consumido por `storage/backends.py:MinIOStorage` e
`storage/media_proxy.py:MediaProxyView`.

| Valor     | Comportamento                                                        |
|-----------|-----------------------------------------------------------------------|
| `"false"` | HTTP simples — usado hoje no `docker-compose` local.                  |
| `"true"`  | HTTPS obrigatório — usado em staging e produção, com certificado público confiável (nenhuma verificação de CA customizada é necessária). |

## Backup e restore

O backup de produção roda automaticamente via CronJob k8s
(`infra/k8s/overlays/production/backup-cronjob.yaml`, diário às 02:00 BRT),
executando o script canônico `apps/api/scripts/backup.sh`, que já fazia
upload direto por rede via `mc` (nunca dependeu do MinIO estar no mesmo
cluster) — só o valor de `MINIO_ENDPOINT` no Secret `axiom-backup-secrets`
muda, de `http://minio-service:9000` para o endpoint externo.

- **RPO**: 24 horas (backup diário).
- **RTO**: ≤ 4 horas (download do MinIO → decrypt → `pg_restore`).
- **Retenção GFS**: 7 diários / 4 semanais / 3 mensais.
- **Criptografia**: AES-256-CBC (PBKDF2, 600k iterações), chave em
  `BACKUP_ENCRYPTION_KEY`.
- **Armazenamento**: MinIO externo ao cluster (veja topologia acima).

### Puxar um backup de produção para a máquina local

`infra/scripts/k8s-backup.sh` lê `DB_HOST`/`DB_PORT`/`MINIO_ENDPOINT` do
Secret `axiom-secrets` e `DB_SSLMODE`/`MINIO_BUCKET_NAME` do ConfigMap
`axiom-config`, depois roda `pg_dump` e `mc mirror` diretamente pela rede
(requer que a máquina que executa o script tenha acesso a ambos — hoje, o
IP público/hostname da VPS; se migrar para hosts separados, pelo mesmo
túnel WireGuard/allowlist do runbook acima). Não há mais `kubectl
port-forward` — o MinIO é acessado da mesma forma direta que o Postgres.

### Restaurar localmente (docker-compose)

`infra/scripts/docker-restore.sh` consome o arquivo gerado por
`k8s-backup.sh` (`database.dump` + `minio/` + `metadata.json`) e restaura no
MinIO local do `docker-compose` — sem nenhuma mudança necessária, já que ele
só depende da estrutura do arquivo, não de como o dump foi produzido.

### Restaurar em produção/staging

```bash
# 1. Baixar o dump criptografado do MinIO externo
mc cp axiom-minio/axiom-backups/db/db_backup_<TS>.dump.enc .

# 2. Decriptar (a chave precisa ser a mesma usada no backup)
export BACKUP_ENCRYPTION_KEY="<chave>"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in  db_backup_<TS>.dump.enc \
  -out db_backup_<TS>.dump

# 3. Restaurar diretamente na VM externa do Postgres
pg_restore \
  -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> \
  --clean --if-exists --no-owner --no-privileges \
  --verbose \
  db_backup_<TS>.dump
```

## Módulo Django

O código de storage está isolado no app `apps/api/storage/` (sem models,
sem migrations):

| Arquivo | Conteúdo |
|---|---|
| `storage/backends.py` | `MinIOStorage` — backend `S3Boto3Storage` customizado, com suporte a URLs pré-assinadas contra o endpoint externo e override de credenciais via `SystemConfig` (Django Admin) |
| `storage/media_proxy.py` | `MediaProxyView` — faz proxy de arquivos do MinIO através do Django quando `MINIO_EXTERNAL_ENDPOINT` não está configurado |
| `storage/health.py` | `check_storage()` — verificação leve de conectividade (HEAD bucket, timeout de 2s), usada por `/health/` e pelo painel admin |
| `storage/management/commands/migrate_media_to_minio.py` | Comando de migração de mídia local → MinIO (suporta `--dry-run`) |

As credenciais/endpoint continuam configuráveis em runtime via Django Admin
(`SystemConfig`, categoria "Armazenamento (MinIO)") — esse mecanismo não foi
afetado pela mudança de topologia.

## Fora de escopo

- `infra/docker/docker-compose.yml` (serviço `minio`) continua sendo MinIO
  local, exclusivamente para desenvolvimento — não é afetado por esta
  topologia.
- O provisionamento do host em si (sistema operacional, binário do MinIO,
  systemd, certbot) é executado manualmente pelo administrador seguindo este
  runbook; não há automação disso neste repositório.

---

[Voltar à documentação de storage](README.md)
