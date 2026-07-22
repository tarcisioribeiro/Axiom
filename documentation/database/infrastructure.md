# Infraestrutura de Banco de Dados

Este documento descreve onde e como o PostgreSQL de produção e staging roda,
por que ele está fora do cluster Kubernetes, e o procedimento operacional
completo (setup da VM, rede/segurança, backup e restore).

## Topologia

O PostgreSQL **não roda dentro do cluster k3s**. Ele roda em uma VM externa,
auto-gerenciada (não é um serviço gerenciado como RDS/Supabase/Neon), fora do
cluster. Isso facilita consultas ad-hoc, manutenção (vacuum, reindex, extensões)
e backup sem competir por recursos com os pods da aplicação nem depender de
`kubectl exec` para tudo.

Um único servidor Postgres hospeda dois bancos:

| Ambiente  | Database          | Namespace k8s     |
|-----------|-------------------|--------------------|
| Produção  | `axiom_db`         | `axiom`            |
| Staging   | `axiom_staging_db` | `axiom-staging`    |

Essa é a opção mais simples para um setup self-hosted de pequena escala — não
exige uma segunda VM. Se no futuro for necessário isolar o "raio de explosão"
entre staging e produção (ex.: não permitir que um bug em staging tenha
qualquer acesso de rede ao servidor de produção), o caminho de reversão é
barato: basta sobrescrever `DB_HOST`/`DB_SSLMODE` em
`infra/k8s/overlays/staging/patches/configmap.yaml` (que já existe e já
sobrescreve outras chaves do ConfigMap) apontando para uma segunda VM.

