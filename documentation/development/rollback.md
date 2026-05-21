# Runbook de Rollback — Axiom

Este documento descreve os procedimentos de rollback disponíveis para os
ambientes de **staging** e **produção**, tanto os acionados automaticamente
pelo pipeline quanto os acionados manualmente por operadores.

---

## Visão geral

| Job CI                    | Ambiente   | Acionamento         | Estratégia           |
|---------------------------|------------|---------------------|----------------------|
| `deploy:rollback:staging` | Staging    | Automático (falha)  | `kubectl rollout undo` |
| `rollback:staging`        | Staging    | Manual              | `kubectl rollout undo` |
| `deploy:rollback:production` | Produção | Automático (falha) | Blue-green slot switch |
| `rollback:production`     | Produção   | Manual              | Blue-green slot switch |

---

## Rollback automático de staging

O job `deploy:rollback:staging` é acionado automaticamente sempre que
`smoke:staging` falha (`when: on_failure`). Ele reverte ambos os deployments
para a revisão anterior via `kubectl rollout undo`.

**Você não precisa fazer nada.** O pipeline cuida do rollback sozinho.

### O que o job faz

```bash
kubectl -n axiom-staging rollout undo deployment/api
kubectl -n axiom-staging rollout undo deployment/frontend
kubectl -n axiom-staging rollout status deployment/api --timeout=120s
kubectl -n axiom-staging rollout status deployment/frontend --timeout=60s
```

---

## Rollback manual de staging

Use o job `rollback:staging` quando precisar reverter o ambiente de staging
**fora de uma falha de smoke test** — por exemplo, após detectar um bug nos
testes de carga ou nos testes E2E.

### Como acionar

1. Acesse o pipeline no GitLab (**CI/CD → Pipelines → pipeline em questão**).
2. Localize o stage `smoke-staging`.
3. Clique no job `rollback:staging` (ícone de play manual).
4. Confirme o acionamento.

### O que o job faz

Idêntico ao rollback automático — reverte `deployment/api` e
`deployment/frontend` no namespace `axiom-staging` para a revisão
Kubernetes anterior.

### Verificação pós-rollback

```bash
# Confirmar que os pods estão Running
kubectl -n axiom-staging get pods

# Confirmar a revisão ativa
kubectl -n axiom-staging rollout history deployment/api
kubectl -n axiom-staging rollout history deployment/frontend

# Re-executar os smoke tests manualmente
curl -s -o /dev/null -w "%{http_code}" https://staging.example.com/health/
curl -s -o /dev/null -w "%{http_code}" https://staging.example.com/ready/
```

---

## Rollback automático de produção

O job `deploy:rollback:production` é acionado automaticamente quando
`smoke:production` falha. A produção usa deploy **blue-green**, portanto o
rollback funciona diferente do staging: em vez de `rollout undo`, o tráfego
é redirecionado de volta ao slot anterior (que permanece em 0 réplicas após
o deploy) e o slot recém-implantado é escalado para 0.

**Você não precisa fazer nada.** O pipeline cuida do rollback sozinho.

### O que o job faz

1. Lê o slot ativo atual do `api-service` (blue ou green).
2. Escala o slot anterior para 1 réplica e aguarda readiness.
3. Atualiza o selector do Service para apontar para o slot anterior.
4. Escala o slot recém-implantado para 0 réplicas.
5. Desfaz o deployment do frontend via `kubectl rollout undo`.

---

## Rollback manual de produção

Use o job `rollback:production` quando precisar reverter a produção
**após um deploy bem-sucedido** — por exemplo, após detectar um problema
funcional que os smoke tests não cobriram.

> **Atenção:** Este job afeta diretamente o ambiente de produção.
> Confirme com a equipe antes de acionar.

### Como acionar

1. Acesse o pipeline no GitLab (**CI/CD → Pipelines → pipeline em questão**).
2. Localize o stage `smoke-production`.
3. Clique no job `rollback:production` (ícone de play manual).
4. Confirme o acionamento.

