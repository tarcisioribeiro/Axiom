# MindLedger

Sistema completo de gestão pessoal com módulos para finanças, segurança, biblioteca e planejamento pessoal. Interface em português brasileiro.

## Estrutura do Projeto

```
MindLedger/
├── api/              # Backend Django REST Framework (porta 39100)
├── frontend/         # Frontend React + Vite + TypeScript (porta 39101)
├── docker-compose.yml
└── .env              # Variáveis de ambiente (criado via setup-env.sh)
```

## Tecnologias

### Backend
- Python 3.12 + Django 5.x + Django REST Framework
- PostgreSQL 16
- Redis 7 (cache)
- MinIO (armazenamento de objetos)
- JWT em cookies HttpOnly

### Frontend
- React 19 + TypeScript 5.9 + Vite 7
- TailwindCSS 3 + Radix UI
- Zustand (estado global)
- React Router v7
- React Hook Form + Zod
- Recharts + Framer Motion

## Pré-requisitos

- Docker e Docker Compose

## Configuração

### 1. Clone o repositório

```bash
git clone <repositorio>
cd MindLedger
```

### 2. Configure as variáveis de ambiente

```bash
chmod +x setup-env.sh
./setup-env.sh
```

Ou copie manualmente:

```bash
cp .env.example .env
# Edite o .env com suas configurações
```

> **Atenção**: `ENCRYPTION_KEY` é uma chave Fernet de 44 caracteres. **Nunca a altere após criptografar dados.** Para gerar uma nova: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

### 3. Inicie os serviços

```bash
docker-compose up -d
```

### 4. Execute as migrações e configure permissões

```bash
docker-compose exec api python manage.py migrate
docker-compose exec api python manage.py setup_permissions
```

### 5. Crie um superusuário (primeiro acesso)

```bash
docker-compose exec api python manage.py createsuperuser
```

## Acessando a Aplicação

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:39101 |
| Backend API | http://localhost:39100 |
| Swagger Docs | http://localhost:39100/api/docs/ |
| Django Admin | http://localhost:39100/admin |
| PostgreSQL | localhost:39102 |
| Redis | localhost:39103 |
| MinIO API | localhost:39105 |
| MinIO Console | http://localhost:39106 |

## Funcionalidades

### Finanças
- **Dashboard** — visão geral com gráficos, saldos e projeções
- **Contas Bancárias** — cadastro e acompanhamento de saldos
- **Despesas** — registro, categorização e filtros avançados
- **Despesas Fixas** — controle de despesas recorrentes
- **Receitas** — controle de entradas e categorização
- **Cartões de Crédito** — faturas, compras e parcelamentos (dados criptografados)
- **Transferências** — movimentações entre contas
- **Empréstimos** — controle de parcelas e pagamentos
- **A Pagar** — obrigações financeiras pendentes
- **Orçamentos** — limites mensais por categoria de despesa
- **Cofres** — poupanças com simulação de rendimento (CDI/taxa anual)
- **Metas Financeiras** — acompanhamento de objetivos

### Segurança
- **Senhas** — cofre criptografado com auditoria de saúde
- **Cartões Armazenados** — dados de cartão criptografados
- **Contas Armazenadas** — credenciais de acesso criptografadas
- **Arquivos** — armazenamento seguro de documentos (MinIO)
- **Logs de Atividade** — rastreamento de acessos ao cofre

### Biblioteca
- **Livros, Autores e Editoras** — catálogo pessoal
- **Leituras** — acompanhamento com metas anuais e heatmap de hábito
- **Resumos** — notas e resenhas de leitura

### Planejamento Pessoal
- **Tarefas de Rotina** — templates com geração automática de instâncias diárias
- **Checklist Diário** — execução das tarefas do dia
- **Metas** — objetivos com acompanhamento de progresso
- **Reflexões Diárias** — registro de journaling

### Outros
- **Membros** — gerenciamento de membros da família/grupo (CPF criptografado)
- **Notificações** — central de avisos do sistema
- **Permissões** — controle de acesso por perfil

## Comandos Úteis

### Docker

```bash
docker-compose up -d                           # Iniciar serviços
docker-compose down                            # Parar serviços
docker-compose logs -f api                     # Logs da API
docker-compose up -d --build                   # Reconstruir após mudanças de dependências
docker-compose exec api bash                   # Shell do container da API
```

> **Atenção**: O container da API não monta o código-fonte como volume — o código é copiado no build. Para aplicar alterações em arquivos host, copie-os manualmente (`docker cp`) ou faça rebuild.

### Migrations

```bash
docker-compose exec api python manage.py makemigrations
docker-compose exec api python manage.py migrate
```

### Comandos de Manutenção

```bash
docker-compose exec api python manage.py setup_permissions       # Recria grupo Members e permissões
docker-compose exec api python manage.py update_balances         # Recalcula saldos das contas
docker-compose exec api python manage.py close_overdue_bills     # Fecha faturas vencidas
docker-compose exec api python manage.py purge_deleted_records   # Remove permanentemente registros deletados há >90 dias (LGPD)
docker-compose exec api python manage.py vault_recovery          # Diagnóstico e recuperação de cofres
docker-compose exec api python manage.py migrate_media_to_minio  # Migra arquivos locais para MinIO (--dry-run disponível)
```

### Testes

```bash
# Backend (dentro do container)
docker-compose exec api python -m pytest tests/
docker-compose exec api python -m pytest tests/ --cov

# Frontend (na máquina host — container frontend é nginx-only)
cd frontend
npm run test -- --run
npm run test:coverage
```

### Qualidade de Código

```bash
# Backend
cd api && black . && isort . && flake8 .

# Frontend
cd frontend
npm run lint:fix
npm run format
npm run typecheck
```

## Banco de Dados

```bash
# Backup
docker-compose exec db pg_dump -U $DB_USER mindledger_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Restauração
docker-compose exec -T db psql -U $DB_USER mindledger_db < backups/seu_backup.sql

# Shell PostgreSQL
docker-compose exec db psql -U $DB_USER -d mindledger_db
```

## Segurança

- Dados sensíveis criptografados com Fernet (CPF, senhas do cofre, números de conta/cartão)
- JWT em cookies HttpOnly com refresh automático
- Soft delete para todos os registros; purge com retenção de 90 dias (LGPD)
- Auditoria de todas as operações de escrita via `AuditLoggingMiddleware`
- Permissões granulares por módulo via `GlobalDefaultPermission`

## Health Check

```bash
curl http://localhost:39100/health/
```

## Desenvolvimento Local (sem Docker)

```bash
# Backend
cd api
python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:39100

# Frontend
cd frontend
npm install
npm run dev
```

### Configuração de hooks de commit (primeira vez)

```bash
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg
```

## Troubleshooting

**Containers não iniciam:**
```bash
docker-compose logs
docker-compose down -v && docker-compose up -d --build
```

**Banco de dados não conecta:**
- Verifique as variáveis no `.env` (DB_USER, DB_PASSWORD, DB_HOST)
- Confirme que a porta 39102 não está em uso
- Aguarde o healthcheck do PostgreSQL completar

**Migrations com conflito:**
```bash
docker-compose exec api python manage.py migrate --fake-initial
```

## Licença

Este projeto é privado e proprietário.
