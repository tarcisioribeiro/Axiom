# Infraestrutura de LLM (Ollama externo)

Este documento descreve onde e como o Ollama de produção e staging roda, por
que ele está fora do cluster Kubernetes, o runbook de instalação, e como
configurar os providers cloud de fallback (Groq/Anthropic/OpenAI). Ver também
[`documentation/architecture/agents-llm-boundary.md`](../architecture/agents-llm-boundary.md)
para as fronteiras de código do módulo `agents/`.

## Topologia

O Ollama **não roda dentro do cluster k3s**. Ele roda self-managed, fora do
cluster — mesma filosofia adotada para o PostgreSQL e o MinIO (veja
[documentation/database/infrastructure.md](../database/infrastructure.md) e
[documentation/storage/infrastructure.md](../storage/infrastructure.md)).
Isso reduz o footprint de recursos do k3s (o Deployment do Ollama reservava
sozinho metade do `ResourceQuota` de memória do namespace — 4Gi
request/8Gi limit) e evita competir por CPU/RAM/GPU com os pods da aplicação.

Um único servidor Ollama pode atender produção e staging simultaneamente —
não há isolamento por bucket/database como em MinIO/Postgres, porque o
Ollama não guarda dados por usuário, só os modelos baixados. Se no futuro for
necessário isolar produção de staging, o caminho é o mesmo já documentado
para o Postgres: apontar `STAGING_OLLAMA_BASE_URL` para um host diferente de
`PRODUCTION_OLLAMA_BASE_URL` — nenhum arquivo do repositório precisa mudar.

A aplicação Django é agnóstica de onde o Ollama está — tudo é lido de
`OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_EMBED_MODEL` via variáveis de
ambiente. No k8s, `OLLAMA_BASE_URL` vem do Secret `axiom-secrets` (injetado a
partir das variáveis de CI/CD `STAGING_OLLAMA_BASE_URL`/
`PRODUCTION_OLLAMA_BASE_URL` — nunca commitado em arquivo); `OLLAMA_MODEL`/
`OLLAMA_EMBED_MODEL`/`LLM_PROVIDER` (não sensíveis) continuam no ConfigMap
`axiom-config`. Localmente, tudo vem do `.env` e aponta para o Ollama
containerizado do `docker-compose` — **isso não muda**: o
`docker-compose.yml` continua com um service `ollama` local para
desenvolvimento, só a topologia de staging/produção foi externalizada.

## Setup manual do host externo (runbook)