### O que o job faz

Usa a mesma lógica do rollback automático:

```bash
# Determina o slot ativo
CURRENT_SLOT=$(kubectl -n axiom get svc api-service \
  -o jsonpath='{.spec.selector.slot}')

# Escala o slot anterior, redireciona o tráfego, escala o atual para 0
kubectl -n axiom scale deployment/api-$ROLLBACK_SLOT --replicas=1
kubectl -n axiom patch svc api-service \
  --type=merge \
  -p '{"spec":{"selector":{"app":"api","slot":"$ROLLBACK_SLOT"}}}'
kubectl -n axiom scale deployment/api-$CURRENT_SLOT --replicas=0

# Reverte o frontend
kubectl -n axiom rollout undo deployment/frontend
```

### Verificação pós-rollback

```bash
# Confirmar que o slot correto está recebendo tráfego
kubectl -n axiom get svc api-service \
  -o jsonpath='{.spec.selector.slot}'

# Confirmar que os pods do slot ativo estão Running
kubectl -n axiom get pods -l app=api

# Re-executar smoke checks manualmente
curl -s -o /dev/null -w "%{http_code}" https://example.com/health/
curl -s -o /dev/null -w "%{http_code}" https://example.com/ready/
```

---

## Rollback de emergência sem pipeline

Se o pipeline não estiver disponível e for necessário rollback imediato
via `kubectl` direto:

### Staging

```bash
kubectl -n axiom-staging rollout undo deployment/api
kubectl -n axiom-staging rollout undo deployment/frontend
kubectl -n axiom-staging rollout status deployment/api --timeout=120s
kubectl -n axiom-staging rollout status deployment/frontend --timeout=60s
```

### Produção (blue-green)

```bash
# 1. Identificar o slot ativo
CURRENT_SLOT=$(kubectl -n axiom get svc api-service \
  -o jsonpath='{.spec.selector.slot}')
echo "Slot ativo: $CURRENT_SLOT"

# 2. Determinar o slot de rollback
if [ "$CURRENT_SLOT" = "blue" ]; then ROLLBACK_SLOT="green"; else ROLLBACK_SLOT="blue"; fi

# 3. Escalar o slot de rollback
kubectl -n axiom scale deployment/api-$ROLLBACK_SLOT --replicas=1
kubectl -n axiom rollout status deployment/api-$ROLLBACK_SLOT --timeout=120s

# 4. Redirecionar o tráfego
kubectl -n axiom patch svc api-service \
  --type=merge \
  -p "{\"spec\":{\"selector\":{\"app\":\"api\",\"slot\":\"$ROLLBACK_SLOT\"}}}"

# 5. Escalar o slot problemático para 0
kubectl -n axiom scale deployment/api-$CURRENT_SLOT --replicas=0

# 6. Reverter o frontend
kubectl -n axiom rollout undo deployment/frontend
kubectl -n axiom rollout status deployment/frontend --timeout=60s
```

---

## Diagnóstico rápido

```bash
# Ver histórico de revisões
kubectl -n axiom rollout history deployment/api
kubectl -n axiom rollout history deployment/frontend

# Ver qual imagem está rodando em cada slot (produção)
kubectl -n axiom get deployment api-blue \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl -n axiom get deployment api-green \
  -o jsonpath='{.spec.template.spec.containers[0].image}'

# Ver eventos recentes do namespace
kubectl -n axiom get events --sort-by='.lastTimestamp' | tail -20
```

---

## Variáveis de CI/CD necessárias

| Variável           | Descrição                                              |
|--------------------|--------------------------------------------------------|
| `KUBECONFIG_CONTENT` | kubeconfig em base64 com acesso aos dois namespaces  |
| `STAGING_URL`      | URL pública do staging (usada para links no GitLab)    |
| `PRODUCTION_URL`   | URL pública da produção (usada para links no GitLab)   |

Consulte o [Guia de Deploy](deploy.md) para instruções de geração do
`KUBECONFIG_CONTENT`.
