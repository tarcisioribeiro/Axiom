# MindLedger

Sistema completo de gestão pessoal com funcionalidades para controle de planejamento pessoal, finanças, dados pessoais e leituras.

## Estrutura do Projeto

```
MindLedger/
├── api/              # Backend Django REST Framework
├── frontend/         # Frontend React + Vite + TypeScript
├── docker-compose.yml
└── .env
```

## Tecnologias

### Backend (API)
- Python 3.12
- Django 5.x
- Django REST Framework
- PostgreSQL 16
- JWT Authentication

### Frontend
- React 19
- TypeScript
- Vite
- TailwindCSS
- Radix UI
- Axios
- Zustand (State Management)
- React Router Dom

## Pré-requisitos

- Docker
- Docker Compose
- (Opcional) Node.js 18+ e Python 3.12+ para desenvolvimento local

## Configuração Rápida

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd MindLedger
```

### 2. Configure as variáveis de ambiente

Execute o script de configuração:

```bash
chmod +x setup-env.sh
./setup-env.sh
```

Ou crie manualmente o arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
# Edite o .env com suas configurações
```

### 3. Inicie os containers

```bash
docker-compose up -d
```

### 4. Execute as migrações do banco de dados

```bash
docker-compose exec api python manage.py migrate
```

### 5. Crie um superusuário (opcional)

```bash
docker-compose exec api python manage.py createsuperuser
```

### 6. Acesse a aplicação

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8002
- **Admin Django**: http://localhost:8002/admin

## Desenvolvimento Local

### Backend

```bash
cd api
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8002
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Comandos Úteis

### Docker

```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f api
docker-compose logs -f frontend

# Parar todos os serviços
docker-compose down

# Reconstruir as imagens
docker-compose build

# Executar comandos no container da API
docker-compose exec api python manage.py <comando>

# Acessar shell do container
docker-compose exec api bash
docker-compose exec frontend sh
```

### Django Management Commands

```bash
# Criar migrações
docker-compose exec api python manage.py makemigrations

# Aplicar migrações
docker-compose exec api python manage.py migrate

# Criar superusuário
docker-compose exec api python manage.py createsuperuser

# Coletar arquivos estáticos
docker-compose exec api python manage.py collectstatic --noinput

# Atualizar balanços
docker-compose exec api python manage.py update_balances

# Configurar permissões
docker-compose exec api python manage.py setup_permissions
```

## Funcionalidades

### Módulos do Sistema

1. **Autenticação**
   - Login/Logout
   - JWT + Cookie-based authentication
   - Gerenciamento de sessões

2. **Contas Bancárias**
   - Cadastro de instituições financeiras
   - Gerenciamento de contas
   - Acompanhamento de saldos

3. **Cartões de Crédito**
   - Cadastro de cartões
   - Dados criptografados
   - Controle de limites e fechamento

4. **Despesas**
   - Registro de despesas
   - Categorização
   - Filtros avançados
   - Status de pagamento

5. **Receitas**
   - Controle de entradas
   - Categorização
   - Visualização consolidada

6. **Empréstimos**
   - Registro de empréstimos
   - Controle de parcelas
   - Acompanhamento de pagamentos

7. **Dashboard**
   - Visão geral financeira
   - Gráficos e estatísticas
   - Resumos por período

8. **Membros**
   - Gerenciamento de membros da família/grupo
   - Associação de transações

## Segurança

- Dados sensíveis criptografados com Fernet
- Autenticação JWT
- Cookies HttpOnly e Secure
- CORS configurado
- Validação de dados no backend e frontend
- Senhas com hash bcrypt

## Backup

Backups do banco de dados podem ser salvos em `./backups/`:

```bash
docker-compose exec db pg_dump -U $DB_USER MindLedger_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

## Restauração

```bash
docker-compose exec -T db psql -U $DB_USER MindLedger_db < backups/seu_backup.sql
```

## Health Check

A API possui um endpoint de health check:

```bash
curl http://localhost:8002/health/
```

## Troubleshooting

### Problema: Containers não iniciam

```bash
# Verificar logs
docker-compose logs

# Limpar volumes e reconstruir
docker-compose down -v
docker-compose up -d --build
```

### Problema: Banco de dados não conecta

- Verifique as variáveis de ambiente no `.env`
- Confirme que a porta 5435 não está em uso
- Aguarde o healthcheck do banco de dados completar

### Problema: Migrations não aplicadas

```bash
docker-compose exec api python manage.py migrate --fake-initial
```

## Licença

Este projeto é privado e proprietário.

## Contribuindo

1. Crie uma branch para sua feature
2. Faça commit das mudanças
3. Abra um Pull Request

## Contato

Para dúvidas ou suporte, entre em contato com a equipe de desenvolvimento.
