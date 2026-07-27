# Documentação de Backups e Observabilidade

Esta seção documenta a estratégia de backup do PostgreSQL/MinIO e a stack de
observabilidade (Prometheus + Grafana + alertas) do Axiom, revisadas e
validadas ponta a ponta após a reorganização do monorepo (`refactor/restructure-monorepo-layout`).

## Arquivos Disponíveis

### [backup-strategy.md](backup-strategy.md)
Pipeline de backup (Docker Compose e Kubernetes CronJob), RPO/RTO, rotação de
chave de criptografia, verificação de integridade, health checks e o
histórico de problemas encontrados/corrigidos na revisão de 2026-07.

### [monitoring.md](monitoring.md)
Métricas Prometheus expostas pela API (django-prometheus + métricas de
negócio customizadas), dashboards Grafana, regras de alerta e o histórico de
problemas encontrados/corrigidos na mesma revisão.

### [incident-ci-minio-firewall.md](incident-ci-minio-firewall.md)
Post-mortem do job `test:backup-restore` (#18855) falhando por timeout ao
acessar o MinIO — causa raiz era uma regra de firewall (UFW) que não cobria
o pool de redes efêmeras Docker usado pelo GitLab Runner, e a correção
aplicada na VPS.
