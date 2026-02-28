# Decisões Arquiteturais

## Introdução

Este documento registra as principais decisões arquiteturais tomadas durante o desenvolvimento do MindLedger, suas justificativas, alternativas consideradas e trade-offs. Compreender essas decisões é fundamental para manter a coerência do sistema e tomar decisões futuras alinhadas com a filosofia do projeto.

## Índice de Decisões

1. [Monorepo vs. Múltiplos Repositórios](#1-monorepo-vs-múltiplos-repositórios)
2. [Django REST Framework vs. FastAPI](#2-django-rest-framework-vs-fastapi)
3. [React vs. Vue vs. Angular](#3-react-vs-vue-vs-angular)
4. [TypeScript vs. JavaScript](#4-typescript-vs-javascript)
5. [PostgreSQL vs. MySQL vs. MongoDB](#5-postgresql-vs-mysql-vs-mongodb)
6. [JWT em Cookies HttpOnly vs. LocalStorage](#6-jwt-em-cookies-httponly-vs-localstorage)
7. [Zustand vs. Redux vs. Context API](#7-zustand-vs-redux-vs-context-api)
8. [Embeddings Locais vs. API Externa](#8-embeddings-locais-vs-api-externa)
9. [Soft Delete vs. Hard Delete](#9-soft-delete-vs-hard-delete)
10. [Criptografia Simétrica (Fernet) vs. Assimétrica](#10-criptografia-simétrica-fernet-vs-assimétrica)
11. [Service Layer Pattern vs. Direct API Calls](#11-service-layer-pattern-vs-direct-api-calls)
12. [Docker Compose vs. Kubernetes](#12-docker-compose-vs-kubernetes)
13. [Versionamento de API por URL vs. Header](#13-versionamento-de-api-por-url-vs-header)
14. [Apps Django Modulares vs. App Monolítico](#14-apps-django-modulares-vs-app-monolítico)
15. [Groq vs. OpenAI vs. Modelos Locais](#15-groq-vs-openai-vs-modelos-locais)

---

## 1. Monorepo vs. Múltiplos Repositórios

### Decisão

**Escolhido**: Monorepo

### Contexto

O MindLedger possui backend e frontend fortemente acoplados, com contratos de API que precisam evoluir em sincronia.

### Alternativas Consideradas

1. **Monorepo** (escolhido)
2. **Repositórios separados**: Um para backend, um para frontend
3. **Submodules Git**: Frontend como submódulo do backend

### Justificativa

**Vantagens do Monorepo**:
- Mudanças na API e frontend podem ser commitadas atomicamente
- Refatorações são mais seguras (mudança na API + adaptação no frontend em um commit)
- Onboarding simplificado (clone único)
- Compartilhamento de documentação e configurações
- CI/CD simplificado

**Desvantagens**:
- Repositório maior
- Builds podem ser mais lentos
- Necessita estratégia de versionamento clara

**Por que não repositórios separados?**
- Sincronização manual entre repos
- Refatorações em duas etapas (backend primeiro, depois frontend)
- Duplicação de documentação
- Complexidade no versionamento

### Decisões Futuras

Se o projeto crescer significativamente (ex: aplicativo mobile, admin separado), considerar migração para monorepo com ferramentas especializadas (Nx, Turborepo) ou separação estratégica.

---

## 2. Django REST Framework vs. FastAPI

### Decisão

**Escolhido**: Django REST Framework (DRF)

### Contexto

Necessidade de um framework backend Python robusto para API REST com ORM, admin panel e autenticação.

### Alternativas Consideradas

1. **Django REST Framework** (escolhido)
2. **FastAPI**: Framework moderno, assíncrono, com tipagem Pydantic
3. **Flask + Flask-RESTful**: Micro-framework minimalista

### Justificativa

**Vantagens do DRF**:
- ORM Django maduro e poderoso
- Sistema de autenticação e permissões integrado
- Admin panel automático para gestão de dados
- Serializers robustos para validação
- Ecosystem rico (extensions, packages)
- Documentação extensiva
- Suporte a migrations automáticas

**Vantagens do FastAPI (não escolhido)**:
- Performance superior (assíncrono)
- Documentação OpenAPI automática
- Validação com Pydantic

**Por que não FastAPI?**
- Projeto não tem requisitos de alta concorrência
- DRF oferece mais "batteries included"
- Admin panel do Django é valiosíssimo para debugging
- Ecossistema mais maduro para funcionalidades necessárias

### Trade-offs Aceitos

- Menor performance (síncrono vs. assíncrono)
- Footprint maior (Django é mais pesado)

**Quando reconsiderar?**
- Se houver necessidade de WebSockets ou long-polling
- Se performance se tornar gargalo
- Se houver necessidade de microserviços

---

## 3. React vs. Vue vs. Angular

### Decisão

**Escolhido**: React 18

### Contexto

Necessidade de framework frontend moderno para construir SPA responsiva.

### Alternativas Consideradas

1. **React** (escolhido)
2. **Vue 3**: Framework progressivo, mais fácil de aprender
3. **Angular**: Framework completo, opinativo
4. **Svelte**: Compilador, sem virtual DOM

### Justificativa

**Vantagens do React**:
- Ecossistema enorme (bibliotecas, componentes, tutoriais)
- Comunidade muito ativa
- Flexibilidade para escolher bibliotecas complementares
- Excelente integração com TypeScript
- Hooks modernos para lógica reutilizável
- React Router v7 é robusto
- Mercado de trabalho valoriza React

**Por que não Vue?**
- Menor ecossistema comparado ao React
- Menos opções de bibliotecas UI prontas

**Por que não Angular?**
- Muito opinativo e pesado
- Curva de aprendizado maior
- Overkill para o tamanho do projeto

### Trade-offs Aceitos

- Necessidade de escolher bibliotecas (state management, routing, etc.)
- Bundle size maior que Svelte
- Virtual DOM overhead

---

## 4. TypeScript vs. JavaScript

### Decisão

**Escolhido**: TypeScript

### Contexto

Desenvolvimento de frontend complexo com múltiplos tipos de dados e interações com API.

### Alternativas Consideradas

1. **TypeScript** (escolhido)
2. **JavaScript puro com JSDoc**: Comentários de tipo
3. **JavaScript + PropTypes**: Validação em runtime

### Justificativa

**Vantagens do TypeScript**:
- Detecção de erros em tempo de desenvolvimento
- Autocomplete e IntelliSense melhores
- Refatorações mais seguras
- Contratos de API fortemente tipados
- Documentação implícita via tipos
- Melhor experiência de desenvolvimento

**Por que não JavaScript puro?**
- Erros de tipo só descobertos em runtime
- Refatorações arriscadas
- Menos suporte de IDE

### Trade-offs Aceitos

- Necessidade de compilação (mas Vite já compila)
- Curva de aprendizado (mas vale a pena)
- Alguns tipos complexos podem ser verbosos

**Decisão Complementar**: Usar Zod para validação em runtime (dupla camada de segurança)

---

## 5. PostgreSQL vs. MySQL vs. MongoDB

### Decisão

**Escolhido**: PostgreSQL 16 com extensão pgvector

### Contexto

Necessidade de banco de dados relacional com suporte a busca vetorial para AI Assistant.

### Alternativas Consideradas

1. **PostgreSQL + pgvector** (escolhido)
2. **MySQL**: Banco relacional popular
3. **MongoDB**: Banco NoSQL orientado a documentos
4. **PostgreSQL + Pinecone/Weaviate**: Banco vetorial especializado separado

### Justificativa

**Vantagens do PostgreSQL**:
- Banco relacional robusto e confiável
- **pgvector**: Extensão nativa para busca vetorial
- JSONB para dados semi-estruturados
- Full-text search nativo
- Constraints e validações rígidas
- Excelente performance
- Suporte Django maduro

**Por que não MySQL?**
- Sem extensão equivalente ao pgvector
- Menos features avançadas (JSONB, arrays, etc.)

**Por que não MongoDB?**
- Dados são majoritariamente estruturados e relacionais
- Perda de integridade referencial
- Não se beneficia de schema flexível

**Por que não banco vetorial separado?**
- Complexidade adicional (dois bancos)
- Custo adicional (Pinecone é pago)
- pgvector suficiente para escala atual

### Trade-offs Aceitos

- pgvector não é tão otimizado quanto bancos vetoriais especializados
- Performance de busca vetorial em grandes escalas pode ser limitada

**Quando reconsiderar?**
- Se volume de embeddings ultrapassar 1 milhão
- Se latência de busca se tornar problema
- Se precisar de features avançadas (ANN, HNSW otimizados)

---

## 6. JWT em Cookies HttpOnly vs. LocalStorage

### Decisão

**Escolhido**: JWT armazenado em cookies HttpOnly

### Contexto

Necessidade de autenticação segura com proteção contra XSS e CSRF.

### Alternativas Consideradas

1. **Cookies HttpOnly** (escolhido)
2. **LocalStorage**: Armazenamento no navegador acessível via JS
3. **SessionStorage**: Similar ao LocalStorage mas por sessão
4. **Memory only**: Token só em memória (perde ao refresh)

### Justificativa

**Vantagens de Cookies HttpOnly**:
- **Proteção contra XSS**: JavaScript não pode acessar o cookie
- Navegador envia automaticamente em requisições
- Suporte a SameSite para mitigar CSRF
- Expiração gerenciada pelo navegador
- Mais seguro que LocalStorage

**Por que não LocalStorage?**
- Vulnerável a XSS (qualquer script pode ler)
- Necessita lógica manual para enviar token
- Menos seguro

**Implementação**:
```python
# Backend - Define cookies HttpOnly
response.set_cookie(
    key='access_token',
    value=access_token,
    httponly=True,  # Não acessível via JS
    secure=True,    # Apenas HTTPS (produção)
    samesite='Lax'  # Proteção CSRF
)
```

```typescript
// Frontend - Não precisa gerenciar token
// apiClient envia cookies automaticamente
axios.defaults.withCredentials = true;
```

### Trade-offs Aceitos

- CORS precisa ser configurado corretamente
- Cookies aumentam tamanho de toda requisição (pequeno)
- Necessita middleware customizado para extrair token

**Decisão Complementar**:
- `access_token` e `refresh_token` em HttpOnly cookies
- Dados de usuário (nome, permissões) em cookies não-HttpOnly para acesso frontend

---

## 7. Zustand vs. Redux vs. Context API

### Decisão

**Escolhido**: Zustand

### Contexto

Necessidade de gerenciamento de estado global no frontend (autenticação, dados compartilhados).

### Alternativas Consideradas

1. **Zustand** (escolhido)
2. **Redux Toolkit**: Padrão da indústria, verboso
3. **Context API**: Nativo do React
4. **Jotai**: Atômico, moderno
5. **Recoil**: Facebook, atômico

### Justificativa

**Vantagens do Zustand**:
- API extremamente simples e minimalista
- Zero boilerplate (sem actions, reducers complexos)
- TypeScript friendly
- Não precisa de Provider no topo da árvore
- Performance excelente (não re-renderiza desnecessariamente)
- Bundle tiny (~1KB)
- Suficiente para escala do projeto

**Por que não Redux?**
- Muita cerimônia para casos de uso simples
- Boilerplate excessivo (actions, reducers, etc.)
- Overkill para estado relativamente simples

**Por que não Context API?**
- Performance issues em grandes árvores
- Re-renderizações desnecessárias
- Necessita múltiplos contextos para evitar problemas

**Exemplo de simplicidade**:

```typescript
// Zustand store
const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearAuth: () => set({ user: null, isAuthenticated: false }),
}));

// Uso no componente
const { user, setUser } = useAuthStore();
```

### Trade-offs Aceitos

- Menos opções de middlewares comparado ao Redux
- Menos recursos avançados (time travel debugging)

**Quando reconsiderar?**
- Se estado global crescer muito em complexidade
- Se necessitar time travel debugging
- Se precisar de persistência avançada

---

## 8. Embeddings Locais vs. API Externa

### Decisão

**Escolhido**: Embeddings locais com sentence-transformers

### Contexto

AI Assistant precisa gerar embeddings para busca semântica. Decisão entre processar localmente ou usar API.

### Alternativas Consideradas

1. **Sentence-transformers local** (escolhido)
2. **OpenAI Embeddings API**: text-embedding-ada-002
3. **Cohere Embeddings**: API especializada
4. **Hugging Face Inference API**: Modelos hospedados

### Justificativa

**Vantagens de embeddings locais**:
- **Custo zero**: Sem cobranças por requisição
- **Privacidade**: Dados nunca saem do servidor
- **Latência baixa**: ~50ms vs. ~200ms+ de API
- **Sem rate limits**: Processa quantos quiser
- **Offline**: Funciona sem internet
- **Modelo pequeno**: all-MiniLM-L6-v2 (~80MB)

**Por que não OpenAI?**
- Custo por token (não gratuito)
- Latência de rede
- Dependência de serviço externo
- Questões de privacidade (dados enviados para OpenAI)

**Especificações do modelo escolhido**:
- Modelo: all-MiniLM-L6-v2
- Dimensões: 384 (vs. 1536 do OpenAI)
- Performance: 5x mais rápido que modelos maiores
- Qualidade: Suficiente para português e inglês

### Trade-offs Aceitos

- Qualidade ligeiramente inferior ao text-embedding-ada-002
- Menos dimensões (384 vs. 1536)
- Uso de RAM (~80MB)
- Necessita GPU para máxima performance (mas funciona em CPU)

**Quando reconsiderar?**
- Se precisar de embeddings multilíngues avançados
- Se qualidade se tornar gargalo
- Se servidor não tiver recursos para processar

### Decisão Complementar

Usar **Groq para geração de texto** (gratuito, tier generoso) em vez de processar localmente, pois:
- LLMs grandes são pesados (> 10GB)
- Groq oferece 6.000 req/min grátis
- Latência aceitável (~500ms)

---

## 9. Soft Delete vs. Hard Delete

### Decisão

**Escolhido**: Soft Delete (exclusão lógica)

### Contexto

Necessidade de "excluir" registros mas manter histórico e integridade referencial.

### Alternativas Consideradas

1. **Soft Delete** (escolhido)
2. **Hard Delete**: Exclusão física do banco
3. **Híbrido**: Soft delete + hard delete agendado

### Justificativa

**Vantagens do Soft Delete**:
- **Auditoria completa**: Sabe-se quem deletou e quando
- **Recuperação**: Possível "desfazer" exclusão
- **Integridade referencial**: Não quebra FKs
- **Análise histórica**: Relatórios incluem dados deletados se necessário
- **Compliance**: Alguns regulamentos exigem histórico

**Implementação**:

```python
class SoftDeleteModel(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)

    class Meta:
        abstract = True

# Manager customizado filtra automaticamente
class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)
```

**Por que não Hard Delete?**
- Perda permanente de dados
- Quebra de integridade referencial
- Impossível auditoria
- Não há "desfazer"

### Trade-offs Aceitos

- Tabelas crescem continuamente
- Queries precisam filtrar `is_deleted=False`
- Índices maiores
- Complexidade em unique constraints

**Mitigação**:
- Índice em `is_deleted`
- Manager padrão já filtra automaticamente
- Processo futuro de "arquivo" (mover deletados para tabela de histórico)

**Quando reconsiderar?**
- Se volume de dados deletados impactar performance
- Se compliance não exigir histórico completo
- Se storage se tornar problema

---

## 10. Criptografia Simétrica (Fernet) vs. Assimétrica

### Decisão

**Escolhido**: Criptografia simétrica com Fernet

### Contexto

Necessidade de criptografar dados sensíveis (CVV, senhas, números de conta) no banco de dados.

### Alternativas Consideradas

1. **Fernet (simétrica)** (escolhido)
2. **RSA (assimétrica)**: Par de chaves pública/privada
3. **AES direto**: Algoritmo de baixo nível
4. **Django Cryptographic Fields**: Biblioteca third-party

### Justificativa

**Vantagens do Fernet**:
- **Simplicidade**: API simples (encrypt/decrypt)
- **Segurança**: AES-128-CBC + HMAC-SHA256
- **Timestamp incluso**: Detecta adulteração
- **Biblioteca padrão**: cryptography (bem mantida)
- **Performance**: Muito rápido para encrypt/decrypt
- **Chave única**: Facilita gerenciamento

**Por que não RSA?**
- Mais lento (10-100x)
- Desnecessário (não há troca de chaves entre partes)
- Complexidade de gerenciar par de chaves

**Por que não AES direto?**
- Necessita implementar padding, IV, MAC
- Fernet já faz tudo isso corretamente

**Implementação**:

```python
from cryptography.fernet import Fernet

class FieldEncryption:
    @staticmethod
    def encrypt_data(plain_text: str) -> str:
        fernet = Fernet(settings.ENCRYPTION_KEY.encode())
        return fernet.encrypt(plain_text.encode()).decode()

    @staticmethod
    def decrypt_data(encrypted_text: str) -> str:
        fernet = Fernet(settings.ENCRYPTION_KEY.encode())
        return fernet.decrypt(encrypted_text.encode()).decode()
```

### Trade-offs Aceitos

- **Chave única**: Se vazar, todos os dados são comprometidos
- **Rotação de chave complexa**: Necessita re-criptografar todos os dados
- **Sem busca**: Não é possível buscar em campos criptografados

**Mitigação**:
- `ENCRYPTION_KEY` em variável de ambiente (nunca committada)
- Permissões restritas no arquivo .env
- Documentação clara sobre importância da chave
- Backup seguro da chave

**CRÍTICO**: Documentado claramente que NUNCA se deve mudar `ENCRYPTION_KEY` após criptografar dados (irreversível).

---

## 11. Service Layer Pattern vs. Direct API Calls

### Decisão

**Escolhido**: Service Layer Pattern

### Contexto

Como organizar chamadas de API no frontend.

### Alternativas Consideradas

1. **Service Layer** (escolhido): Camada dedicada de serviços
2. **Direct calls**: Componentes chamam axios diretamente
3. **Custom hooks**: Hooks React para cada recurso

### Justificativa

**Vantagens do Service Layer**:
- **Centralização**: Toda lógica de API em um lugar
- **Reutilização**: Múltiplos componentes usam mesmo service
- **Testabilidade**: Fácil mockar services
- **Manutenção**: Mudanças na API em um único lugar
- **Tipagem**: Tipos compartilhados e consistentes
- **Separação de responsabilidades**: Componentes não sabem detalhes HTTP

**Estrutura**:

```typescript
// services/accounts-service.ts
export const accountsService = {
  getAll: () => apiClient.get<Account[]>('/api/v1/accounts/'),
  getById: (id: string) => apiClient.get<Account>(`/api/v1/accounts/${id}/`),
  create: (data: CreateAccountData) => apiClient.post('/api/v1/accounts/', data),
  update: (id: string, data: UpdateAccountData) =>
    apiClient.put(`/api/v1/accounts/${id}/`, data),
  delete: (id: string) => apiClient.delete(`/api/v1/accounts/${id}/`),
};

// Componente usa service
const accounts = await accountsService.getAll();
```

**Por que não direct calls?**
- Duplicação de código
- Componentes acoplados a detalhes HTTP
- Difícil testar

**Por que não só custom hooks?**
- Hooks são excelentes para lógica de estado
- Mas service layer é melhor para chamadas puras de API
- Podemos usar hooks + services juntos

### Decisão Complementar

Usar **custom hooks** para lógica complexa de estado + services:

```typescript
function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    accountsService.getAll()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  return { accounts, loading };
}
```

---

## 12. Docker Compose vs. Kubernetes

### Decisão

**Escolhido**: Docker Compose

### Contexto

Orquestração de containers para desenvolvimento e produção simples.

### Alternativas Consideradas

1. **Docker Compose** (escolhido)
2. **Kubernetes (K8s)**: Orquestração enterprise
3. **Docker Swarm**: Alternativa mais simples ao K8s
4. **Nomad**: HashiCorp, simples

### Justificativa

**Vantagens do Docker Compose**:
- **Simplicidade extrema**: YAML simples
- **Setup rápido**: `docker-compose up`
- **Suficiente para projeto**: 3 containers (api, frontend, db)
- **Desenvolvimento local**: Perfeito para dev
- **Deploys simples**: VPS única com compose
- **Curva de aprendizado baixa**

**Por que não Kubernetes?**
- Overkill para escala atual
- Complexidade extrema
- Necessita cluster (custo)
- Curva de aprendizado íngreme
- Projeto não precisa de features K8s (auto-scaling, self-healing, etc.)

**Docker Compose é suficiente porque**:
- Aplicação monolítica
- Deploy em VPS única
- Tráfego baixo/médio
- Não precisa de alta disponibilidade (HA)

### Trade-offs Aceitos

- Sem auto-scaling
- Sem self-healing automático
- Menos resiliência
- Limitado a host único

**Quando reconsiderar?**
- Se precisar escalar horizontalmente (múltiplas instâncias)
- Se precisar de alta disponibilidade
- Se tráfego crescer significativamente (> 10k usuários)
- Se precisar de deploys blue-green, canary

### Decisão Complementar

Para produção simples, usar **Docker Compose + Nginx como reverse proxy + Let's Encrypt para HTTPS**.

---

## 13. Versionamento de API por URL vs. Header

### Decisão

**Escolhido**: Versionamento por URL (`/api/v1/`)

### Contexto

Como versionar a API para permitir evolução sem quebrar clientes existentes.

### Alternativas Consideradas

1. **URL path** (escolhido): `/api/v1/resource/`
2. **Header customizado**: `X-API-Version: 1`
3. **Accept header**: `Accept: application/vnd.myapi.v1+json`
4. **Query param**: `/api/resource/?version=1`

### Justificativa

**Vantagens de versionamento por URL**:
- **Clareza absoluta**: Versão visível na URL
- **Facilidade de teste**: Testar no navegador ou Postman é trivial
- **Cache-friendly**: Diferentes URLs para diferentes versões
- **Documentação clara**: Swagger/OpenAPI facilmente versionado
- **Roteamento simples**: Django routing nativo

**Por que não header customizado?**
- Menos óbvio
- Dificulta testes manuais
- Necessita ferramentas para testar

**Por que não Accept header?**
- Complexo de entender
- Não é padrão (poucos APIs usam)
- Desnecessário para uso interno

### Implementação

```python
# urls.py
urlpatterns = [
    path('api/v1/', include('myapp.urls')),
    # Futuro: path('api/v2/', include('myapp.urls_v2')),
]
```

### Convenções

- **Versão atual**: v1
- **Breaking changes**: Incremento de major version (v2, v3)
- **Backward compatible**: Mantido dentro da mesma versão
- **Deprecated**: Marcado com warnings por 6 meses antes de remover

---

## 14. Apps Django Modulares vs. App Monolítico

### Decisão

**Escolhido**: Apps Django modulares

### Contexto

Como organizar o código backend do Django.

### Alternativas Consideradas

1. **Apps modulares** (escolhido): Cada domínio é um app Django
2. **App único**: Todo código em um app só
3. **Pacotes Python**: Sem apps Django, só pacotes

### Justificativa

**Vantagens de apps modulares**:
- **Separação de responsabilidades**: Cada app tem domínio claro
- **Reutilização**: Apps podem ser extraídos para outros projetos
- **Organização**: Código não vira "big ball of mud"
- **Escalabilidade**: Futuro pode virar microserviços
- **Testabilidade**: Testes isolados por app
- **Manutenção**: Mais fácil encontrar código

**Estrutura atual**:

```
api/
├── accounts/          # Contas bancárias
├── credit_cards/      # Cartões de crédito
├── expenses/          # Despesas
├── revenues/          # Receitas
├── loans/             # Empréstimos
├── transfers/         # Transferências
├── dashboard/         # Dashboard financeiro
├── security/          # Senhas e arquivos
├── library/           # Livros e autores
├── ai_assistant/      # AI Assistant
├── authentication/    # Auth
├── members/           # Membros
└── app/               # Config central
```

**Por que não app único?**
- Código vira spaghetti
- Difícil manutenção
- Acoplamento alto

### Convenções de Apps

- **Nome**: Plural (accounts, not account)
- **Responsabilidade única**: Cada app tem um domínio
- **Dependências mínimas**: Apps não devem depender uns dos outros excessivamente
- **Models relacionados**: No mesmo app
- **Shared code**: Em `app/` (utilities, base models, etc.)

---

## 15. Groq vs. OpenAI vs. Modelos Locais

### Decisão

**Escolhido**: Groq API com llama-3.3-70b-versatile

### Contexto

AI Assistant precisa de LLM para gerar respostas baseadas em contexto recuperado.

### Alternativas Consideradas

1. **Groq API** (escolhido)
2. **OpenAI GPT-4**: Modelo mais poderoso
3. **OpenAI GPT-3.5-turbo**: Mais barato que GPT-4
4. **Modelos locais (Llama, Mistral)**: Executar no servidor
5. **Anthropic Claude**: Concorrente de OpenAI

### Justificativa

**Vantagens do Groq**:
- **Gratuito**: Tier grátis com 6.000 req/min
- **Rápido**: Latência muito baixa (~500ms)
- **Qualidade**: llama-3.3-70b é excelente
- **Português**: Suporte nativo
- **API simples**: Compatível com OpenAI

**Por que não OpenAI?**
- **Custo**: Não é gratuito
- **Privacy**: Dados enviados para OpenAI (questões de privacidade)
- Groq é suficiente para caso de uso

**Por que não modelos locais?**
- **Recursos**: LLMs grandes precisam de GPU potente (> 24GB VRAM)
- **Custo de infra**: Servidor com GPU é caro
- **Latência**: Inferência local pode ser lenta sem GPU adequada
- **Complexidade**: Deploy e manutenção mais complexos

**Especificações do modelo**:
- Modelo: llama-3.3-70b-versatile
- Parâmetros: 70 bilhões
- Contexto: 128k tokens
- Multilíngue: Sim

### Trade-offs Aceitos

- Dependência de serviço externo
- Rate limits (mas generosos)
- Questões de privacidade (dados enviados para Groq)

**Quando reconsiderar?**
- Se Groq começar a cobrar ou reduzir tier grátis
- Se privacidade se tornar preocupação crítica (considerar local)
- Se precisar de GPT-4 level quality

### Mitigação de Privacidade

- Contexto enviado é apenas top-k resultados (não banco completo)
- Dados sensíveis (senhas, CVVs) não são indexados
- Usuário pode optar por não usar AI Assistant

---

## Resumo de Decisões

| Decisão | Escolha | Razão Principal |
|---------|---------|-----------------|
| Repositório | Monorepo | Sincronia frontend/backend |
| Backend Framework | Django REST Framework | Ecosystem completo |
| Frontend Framework | React 18 | Ecosystem e comunidade |
| Linguagem Frontend | TypeScript | Type safety |
| Banco de Dados | PostgreSQL + pgvector | Relacional + vetorial |
| Auth Token Storage | Cookies HttpOnly | Segurança contra XSS |
| State Management | Zustand | Simplicidade |
| Embeddings | Sentence-transformers local | Grátis e privado |
| Exclusão | Soft Delete | Auditoria e recuperação |
| Criptografia | Fernet (simétrica) | Simplicidade e performance |
| API Calls | Service Layer | Centralização |
| Orquestração | Docker Compose | Simplicidade |
| API Versioning | URL path | Clareza |
| Backend Structure | Apps modulares | Separação de responsabilidades |
| LLM | Groq llama-3.3-70b | Gratuito e rápido |

## Princípios Orientadores

Todas as decisões seguiram estes princípios:

1. **Simplicidade > Sofisticação**: Escolher solução mais simples que atende requisitos
2. **Praticidade > Perfeição**: Shipping é mais importante que arquitetura perfeita
3. **Segurança > Conveniência**: Quando conflito, priorizar segurança
4. **Custo-benefício**: Considerar custo (tempo, $, complexidade) vs. benefício
5. **Documentação**: Decisões devem ser documentadas e justificadas
6. **Reversibilidade**: Preferir decisões que podem ser revertidas

## Processo de Decisão Futura

Para decisões arquiteturais futuras:

1. **Identificar problema**: Qual problema estamos resolvendo?
2. **Listar alternativas**: Pelo menos 3 opções
3. **Avaliar trade-offs**: Prós e contras de cada
4. **Considerar contexto**: Escala atual, recursos, equipe
5. **Decidir**: Escolher baseado em princípios
6. **Documentar**: Atualizar este documento
7. **Revisar**: Agendar revisão da decisão (3-6 meses)

## Links Relacionados

- [Visão Geral da Arquitetura](./visao-geral.md)
- [Fluxo de Dados](./fluxo-dados.md)
- [Guia de Desenvolvimento](../08-development/guia-desenvolvimento.md)