Passos executados uma única vez pelo administrador, no host que vai hospedar
o Ollama. Pode ser a mesma VPS que já hospeda o k3s/Postgres (mesma
abordagem hoje usada para o banco — veja
[documentation/database/infrastructure.md#topologia](../database/infrastructure.md)),
ou um host dedicado se os requisitos de GPU/RAM justificarem.

1. **Instalar o Ollama nativo** (não em container — o
   Deployment/imagem `ollama/ollama:latest` usados no k8s foram removidos):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
   Isso instala o binário e um serviço `systemd` (`ollama.service`) já
   habilitado.

2. **Expor a porta para conexões externas** (por padrão o Ollama só escuta em
   `localhost`). Edite o override do systemd:
   ```bash
   sudo systemctl edit ollama.service
   ```
   e adicione:
   ```ini
   [Service]
   Environment="OLLAMA_HOST=0.0.0.0:11434"
   ```
   depois:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart ollama
   ```

3. **Baixar os modelos** usados pelos agentes (os mesmos que antes eram
   puxados pelo entrypoint do Deployment removido):
   ```bash
   ollama pull mistral:7b-instruct
   ollama pull nomic-embed-text
   ```
   Modelos adicionais usados por agentes específicos (ver
   `apps/api/agents/agents/*.py` → atributo `ollama_model`) devem ser
   baixados também, ex.: `ollama pull qwen2.5:7b`, `ollama pull qwen2.5:14b`,
   `ollama pull llama3.1:8b`.

4. **Verificar**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

## Rede e segurança (runbook)

A conectividade entre o cluster k3s e o Ollama **não é resolvida
automaticamente por nenhum código deste repositório** — é uma etapa de
infraestrutura executada manualmente, na mesma linha do runbook de rede do
PostgreSQL (veja
[documentation/database/infrastructure.md#rede-e-segurança-runbook](../database/infrastructure.md)).

Se o Ollama rodar na mesma VPS que hospeda o k3s, os pods alcançam o Ollama
pelo IP público/hostname da VPS, sem necessidade de túnel adicional — mesmo
setup atual do Postgres. Se for movido para um host separado (ex.: uma
máquina com GPU dedicada), as mesmas duas opções descritas no doc do banco se
aplicam:

- **Túnel WireGuard** (recomendado se o IP público da VPS do cluster for
  dinâmico via DuckDNS — ver
  [dns_infrastructure.md](../development/dns_infrastructure.md)): a
  comunicação passa a usar os IPs fixos da interface `wg0`, imune a mudanças
  de IP público.
- **Allowlist de firewall**: só segura com IP fixo do lado do cluster
  (`ufw allow from <IP-fixo-do-cluster> to any port 11434 proto tcp` no host
  do Ollama).

Diferente do MinIO, o Ollama **não precisa de certificado TLS público** — não
é acessado diretamente pelo navegador, só pela API Django via rede
interna/túnel. `OLLAMA_BASE_URL` pode continuar em `http://`.

Ao expor `OLLAMA_HOST=0.0.0.0:11434`, a porta fica acessível a partir de
qualquer lugar que alcance o host, não só do cluster — vale a pena restringir
com `ufw`/`iptables` (permitir só a sub-rede de pods do k3s, tipicamente
`10.42.0.0/16` com Flannel, ou a sub-rede do túnel WireGuard) assim que a
rede for configurada.

## Variáveis de CI/CD

| Variável | Obrigatória | Descrição |
|---|---|---|
| `STAGING_OLLAMA_BASE_URL` / `PRODUCTION_OLLAMA_BASE_URL` | Sim | URL do host Ollama externo (ex.: `http://10.8.0.1:11434` via túnel WireGuard) |
| `STAGING_GROQ_API_KEY` / `PRODUCTION_GROQ_API_KEY` | Não (masked) | Chave da API Groq, fallback cloud |
| `STAGING_ANTHROPIC_API_KEY` / `PRODUCTION_ANTHROPIC_API_KEY` | Não (masked) | Chave da API Anthropic, fallback cloud |
| `STAGING_OPENAI_API_KEY` / `PRODUCTION_OPENAI_API_KEY` | Não (masked) | Chave da API OpenAI, fallback cloud |

`STAGING_OLLAMA_BASE_URL`/`PRODUCTION_OLLAMA_BASE_URL` são obrigatórias — os
jobs `deploy:staging`/`deploy:production` abortam se estiverem vazias (mesmo
guard usado para as variáveis do MinIO). As chaves de API cloud são
opcionais: ficam vazias no Secret se não configuradas, e `LLM_PROVIDER`
continua `ollama` por padrão.

## Fallback multi-provider

`LLM_PROVIDER` define o provider primário; `LLM_FALLBACK_PROVIDERS` (opcional,
lista separada por vírgula) define providers testados em ordem se o
primário falhar — ver `LLMClient._get_providers()` em
`apps/api/agents/core/llm_client.py`. Com o Ollama agora externo ao cluster
(um ponto de falha de rede a mais do que quando rodava no mesmo namespace),
convém configurar ao menos um fallback cloud:

```
LLM_PROVIDER = ollama
LLM_FALLBACK_PROVIDERS = groq,anthropic
```

O circuit breaker (`apps/api/agents/core/circuit_breaker.py`) só cobre o
Ollama: após um número de falhas consecutivas, passa a pular direto para o
próximo provider da lista (fast-fail) em vez de tentar o Ollama a cada
request e esperar o timeout. Os providers cloud (Groq/Anthropic/OpenAI) não
têm circuit breaker — falhas neles apenas avançam para o próximo item de
`LLM_FALLBACK_PROVIDERS` na mesma request.

Para configurar cada provider (obtenção de chave, modelos recomendados,
valores de exemplo para o painel admin), veja
[`documentation/admin-panel/llm_ollama_configuration.md`](../admin-panel/llm_ollama_configuration.md).

## Fora de escopo

- **Ambiente local (`docker-compose`)**: continua com um service `ollama`
  containerizado, sem nenhuma mudança — esta externalização é só para
  staging/produção no k3s.
- **GPU/aceleração de hardware**: fora do escopo deste documento; ver a
  documentação oficial do Ollama para configurar acesso a GPU no host
  externo, se necessário.
