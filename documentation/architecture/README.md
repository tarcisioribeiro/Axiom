# Documentação de Arquitetura

Esta seção contém a documentação completa da arquitetura do MindLedger, incluindo decisões de design, fluxos de dados e visão geral do sistema.

## Documentos Disponíveis

### 1. [Visão Geral da Arquitetura](./visao-geral.md)

Apresentação completa da arquitetura do sistema, suas camadas, padrões e organização.

**Conteúdo**:
- Arquitetura de alto nível
- Estrutura do monorepo
- Camadas da arquitetura (apresentação, API, backend, dados)
- Módulos do sistema (Finance, Security, Library, AI Assistant)
- Padrões arquiteturais aplicados
- Comunicação entre camadas
- Segurança, escalabilidade e performance
- Padrões de nomenclatura e convenções

**Ideal para**: Desenvolvedores novos no projeto, compreensão geral do sistema.

### 2. [Fluxo de Dados](./fluxo-dados.md)

Detalha como os dados fluem através do MindLedger, desde a interface até o banco de dados.

**Conteúdo**:
- Fluxo de autenticação (login, refresh, logout)
- Fluxo CRUD padrão (create, read, update, delete)
- Fluxo de dados sensíveis (criptografia/descriptografia)
- Fluxo de busca semântica (AI Assistant com RAG)
- Fluxo de dashboard (agregações e métricas)
- Tratamento de erros e recuperação
- Otimizações de performance (N+1 queries, caching, lazy loading)

**Ideal para**: Debugging, implementação de novas features, otimizações.

### 3. [Decisões Arquiteturais](./decisoes-arquiteturais.md)

Registra todas as decisões arquiteturais importantes, suas justificativas e trade-offs.

**Conteúdo**:
- 15 decisões arquiteturais detalhadas
- Alternativas consideradas para cada decisão
- Justificativas técnicas e de negócio
- Trade-offs aceitos
- Quando reconsiderar cada decisão
- Princípios orientadores do projeto
- Processo para decisões futuras

**Decisões documentadas**:
1. Monorepo vs. Múltiplos Repositórios
2. Django REST Framework vs. FastAPI
3. React vs. Vue vs. Angular
4. TypeScript vs. JavaScript
5. PostgreSQL vs. MySQL vs. MongoDB
6. JWT em Cookies HttpOnly vs. LocalStorage
7. Zustand vs. Redux vs. Context API
8. Embeddings Locais vs. API Externa
9. Soft Delete vs. Hard Delete
10. Criptografia Simétrica vs. Assimétrica
11. Service Layer Pattern vs. Direct API Calls
12. Docker Compose vs. Kubernetes
13. Versionamento de API por URL vs. Header
14. Apps Django Modulares vs. App Monolítico
15. Groq vs. OpenAI vs. Modelos Locais

**Ideal para**: Compreender o "porquê" das escolhas técnicas, tomar decisões futuras consistentes.

## Diagramas

Todos os documentos incluem diagramas Mermaid para visualização:

- **Arquitetura de alto nível**: Visão geral de todas as camadas
- **Fluxo de autenticação**: Sequence diagram do login completo
- **Fluxo de refresh de token**: Processo automático de renovação
- **Fluxo CRUD**: Operações de leitura e escrita
- **Fluxo de criptografia**: Como dados sensíveis são protegidos
- **Fluxo RAG**: Busca semântica com AI Assistant
- **Fluxo de dashboard**: Agregações e métricas

## Como Navegar

### Para Desenvolvedores Novos

1. Comece com [Introdução ao MindLedger](../01-overview/introducao.md)
2. Leia [Visão Geral da Arquitetura](./visao-geral.md)
3. Explore [Recursos e Funcionalidades](../01-overview/recursos.md)
4. Consulte [Guia de Desenvolvimento](../08-development/guia-desenvolvimento.md)

### Para Implementar Nova Feature

1. Revise [Fluxo de Dados](./fluxo-dados.md) relevante
2. Consulte [Decisões Arquiteturais](./decisoes-arquiteturais.md) para padrões
3. Veja [Documentação de API](../05-api/endpoints.md)
4. Siga [Convenções de Código](../08-development/convencoes.md)

### Para Fazer Decisões Técnicas

1. Leia [Decisões Arquiteturais](./decisoes-arquiteturais.md)
2. Siga o "Processo de Decisão Futura" documentado
3. Considere os "Princípios Orientadores"
4. Documente nova decisão neste arquivo

## Documentação Relacionada

- [01 - Overview](../overview/) - Visão geral do projeto
- [03 - Backend](../backend/) - Documentação do Django
- [04 - Frontend](../frontend/) - Documentação do React
- [05 - API](../api/) - Endpoints e contratos
- [06 - Database](../database/) - Modelo de dados
- [07 - Authentication & Security](../authentication-security/) - Autenticação e segurança
- [08 - Development](../development/) - Guias de desenvolvimento

## Manutenção desta Documentação

### Quando Atualizar

- **Visão Geral**: Quando adicionar novo módulo ou camada
- **Fluxo de Dados**: Quando implementar novo fluxo ou otimização significativa
- **Decisões Arquiteturais**: Toda decisão técnica importante deve ser documentada

### Como Contribuir

1. Mantenha o formato existente (Markdown + Mermaid)
2. Use diagramas para visualizar conceitos complexos
3. Seja técnico mas didático
4. Inclua exemplos de código quando relevante
5. Mantenha links para documentos relacionados atualizados

## Ferramentas Recomendadas

- **Visualização Mermaid**: VS Code com extensão "Markdown Preview Mermaid Support"
- **Edição Markdown**: VS Code, Typora, ou qualquer editor Markdown
- **Diagramas online**: [Mermaid Live Editor](https://mermaid.live/)

## Contato

Para questões sobre arquitetura ou sugestões de melhoria:

- **Issues**: [GitHub Issues](https://github.com/tarcisioribeiro/mindledger/issues)
- **Email**: tarcisio.ribeiro.1840@hotmail.com

---

**Última atualização**: 2026-01-12
