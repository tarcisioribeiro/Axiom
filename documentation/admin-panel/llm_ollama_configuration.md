# Configuração LLM / Ollama

O sistema de agentes do Axiom (`api/agents/`) suporta dois provedores de LLM: **Ollama** (local, privado) e **Anthropic Claude** (nuvem). O provedor ativo é controlado pela chave `LLM_PROVIDER` no painel admin.

## Índice

- [Visão Geral](#visão-geral)
- [Referência de Configurações](#referência-de-configurações)
- [Configurando Ollama (local)](#configurando-ollama-local)
  - [Como o Ollama Funciona](#como-o-ollama-funciona)
  - [Puxando Modelos](#puxando-modelos)
  - [Escolhendo o Modelo de Chat](#escolhendo-o-modelo-de-chat)
  - [Escolhendo o Modelo de Embedding](#escolhendo-o-modelo-de-embedding)
  - [Requisitos de Hardware](#requisitos-de-hardware)
  - [Valores para o Painel Admin](#valores-para-o-painel-admin-ollama)
- [Configurando Anthropic Claude (nuvem)](#configurando-anthropic-claude-nuvem)
  - [Obtendo a Chave de API](#obtendo-a-chave-de-api)
  - [Escolhendo o Modelo Claude](#escolhendo-o-modelo-claude)
  - [Valores para o Painel Admin](#valores-para-o-painel-admin-anthropic)
- [Verificando a Configuração](#verificando-a-configuração)
- [Monitoramento dos Agentes](#monitoramento-dos-agentes)
- [Solução de Problemas](#solução-de-problemas)

---

## Visão Geral

| Provedor | Privacidade | Custo | Latência | Qualidade |
|----------|-------------|-------|----------|-----------|
| **Ollama** | ✅ Total (local) | ✅ Gratuito | Depende do hardware | Boa a excelente (modelos 7B–13B) |
| **Anthropic Claude** | ⚠️ Dados enviados à Anthropic | 💰 Por token | Baixa (rede) | Excelente |

**Use Ollama quando**: privacidade dos dados financeiros for prioridade ou você quiser custo zero.
**Use Anthropic quando**: precisar da melhor qualidade de resposta possível e a latência for crítica.

---

## Referência de Configurações

| Chave | Label no Painel | Secret | Requer Restart | Padrão |
|-------|----------------|--------|----------------|--------|
| `LLM_PROVIDER` | Provedor LLM | Não | **Sim** | `ollama` |
| `OLLAMA_BASE_URL` | URL do Ollama | Não | Não | `http://ollama:11434` |
| `OLLAMA_MODEL` | Modelo Ollama (Chat) | Não | Não | — |
| `OLLAMA_EMBED_MODEL` | Modelo Ollama (Embedding) | Não | Não | — |
| `LLM_TIMEOUT_CHAT` | Timeout Chat (segundos) | Não | Não | `120` |
| `LLM_TIMEOUT_EMBED` | Timeout Embedding (segundos) | Não | Não | `30` |
| `ANTHROPIC_API_KEY` | Chave API Anthropic 🔒 | **Sim** | Não | — |
| `ANTHROPIC_MODEL` | Modelo Anthropic | Não | Não | — |

> 🔒 `ANTHROPIC_API_KEY` é armazenada criptografada e exibida como `••••••••`.

### Descrição detalhada de cada chave

**`LLM_PROVIDER`**
Define qual provedor o sistema de agentes usa.
- `ollama` — usa instância local do Ollama; as chaves `ANTHROPIC_*` são ignoradas.
- `anthropic` — usa a API do Claude; as chaves `OLLAMA_*` são ignoradas.
- **Requer restart** para propagar ao processo Django.

**`OLLAMA_BASE_URL`**
Endereço HTTP do servidor Ollama. Dentro do Docker Compose, o service name é `ollama`, portanto o padrão `http://ollama:11434` funciona sem alteração. Para usar um Ollama instalado no host (fora do Docker), use `http://host.docker.internal:11434`.

**`OLLAMA_MODEL`**
Tag do modelo Ollama usado para geração de texto (chat). O modelo deve estar **previamente baixado** no Ollama. Exemplos: `mistral:7b-instruct`, `llama3:8b`, `gemma2:9b-instruct`.

**`OLLAMA_EMBED_MODEL`**
Tag do modelo Ollama usado para gerar embeddings vetoriais (necessário para o RAG — busca semântica sobre documentos financeiros). Exemplos: `nomic-embed-text`, `mxbai-embed-large`.

**`LLM_TIMEOUT_CHAT`**
Segundos de espera máxima por uma resposta de chat antes de abortar com erro. Padrão: `120`. Em hardware mais lento (CPU only), aumente para `300` ou mais.

**`LLM_TIMEOUT_EMBED`**
Segundos de espera máxima por um embedding. Padrão: `30`. Embeddings são mais rápidos que chat; raramente precisa ser aumentado.

**`ANTHROPIC_API_KEY`**
Chave secreta da API Anthropic. Obrigatória quando `LLM_PROVIDER=anthropic`. Começa com `sk-ant-api03-`. Armazenada criptografada no banco.

**`ANTHROPIC_MODEL`**
ID do modelo Claude a utilizar. Os IDs são versionados e mudam periodicamente; consulte sempre a [documentação oficial](https://docs.anthropic.com/en/docs/about-claude/models) para o modelo mais recente recomendado. Exemplos: `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`.

---

## Configurando Ollama (local)

### Como o Ollama Funciona

Ollama é um runtime que serve modelos de linguagem localmente via HTTP. O Axiom se comunica com ele em duas situações:

1. **Chat** (`/api/chat`): o agente envia o histórico da conversa e recebe uma resposta gerada.
2. **Embeddings** (`/api/embeddings`): o sistema converte texto em vetores numéricos para busca semântica (RAG sobre transações e documentos).

O Docker Compose inclui um service `ollama` que inicia o servidor automaticamente. Os modelos precisam ser baixados separadamente — eles não vêm pré-instalados.

### Puxando Modelos

```bash
# Verificar se o serviço está rodando
docker compose ps ollama

# Baixar o modelo de chat (escolha um — ver tabela abaixo)
docker compose exec ollama ollama pull mistral:7b-instruct

# Baixar o modelo de embedding (obrigatório para RAG)
docker compose exec ollama ollama pull nomic-embed-text

# Listar modelos disponíveis localmente
docker compose exec ollama ollama list
```

A primeira execução baixa os pesos do modelo (~4–6 GB por modelo de 7B). As execuções seguintes usam o cache local.

### Escolhendo o Modelo de Chat

| Modelo | Tamanho | RAM necessária | Características |
|--------|---------|---------------|----------------|
| `mistral:7b-instruct` | 4,1 GB | 8 GB | Equilibrio entre qualidade e velocidade; bom para português |
| `llama3:8b` | 4,7 GB | 10 GB | Forte em raciocínio; boa compreensão de contexto |
| `gemma2:9b-instruct` | 5,4 GB | 12 GB | Modelo Google; preciso em instruções |
| `llama3:70b` | 40 GB | 48 GB | Qualidade próxima ao GPT-4; requer hardware dedicado |

> **Recomendação para desenvolvimento**: `mistral:7b-instruct` — funciona bem em laptops com 16 GB de RAM.
>
> **Recomendação para produção**: `llama3:8b` em máquina com GPU ou `llama3:70b` em servidor dedicado.

### Escolhendo o Modelo de Embedding

| Modelo | Tamanho | Dimensões | Características |
|--------|---------|-----------|----------------|
| `nomic-embed-text` | 274 MB | 768 | Leve, rápido, boa qualidade geral — **recomendado** |
| `mxbai-embed-large` | 670 MB | 1024 | Maior precisão semântica; mais lento |
| `all-minilm` | 46 MB | 384 | Mínimo; adequado para texto curto |

> O modelo de embedding **precisa estar alinhado** com os vetores já armazenados no pgvector. Se trocar o modelo, os embeddings existentes no banco ficarão inconsistentes e a busca semântica retornará resultados ruins. Nesse caso, rode um script de re-indexação ou limpe a tabela de embeddings.

### Requisitos de Hardware

| Configuração | Modelos suportados | Observação |
|---|---|---|
| 8 GB RAM, CPU only | Até 7B params | Latência ~15–60 s por resposta |
| 16 GB RAM, CPU only | Até 8B params | Latência ~10–30 s por resposta |
| 16 GB RAM + GPU 8 GB VRAM | Até 7B (GPU) | Latência ~1–3 s por resposta |
| 32 GB RAM + GPU 24 GB VRAM | Até 13B (GPU) | Latência < 1 s por resposta |

Em ambiente sem GPU, aumente `LLM_TIMEOUT_CHAT` para `300` segundos para evitar timeouts.

### Valores para o Painel Admin (Ollama)

```
LLM_PROVIDER       = ollama
OLLAMA_BASE_URL    = http://ollama:11434
OLLAMA_MODEL       = mistral:7b-instruct
OLLAMA_EMBED_MODEL = nomic-embed-text
LLM_TIMEOUT_CHAT   = 120
LLM_TIMEOUT_EMBED  = 30
```

---

## Configurando Anthropic Claude (nuvem)

### Obtendo a Chave de API

1. Acesse [console.anthropic.com](https://console.anthropic.com) e faça login (ou crie uma conta).
2. No menu lateral, clique em **API Keys**.
3. Clique em **Create Key**, dê um nome (ex: `Axiom Production`) e confirme.
4. **Copie a chave imediatamente** — ela só é exibida uma vez. Começa com `sk-ant-api03-`.
5. Guarde em local seguro (gerenciador de senhas ou secret manager).

> **⚠️ Segurança**: nunca commite a chave em código. O painel admin armazena o valor criptografado no banco de dados.

### Escolhendo o Modelo Claude

Os IDs de modelo mudam com cada nova versão. Consulte sempre a [página oficial de modelos](https://docs.anthropic.com/en/docs/about-claude/models) para os IDs mais recentes. Referência em Abril de 2026:

| Modelo | ID | Características |
|--------|-----|----------------|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Melhor equilíbrio qualidade/velocidade/custo — **recomendado** |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Mais rápido e barato; boa qualidade para tarefas simples |
| Claude Opus 4.7 | `claude-opus-4-7` | Máxima qualidade; mais lento e caro |

### Valores para o Painel Admin (Anthropic)

```
LLM_PROVIDER      = anthropic
ANTHROPIC_API_KEY = sk-ant-api03-...   (cole a chave copiada)
ANTHROPIC_MODEL   = claude-sonnet-4-6
```

Com `LLM_PROVIDER=anthropic`, as chaves `OLLAMA_*` são ignoradas. O Ollama pode permanecer rodando sem impacto.

---

## Verificando a Configuração

### Status dos agentes

```bash
curl http://localhost:39100/api/v1/admin/agents/status/ \
  -b "access_token=<seu_token>" | python -m json.tool
```

Resposta esperada com Ollama:

```json
{
  "provider": "ollama",
  "ollama": {
    "base_url": "http://ollama:11434",
    "model": "mistral:7b-instruct",
    "embed_model": "nomic-embed-text",
    "connectivity": {
      "status": "healthy",
      "message": "2 modelo(s) disponível(is)",
      "models": ["mistral:7b-instruct", "nomic-embed-text"]
    }
  },
  "anthropic": {
    "model": "",
    "api_key_configured": false
  },
  "total_conversations": 42,
  "timeout_chat": 120,
  "timeout_embed": 30
}
```

Resposta esperada com Anthropic:

```json
{
  "provider": "anthropic",
  "ollama": {"base_url": "", "model": "", "embed_model": "", "connectivity": {"status": "not_active"}},
  "anthropic": {
    "model": "claude-sonnet-4-6",
    "api_key_configured": true
  }
}
```

### Verificação de conectividade via health check

```bash
curl http://localhost:39100/api/v1/admin/health/ \
  -b "access_token=<seu_token>" | python -m json.tool | grep -A 4 '"ollama"'
```

---

## Monitoramento dos Agentes

O endpoint `/api/v1/admin/agents/status/` retorna em tempo real:

- **`provider`**: qual provedor está ativo (`ollama` ou `anthropic`)
- **`ollama.connectivity.models`**: lista de modelos disponíveis no Ollama
- **`anthropic.api_key_configured`**: se a chave Anthropic está preenchida
- **`total_conversations`**: total de conversas registradas no banco

Para verificar o histórico de uso dos agentes:

```bash
# Listar conversas recentes (via Django shell)
docker compose exec api python manage.py shell -c "
from agents.models import AgentConversation
for c in AgentConversation.objects.order_by('-created_at')[:5]:
    print(c.id, c.user, c.created_at)
"
```

---

## Solução de Problemas

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| `ollama: "Inacessível"` no health check | Container Ollama não está rodando | `docker compose up -d ollama` |
| `0 modelo(s) disponível(is)` | Nenhum modelo foi baixado | `docker compose exec ollama ollama pull mistral:7b-instruct` |
| Timeout nas respostas de chat | Hardware lento ou modelo muito grande | Aumente `LLM_TIMEOUT_CHAT`; use um modelo menor |
| `ANTHROPIC_API_KEY inválida (401)` | Chave errada ou revogada | Crie uma nova chave no Console Anthropic |
| `model not found` no log do Ollama | `OLLAMA_MODEL` tem uma tag não baixada | Verifique o nome com `ollama list`; puxe com `ollama pull` |
| Resultados de busca semântica ruins | Modelo de embedding trocado sem re-indexar | Recrie os embeddings ou volte ao modelo anterior |
| `LLM_PROVIDER` não mudou após salvar | A chave requer restart | `docker compose restart api` |
