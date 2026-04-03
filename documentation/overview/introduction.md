# Introdução ao MindLedger

## O que é o MindLedger?

MindLedger é um sistema completo de gerenciamento pessoal que integra três módulos principais: **Finanças**, **Segurança** e **Biblioteca**. O sistema foi projetado para oferecer controle total sobre diferentes aspectos da vida pessoal através de uma plataforma unificada, segura e intuitiva.

## Visão Geral

O MindLedger é construído como uma aplicação full-stack moderna, combinando:

- **Backend robusto** em Django REST Framework
- **Frontend responsivo** em React com TypeScript
- **Banco de dados PostgreSQL** com extensão pgvector para busca semântica
- **Assistente de IA** com tecnologia RAG (Retrieval Augmented Generation)

## Módulos Principais

### 1. Módulo Finance (ExpenseLit)

Sistema completo de gestão financeira pessoal que permite:

- Gerenciamento de contas bancárias e cartões de crédito
- Controle detalhado de despesas e receitas
- Sistema de empréstimos e transferências
- Dashboard com visualizações e métricas financeiras
- Categorização automática de transações
- Criptografia de dados sensíveis (CVV, números de conta)

### 2. Módulo Security (StreamFort)

Gerenciador seguro de credenciais e informações confidenciais:

- Armazenamento criptografado de senhas
- Gestão segura de cartões de crédito
- Credenciais bancárias protegidas
- Arquivos confidenciais com criptografia
- Sistema de auditoria e logs de atividade
- Organização por categorias e tags

### 3. Módulo Library (CodexDB)

Biblioteca pessoal digital com recursos avançados:

- Catálogo completo de livros
- Gestão de autores e editoras
- Resumos de leitura com busca semântica
- Controle de progresso de leitura
- Metadados completos (ISBN, ano, páginas)
- Sistema de avaliações e notas

## Tecnologias Core

### Backend

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat-square&logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/Django_REST_Framework-3.16-ff1709?style=flat-square&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-HttpOnly_Cookies-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![Fernet](https://img.shields.io/badge/Fernet-Field_Encryption-FFD43B?style=flat-square&logo=python&logoColor=black)

- **Django 5.2.12** - Framework web principal
- **Django REST Framework 3.16.1** - API RESTful
- **PostgreSQL 16** com **pgvector** - Banco de dados
- **Sentence Transformers** - Embeddings semânticos
- **Groq API** - Geração de respostas via LLM
- **Cryptography (Fernet)** - Criptografia de dados

### Frontend

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-primitives-161618?style=flat-square&logo=radixui&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-state_management-443E38?style=flat-square)
![React Router](https://img.shields.io/badge/React_Router-v7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-animations-0055FF?style=flat-square&logo=framer&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-charts-22B5BF?style=flat-square)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5-FF4154?style=flat-square&logo=reactquery&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-validation-3E67B1?style=flat-square)

- **React 19** - Biblioteca UI
- **TypeScript 5.9** - Tipagem estática
- **Vite 7** - Build tool e dev server
- **TailwindCSS 3** - Framework CSS
- **Radix UI** - Componentes primitivos acessíveis
- **Zustand** - Gerenciamento de estado global
- **React Router v7** - Roteamento
- **Framer Motion** - Animações
- **Recharts** - Visualização de dados
- **TanStack Query v5** - Cache e sincronização de dados do servidor
- **Zod** - Validação de formulários (com React Hook Form)

### Infraestrutura

![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-reverse_proxy-009639?style=flat-square&logo=nginx&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-object_storage-C72E49?style=flat-square&logo=minio&logoColor=white)
![Sentry](https://img.shields.io/badge/Sentry-error_tracking-362D59?style=flat-square&logo=sentry&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-metrics-E6522C?style=flat-square&logo=prometheus&logoColor=white)

- **Docker & Docker Compose** - Containerização
- **Nginx** - Proxy reverso e servidor de assets do frontend
- **MinIO** - Armazenamento de objetos (mídia)
- **Sentry** - Error tracking (frontend, via `VITE_SENTRY_DSN`)
- **Prometheus** - Coleta de métricas (via django-prometheus)
- **JWT** - Autenticação baseada em tokens (HttpOnly cookies)

## Arquitetura de Alto Nível

```mermaid
graph TB
    subgraph "Frontend - React + TypeScript"
        UI[Interface do Usuário]
        Store[Zustand Store]
        API[API Client]
    end

    subgraph "Backend - Django"
        Gateway[API Gateway]
        Auth[Autenticação JWT]
        Finance[Módulo Finance]
        Security[Módulo Security]
        Library[Módulo Library]
    end

    subgraph "Dados"
        DB[(PostgreSQL)]
        Cache[Redis Cache]
    end

    UI --> Store
    Store --> API
    API --> Gateway
    Gateway --> Auth
    Auth --> Finance
    Auth --> Security
    Auth --> Library

    Finance --> DB
    Security --> DB
    Library --> DB

    Finance -.-> Cache
    Security -.-> Cache
    Library -.-> Cache
```

## Principais Características

### Segurança

- **Criptografia end-to-end** para dados sensíveis usando Fernet
- **Autenticação JWT** com tokens armazenados em HttpOnly cookies
- **Sistema de permissões** granular baseado no Django
- **Logs de auditoria** para ações críticas
- **Soft delete** preservando histórico de dados
- **Validações robustas** em todas as camadas

### Performance

- **Índices otimizados** no banco de dados
- **Lazy loading** de componentes no frontend
- **Embeddings locais** sem dependência de APIs externas
- **Cache estratégico** para dados frequentemente acessados
- **Queries otimizadas** com select_related e prefetch_related

### Usabilidade

- **Interface responsiva** que se adapta a qualquer dispositivo
- **Tema dark mode** (Dracula) por padrão
- **Traduções em português** para toda a interface
- **Feedback visual** em todas as ações
- **Navegação intuitiva** com sidebar e breadcrumbs

### Manutenibilidade

- **Código limpo** seguindo padrões PEP8 e clean code
- **Tipagem forte** em TypeScript
- **Arquitetura modular** com separação de responsabilidades
- **Documentação completa** em português
- **Testes automatizados** (em desenvolvimento)

## Público-Alvo

O MindLedger é ideal para:

- Indivíduos que buscam controle financeiro detalhado
- Profissionais que necessitam gerenciar múltiplas credenciais
- Leitores que desejam organizar sua biblioteca pessoal
- Usuários que valorizam privacidade e segurança de dados
- Pessoas que querem centralizar informações pessoais em um único lugar

## Próximos Passos

Para começar a usar o MindLedger, consulte:

- [Guia de Instalação](../development/installation.md)
- [Configuração Inicial](../development/configuration.md)
- [Arquitetura do Sistema](../architecture/overview.md)

## Suporte e Comunidade

- **Documentação**: Este repositório de documentação
- **Issues**: GitLab Issues (repositório interno)
- **Email**: tarcisio.ribeiro.1840@hotmail.com

## Licença

Este projeto está sob a licença MIT. Consulte o arquivo LICENSE para mais detalhes.
