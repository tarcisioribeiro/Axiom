# Incidente: `test:backup-restore` falhando por timeout no MinIO (job #18855)

**Data**: 2026-07-27
**Job afetado**: [`test:backup-restore` #18855](https://gitlab.tjtux.duckdns.org/tarcisioribeiro/Axiom/-/jobs/18855)
**Branch**: `develop` (commit `7aadb09b`)
**Impacto**: `test:backup-restore` falhava de forma determinística (não
intermitente) sempre que executado, bloqueando a validação de restore de
backup no pipeline de `develop`. `backup:staging` (job anterior no mesmo
pipeline) não é afetado porque roda `mc`/o acesso ao MinIO **de dentro do
cluster k3s**, não de um container Docker na VPS.

## Sintoma

```
mc: <ERROR> Unable to initialize new alias from the provided credentials.
Get "http://<STAGING_MINIO_ENDPOINT>:9000/probe-.../?location=":
dial tcp <STAGING_MINIO_ENDPOINT_IP>:9000: i/o timeout.
```

O passo `mc alias set` no `before_script` do job nunca conseguia abrir uma
conexão TCP com a porta 9000 do MinIO.

## Investigação

O MinIO da VPS **não roda no k3s nem em um container Docker** — é um serviço
systemd rodando diretamente no host (`systemctl status minio`), escutando em
`0.0.0.0:9000`. `STAGING_MINIO_ENDPOINT` (`minio.tjtux.duckdns.org`) resolve
para o próprio IP público da VPS.

Testes de conectividade:

| Origem | Destino | Resultado |
|---|---|---|
| Host (shell da VPS) | `minio.tjtux.duckdns.org:9000` | `200 OK` |
| Container Docker na rede `bridge` | `minio.tjtux.duckdns.org:9000` | **timeout** (reproduz o erro do job) |
| Container Docker em rede efêmera nova (`docker network create`, sem subnet fixa) | `minio.tjtux.duckdns.org:9000` | **timeout** |

O runner do GitLab (`gitlab-runner`, executor `docker`, ver
`docker exec gitlab-runner cat /etc/gitlab-runner/config.toml`) cria uma rede
Docker efêmera nova para cada job (visível no log como
`runner-<token>-project-1-concurrent-0-<hash>-pgvector__pgvector-0`), sem
subnet explícita.

`/etc/docker/daemon.json` da VPS define:

```json
{
  "bip": "172.24.0.1/16",
  "default-address-pools": [
    { "base": "172.31.0.0/16", "size": 24 }
  ]
}
```

Toda rede Docker criada sem subnet explícita (como as redes efêmeras de job
do runner) recebe um `/24` desse pool — confirmado criando uma rede de teste
(`docker network create`), que recebeu `172.31.0.0/24`.

O UFW da VPS só liberava a porta 9000 para uma origem específica:

```
9000/tcp  ALLOW IN  172.19.0.0/16  # MinIO - NPM proxy (docker bridge)
```

`172.19.0.0/16` é a subnet da rede `gitlab_gitlab-network` (onde rodam o
Nginx Proxy Manager e o próprio GitLab — confirmado com
`docker network inspect`), **não** o pool `172.31.0.0/16` usado pelas redes
efêmeras de CI. Ou seja: qualquer tráfego partindo de um job de CI para o
MinIO na porta 9000 era descartado pelo firewall antes mesmo de chegar ao
processo do MinIO.

## Causa raiz

Regra de firewall (UFW) desatualizada/incompleta: liberava a porta 9000 do
MinIO apenas para a subnet Docker do NPM/GitLab (`172.19.0.0/16`), sem
considerar que o GitLab Runner (executor `docker`) cria redes efêmeras por
job a partir de um pool Docker diferente (`172.31.0.0/16`, definido em
`default-address-pools` no `daemon.json`). Não há relação com o código da
aplicação, com o `.gitlab-ci.yml` ou com credenciais — é puramente
infraestrutura/rede da VPS.

## Correção aplicada

Adicionada uma regra UFW liberando a porta 9000 para o pool de redes
efêmeras do Docker usado pelo runner, na mesma VPS onde já existia a regra
do NPM:

```bash
sudo ufw allow from 172.31.0.0/16 to any port 9000 proto tcp \
  comment 'MinIO - GitLab CI ephemeral job networks (docker default-address-pool)'
```

Validado com um container de teste na mesma subnet (`172.31.0.0/24`) que os
jobs de CI usam — `HTTP 200` em
`GET http://minio.tjtux.duckdns.org:9000/minio/health/live` — antes de
reexecutar o job #18855.

Nenhuma mudança foi necessária no `.gitlab-ci.yml`, em
`apps/api/scripts/verify-backup.sh` ou em qualquer código da aplicação.

## Recomendações futuras

- Se o `daemon.json` (`default-address-pools`) for alterado novamente no
  futuro, revisar também as regras do UFW que dependem de subnets Docker
  específicas (`172.19.0.0/16` para NPM, `172.31.0.0/16` para CI) — elas não
  se ajustam automaticamente.
- Considerar fixar a rede usada pelo `gitlab-runner` para os jobs (via
  `[runners.docker] network_mode` ou uma rede nomeada com subnet fixa) em vez
  de depender do pool default do Docker, tornando a regra de firewall
  correspondente estável e explícita.
