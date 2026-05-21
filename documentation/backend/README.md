# Backend Django

Documentação técnica do backend Django REST Framework do Axiom.

**Stack**: Django 5.x + DRF · PostgreSQL 16 · Redis · MinIO · JWT HttpOnly cookies · Fernet encryption

## Conteúdo

- **[Estrutura das Apps](apps_structure.md)** — Organização modular das apps Django e convenções
- **[Modelos de Dados](data_models.md)** — BaseModel, campos, relacionamentos e soft delete
- **[Serializers](serializers.md)** — Padrões DRF: leitura vs. escrita, validações, campos calculados
- **[Views e Endpoints](viewsets_views.md)** — Generic views, permissões, paginação e otimizações
- **[Middleware e Signals](middleware_signals.md)** — Pipeline de requisições e automação por eventos
- **[Criptografia](criptography.md)** — FieldEncryption (Fernet), campos sensíveis e rotação de chaves
- **[Comandos de Management](management_commands.md)** — Comandos customizados Django
- **[Sistema de Agentes de IA](agents.md)** — Pipeline completo dos agentes LLM, roteador, memória, RAG e streaming

## Padrões essenciais

| Padrão | Descrição |
|--------|-----------|
| `BaseModel` | UUID PK, timestamps, auditoria, `is_deleted` |
| `BaseListCreateView` | GET list + POST create (permissões inclusas) |
| `BaseRetrieveUpdateDestroyView` | GET/PUT/PATCH/DELETE (permissões inclusas) |
| `GlobalDefaultPermission` | Mapeia HTTP method → permissão Django |
| `FieldEncryption` | `encrypt_data()` / `decrypt_data()` via Fernet |

---

[Voltar ao índice da documentação](../README.md)