A aplicação Django e os scripts de backup já são agnósticos de onde o
Postgres está — tudo é lido de `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/
`DB_PASSWORD`/`DB_SSLMODE` via variáveis de ambiente (ConfigMap `axiom-config`
+ Secret `axiom-secrets` no k8s, `.env` localmente). **Migrations e management
commands não são afetados** por essa topologia.

## Setup manual da VM (runbook)

Passos executados uma única vez pelo administrador, na VM que vai hospedar o
Postgres:

1. **Instalar PostgreSQL 16** (via pacote da distro ou repositório PGDG) e a
   extensão **pgvector** (compilar a partir do código-fonte, ou instalar o
   pacote `postgresql-16-pgvector` se disponível na distro).
2. **Criar os bancos e roles** (um role por ambiente, sem privilégio de
   superusuário):
   ```sql
   CREATE DATABASE axiom_db;
   CREATE DATABASE axiom_staging_db;

   CREATE ROLE axiom_user WITH LOGIN PASSWORD '<senha-forte>';
   GRANT ALL PRIVILEGES ON DATABASE axiom_db TO axiom_user;

   CREATE ROLE axiom_staging_user WITH LOGIN PASSWORD '<outra-senha-forte>';
   GRANT ALL PRIVILEGES ON DATABASE axiom_staging_db TO axiom_staging_user;
   ```
3. **Habilitar a extensão pgvector — passo crítico**, executado como
   superusuário, uma vez por banco, **antes** do role da aplicação nunca
   conectar:
   ```sql
   \c axiom_db
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE SCHEMA IF NOT EXISTS vectors;

   \c axiom_staging_db
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE SCHEMA IF NOT EXISTS vectors;
   ```
   Por quê: a migration `apps/api/agents/migrations/0002_agentembedding.py`
   já roda `CREATE EXTENSION IF NOT EXISTS vector` de forma idempotente em
   todo `migrate` — isso não muda. Mas criar uma extensão normalmente exige
   privilégio de superusuário, que o role da aplicação (`axiom_user`) não
   deve ter. Esse passo replica o que o antigo ConfigMap
   `postgres-init-config` fazia automaticamente no `initdb` do Postgres
   in-cluster (removido nesta migração).

## Rede e segurança (runbook)

A conectividade entre o cluster k3s e a VM do Postgres **não é resolvida
automaticamente por nenhum código deste repositório** — é uma etapa de
infraestrutura executada manualmente. Duas opções, comparadas:

### Opção recomendada: túnel WireGuard

O VPS onde roda o k3s tem **IP público dinâmico** (usa DuckDNS + cronjob de
atualização — veja
[dns_infrastructure.md](../development/dns_infrastructure.md)). Isso descarta
allowlist de IP por firewall como abordagem padrão segura: o IP de saída do
cluster mudaria e derrubaria silenciosamente o acesso à VM do banco.

Um túnel WireGuard resolve isso porque não depende do IP público de nenhum
dos dois lados — a comunicação passa a usar os IPs fixos da interface `wg0`:

1. Instalar WireGuard nos dois lados (nó(s) do k3s e a VM do Postgres).
2. Definir uma sub-rede privada para o túnel (ex. `10.8.0.0/24`), com a VM do
   Postgres em `10.8.0.1` e o(s) nó(s) do k3s em `10.8.0.2`, `10.8.0.3`, etc.
3. Na VM, configurar `postgresql.conf`:
   ```
   listen_addresses = 'localhost,10.8.0.1'
   ```
4. Restringir `pg_hba.conf` para aceitar apenas a sub-rede do túnel:
   ```
   host    axiom_db          axiom_user          10.8.0.0/24    scram-sha-256
   host    axiom_staging_db  axiom_staging_user  10.8.0.0/24    scram-sha-256
   ```
5. `DB_HOST` no ConfigMap (`infra/k8s/base/configmap.yaml`) aponta para o IP
   da VM **na interface do túnel** (`10.8.0.1`), nunca o IP público.

### Alternativa: allowlist de firewall

Só é segura se o VPS do cluster tiver **IP público fixo** (não é o caso hoje,
por causa do DuckDNS). Se isso mudar no futuro:

1. `ufw allow from <IP-fixo-do-cluster> to any port 5432 proto tcp` na VM do
   Postgres (ou regra equivalente de `iptables`/security group).
2. `DB_SSLMODE=require` é **obrigatório** nesse caminho (a conexão trafega
   sem túnel, então precisa de TLS na camada do Postgres).
3. Gerar certificado TLS para o Postgres (`ssl = on` em `postgresql.conf`,
   certificado próprio ou Let's Encrypt) e usar senha forte.

### `DB_SSLMODE` — referência

Definido em `infra/k8s/base/configmap.yaml`, lido em
`apps/api/app/settings.py` (`DATABASES["default"]["OPTIONS"]["sslmode"]`) e
repassado ao `pg_dump`/`pg_restore` via variável de ambiente `PGSSLMODE`
(libpq já respeita isso nativamente, sem mudança nos scripts de backup).

| Valor      | Comportamento                                                        |
|------------|-----------------------------------------------------------------------|
| `disable`  | Nunca usa TLS.                                                        |
| `prefer`   | **Padrão atual.** Usa TLS se disponível, senão conecta sem TLS.       |
| `require`  | Exige TLS; falha a conexão se não disponível. Obrigatório na alternativa de firewall-allowlist. |

Com o túnel WireGuard, o tráfego já está criptografado no nível da VPN, então
`prefer` (ou até `disable`) é aceitável — `require` é uma camada extra opcional.

## Backup e restore

O backup de produção roda automaticamente via CronJob k8s
(`infra/k8s/overlays/production/backup-cronjob.yaml`, diário às 02:00 BRT),
executando o script canônico `apps/api/scripts/backup.sh` — que já fazia
`pg_dump --host="$PGHOST"` via rede (não `kubectl exec`), então não precisou
de nenhuma mudança de lógica; apenas `PGHOST`/`PGPORT`/`PGSSLMODE` passaram a
vir do ConfigMap `axiom-config` em vez de um valor fixo (`postgres-service`).

- **RPO**: 24 horas (backup diário).
- **RTO**: ≤ 4 horas (download do MinIO → decrypt → `pg_restore`).
- **Retenção GFS**: 7 diários / 4 semanais / 3 mensais.
- **Criptografia**: AES-256-CBC (PBKDF2, 600k iterações), chave em
  `BACKUP_ENCRYPTION_KEY`.
- **Armazenamento**: MinIO, que continua rodando dentro do cluster
  (`minio-service`), sem alteração.

### Puxar um backup de produção para a máquina local

`infra/scripts/k8s-backup.sh` lê `DB_HOST`/`DB_PORT`/`DB_SSLMODE` do
ConfigMap `axiom-config` e roda `pg_dump` diretamente pela rede (requer que a
máquina que executa o script tenha acesso à VM do Postgres pelo mesmo túnel
WireGuard/allowlist do runbook acima). O MinIO continua sendo acessado via
`kubectl port-forward`, já que ele segue in-cluster.

### Restaurar localmente (docker-compose)

`infra/scripts/docker-restore.sh` consome o arquivo gerado por
`k8s-backup.sh` (`database.dump` + `minio/` + `metadata.json`) e restaura no
Postgres local do `docker-compose` — sem nenhuma mudança necessária, já que
ele só depende da estrutura do arquivo, não de como o dump foi produzido.

### Restaurar em produção/staging

```bash
# 1. Baixar o dump criptografado do MinIO
mc cp axiom-storage/axiom-backups/db/db_backup_<TS>.dump.enc .

# 2. Decriptar (a chave precisa ser a mesma usada no backup)
export BACKUP_ENCRYPTION_KEY="<chave>"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in  db_backup_<TS>.dump.enc \
  -out db_backup_<TS>.dump

# 3. Restaurar diretamente na VM externa
pg_restore \
  -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> \
  --clean --if-exists --no-owner --no-privileges \
  --verbose \
  db_backup_<TS>.dump
```

## Fora de escopo

- `infra/docker/docker-compose.yml` (serviço `db`) continua sendo Postgres
  local, exclusivamente para desenvolvimento — não é afetado por esta
  topologia.
- O provisionamento da VM em si (sistema operacional, WireGuard, instalação
  do Postgres) é executado manualmente pelo administrador seguindo este
  runbook; não há automação disso neste repositório.

---

[Voltar à documentação de banco de dados](README.md)
