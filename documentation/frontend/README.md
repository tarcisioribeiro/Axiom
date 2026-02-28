# Documentação do Frontend

Esta pasta contém a documentação completa do frontend do MindLedger - uma aplicação React + TypeScript moderna com TailwindCSS e Zustand.

## Conteúdo

### 📁 [estrutura-projeto.md](./estrutura-projeto.md)
Estrutura completa do projeto frontend, organização de diretórios, componentes, pages, services, stores e types. Convenções de nomenclatura e padrões de importação.

**Tópicos principais:**
- Estrutura de diretórios completa
- Organização de componentes por módulo
- Hierarquia de rotas e páginas
- Camada de services (API clients)
- Sistema de types TypeScript
- Convenções de nomenclatura
- Padrões de importação com path alias (@/)

### 🎨 [componentes-ui.md](./componentes-ui.md)
Documentação completa dos componentes UI baseados em shadcn/ui e Radix UI. Exemplos de uso, variantes, acessibilidade e customização.

**Tópicos principais:**
- Todos os componentes UI (Button, Input, Dialog, etc.)
- Variantes e tamanhos disponíveis
- Exemplos práticos de uso
- Radix UI primitives e acessibilidade
- Animações e transições
- Customização e tema

### 🚦 [roteamento.md](./roteamento.md)
Sistema de roteamento com React Router v6, proteção de rotas, lazy loading e animações de transição.

**Tópicos principais:**
- Configuração do React Router
- Rotas públicas vs protegidas
- Componente ProtectedRoute
- Layout aninhado
- Lazy loading e code splitting
- Animações com Framer Motion
- Mapa completo de rotas
- Navegação programática
- Parâmetros de rota e query params

### 🗂️ [gerenciamento-estado.md](./gerenciamento-estado.md)
Gerenciamento de estado global com Zustand, focado na auth store e boas práticas de performance.

**Tópicos principais:**
- Auth store (autenticação, usuário, permissões)
- Quando usar estado global vs local
- Zustand API e padrões
- Fluxo de autenticação completo
- Verificação de permissões
- React Hook Form para formulários
- Otimização de performance
- Debugging e DevTools

### 🌐 [api-client.md](./api-client.md)
Cliente HTTP baseado em Axios com interceptors para autenticação, refresh de tokens e tratamento de erros.

**Tópicos principais:**
- Singleton ApiClient
- Request e Response interceptors
- Refresh automático de tokens JWT
- Classes de erro customizadas
- Tratamento centralizado de erros
- Métodos HTTP (GET, POST, PUT, PATCH, DELETE)
- Padrão de services por módulo
- Configuração de endpoints
- Uso em componentes

### 🎨 [estilizacao.md](./estilizacao.md)
Sistema de estilização com TailwindCSS e tema Dracula. Paleta de cores, componentes estilizados e boas práticas.

**Tópicos principais:**
- TailwindCSS utility classes
- Tema Dracula (paleta completa)
- CSS Variables para cores
- Configuração do tailwind.config.js
- Animações customizadas
- Componentes estilizados
- Ícones com Lucide React
- Layout patterns
- Formulários
- Responsive design
- Boas práticas de estilização

## Fluxo de Trabalho

### 1. Estrutura
Comece entendendo a estrutura geral do projeto em [estrutura-projeto.md](./estrutura-projeto.md).

### 2. Componentes
Explore os componentes UI disponíveis em [componentes-ui.md](./componentes-ui.md).

### 3. Roteamento
Configure e entenda as rotas em [roteamento.md](./roteamento.md).

### 4. Estado
Gerencie estado global e local em [gerenciamento-estado.md](./gerenciamento-estado.md).

### 5. API
Integre com o backend usando [api-client.md](./api-client.md).

### 6. Estilos
Estilize componentes com [estilizacao.md](./estilizacao.md).

## Stack Tecnológica

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Roteamento:** React Router v6
- **Estado Global:** Zustand
- **HTTP Client:** Axios
- **Formulários:** React Hook Form + Zod
- **UI Components:** shadcn/ui (Radix UI)
- **Estilização:** TailwindCSS
- **Ícones:** Lucide React
- **Animações:** Framer Motion

## Arquitetura

```
Frontend Architecture
├── Pages (Rotas)
│   └── Componentes de Feature
│       ├── Componentes UI (shadcn/ui)
│       └── Componentes Comuns
├── Services (API Layer)
│   └── api-client (Axios + Interceptors)
├── Stores (Estado Global)
│   └── Zustand
└── Types (TypeScript)
```

## Início Rápido

### Desenvolvimento

```bash
cd frontend
npm install
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Lint

```bash
npm run lint
```

## Variáveis de Ambiente

```env
VITE_API_BASE_URL=http://localhost:8002
```

## Portas

- **Dev Server:** http://localhost:3000
- **Backend API:** http://localhost:8002

## Recursos Externos

- **React Docs:** https://react.dev/
- **TypeScript Docs:** https://www.typescriptlang.org/
- **Vite Docs:** https://vitejs.dev/
- **React Router:** https://reactrouter.com/
- **Zustand:** https://github.com/pmndrs/zustand
- **TailwindCSS:** https://tailwindcss.com/
- **shadcn/ui:** https://ui.shadcn.com/
- **Radix UI:** https://www.radix-ui.com/
- **Lucide Icons:** https://lucide.dev/

## Contribuindo

Ao adicionar novos componentes ou features:

1. Siga as convenções de nomenclatura
2. Use TypeScript com tipos explícitos
3. Documente props e comportamentos
4. Adicione exemplos de uso
5. Teste em diferentes tamanhos de tela
6. Mantenha acessibilidade (ARIA, keyboard navigation)

## Próximos Módulos

- **API:** Veja [../05-api/](../05-api/) para documentação dos endpoints
- **Backend:** Veja [../03-backend/](../03-backend/) para arquitetura do backend
- **Banco de Dados:** Veja [../06-database/](../06-database/) para schema e queries
