# Métricas, Dashboards e Alertas

## Stack

- **Instrumentação**: `django-prometheus`, expõe `/metrics` (ver
  `app/urls.py`, montado via `django_prometheus.urls`).
- **Métricas de negócio/LLM/agentes**: `app/metrics.py` — Counters/Gauges/
  Histograms customizados (`axiom_expenses_created_total`,
  `axiom_llm_requests_total`, `axiom_agent_routing_decisions_total` etc.),
  incrementados por funções `record_*()` chamadas a partir de signals
  (`expenses/signals.py`, `revenues/signals.py`), `webhooks/tasks.py` e
  `agents/core/`.
- **Coleta**: `infra/k8s/monitoring/prometheus.yaml` — Prometheus roda no
  namespace `monitoring`, descobre a API via anotações
  `prometheus.io/scrape` no `Service` `axiom` (namespace `axiom`, produção).
  Staging **não** é raspado — o overlay de staging remove a
  `NetworkPolicy allow-prometheus-scrape` de propósito
  (`patches/network-policy-remove-prometheus.yaml`), consistente com o
  `prometheus.yaml` só listar o namespace `axiom` no `kubernetes_sd_configs`.
- **Visualização**: `infra/k8s/monitoring/grafana.yaml` — dashboard
  "Axiom Django API" com 5 painéis (request rate, error rate, DB query rate,
  cache hit ratio, latência p50/p95/p99).
- **Alertas**: regras Prometheus embutidas no mesmo `ConfigMap` de
  `prometheus.yaml` (`HighHttpErrorRate`, `PodRestartingFrequently`,
  `DiskUsageHigh`). Ainda não há `Alertmanager` implantado — a seção
  `alerting.alertmanagers` está vazia (`targets: []`); os alertas ficam
  visíveis na UI do Prometheus (`ALERTS`) mas não são roteados a
  Slack/email/PagerDuty ainda.

## Revisão de 2026-07 — problemas encontrados e corrigidos

Validação manual do `/metrics` (via Docker Compose, 4 workers Gunicorn)
encontrou três problemas que tornavam boa parte do dashboard e dos alertas
não confiáveis, apesar de tudo parecer "funcionando" à primeira vista:

1. **Sem modo multiprocess do `prometheus_client` com Gunicorn multi-worker**
   (`GUNICORN_WORKERS=4` por padrão em Compose e produção, `2` em staging).
   Sem `PROMETHEUS_MULTIPROC_DIR`, cada worker Gunicorn mantém seu próprio
   registro Prometheus em memória; cada scrape em `/metrics` só reflete o
   worker que respondeu àquela requisição específica — não o total real.
   Isso quebra qualquer `rate()`/`sum()` que dependa de um contador
   monotonicamente crescente por pod, incluindo o alerta `HighHttpErrorRate`
   e os painéis de request rate/error rate/latência do Grafana. Corrigido:
   - `apps/api/gunicorn.conf.py` (novo) — hooks `on_starting` (limpa o
     diretório multiproc de gerações anteriores do processo) e `child_exit`
     (libera os arquivos de um worker quando ele é reciclado).
   - `apps/api/entrypoint.sh` — exporta `PROMETHEUS_MULTIPROC_DIR` (default
     `/tmp/prometheus-multiproc`) e passa `--config /app/gunicorn.conf.py`
     ao Gunicorn.
   - `django_prometheus.exports.ExportToDjangoView` detecta a env var
     automaticamente e troca para `MultiProcessCollector` — nenhuma mudança
     adicional foi necessária no lado Django.
   - Validado: 30 requisições disparadas com round-robin entre os 4 workers
     fizeram o contador em `/metrics` subir de 28 → 60 (batendo com o total
     real), e `/tmp/prometheus-multiproc/` passou a conter um arquivo
     `counter_<pid>.db`/`histogram_<pid>.db` por worker.

2. **`DATABASES`/`CACHES` usando os backends "puros" em vez dos
   instrumentados pelo `django-prometheus`** (`app/settings.py`). O painel
   "Database Query Rate" (`django_db_execute_total`) e "Cache Hit Ratio"
   (`django_cache_get_hits_total` / `django_cache_get_total`) sempre
   mostravam "sem dados" — essas métricas não existiam de jeito nenhum,
   independente de tráfego. Corrigido trocando:
   - `DATABASES["default"]["ENGINE"]`: `django.db.backends.postgresql` →
     `django_prometheus.db.backends.postgresql` (wrapper compatível, mesmo
     comportamento de conexão).
   - `CACHES["default"]["BACKEND"]`: `django_redis.cache.RedisCache` →
     `django_prometheus.cache.backends.redis.RedisCache` (subclasse direta
     de `django_redis.cache.RedisCache`, compatível com as mesmas `OPTIONS`).
   - Testes usam SQLite/locmem (branch `_TESTING`), não afetados.
   - Validado: `django_db_execute_total{alias="default",vendor="postgresql"}`
     e `django_cache_get_hits_total{backend="redis"}` passaram a aparecer em
     `/metrics` após uma requisição simples.

3. **Painel de latência do Grafana usando nome de métrica errado**. A query
   referenciava `django_http_requests_latency_seconds_bucket`, que não
   existe — o `django-prometheus` expõe
   `django_http_requests_latency_including_middlewares_seconds_bucket` (fim
   a fim, incluindo middlewares) ou
   `django_http_requests_latency_seconds_by_view_method_bucket` (com labels
   `view`/`method`). Corrigido as 3 queries (p50/p95/p99) em
   `infra/k8s/monitoring/grafana.yaml` para usar a métrica
   `_including_middlewares_` (equivalente ao que o painel já pretendia medir:
   latência de ponta a ponta).

**Observação sobre métricas de negócio** (`app/metrics.py`): os `record_*()`
são importados **dentro** das funções de signal (import local, não no topo do
módulo) para evitar import cíclico. Isso significa que os
`Counter`/`Gauge`/`Histogram` só são registrados no processo Gunicorn na
primeira vez que a ação correspondente ocorre (ex.: `axiom_expenses_created_total`
só aparece em `/metrics` depois da primeira despesa criada *naquele worker*).
Isso é aceitável para métricas ainda não observadas, mas é bom saber que "não
aparece em `/metrics`" não significa necessariamente "quebrado" — pode
simplesmente não ter sido acionado ainda naquele worker.

## Comandos úteis

```bash
# Ver todas as métricas expostas
curl -s http://localhost:39100/metrics

# Filtrar métricas de negócio da Axiom
curl -s http://localhost:39100/metrics | grep ^axiom_

# Confirmar agregação multiprocess (deve haver 1 par counter/histogram .db por worker)
docker exec axiom-api ls /tmp/prometheus-multiproc/
```
