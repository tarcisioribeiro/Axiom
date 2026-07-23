# Documentação de Storage

Esta seção contém a documentação completa sobre a camada de storage (MinIO)
do Axiom.

## Arquivos Disponíveis

### [infrastructure.md](infrastructure.md)
Topologia e operação do MinIO de produção/staging:
- MinIO externo ao cluster k8s (host auto-gerenciado)
- Setup manual do host (instalação, buckets, CORS, TLS)
- Runbook de rede/segurança (mesmo padrão do PostgreSQL)
- Referência de `MINIO_USE_SSL`
- Procedimento completo de backup e restore
- Estrutura do módulo Django (`apps/api/storage/`)
