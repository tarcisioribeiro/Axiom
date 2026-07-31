# Estratégia de Backup

Backup diário do PostgreSQL (dump SQL simples, `pg_dump --format=plain`),
compactado com `gzip` e criptografado com AES-256-CBC (senha via
`BACKUP_ENCRYPTION_KEY`), gerando um único artefato `.sql.gz.enc` enviado
para o MinIO (bucket separado, `axiom-backups`). Roda como container
`db-backup` no Docker Compose (dev/self-hosted) e como `CronJob` no
Kubernetes (staging/produção).

**Artefato gerado por execução**: `db_backup_<timestamp>_kv<versão>.sql.gz.enc`
— um dump `.sql` simples, sem formato proprietário do `pg_restore` e sem
`.manifest` (removidos em 2026-07 a pedido do time; restore agora é só
`openssl` → `gunzip` → `psql -f`, sem depender de `pg_restore`).

## RPO / RTO

- **RPO**: 24 horas — backup roda uma vez por dia, às 02:00 BRT (`BACKUP_CRON`).
- **RTO**: ≤ 4 horas — download do MinIO (~5min) + decrypt/gunzip (~5min) +
  provisionamento de infra (~30min) + restore via `psql -f` (30–120min,
  depende do tamanho do banco) + smoke tests (~15min).

O procedimento de restore completo está documentado no cabeçalho de
`apps/api/scripts/backup.sh`.

## Componentes

| Componente | Onde roda | Script |
|---|---|---|
| `db-backup` (Docker Compose) | `infra/docker/backup/` (imagem `postgres:16-alpine`) | `apps/api/scripts/backup.sh` (bind mount `:ro`) |
| `axiom-db-backup` (CronJob) | `infra/k8s/overlays/production/backup-cronjob.yaml` (imagem `postgres:16`, debian) | cópia embutida no `ConfigMap` — ver seção de sincronização abaixo |
| `axiom-db-backup-staging` (CronJob) | `infra/k8s/overlays/staging/backup-cronjob.yaml` | idem |

`apps/api/scripts/backup.sh` é a fonte canônica. Os CronJobs do Kubernetes
embutem uma **cópia** do script em um `ConfigMap` (Kubernetes não suporta bind
mount de um arquivo do repositório para dentro de um Pod). Depois de editar
`backup.sh`, regenere o `ConfigMap` com:

```bash
kubectl create configmap backup-script \
  --from-file=backup.sh=apps/api/scripts/backup.sh \
  --dry-run=client -o yaml -n axiom
# substitua o bloco data.backup.sh no arquivo pelo output acima
```
(idem para `backup-script-staging` / namespace `axiom-staging`). **Antes desta
revisão a cópia do Kubernetes estava dessincronizada** — não tinha suporte a
`BACKUP_KEY_VERSION` (rotação de chave). Foi resincronizada em 2026-07.

## Verificação e monitoramento

- `apps/api/scripts/verify-backup.sh` — decripta o dump mais recente, restaura
  em um banco temporário, valida schema/tabelas/migrações e apaga tudo.
  Rodar manualmente: `docker compose exec db-backup /scripts/verify-backup.sh`.
- `GET /api/v1/health/backup/` — endpoint HTTP que lê o sentinel
  (`.last_successful_backup` / `.last_backup_status`) e retorna 503 se o
  último backup tem mais de `BACKUP_MAX_AGE_HOURS` (default 26h) ou falhou.
- `python manage.py check_backup_health` — mesma checagem via linha de
  comando, para uso em monitoramento externo (cron alert, Prometheus
  blackbox, UptimeRobot etc.).

Ambos os checks acima rodam **dentro do container/pod da API**, então ele
precisa ter acesso de leitura ao mesmo diretório `BACKUP_DIR` usado pelo
`db-backup`/CronJob — ver problema #2 abaixo.

## Cobertura de arquivos de mídia (foto de perfil, capas, documentos de livros, certificados)

`backup.sh` só arquiva `/app/media` — e apenas quando o diretório está montado
e não-vazio. Como `MINIO_ENDPOINT` está configurado, o Django usa
`S3Boto3Storage` para todo upload de mídia (`apps/api/app/settings.py`,
bucket `axiom` por padrão via `MINIO_BUCKET_NAME`), então os arquivos reais
(foto de perfil, capas de livro, documentos, certificados) nunca chegam a
`/app/media` — ficam direto no bucket `axiom` do MinIO. Na prática, o passo
de "media backup" do `backup.sh` está sempre pulando ("No media files found")
e **esses arquivos não são cobertos pelo backup diário automatizado**.

