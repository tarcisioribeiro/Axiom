# Documentação Oficial do MindLedger

Bem-vindo à documentação oficial do MindLedger! Esta documentação completa cobre todos os aspectos do sistema, desde a visão geral até detalhes técnicos de implementação.

## 📚 Índice Geral

### [1. Visão Geral](overview/)
Introdução ao sistema e seus recursos principais.

- **[Introdução](overview/introduction.md)** - O que é o MindLedger, módulos, tecnologias e arquitetura de alto nível
- **[Recursos e Funcionalidades](overview/resources.md)** - Detalhamento completo de todas as funcionalidades por módulo

### [2. Arquitetura](architecture/)
Decisões técnicas e estrutura do sistema.

- **[Visão Geral da Arquitetura](architecture/overview.md)** - Estrutura do monorepo, camadas, padrões arquiteturais
- **[Fluxo de Dados](architecture/data_flow.md)** - Como os dados fluem entre frontend, backend e banco de dados
- **[Decisões Arquiteturais](architecture/architectural_decisions.md)** - Decisões técnicas importantes e suas justificativas

### [3. Backend](backend/)
Documentação do Django REST Framework.

- **[Estrutura de Apps](backend/apps_structure.md)** - Organização das apps Django
- **[Modelos de Dados](backend/data_models.md)** - Modelos Django, campos e relacionamentos
- **[Serializers](backend/serializers.md)** - Padrões de serialização DRF
- **[ViewSets e Views](backend/viewsets_views.md)** - API endpoints e lógica de negócio
- **[Middleware e Signals](backend/middleware_signals.md)** - Processamento de requisições e automação
- **[Criptografia](backend/criptography.md)** - Sistema de criptografia Fernet
- **[Comandos de Management](backend/management_commands.md)** - Comandos personalizados Django

### [4. Frontend](frontend/)
Documentação do React + TypeScript.

- **[Estrutura do Projeto](frontend/project_structure.md)** - Organização de diretórios e arquivos
- **[Componentes UI](frontend/ui_components.md)** - shadcn/ui, Radix e componentes customizados
- **[Roteamento](frontend/routing.md)** - React Router e proteção de rotas
- **[Gerenciamento de Estado](frontend/state_management.md)** - Zustand stores
- **[API Client](frontend/api_client.md)** - Axios, interceptores e serviços
- **[Estilização](frontend/stylization.md)** - TailwindCSS e tema Dracula

### [5. API](api/)
Documentação dos endpoints RESTful.

- **[Endpoints](api/endpoints.md)** - Lista completa de endpoints por módulo
- **[Autenticação e Tokens](api/autenticacao-tokens.md)** - Login, refresh e logout
- **[Tratamento de Erros](api/tratamento-erros.md)** - Status codes e mensagens de erro
- **[Filtros e Ordenação](api/filtros-ordenacao.md)** - Query parameters suportados

### [6. Banco de Dados](database/)
PostgreSQL com pgvector.

- **[Schema](database/schema.md)** - Tabelas, campos e relacionamentos completos
- **[Índices e Otimização](database/indices-otimizacao.md)** - Estratégias de performance
- **[pgvector](database/pgvector.md)** - Busca vetorial e embeddings
- **[Migrations](database/migrations.md)** - Guia de migrations Django

### [7. Autenticação e Segurança](authentication-security/)
Segurança, permissões e criptografia.

- **[Fluxo de Autenticação](authentication-security/authentication_flow.md)** - JWT com HttpOnly cookies
- **[Sistema de Permissões](authentication-security/permissions_system.md)** - Grupos e permissões Django
- **[Criptografia de Dados](authentication-security/data_encryption.md)** - Fernet para dados sensíveis
- **[Boas Práticas de Segurança](authentication-security/security_best_practices.md)** - OWASP Top 10 e headers

### [8. Desenvolvimento](development/)
Guias para desenvolvedores.

- **[Instalação](development/installation.md)** - Setup inicial (Docker e local)
- **[Configuração](development/configuration.md)** - Variáveis de ambiente e chaves
- **[Workflow de Desenvolvimento](development/development_workflow.md)** - Comandos diários, debugging e testes
- **[Guia de Contribuição](development/contribution_guide.md)** - Padrões de código e PRs
- **[Troubleshooting](development/troubleshooting.md)** - Solução de problemas comuns

## 🚀 Início Rápido

### Para Novos Usuários
1. Leia a [Introdução](overview/introduction.md) para entender o que é o MindLedger
2. Consulte [Recursos e Funcionalidades](overview/resources.md) para ver tudo que pode fazer
3. Siga o [Guia de Instalação](development/installation.md) para começar a usar

### Para Desenvolvedores
1. Comece pela [Instalação](development/installation.md) para configurar o ambiente
2. Leia o [Workflow de Desenvolvimento](development/development_workflow.md) para comandos diários
3. Consulte o [Guia de Contribuição](development/contribution_guide.md) para padrões de código
4. Use [Troubleshooting](development/troubleshooting.md) quando encontrar problemas

### Para Arquitetos e Tech Leads
1. Estude a [Visão Geral da Arquitetura](architecture/overview.md)
2. Revise as [Decisões Arquiteturais](architecture/architectural_decisions.md)
3. Analise o [Fluxo de Dados](architecture/data_flow.md)
4. Confira [Boas Práticas de Segurança](authentication-security/security_best_practices.md)

