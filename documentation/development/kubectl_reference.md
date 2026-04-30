# Referência de Comandos kubectl — MindLedger

Guia completo de comandos `kubectl` para operar o cluster k3s do MindLedger.
Todos os comandos assumem acesso ao cluster configurado via `KUBECONFIG`.

---

## Sumário

1. [Namespaces e recursos do projeto](#1-namespaces-e-recursos-do-projeto)
2. [Comandos gerais do cluster](#2-comandos-gerais-do-cluster)
3. [PostgreSQL](#3-postgresql)
4. [Redis](#4-redis)
5. [API Django](#5-api-django)
6. [Frontend](#6-frontend)
7. [MinIO](#7-minio)
8. [Backup](#8-backup)
9. [Secrets e senhas](#9-secrets-e-senhas)
10. [Ingress e TLS](#10-ingress-e-tls)
11. [HPA — Horizontal Pod Autoscaler](#11-hpa--horizontal-pod-autoscaler)
12. [PDB — Pod Disruption Budget](#12-pdb--pod-disruption-budget)
13. [PVCs — armazenamento persistente](#13-pvcs--armazenamento-persistente)
14. [Monitoramento — Prometheus e Grafana](#14-monitoramento--prometheus-e-grafana)
15. [Blue-Green — deploy de produção](#15-blue-green--deploy-de-produção)
16. [Rollback](#16-rollback)
17. [Staging — comandos específicos](#17-staging--comandos-específicos)
18. [Troubleshooting e diagnóstico](#18-troubleshooting-e-diagnóstico)

---

## 1. Namespaces e recursos do projeto

### Namespaces

| Namespace           | Uso                                  |
|---------------------|--------------------------------------|
| `mindledger`        | Produção                             |
| `mindledger-staging`| Staging                              |
| `monitoring`        | Prometheus e Grafana                 |

```bash
# Listar todos os namespaces do cluster
kubectl get namespaces

# Ver resumo de todos os recursos de produção
kubectl get all -n mindledger

# Ver resumo de todos os recursos de staging
kubectl get all -n mindledger-staging

# Ver recursos de um namespace com mais detalhes
kubectl get all -n mindledger -o wide
```

### Deployments do projeto

| Deployment   | Namespace    | Porta      | Notas                          |
|--------------|--------------|------------|--------------------------------|
| `postgres`   | mindledger   | 5432       | PostgreSQL 16 + pgvector       |
| `redis`      | mindledger   | 6379       | Redis 7, autenticado           |
| `minio`      | mindledger   | 9000/9001  | Object storage, TLS interno    |
| `api-blue`   | mindledger   | 39100      | Slot blue (blue-green)         |
| `api-green`  | mindledger   | 39100      | Slot green (blue-green)        |
| `frontend`   | mindledger   | 80         | Nginx servindo React           |
| `api`        | staging      | 39100      | Deploy simples (sem blue-green)|

### Services do projeto

| Service             | Namespace  | Porta(s)    |
|---------------------|------------|-------------|
| `postgres-service`  | mindledger | 5432        |
| `redis-service`     | mindledger | 6379        |
| `minio-service`     | mindledger | 9000, 9001  |
| `api-service`       | mindledger | 39100       |
| `frontend-service`  | mindledger | 80          |

---

## 2. Comandos gerais do cluster

### Visão geral

```bash
# Status dos nós do cluster
kubectl get nodes
kubectl get nodes -o wide

# Versão do cluster
kubectl version

# Informações do cluster (API server, DNS)
kubectl cluster-info

# Todos os pods de todos os namespaces
kubectl get pods -A

# Todos os pods com nome do nó e IP
kubectl get pods -A -o wide

# Listar todos os recursos de um namespace
kubectl get all -n mindledger

# Listar eventos recentes de um namespace (útil para debug)
kubectl get events -n mindledger --sort-by='.lastTimestamp'
kubectl get events -n mindledger --sort-by='.lastTimestamp' | tail -30

# Listar apenas eventos de Warning
kubectl get events -n mindledger --field-selector type=Warning
```

### Contextos e configuração

```bash
# Ver contexto atual
kubectl config current-context

# Listar todos os contextos
kubectl config get-contexts

# Trocar de contexto
kubectl config use-context <nome-do-contexto>

# Ver configuração completa do kubeconfig
kubectl config view

# Definir namespace padrão para o contexto atual (evita repetir -n)
kubectl config set-context --current --namespace=mindledger
```

### Nodes e recursos do cluster

```bash
# Ver uso de recursos dos nós (requer metrics-server)
kubectl top nodes

# Ver uso de recursos dos pods de produção
kubectl top pods -n mindledger

# Ver uso de recursos dos pods de staging
kubectl top pods -n mindledger-staging

# Descrever um nó (eventos, condições, pods alocados)
kubectl describe node <nome-do-node>

# Ver ResourceQuota do namespace de produção
kubectl get resourcequota -n mindledger
kubectl describe resourcequota mindledger-quota -n mindledger

# Ver LimitRange (valores default de requests/limits)
kubectl get limitrange -n mindledger
kubectl describe limitrange mindledger-limit-range -n mindledger
```

---

## 3. PostgreSQL

### Inspecionar

```bash
# Ver o pod do Postgres (produção)
kubectl get pod -l app=postgres -n mindledger

# Ver detalhes do pod (recursos, volumes, probes, eventos)
kubectl describe pod -l app=postgres -n mindledger

# Ver o deployment
kubectl get deployment postgres -n mindledger
kubectl describe deployment postgres -n mindledger

# Ver o service
kubectl get svc postgres-service -n mindledger
kubectl describe svc postgres-service -n mindledger
```

### Logs

```bash
# Logs em tempo real
kubectl logs -f -l app=postgres -n mindledger

# Últimas 100 linhas
kubectl logs -l app=postgres -n mindledger --tail=100

# Logs do container anterior (após crash/restart)
kubectl logs -l app=postgres -n mindledger --previous
```

### Port-forward

```bash
# Expor PostgreSQL localmente na porta 5432
kubectl port-forward svc/postgres-service 5432:5432 -n mindledger

# Ou usando a porta local 15432 (evita conflito com Postgres local)
kubectl port-forward svc/postgres-service 15432:5432 -n mindledger

# Conectar via psql após o port-forward (em outro terminal)
# Obtendo usuário e senha — ver seção 9 (Secrets e senhas)
psql -h localhost -p 15432 -U <DB_USER> -d <DB_NAME>
```

### Acesso ao shell do Postgres

```bash
# Abrir psql diretamente no pod
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U $POSTGRES_USER -d $POSTGRES_DB

# Executar query rápida sem abrir shell interativo
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt"

# Listar tabelas
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt+"

# Ver tamanho do banco
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Ver conexões ativas
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

### Backup manual via kubectl (pg_dump direto)

```bash
# Dump do banco para arquivo local (produção)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- pg_dump -U $POSTGRES_USER -d $POSTGRES_DB --format=custom \
  > backup_manual_$(date +%Y%m%d_%H%M%S).dump

# Dump em formato SQL puro
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- pg_dump -U $POSTGRES_USER -d $POSTGRES_DB \
  > backup_manual_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar backup

```bash
# Restaurar dump (formato custom) — via port-forward
kubectl port-forward svc/postgres-service 15432:5432 -n mindledger &
pg_restore -h localhost -p 15432 -U <DB_USER> -d <DB_NAME> \
  --clean --if-exists --no-owner --no-privileges \
  --verbose backup_manual.dump

# Restaurar SQL puro via stdin
kubectl exec -i -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U $POSTGRES_USER -d $POSTGRES_DB < backup_manual.sql
```

### Reiniciar o Postgres

```bash
# Forçar rollout restart (recria o pod sem alterar imagem)
kubectl rollout restart deployment/postgres -n mindledger

# Aguardar o pod ficar pronto
kubectl rollout status deployment/postgres -n mindledger --timeout=120s
```

### PVC do Postgres

```bash
# Ver o PVC
kubectl get pvc postgres-pvc -n mindledger
kubectl describe pvc postgres-pvc -n mindledger
```

---

## 4. Redis

### Inspecionar

```bash
# Ver o pod do Redis (produção)
kubectl get pod -l app=redis -n mindledger

# Ver detalhes do pod
kubectl describe pod -l app=redis -n mindledger

# Ver o deployment
kubectl get deployment redis -n mindledger
kubectl describe deployment redis -n mindledger

# Ver o service
kubectl get svc redis-service -n mindledger
```

### Logs

```bash
# Logs em tempo real
kubectl logs -f -l app=redis -n mindledger

# Últimas 100 linhas
kubectl logs -l app=redis -n mindledger --tail=100

# Logs do container anterior (após crash/restart)
kubectl logs -l app=redis -n mindledger --previous
```

### Port-forward

```bash
# Expor Redis localmente na porta 6379
kubectl port-forward svc/redis-service 6379:6379 -n mindledger

# Ou na porta local 16379 (evita conflito com Redis local)
kubectl port-forward svc/redis-service 16379:6379 -n mindledger

# Conectar com redis-cli após o port-forward
redis-cli -h localhost -p 16379 -a <REDIS_PASSWORD>
```

### Acesso ao shell do Redis

```bash
# Abrir redis-cli diretamente no pod (a variável REDISCLI_AUTH já está setada)
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli

# Checar se o Redis está respondendo
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli ping

# Ver informações gerais (memória, conexões, versão)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli info

# Ver uso de memória
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli info memory

# Listar todas as chaves (use com cuidado em produção — bloqueia o servidor)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli keys "*"

# Contar chaves pelo padrão do projeto (prefixo mindledger)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli keys "mindledger*" | wc -l

# Limpar todo o cache (CUIDADO — apaga todas as chaves)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli flushall

# Ver estatísticas de acerto/miss do cache
kubectl exec -n mindledger \
  $(kubectl get pod -l app=redis -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli info stats | grep -E "keyspace|hit|miss"
```

### Reiniciar o Redis

```bash
kubectl rollout restart deployment/redis -n mindledger
kubectl rollout status deployment/redis -n mindledger --timeout=60s
```

---

## 5. API Django

### Inspecionar

```bash
# Ver pods da API (produção — identifica o slot ativo blue/green)
kubectl get pod -l app=api -n mindledger -o wide

# Ver pod do slot blue especificamente
kubectl get pod -l app=api,slot=blue -n mindledger

# Ver pod do slot green especificamente
kubectl get pod -l app=api,slot=green -n mindledger

# Ver qual slot está ativo no service
kubectl get svc api-service -n mindledger \
  -o jsonpath='{.spec.selector.slot}'

# Ver os dois deployments blue e green
kubectl get deployment api-blue api-green -n mindledger

# Ver detalhes do deployment ativo
kubectl describe deployment api-blue -n mindledger

# Ver o service da API
kubectl get svc api-service -n mindledger
kubectl describe svc api-service -n mindledger
```

### Logs

```bash
# Logs da API em tempo real (todos os pods com label app=api)
kubectl logs -f -l app=api -n mindledger

# Logs apenas do slot blue
kubectl logs -f -l app=api,slot=blue -n mindledger

# Logs apenas do slot green
kubectl logs -f -l app=api,slot=green -n mindledger

# Últimas 200 linhas
kubectl logs -l app=api -n mindledger --tail=200

# Logs do container anterior (após crash)
kubectl logs -l app=api -n mindledger --previous

# Logs de todos os containers do pod (inclui initContainers)
kubectl logs -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  --all-containers
```

### Port-forward

```bash
# Expor a API localmente na porta 39100
kubectl port-forward svc/api-service 39100:39100 -n mindledger

# Testar após o port-forward
curl http://localhost:39100/health/
curl http://localhost:39100/ready/
curl http://localhost:39100/api/docs/
```

### Acesso ao shell da API (Django manage.py)

```bash
# Abrir shell no pod da API
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- bash

# Django shell interativo
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py shell

# Rodar manage.py sem abrir shell interativo
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py check

# Ver migrações pendentes
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py showmigrations

# Aplicar migrações manualmente
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py migrate

# Configurar permissões (cria grupo Members com CRUD completo)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py setup_permissions

# Recalcular saldos das contas
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py update_balances

# Criar superusuário manualmente
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py createsuperuser

# Redefinir senha de um usuário existente
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
u = U.objects.get(username='admin')
u.set_password('NOVA_SENHA')
u.save()
print('Senha alterada com sucesso')
"

# Coletar arquivos estáticos
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py collectstatic --noinput

# Purgar registros soft-deleted com mais de 90 dias (LGPD)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py purge_deleted_records

# Fechar faturas vencidas de cartão de crédito
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py close_overdue_bills

# Diagnóstico de vault
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py vault_recovery --username admin
```

### Escalar a API

```bash
# Escalar o slot blue para 2 réplicas
kubectl scale deployment/api-blue --replicas=2 -n mindledger

# Escalar o slot green para 0 (slot inativo)
kubectl scale deployment/api-green --replicas=0 -n mindledger

# Ver status das réplicas
kubectl get deployment api-blue api-green -n mindledger
```

### Reiniciar a API

```bash
# Forçar rollout restart do slot ativo (substitua blue/green conforme necessário)
kubectl rollout restart deployment/api-blue -n mindledger

# Aguardar o pod ficar pronto
kubectl rollout status deployment/api-blue -n mindledger --timeout=120s

# Ver histórico de revisões do deployment
kubectl rollout history deployment/api-blue -n mindledger
```

### Atualizar imagem da API

```bash
# Atualizar para uma nova imagem (normalmente feito pelo CI)
kubectl set image deployment/api-blue \
  api=registry.gitlab.com/tarcisioribeiro/mindledger/api:<TAG> \
  -n mindledger

# Acompanhar o rollout
kubectl rollout status deployment/api-blue -n mindledger --timeout=120s
```

---

## 6. Frontend

### Inspecionar

```bash
# Ver pod do frontend
kubectl get pod -l app=frontend -n mindledger

# Ver detalhes do pod
kubectl describe pod -l app=frontend -n mindledger

# Ver o deployment
kubectl get deployment frontend -n mindledger
kubectl describe deployment frontend -n mindledger

# Ver o service
kubectl get svc frontend-service -n mindledger
```

### Logs

```bash
# Logs do Nginx em tempo real
kubectl logs -f -l app=frontend -n mindledger

# Últimas 100 linhas
kubectl logs -l app=frontend -n mindledger --tail=100

# Logs do container anterior (após crash)
kubectl logs -l app=frontend -n mindledger --previous
```

### Port-forward

```bash
# Expor o frontend localmente na porta 8080
kubectl port-forward svc/frontend-service 8080:80 -n mindledger

# Acessar no browser: http://localhost:8080
```

### Acesso ao shell do frontend

```bash
# Abrir shell no container Nginx
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=frontend -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- sh

# Ver configuração do Nginx
kubectl exec -n mindledger \
  $(kubectl get pod -l app=frontend -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- cat /etc/nginx/conf.d/default.conf

# Testar configuração do Nginx
kubectl exec -n mindledger \
  $(kubectl get pod -l app=frontend -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- nginx -t

# Ver ConfigMap com a config do Nginx
kubectl get configmap -l app.kubernetes.io/component=frontend -n mindledger
kubectl describe configmap frontend-nginx-config -n mindledger
```

### Reiniciar o Frontend

```bash
kubectl rollout restart deployment/frontend -n mindledger
kubectl rollout status deployment/frontend -n mindledger --timeout=60s

# Ver histórico de revisões
kubectl rollout history deployment/frontend -n mindledger
```

### Atualizar imagem do Frontend

```bash
kubectl set image deployment/frontend \
  frontend=registry.gitlab.com/tarcisioribeiro/mindledger/frontend:<TAG> \
  -n mindledger

kubectl rollout status deployment/frontend -n mindledger --timeout=60s
```

---

## 7. MinIO

### Inspecionar

```bash
# Ver pod do MinIO
kubectl get pod -l app=minio -n mindledger

# Ver detalhes do pod
kubectl describe pod -l app=minio -n mindledger

# Ver o deployment
kubectl get deployment minio -n mindledger
kubectl describe deployment minio -n mindledger

# Ver o service (portas 9000 API e 9001 console)
kubectl get svc minio-service -n mindledger
kubectl describe svc minio-service -n mindledger
```

### Logs

```bash
# Logs do MinIO em tempo real
kubectl logs -f -l app=minio -n mindledger

# Últimas 100 linhas
kubectl logs -l app=minio -n mindledger --tail=100

# Logs do container anterior (após crash)
kubectl logs -l app=minio -n mindledger --previous
```

### Port-forward

```bash
# Expor a API do MinIO (porta 9000) e o console (porta 9001)
kubectl port-forward svc/minio-service 9000:9000 9001:9001 -n mindledger

# Acessar o console no browser: https://localhost:9001
# (certificado auto-assinado — aceite o aviso de segurança)

# Acessar via mc (MinIO client) após o port-forward
mc alias set local https://localhost:9000 <MINIO_ROOT_USER> <MINIO_ROOT_PASSWORD> --insecure
mc ls local/mindledger --insecure
```

### Acesso ao shell do MinIO (mc client)

```bash
# Abrir shell no pod do MinIO
kubectl exec -it -n mindledger \
  $(kubectl get pod -l app=minio -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- sh

# Listar buckets via mc (dentro do pod)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=minio -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- sh -c 'mc --insecure alias set local https://localhost:9000 \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc --insecure ls local/'

# Listar objetos no bucket mindledger
kubectl exec -n mindledger \
  $(kubectl get pod -l app=minio -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- sh -c 'mc --insecure alias set local https://localhost:9000 \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc --insecure ls local/mindledger/'

# Ver tamanho do bucket
kubectl exec -n mindledger \
  $(kubectl get pod -l app=minio -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- sh -c 'mc --insecure alias set local https://localhost:9000 \
    "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc --insecure du local/mindledger'
```

### TLS do MinIO

```bash
# Ver o secret com o certificado TLS do MinIO
kubectl get secret minio-tls -n mindledger
kubectl describe secret minio-tls -n mindledger

# Ver datas de validade do certificado
kubectl get secret minio-tls -n mindledger \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | \
  openssl x509 -noout -dates

# Verificar health do MinIO via port-forward
kubectl port-forward svc/minio-service 9000:9000 -n mindledger &
curl -k https://localhost:9000/minio/health/ready
curl -k https://localhost:9000/minio/health/live
```

### Reiniciar o MinIO

```bash
kubectl rollout restart deployment/minio -n mindledger
kubectl rollout status deployment/minio -n mindledger --timeout=60s
```

### Job de inicialização do MinIO (criar bucket)

```bash
# Executar o job de init para criar o bucket mindledger (se ainda não existir)
kubectl apply -f k8s/minio/deployment.yaml -n mindledger

# Ver status do job
kubectl get job minio-init -n mindledger

# Ver logs do job
kubectl logs -l app=minio-init -n mindledger
```

---

## 8. Backup

### CronJob de backup

```bash
# Ver o CronJob
kubectl get cronjob mindledger-db-backup -n mindledger
kubectl describe cronjob mindledger-db-backup -n mindledger

# Ver histórico de jobs executados
kubectl get jobs -l app.kubernetes.io/component=backup -n mindledger

# Ver o último job e seu status
kubectl get jobs -n mindledger --sort-by='.status.startTime' | tail -5
```

### Disparar backup manual imediatamente

```bash
# Criar um job a partir do CronJob (execução imediata)
kubectl create job --from=cronjob/mindledger-db-backup \
  mindledger-backup-manual-$(date +%Y%m%d%H%M%S) \
  -n mindledger

# Acompanhar os logs do backup em tempo real
kubectl logs -f -l app=mindledger-backup -n mindledger

# Ver status do job manual
kubectl get jobs -n mindledger | grep mindledger-backup-manual
```

### Ver logs de backups anteriores

```bash
# Listar todos os jobs de backup (bem-sucedidos e falhos)
kubectl get jobs -n mindledger -l app.kubernetes.io/component=backup

# Ver logs de um job específico
kubectl logs -n mindledger job/<nome-do-job>

# Ver pods de backup (incluindo os concluídos)
kubectl get pods -n mindledger -l app=mindledger-backup --show-terminated
```

### Verificar status do último backup

```bash
# Verificar o sentinel file dentro do PVC de backup
kubectl exec -n mindledger \
  $(kubectl get pod -l app=mindledger-backup -n mindledger \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
    echo "$(kubectl get pods -n mindledger | grep backup | head -1 | awk '{print $1}')") \
  -- cat /backups/.last_backup_status 2>/dev/null || \
  echo "Nenhum pod de backup rodando no momento. Verifique os jobs concluídos."

# Listar arquivos de backup no PVC
kubectl exec -n mindledger \
  $(kubectl get pod -l app=mindledger-backup -n mindledger \
    -o jsonpath='{.items[0].metadata.name}') \
  -- ls -lh /backups/
```

### Restaurar backup encriptado

```bash
# 1. Baixar o backup do MinIO via port-forward
kubectl port-forward svc/minio-service 9000:9000 -n mindledger &
mc alias set prod https://localhost:9000 <MINIO_ROOT_USER> <MINIO_ROOT_PASSWORD> --insecure
mc --insecure cp prod/mindledger-backups/db/db_backup_<TIMESTAMP>.dump.enc .

# 2. Descriptografar
export BACKUP_ENCRYPTION_KEY="<chave>"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in  db_backup_<TIMESTAMP>.dump.enc \
  -out db_backup_<TIMESTAMP>.dump

# 3. Restaurar via port-forward do Postgres
kubectl port-forward svc/postgres-service 15432:5432 -n mindledger &
pg_restore \
  -h localhost -p 15432 -U <DB_USER> -d <DB_NAME> \
  --clean --if-exists --no-owner --no-privileges \
  --verbose db_backup_<TIMESTAMP>.dump
```

### Limpar jobs de backup concluídos

```bash
# Remover jobs bem-sucedidos mais antigos (o CronJob mantém apenas os 3 últimos)
kubectl delete jobs -n mindledger \
  $(kubectl get jobs -n mindledger -l app.kubernetes.io/component=backup \
    --field-selector status.successful=1 \
    -o jsonpath='{.items[*].metadata.name}')
```

---

## 9. Secrets e senhas

> **Importante:** todas as senhas e chaves ficam no secret `mindledger-secrets`
> (e `mindledger-backup-secrets` para o backup). Use os comandos abaixo para
> extrair os valores sem precisar editar arquivos.

### Ver todos os secrets do namespace

```bash
# Listar secrets de produção
kubectl get secrets -n mindledger

# Listar secrets de staging
kubectl get secrets -n mindledger-staging
```

### Extrair senhas do secret principal (`mindledger-secrets`)

```bash
# Senha do banco de dados
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.DB_PASSWORD}' | base64 -d && echo

# Usuário do banco de dados
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.DB_USER}' | base64 -d && echo

# Nome do banco de dados
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.DB_NAME}' | base64 -d && echo

# Django SECRET_KEY
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.SECRET_KEY}' | base64 -d && echo

# Chave de criptografia Fernet (ENCRYPTION_KEY)
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.ENCRYPTION_KEY}' | base64 -d && echo

# Usuário superadmin Django
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.DJANGO_SUPERUSER_USERNAME}' | base64 -d && echo

# Senha superadmin Django
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.DJANGO_SUPERUSER_PASSWORD}' | base64 -d && echo

# Senha do Redis
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d && echo

# URL completa do Redis (inclui senha)
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.REDIS_URL}' | base64 -d && echo

# Usuário root do MinIO
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.MINIO_ROOT_USER}' | base64 -d && echo

# Senha root do MinIO
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.MINIO_ROOT_PASSWORD}' | base64 -d && echo

# Sentry DSN (se configurado)
kubectl get secret mindledger-secrets -n mindledger \
  -o jsonpath='{.data.SENTRY_DSN}' | base64 -d && echo
```

### Extrair senhas do secret de backup (`mindledger-backup-secrets`)

```bash
# Chave de criptografia dos backups
kubectl get secret mindledger-backup-secrets -n mindledger \
  -o jsonpath='{.data.BACKUP_ENCRYPTION_KEY}' | base64 -d && echo

# Endpoint do MinIO para backup
kubectl get secret mindledger-backup-secrets -n mindledger \
  -o jsonpath='{.data.MINIO_ENDPOINT}' | base64 -d && echo

# Access Key do MinIO (backup)
kubectl get secret mindledger-backup-secrets -n mindledger \
  -o jsonpath='{.data.MINIO_ACCESS_KEY}' | base64 -d && echo

# Secret Key do MinIO (backup)
kubectl get secret mindledger-backup-secrets -n mindledger \
  -o jsonpath='{.data.MINIO_SECRET_KEY}' | base64 -d && echo
```

### Extrair todos os valores de um secret de uma vez

```bash
# Ver todos os campos do secret principal (valores em base64)
kubectl get secret mindledger-secrets -n mindledger -o yaml

# Ver todos os campos decodificados de uma vez (requer jq)
kubectl get secret mindledger-secrets -n mindledger -o json | \
  jq -r '.data | to_entries[] | "\(.key): \(.value | @base64d)"'

# Mesmo comando para staging
kubectl get secret mindledger-secrets -n mindledger-staging -o json | \
  jq -r '.data | to_entries[] | "\(.key): \(.value | @base64d)"'
```

### Atualizar um secret

```bash
# Atualizar o valor de uma chave específica
kubectl patch secret mindledger-secrets -n mindledger \
  --type='json' \
  -p='[{"op":"replace","path":"/data/DB_PASSWORD","value":"'$(echo -n "NOVA_SENHA" | base64 -w0)'"}]'

# Recriar o secret inteiro (depois de editar o secrets.yaml)
envsubst < k8s/base/secrets.yaml | kubectl apply -f -
```

### Secret do registry (pull de imagens)

```bash
# Ver o pull secret do GitLab Registry
kubectl get secret gitlab-registry-secret -n mindledger
kubectl describe secret gitlab-registry-secret -n mindledger

# Recriar o pull secret (após rotacionar o Deploy Token)
kubectl delete secret gitlab-registry-secret -n mindledger --ignore-not-found
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server="registry.gitlab.com" \
  --docker-username="<DEPLOY_TOKEN_USER>" \
  --docker-password="<DEPLOY_TOKEN_VALUE>" \
  -n mindledger
```

---

## 10. Ingress e TLS

### Inspecionar Ingress

```bash
# Ver os ingresses de produção
kubectl get ingress -n mindledger

# Ver detalhes do ingress de produção
kubectl describe ingress -n mindledger

# Ver ingress do MinIO
kubectl get ingress -n mindledger -l app.kubernetes.io/component=minio
kubectl describe ingress minio-ingress -n mindledger

# Ver ingress de staging
kubectl get ingress -n mindledger-staging
kubectl describe ingress -n mindledger-staging
```

### Certificados TLS (cert-manager)

```bash
# Ver certificados de produção
kubectl get certificate -n mindledger

# Ver detalhes do certificado (datas, status de renovação)
kubectl describe certificate mindledger-tls -n mindledger

# Ver certificados de staging
kubectl get certificate -n mindledger-staging
kubectl describe certificate mindledger-staging-tls -n mindledger-staging

# Ver CertificateRequests (log do processo de emissão)
kubectl get certificaterequest -n mindledger
kubectl describe certificaterequest -n mindledger

# Ver Challenges (processo ACME HTTP-01)
kubectl get challenge -n mindledger

# Ver Orders (solicitações de certificado ao Let's Encrypt)
kubectl get order -n mindledger

# Ver ClusterIssuers disponíveis
kubectl get clusterissuers

# Forçar renovação do certificado (deletar o secret faz o cert-manager emitir novo)
kubectl delete secret mindledger-tls -n mindledger
kubectl delete secret mindledger-staging-tls -n mindledger-staging

# Ver status do cert-manager
kubectl get pods -n cert-manager
kubectl logs -f -l app=cert-manager -n cert-manager
```

### Verificar TLS externamente

```bash
# Verificar certificado de produção
echo | openssl s_client -connect mindledger.tjtux.duckdns.org:443 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer

# Verificar certificado de staging
echo | openssl s_client -connect mindledger-staging.tjtux.duckdns.org:443 2>/dev/null \
  | openssl x509 -noout -dates -subject

# Verificar se as rotas respondem
curl -I https://mindledger.tjtux.duckdns.org/health/
curl -I https://mindledger.tjtux.duckdns.org/ready/
curl -I https://mindledger-staging.tjtux.duckdns.org/health/
```

### Nginx Ingress Controller

```bash
# Ver pods do ingress controller
kubectl get pods -n ingress-nginx

# Ver logs do ingress controller
kubectl logs -f -l app.kubernetes.io/name=ingress-nginx -n ingress-nginx

# Ver ConfigMap do ingress controller
kubectl get configmap -n ingress-nginx
```

---

## 11. HPA — Horizontal Pod Autoscaler

```bash
# Ver todos os HPAs de produção
kubectl get hpa -n mindledger

# Ver detalhes do HPA da API (min 1 / max 10 réplicas)
kubectl describe hpa api-hpa -n mindledger

# Ver detalhes do HPA do frontend (min 1 / max 5 réplicas)
kubectl describe hpa frontend-hpa -n mindledger

# Ver métricas atuais dos HPAs (requer metrics-server)
kubectl get hpa -n mindledger -o wide

# Ajustar temporariamente os limites do HPA da API
kubectl patch hpa api-hpa -n mindledger \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/maxReplicas","value":5}]'

# Desabilitar o HPA temporariamente (definir min e max iguais)
kubectl patch hpa api-hpa -n mindledger \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/minReplicas","value":2},
       {"op":"replace","path":"/spec/maxReplicas","value":2}]'
```

---

## 12. PDB — Pod Disruption Budget

```bash
# Ver todos os PDBs de produção
kubectl get pdb -n mindledger

# Ver detalhes do PDB da API
kubectl describe pdb api-pdb -n mindledger

# Ver detalhes do PDB do frontend
kubectl describe pdb frontend-pdb -n mindledger
```

---

## 13. PVCs — armazenamento persistente

### Listar e inspecionar

```bash
# Ver todos os PVCs de produção
kubectl get pvc -n mindledger

# Ver todos os PVCs de staging
kubectl get pvc -n mindledger-staging

# Ver detalhes de um PVC específico
kubectl describe pvc postgres-pvc -n mindledger
kubectl describe pvc redis-pvc -n mindledger
kubectl describe pvc minio-pvc -n mindledger
kubectl describe pvc backup-pvc -n mindledger
kubectl describe pvc api-media-pvc -n mindledger
kubectl describe pvc api-logs-pvc -n mindledger
kubectl describe pvc api-static-pvc -n mindledger

# Ver os PersistentVolumes provisionados
kubectl get pv

# Ver uso de disco dentro de um pod (a partir do pod)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=postgres -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- df -h
```

### Expandir um PVC (se o StorageClass suportar)

```bash
# Exemplo: expandir o PVC do Postgres de 10Gi para 20Gi
kubectl patch pvc postgres-pvc -n mindledger \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/resources/requests/storage","value":"20Gi"}]'

# Acompanhar a expansão
kubectl describe pvc postgres-pvc -n mindledger | grep -A5 Conditions
```

---

## 14. Monitoramento — Prometheus e Grafana

```bash
# Ver pods do namespace de monitoramento
kubectl get pods -n monitoring

# Ver services de monitoramento
kubectl get svc -n monitoring

# Port-forward do Prometheus (UI na porta 9090)
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Port-forward do Grafana (UI na porta 3000)
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Logs do Prometheus
kubectl logs -f -l app=prometheus -n monitoring

# Logs do Grafana
kubectl logs -f -l app=grafana -n monitoring

# Ver ConfigMap com as regras de alertas do Prometheus
kubectl get configmap -n monitoring
kubectl describe configmap prometheus-config -n monitoring

# Verificar se o endpoint de métricas da API está acessível
# (após port-forward da API na porta 39100)
kubectl port-forward svc/api-service 39100:39100 -n mindledger &
curl http://localhost:39100/metrics
```

---

## 15. Blue-Green — deploy de produção

O ambiente de produção usa deploy blue-green para a API. O `api-service`
aponta para um dos slots (`blue` ou `green`) via selector `slot: <valor>`.

### Identificar o slot ativo

```bash
# Ver qual slot está recebendo tráfego
kubectl get svc api-service -n mindledger \
  -o jsonpath='{.spec.selector.slot}' && echo

# Ver o estado dos dois slots
kubectl get deployment api-blue api-green -n mindledger

# Ver as imagens rodando em cada slot
kubectl get deployment api-blue -n mindledger \
  -o jsonpath='{.spec.template.spec.containers[0].image}' && echo

kubectl get deployment api-green -n mindledger \
  -o jsonpath='{.spec.template.spec.containers[0].image}' && echo

# Ver os pods dos dois slots
kubectl get pods -l app=api -n mindledger -o wide
```

### Fazer o switch manual de slot

```bash
# Determinar slot atual e calcular o de rollback
CURRENT_SLOT=$(kubectl get svc api-service -n mindledger \
  -o jsonpath='{.spec.selector.slot}')
echo "Slot ativo agora: $CURRENT_SLOT"

if [ "$CURRENT_SLOT" = "blue" ]; then TARGET_SLOT="green"; else TARGET_SLOT="blue"; fi
echo "Slot alvo: $TARGET_SLOT"

# Escalar o slot alvo para 1 réplica
kubectl scale deployment/api-$TARGET_SLOT --replicas=1 -n mindledger
kubectl rollout status deployment/api-$TARGET_SLOT -n mindledger --timeout=120s

# Redirecionar o tráfego para o slot alvo
kubectl patch svc api-service -n mindledger \
  --type=merge \
  -p "{\"spec\":{\"selector\":{\"app\":\"api\",\"slot\":\"$TARGET_SLOT\"}}}"

# Escalar o slot anterior para 0
kubectl scale deployment/api-$CURRENT_SLOT --replicas=0 -n mindledger

# Confirmar o switch
kubectl get svc api-service -n mindledger \
  -o jsonpath='{.spec.selector.slot}' && echo
```

### Ver histórico de revisões de cada slot

```bash
kubectl rollout history deployment/api-blue -n mindledger
kubectl rollout history deployment/api-green -n mindledger
kubectl rollout history deployment/frontend -n mindledger
```

---

## 16. Rollback

### Rollback de staging (simples)

```bash
# Reverter API para a revisão anterior
kubectl rollout undo deployment/api -n mindledger-staging

# Reverter frontend para a revisão anterior
kubectl rollout undo deployment/frontend -n mindledger-staging

# Aguardar estabilização
kubectl rollout status deployment/api -n mindledger-staging --timeout=120s
kubectl rollout status deployment/frontend -n mindledger-staging --timeout=60s

# Reverter para uma revisão específica
kubectl rollout undo deployment/api -n mindledger-staging --to-revision=<N>
```

### Rollback de produção (blue-green)

```bash
# 1. Identificar o slot ativo e o de rollback
CURRENT_SLOT=$(kubectl get svc api-service -n mindledger \
  -o jsonpath='{.spec.selector.slot}')
if [ "$CURRENT_SLOT" = "blue" ]; then ROLLBACK_SLOT="green"; else ROLLBACK_SLOT="blue"; fi
echo "Revertendo de $CURRENT_SLOT para $ROLLBACK_SLOT"

# 2. Escalar o slot de rollback
kubectl scale deployment/api-$ROLLBACK_SLOT --replicas=1 -n mindledger
kubectl rollout status deployment/api-$ROLLBACK_SLOT -n mindledger --timeout=120s

# 3. Redirecionar o tráfego
kubectl patch svc api-service -n mindledger \
  --type=merge \
  -p "{\"spec\":{\"selector\":{\"app\":\"api\",\"slot\":\"$ROLLBACK_SLOT\"}}}"

# 4. Escalar o slot problemático para 0
kubectl scale deployment/api-$CURRENT_SLOT --replicas=0 -n mindledger

# 5. Reverter o frontend
kubectl rollout undo deployment/frontend -n mindledger
kubectl rollout status deployment/frontend -n mindledger --timeout=60s

# 6. Verificar
kubectl get svc api-service -n mindledger -o jsonpath='{.spec.selector.slot}' && echo
kubectl get pods -l app=api -n mindledger
```

---

## 17. Staging — comandos específicos

Os comandos de staging são idênticos aos de produção, trocando apenas o namespace
de `mindledger` para `mindledger-staging`. Nos casos onde há diferença
(ex.: deployment `api` em vez de `api-blue`/`api-green`), estão listados abaixo.

### Inspecionar recursos de staging

```bash
# Ver todos os recursos de staging
kubectl get all -n mindledger-staging

# Ver pods de staging
kubectl get pods -n mindledger-staging

# Ver pods com mais detalhes (nó, IP, status)
kubectl get pods -n mindledger-staging -o wide

# Ver eventos recentes de staging
kubectl get events -n mindledger-staging --sort-by='.lastTimestamp' | tail -20
```

### Port-forwards de staging

```bash
# API de staging
kubectl port-forward svc/api-service 39200:39100 -n mindledger-staging

# Frontend de staging
kubectl port-forward svc/frontend-service 8081:80 -n mindledger-staging

# PostgreSQL de staging
kubectl port-forward svc/postgres-service 25432:5432 -n mindledger-staging

# Redis de staging
kubectl port-forward svc/redis-service 26379:6379 -n mindledger-staging

# MinIO de staging (API + console)
kubectl port-forward svc/minio-service 29000:9000 29001:9001 -n mindledger-staging
```

### Extrair senhas de staging

```bash
# Senha do banco de staging
kubectl get secret mindledger-secrets -n mindledger-staging \
  -o jsonpath='{.data.DB_PASSWORD}' | base64 -d && echo

# Usuário superadmin Django (staging)
kubectl get secret mindledger-secrets -n mindledger-staging \
  -o jsonpath='{.data.DJANGO_SUPERUSER_USERNAME}' | base64 -d && echo

# Senha superadmin Django (staging)
kubectl get secret mindledger-secrets -n mindledger-staging \
  -o jsonpath='{.data.DJANGO_SUPERUSER_PASSWORD}' | base64 -d && echo

# Senha do Redis (staging)
kubectl get secret mindledger-secrets -n mindledger-staging \
  -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d && echo

# MinIO root user (staging)
kubectl get secret mindledger-secrets -n mindledger-staging \
  -o jsonpath='{.data.MINIO_ROOT_USER}' | base64 -d && echo

# MinIO root password (staging)
kubectl get secret mindledger-secrets -n mindledger-staging \
  -o jsonpath='{.data.MINIO_ROOT_PASSWORD}' | base64 -d && echo

# Todos os secrets de staging decodificados (requer jq)
kubectl get secret mindledger-secrets -n mindledger-staging -o json | \
  jq -r '.data | to_entries[] | "\(.key): \(.value | @base64d)"'
```

### Logs de staging por componente

```bash
kubectl logs -f -l app=api -n mindledger-staging
kubectl logs -f -l app=frontend -n mindledger-staging
kubectl logs -f -l app=postgres -n mindledger-staging
kubectl logs -f -l app=redis -n mindledger-staging
kubectl logs -f -l app=minio -n mindledger-staging
```

### Backup manual de staging

```bash
kubectl create job --from=cronjob/mindledger-db-backup \
  mindledger-backup-staging-manual-$(date +%Y%m%d%H%M%S) \
  -n mindledger-staging

kubectl logs -f -l app=mindledger-backup -n mindledger-staging
```

### Reiniciar deployments de staging

```bash
kubectl rollout restart deployment/api -n mindledger-staging
kubectl rollout restart deployment/frontend -n mindledger-staging
kubectl rollout restart deployment/postgres -n mindledger-staging
kubectl rollout restart deployment/redis -n mindledger-staging
kubectl rollout restart deployment/minio -n mindledger-staging
```

### Django manage.py em staging

```bash
# Acessar shell Django em staging
kubectl exec -it -n mindledger-staging \
  $(kubectl get pod -l app=api -n mindledger-staging -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py shell

# Ver migrações pendentes em staging
kubectl exec -n mindledger-staging \
  $(kubectl get pod -l app=api -n mindledger-staging -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py showmigrations

# Criar usuário de teste em staging
kubectl exec -it -n mindledger-staging \
  $(kubectl get pod -l app=api -n mindledger-staging -o jsonpath='{.items[0].metadata.name}') \
  -- python manage.py createsuperuser
```

---

## 18. Troubleshooting e diagnóstico

### Pod não inicia (CrashLoopBackOff / ImagePullBackOff)

```bash
# Ver o motivo do erro
kubectl describe pod <nome-do-pod> -n mindledger

# Ver logs do container que está falhando
kubectl logs <nome-do-pod> -n mindledger --previous

# Ver logs do initContainer (ex.: wait-for-postgres)
kubectl logs <nome-do-pod> -n mindledger -c wait-for-postgres

# Verificar eventos do namespace
kubectl get events -n mindledger --sort-by='.lastTimestamp' | grep Warning

# Verificar se o pull secret está válido
kubectl describe secret gitlab-registry-secret -n mindledger
```

### Namespace preso em Terminating

```bash
# Forçar remoção de namespace preso
kubectl get namespace mindledger -o json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
    d['spec']['finalizers']=[]; print(json.dumps(d))" \
  | kubectl replace --raw "/api/v1/namespaces/mindledger/finalize" -f -
```

### Verificar conectividade entre pods

```bash
# Testar se a API consegue chegar ao Postgres (dentro do pod da API)
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- nc -zv postgres-service 5432

# Testar se a API consegue chegar ao Redis
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- nc -zv redis-service 6379

# Testar se a API consegue chegar ao MinIO
kubectl exec -n mindledger \
  $(kubectl get pod -l app=api -n mindledger -o jsonpath='{.items[0].metadata.name}') \
  -- nc -zv minio-service 9000
```

### Diagnosticar problemas de recursos

```bash
# Ver pods com mais detalhes (restarts, idade, status)
kubectl get pods -n mindledger -o wide

# Ver consumo atual de CPU e memória (requer metrics-server)
kubectl top pods -n mindledger
kubectl top pods -n mindledger-staging

# Ver se algum pod foi OOMKilled
kubectl get pods -n mindledger -o json | \
  jq -r '.items[] | select(.status.containerStatuses[]?.lastState.terminated.reason == "OOMKilled") | .metadata.name'

# Ver descrição de todos os pods de um deployment de uma vez
kubectl describe pods -l app=api -n mindledger
```

### Listar todos os recursos por label

```bash
# Todos os recursos com o label do projeto
kubectl get all -l app.kubernetes.io/name=mindledger -n mindledger

# Recursos de um componente específico
kubectl get all -l app.kubernetes.io/component=postgres -n mindledger
kubectl get all -l app.kubernetes.io/component=redis -n mindledger
kubectl get all -l app.kubernetes.io/component=api -n mindledger
kubectl get all -l app.kubernetes.io/component=frontend -n mindledger
kubectl get all -l app.kubernetes.io/component=minio -n mindledger
kubectl get all -l app.kubernetes.io/component=backup -n mindledger
```

### Verificar ConfigMaps

```bash
# Listar ConfigMaps de produção
kubectl get configmap -n mindledger

# Ver o ConfigMap principal da aplicação
kubectl describe configmap mindledger-config -n mindledger

# Ver o ConfigMap de init do Postgres
kubectl describe configmap postgres-init-config -n mindledger

# Ver o ConfigMap do script de backup
kubectl describe configmap backup-script -n mindledger
```

### Copiar arquivos para/de pods

```bash
# Copiar arquivo do pod para o host (ex.: coletar um dump local)
kubectl cp mindledger/<nome-do-pod>:/backups/db_backup.dump ./db_backup.dump

# Copiar arquivo do host para o pod
kubectl cp ./meu-script.sh mindledger/<nome-do-pod>:/tmp/meu-script.sh
```

### Forçar deleção de pod preso

```bash
# Deletar e recriar um pod preso (o Deployment recria automaticamente)
kubectl delete pod <nome-do-pod> -n mindledger

# Forçar deleção sem esperar graceful shutdown (CUIDADO)
kubectl delete pod <nome-do-pod> -n mindledger --force --grace-period=0
```

### Verificar ServiceAccounts

```bash
# Listar ServiceAccounts de produção
kubectl get serviceaccount -n mindledger

# Ver detalhes de uma ServiceAccount
kubectl describe serviceaccount sa-api -n mindledger
kubectl describe serviceaccount sa-postgres -n mindledger
kubectl describe serviceaccount sa-redis -n mindledger
kubectl describe serviceaccount sa-minio -n mindledger
kubectl describe serviceaccount sa-backup -n mindledger
```

### Verificar NetworkPolicy

```bash
# Ver NetworkPolicies de produção
kubectl get networkpolicy -n mindledger
kubectl describe networkpolicy -n mindledger

# Ver NetworkPolicies de staging
kubectl get networkpolicy -n mindledger-staging
```

### Aplicar manifestos manualmente

```bash
# Aplicar todos os manifestos de produção via script
bash k8s/scripts/apply-production.sh

# Aplicar todos os manifestos de staging via script
bash k8s/scripts/apply-staging.sh

# Aplicar um manifesto específico
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/redis/deployment.yaml
kubectl apply -f k8s/minio/deployment.yaml
kubectl apply -f k8s/api/deployment-blue.yaml
kubectl apply -f k8s/api/deployment-green.yaml
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/backup-cronjob.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/resource-quota.yaml
kubectl apply -f k8s/network-policy.yaml

# Aplicar usando Kustomize (produção)
kubectl apply -k k8s/overlays/production/

# Aplicar usando Kustomize (staging)
kubectl apply -k k8s/overlays/staging/

# Dry-run antes de aplicar (verificar sem alterar o cluster)
kubectl apply -f k8s/postgres/deployment.yaml --dry-run=server
```