O único mecanismo que hoje copia o conteúdo real do bucket `axiom` é o
`infra/scripts/k8s-backup.sh`, manual e não agendado (`mc mirror` do bucket
inteiro para um `.tar.gz` local). Se for necessário RPO diário também para
mídia, o `backup.sh` precisaria de um passo adicional de `mc mirror` do
bucket `axiom` (não apenas `/app/media`) para o bucket `axiom-backups`.

## Revisão de 2026-07 — problemas encontrados e corrigidos

A revisão pós-reorganização do monorepo encontrou o pipeline de backup do
Docker Compose **completamente quebrado havia pelo menos 2 dias** (rodando,
mas falhando silenciosamente todo dia às 02:00) e o health check HTTP sempre
retornando 503, independentemente do estado real do backup. Nenhum alerta
disparou porque o `healthcheck` do container `db-backup` só verifica se o
`crond` está vivo, não se o job em si teve sucesso.

1. **`openssl` ausente na imagem do backup** (`infra/docker/backup/Dockerfile`).
   A imagem é baseada em `postgres:16-alpine`, que não inclui o binário
   `openssl` usado por `backup.sh`/`verify-backup.sh`/`rekey-backups.sh` para
   criptografia AES-256. Resultado: o dump era criado e validado
   (`pg_restore --list`), mas o script morria com `exit 127` no passo de
   criptografia — **antes** de conseguir gravar `failed:` no arquivo de
   status, que ficava preso em `in_progress:<timestamp>` para sempre. Dumps
   **não criptografados** ficavam no disco local sem cópia off-site.
   Corrigido adicionando `openssl` ao `apk add` do Dockerfile.

2. **Container da API sem acesso ao diretório de backups**
   (`infra/docker/docker-compose.yml`). O serviço `api` não montava
   `./backups`, então `GET /api/v1/health/backup/` e
   `manage.py check_backup_health` — que rodam no container da API, não no
   `db-backup` — sempre reportavam "sentinel not found", mesmo com backups
   saudáveis. Corrigido com `./backups:/backups:ro` no serviço `api`.

3. **`BACKUP_DIR=./backups` (caminho relativo) em `.env`/`.env.example`**.
   Combinado com o problema #2, mesmo depois de montar o volume o caminho
   relativo resolvia para `/app/backups` (inexistente) dentro do container da
   API, em vez de `/backups` (o mountpoint real). Corrigido para
   `BACKUP_DIR=/backups` em ambos os arquivos.

4. **`apps/api/scripts/verify-backup.sh` sem bit de execução** (commitado como
   modo `100644` em vez de `100755`, diferente de `backup.sh`/
   `rekey-backups.sh`). Quebra o uso documentado
   (`docker compose exec db-backup /scripts/verify-backup.sh`) com
   `Permission denied`. Corrigido com `chmod +x`.

5. **`mktemp` incompatível entre BusyBox (Alpine/Compose) e GNU coreutils
   (Debian/K8s)** em `verify-backup.sh`. O template
   `verify_XXXXXX.dump` funciona no `postgres:16` (Debian, usado pelo CronJob
   K8s) mas falha com `mktemp: : Invalid argument` no `postgres:16-alpine`
   (usado pelo `db-backup` do Compose) — BusyBox exige que o template termine
   exatamente em `XXXXXX`, sem sufixo depois. Corrigido trocando para
   `mktemp -d` (diretório temporário sem sufixo) + nome de arquivo fixo
   dentro dele — compatível com as duas variantes.

6. **`ConfigMap` do CronJob do Kubernetes dessincronizado** do
   `apps/api/scripts/backup.sh` canônico (faltava suporte a
   `BACKUP_KEY_VERSION`, usado para rotação de chave — ver
   `rekey-backups.sh`). Resincronizado (produção e staging) e adicionada a
   env var `BACKUP_KEY_VERSION` no `CronJob`.

Depois das correções, o pipeline foi validado ponta a ponta manualmente:
`backup.sh` → dump → integridade → criptografia → upload MinIO → retenção GFS
→ sentinel; `verify-backup.sh` → decrypt → restore em banco temporário →
124 tabelas / 249 migrações confirmadas; `GET /api/v1/health/backup/` → `200
{"status": "ok", ...}`; `manage.py check_backup_health` → `Backup OK`.

**Recomendação futura**: o `healthcheck` do `db-backup` no Docker Compose
(`pgrep crond`) reporta "healthy" mesmo quando o job diário está falhando —
como aconteceu aqui por dias sem ninguém notar. Considerar expor
`GET /api/v1/health/backup/` a um monitor externo (UptimeRobot, Prometheus
blackbox exporter) para pegar esse tipo de falha silenciosa mais cedo.
