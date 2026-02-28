# Documentação de Desenvolvimento

Bem-vindo à documentação de desenvolvimento do MindLedger! Esta seção contém guias completos para configurar, desenvolver e contribuir para o projeto.

## Conteúdo

### 1. [Instalação](./installation.md)
Guia completo de instalação do ambiente de desenvolvimento:
- Requisitos do sistema
- Instalação com Docker (recomendado)
- Instalação local (desenvolvimento nativo)
- Primeiro acesso e configuração inicial
- Verificação da instalação

### 2. [Configuração](./configuration.md)
Configuração detalhada do ambiente:
- Variáveis de ambiente (.env)
- Geração de chaves de segurança
- Configuração de portas e serviços
- Configuração de logging
- Configuração do AI Assistant

### 3. [Workflow de Desenvolvimento](./development_workflow.md)
Comandos e práticas do dia a dia:
- Iniciando e parando serviços
- Hot reload e desenvolvimento iterativo
- Debugging e logs
- Testes automatizados
- Operações de banco de dados
- Ferramentas de qualidade de código

### 4. [Guia de Contribuição](./contribution_guide.md)
Padrões e boas práticas para contribuir:
- Padrões de código (Python/TypeScript)
- Convenções de commits
- Estratégia de branches
- Process de Pull Request
- Code review

### 5. [Solução de Problemas](./troubleshooting.md)
Diagnóstico e resolução de problemas comuns:
- Problemas com Docker
- Erros de banco de dados
- Conflitos de migrations
- Problemas de autenticação
- Erros de criptografia
- Problemas de CORS
- Troubleshooting do AI Assistant

## Início Rápido

Se você está começando agora, siga esta sequência:

1. **Leia a [Instalação](./installation.md)** para configurar seu ambiente
2. **Configure o [.env](./configuration.md)** com as variáveis necessárias
3. **Familiarize-se com o [Workflow](./development_workflow.md)** para comandos do dia a dia
4. **Consulte o [Guia de Contribuição](./contribution_guide.md)** antes de fazer alterações
5. **Use a [Solução de Problemas](./troubleshooting.md)** quando encontrar erros

## Arquitetura do Projeto

```
MindLedger/
├── api/                    # Backend Django REST Framework
│   ├── accounts/          # Contas bancárias
│   ├── authentication/    # Autenticação JWT
│   ├── credit_cards/      # Cartões de crédito
│   ├── expenses/          # Despesas
│   ├── revenues/          # Receitas
│   ├── loans/             # Empréstimos
│   ├── transfers/         # Transferências
│   ├── security/          # Senhas
│   ├── library/           # Biblioteca de livros
│   ├── ai_assistant/      # Assistente de IA (RAG)
│   └── app/               # Configurações centrais
├── frontend/              # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Páginas/rotas
│   │   ├── services/     # API clients
│   │   └── stores/       # Estado global (Zustand)
│   └── public/           # Assets estáticos
├── documentation/         # Documentação do projeto
└── docker-compose.yml    # Orquestração Docker
```

## Tecnologias Principais

### Backend
- **Django 5.2** - Framework web
- **Django REST Framework 3.16** - API REST
- **PostgreSQL 16** - Banco de dados
- **pgvector** - Extensão para embeddings vetoriais
- **Redis 7** - Cache semântico
- **JWT** - Autenticação via cookies HttpOnly
- **Fernet** - Criptografia de dados sensíveis
- **Groq API** - LLM para geração de texto
- **sentence-transformers** - Embeddings locais

### Frontend
- **React 19** - Biblioteca UI
- **TypeScript 5.9** - Tipagem estática
- **Vite 7** - Build tool
- **TailwindCSS 3.4** - Framework CSS
- **Radix UI** - Componentes acessíveis
- **Zustand 5** - Gerenciamento de estado
- **React Hook Form** - Formulários
- **Zod 4** - Validação de schemas
- **Axios** - Cliente HTTP

### DevOps
- **Docker** - Containerização
- **Docker Compose** - Orquestração de containers
- **pytest** - Testes backend
- **Black, isort, flake8** - Qualidade de código Python
- **ESLint** - Linting JavaScript/TypeScript

## Portas Utilizadas

| Serviço | Porta Padrão | Variável de Ambiente |
|---------|--------------|----------------------|
| Frontend | 39101 | `FRONTEND_PORT` |
| Backend API | 39100 | `API_PORT` |
| PostgreSQL | 39102 | `DB_PORT` |
| Redis | 6379 | `REDIS_PORT` |

## Links Úteis

- **Repositório**: [GitHub MindLedger](https://github.com/seu-usuario/MindLedger)
- **Frontend**: http://localhost:39101
- **Backend API**: http://localhost:39100
- **Django Admin**: http://localhost:39100/admin
- **API Docs**: http://localhost:39100/api/v1/
- **Groq Console**: https://console.groq.com

## Suporte

Se você encontrar problemas não cobertos nesta documentação:

1. Verifique a [Solução de Problemas](./troubleshooting.md)
2. Consulte os logs: `docker-compose logs -f`
3. Abra uma issue no GitHub com detalhes do erro
4. Entre em contato com a equipe de desenvolvimento

## Contribuindo para a Documentação

Esta documentação também é código! Se você encontrar erros, informações desatualizadas ou tiver sugestões de melhorias:

1. Edite os arquivos markdown em `documentation/development/`
2. Siga o [Guia de Contribuição](./contribution_guide.md)
3. Abra um Pull Request com suas alterações

---

**Última atualização**: Janeiro 2026
**Mantenedor**: Equipe MindLedger