## 🎯 Guias por Tarefa

### Implementar Nova Feature

1. **Planejamento**
   - [Arquitetura do Sistema](architecture/overview.md)
   - [Decisões Arquiteturais](architecture/architectural_decisions.md)

2. **Backend**
   - [Modelos de Dados](backend/data_models.md) - Criar modelos
   - [Serializers](backend/serializers.md) - Validação e serialização
   - [ViewSets e Views](backend/viewsets_views.md) - Endpoints API
   - [Migrations](database/migrations.md) - Criar migrations

3. **Frontend**
   - [Estrutura do Projeto](frontend/project_structure.md) - Onde colocar arquivos
   - [API Client](frontend/api_client.md) - Chamar APIs
   - [Componentes UI](frontend/ui_components.md) - Interface
   - [Gerenciamento de Estado](frontend/state_management.md) - Estado global

4. **Testes e Deploy**
   - [Workflow de Desenvolvimento](development/development_workflow.md) - Testes
   - [Guia de Contribuição](development/contribution_guide.md) - Commits e PRs

### Resolver Problemas de Segurança

1. **Identificação**
   - [Boas Práticas de Segurança](authentication-security/security_best_practices.md) - OWASP Top 10
   - [Fluxo de Autenticação](authentication-security/authentication_flow.md) - JWT

2. **Implementação**
   - [Criptografia de Dados](authentication-security/data_encryption.md) - Dados sensíveis
   - [Sistema de Permissões](authentication-security/permissions_system.md) - Controle de acesso

3. **Validação**
   - [Tratamento de Erros](api/tratamento-erros.md) - Mensagens seguras
   - [Troubleshooting](development/troubleshooting.md) - Testes de segurança

### Otimizar Performance

1. **Diagnóstico**
   - [Índices e Otimização](database/indices-otimizacao.md) - Queries lentas
   - [Fluxo de Dados](architecture/data_flow.md) - Gargalos

2. **Backend**
   - [Modelos de Dados](backend/data_models.md) - select_related e prefetch_related
   - [ViewSets e Views](backend/viewsets_views.md) - Otimizações de queries

3. **Frontend**
   - [API Client](frontend/api_client.md) - Caching e interceptores
   - [Componentes UI](frontend/ui_components.md) - Lazy loading

4. **Banco de Dados**
   - [Schema](database/schema.md) - Índices adequados
   - [pgvector](database/pgvector.md) - Busca vetorial eficiente

## 📖 Convenções da Documentação

### Formatação de Código

**Python (Backend)**
```python
def calculate_balance(account_id: int) -> float:
    """Calcula o saldo atual de uma conta."""
    # Implementação
    pass
```

**TypeScript (Frontend)**
```typescript
const calculateBalance = (accountId: number): number => {
  // Implementação
  return balance;
};
```

**SQL (Banco de Dados)**
```sql
SELECT * FROM accounts_account
WHERE is_deleted = false
ORDER BY created_at DESC;
```

### Alertas e Avisos

- **⚠️ CRÍTICO**: Informação que pode causar perda de dados ou quebra do sistema
- **⚠️ ATENÇÃO**: Informação importante que requer cuidado
- **💡 DICA**: Sugestão para melhorar a experiência ou performance
- **🔴 BLOCKER**: Deve ser corrigido antes de prosseguir

### Símbolos de Status

- ✅ Implementado e testado
- 🚧 Em desenvolvimento
- 📋 Planejado
- ❌ Não suportado

## 🛠️ Ferramentas Recomendadas

### Desenvolvimento
- **VS Code** - Editor com extensões para Python, TypeScript, Docker
- **Docker Desktop** - Containerização
- **Postman/Insomnia** - Testes de API
- **pgAdmin/DBeaver** - Gerenciamento PostgreSQL
- **React DevTools** - Debug de componentes React

### Qualidade de Código
- **Black** - Formatação Python
- **ESLint** - Linting TypeScript
- **Prettier** - Formatação geral
- **Bandit** - Security linting Python
- **SonarQube** - Análise de código

### Monitoramento
- **Sentry** - Error tracking
- **Prometheus + Grafana** - Métricas e dashboards
- **Django Debug Toolbar** - Debug de queries

## 📞 Suporte e Comunidade

### Reportar Problemas
Se encontrar erros na documentação ou no sistema:
1. Verifique o [Troubleshooting](development/troubleshooting.md)
2. Busque em issues existentes no GitHub
3. Crie uma nova issue com detalhes

### Contribuir com a Documentação
Encontrou algo confuso ou desatualizado? PRs são bem-vindos!

1. Fork o repositório
2. Edite os arquivos `.md` relevantes
3. Siga o [Guia de Contribuição](development/contribution_guide.md)
4. Abra um Pull Request

### Contato
- **Email**: tarcisio.ribeiro.1840@hotmail.com
- **GitHub**: [@tarcisioribeiro](https://github.com/tarcisioribeiro)

## 📝 Histórico de Versões da Documentação

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0.0 | 2026-01-12 | Documentação inicial completa |

## 📜 Licença

Este projeto está sob a licença MIT. Consulte o arquivo LICENSE na raiz do repositório para mais detalhes.

---

**Última atualização**: Janeiro de 2026
**Mantido por**: Equipe MindLedger

💜 Feito com atenção aos detalhes e amor pelo código limpo.
