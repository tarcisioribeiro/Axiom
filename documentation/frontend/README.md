# Frontend React

Documentação do frontend React + TypeScript do Axiom.

**Stack**: React 19 · TypeScript 5.9 · Vite 7 · TailwindCSS 3 · Radix UI · Zustand · React Router v7 · TanStack Query v5 · React Hook Form + Zod

## Conteúdo

- **[Estrutura do Projeto](project_structure.md)** — Organização de diretórios, componentes, pages, services e types
- **[Componentes UI](ui_components.md)** — Radix UI primitives, componentes comuns e customização
- **[Roteamento](routing.md)** — React Router v7, ProtectedRoute e lazy loading
- **[Gerenciamento de Estado](state_management.md)** — Zustand stores, TanStack Query e React Hook Form
- **[API Client](api_client.md)** — Axios, interceptores, serviços e tratamento de erros
- **[Estilização](stylization.md)** — TailwindCSS, design tokens, temas Dracula/Alucard
- **[Paletas](palettes.md)** — Paleta de cores e variáveis CSS

## Padrões essenciais

| Padrão | Descrição |
|--------|-----------|
| `BaseService<T>` | Classe base para todos os serviços CRUD |
| `useQuery` / `useMutation` | TanStack Query para server state |
| `PageContainer` | Wrapper raiz de toda página |
| `DataTable` | Tabela paginada com empty state |
| `@/` | Alias para `frontend/src/` |

---

[Voltar ao índice da documentação](../README.md)
