# Workflow de Desenvolvimento

Este guia detalha os comandos e práticas do dia a dia no desenvolvimento do MindLedger.

## Índice

- [Comandos Diários](#comandos-diários)
- [Hot Reload e Desenvolvimento Iterativo](#hot-reload-e-desenvolvimento-iterativo)
- [Debugging e Logs](#debugging-e-logs)
- [Testes Automatizados](#testes-automatizados)
- [Operações de Banco de Dados](#operações-de-banco-de-dados)
- [Comandos Personalizados do Django](#comandos-personalizados-do-django)
- [Qualidade de Código](#qualidade-de-código)
- [Gerenciamento de Dependências](#gerenciamento-de-dependências)

## Comandos Diários

### Iniciando o Ambiente

```bash
# Docker (recomendado)
docker-compose up -d

# Verificar status dos containers
docker-compose ps

# Aguardar todos os serviços ficarem healthy
docker-compose logs -f | grep healthy
```

### Parando o Ambiente

```bash
# Parar todos os containers (mantém volumes)
docker-compose down

# Parar e remover volumes (⚠️ apaga dados!)
docker-compose down -v

# Parar apenas um serviço
docker-compose stop api
```

### Reiniciando Serviços

```bash
# Reiniciar todos os serviços
docker-compose restart

# Reiniciar apenas o backend
docker-compose restart api

# Reiniciar após mudar dependências (rebuild)
docker-compose up -d --build

# Rebuild sem cache (quando há problemas)
docker-compose build --no-cache
docker-compose up -d
```

### Acessando Shells

```bash
# Shell Bash do container API
docker-compose exec api bash

# Shell Python (Django)
docker-compose exec api python manage.py shell

# Shell do PostgreSQL
docker-compose exec db psql -U mindledger_user -d mindledger_db

# Shell do Redis
docker-compose exec redis redis-cli
```

### Comandos Rápidos

```bash
# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f db

# Ver apenas últimas N linhas
docker-compose logs --tail=50 api

# Verificar uso de recursos
docker stats mindledger-api mindledger-db mindledger-redis
```

## Hot Reload e Desenvolvimento Iterativo

O MindLedger está configurado para hot reload automático em desenvolvimento.

### Backend (Django)

**Hot reload está ATIVO por padrão** quando `DEBUG=True`.

```bash
# Qualquer alteração em arquivos .py recarrega automaticamente
# Logs mostrarão:
# Watching for file changes with StatReloader
# Performing system checks...
# Starting development server at http://0.0.0.0:39100/
```

**Arquivos que acionam reload:**
- `*.py` - Código Python
- `*.html` - Templates Django (se usar)

**Arquivos que NÃO acionam reload:**
- `*.md` - Documentação
- `*.txt` - Arquivos de configuração
- `requirements.txt` - Requer rebuild

**Quando o hot reload não funciona:**

```bash
# Reinicie o container
docker-compose restart api

# Se ainda não funcionar, rebuild
docker-compose up -d --build api
```

### Frontend (React + Vite)

**Hot Module Replacement (HMR) está ATIVO por padrão** em desenvolvimento.

```bash
# Qualquer alteração em arquivos .tsx, .ts, .css recarrega automaticamente
# Vite otimiza para recarregar apenas o módulo alterado

# Logs mostrarão:
# VITE v7.2.4 ready in 432 ms
# ➜ Local: http://localhost:3000/
# ➜ Network: http://172.18.0.5:3000/
```

**Arquivos que acionam HMR:**
- `*.tsx`, `*.ts` - Componentes React, services
- `*.css` - Estilos
- `*.json` - Configurações

**Quando o HMR não funciona:**

```bash
# Reinicie o frontend
docker-compose restart frontend

# Limpe cache e reinstale
docker-compose down
docker-compose up -d --build frontend
```

**Desenvolvimento local (sem Docker):**

```bash
# Backend (terminal 1)
cd api
source venv/bin/activate
python manage.py runserver 0.0.0.0:39100

# Frontend (terminal 2)
cd frontend
npm run dev
```

## Debugging e Logs

### Logs do Backend (Django)

```bash
# Logs gerais
docker-compose logs -f api

# Filtrar por nível de log
docker-compose logs api | grep ERROR
docker-compose logs api | grep WARNING

# Logs de requisições HTTP
docker-compose logs api | grep "GET\|POST\|PUT\|DELETE"

# Logs do AI Assistant
docker-compose logs api | grep ai_assistant
```

### Debugging com `print()` e `logger`

**Usar `print()` (simples):**

```python
# Em qualquer arquivo .py
def minha_funcao():
    print("DEBUG: Valor da variável:", variavel)
    # Aparecerá nos logs do container
```

**Usar `logger` (recomendado):**

```python
import logging

logger = logging.getLogger(__name__)

def minha_funcao():
    logger.debug("Valor da variável: %s", variavel)
    logger.info("Operação concluída com sucesso")
    logger.warning("Atenção: valor incomum")
    logger.error("Erro ao processar", exc_info=True)
```

### Debugging Interativo com `pdb`

```python
# Em qualquer arquivo .py, adicione:
import pdb; pdb.set_trace()

# Ou use breakpoint() (Python 3.7+)
breakpoint()
```

**Para funcionar com Docker:**

```bash
# Inicie o container em modo interativo
docker-compose stop api
docker-compose run --rm --service-ports api

# Agora quando o código atingir o breakpoint, você terá acesso ao pdb
```

**Comandos do pdb:**
- `n` - next (próxima linha)
- `s` - step (entrar em função)
- `c` - continue (continuar execução)
- `p variavel` - print (imprimir variável)
- `l` - list (mostrar código ao redor)
- `q` - quit (sair)

### Debugging com VS Code

Crie `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Django",
      "type": "python",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 5678
      },
      "pathMappings": [
        {
          "localRoot": "${workspaceFolder}/api",
          "remoteRoot": "/app"
        }
      ]
    }
  ]
}
```

Adicione `debugpy` ao `requirements.txt` e configure no `settings.py`.

### Logs do Frontend (React)

```bash
# Logs do container
docker-compose logs -f frontend

# Console do navegador (F12)
# Logs aparecem no console do browser
```

**Debugging no navegador:**

```typescript
// Em qualquer componente ou service
console.log("DEBUG:", variavel);
console.error("Erro:", error);
console.table(array); // Exibe array como tabela

// Breakpoint no código
debugger; // Para aqui quando DevTools está aberto
```

**React Developer Tools:**

1. Instale a extensão React DevTools
2. Abra DevTools (F12)
3. Aba "Components" - Inspeciona árvore de componentes
4. Aba "Profiler" - Analisa performance

### Monitoramento de Performance

```bash
# Uso de CPU e memória
docker stats mindledger-api mindledger-db mindledger-redis

# Queries lentas no PostgreSQL
docker-compose exec db psql -U mindledger_user -d mindledger_db -c "
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY total_time DESC
  LIMIT 10;
"
```

## Testes Automatizados

### Testes do Backend (Django)

```bash
# Executar todos os testes
docker-compose exec api python manage.py test

# Executar testes de um app específico
docker-compose exec api python manage.py test accounts
docker-compose exec api python manage.py test authentication

# Executar um teste específico
docker-compose exec api python manage.py test accounts.tests.test_models.AccountModelTest

# Com pytest (mais recursos)
docker-compose exec api pytest

# Com coverage (cobertura de código)
docker-compose exec api pytest --cov=. --cov-report=html

# Abrir relatório de cobertura
# Abre api/htmlcov/index.html no navegador
```

### Testes do Frontend (React)

```bash
# Entrar no container
docker-compose exec frontend sh

# Executar testes (se configurado)
npm run test

# Executar linting
npm run lint

# Build de produção (valida TypeScript)
npm run build
```

### Escrevendo Testes

**Backend - teste de modelo:**

```python
# accounts/tests/test_models.py
from django.test import TestCase
from accounts.models import Account

class AccountModelTest(TestCase):
    def setUp(self):
        self.account = Account.objects.create(
            name="Teste",
            initial_balance=1000.00
        )

    def test_account_creation(self):
        self.assertEqual(self.account.name, "Teste")
        self.assertEqual(self.account.current_balance, 1000.00)

    def test_account_str(self):
        self.assertEqual(str(self.account), "Teste")
```

**Backend - teste de API:**

```python
# accounts/tests/test_api.py
from rest_framework.test import APITestCase
from rest_framework import status

class AccountAPITest(APITestCase):
    def test_list_accounts(self):
        response = self.client.get('/api/v1/accounts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_account(self):
        data = {'name': 'Nova Conta', 'initial_balance': 500}
        response = self.client.post('/api/v1/accounts/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

**Frontend - teste de componente:**

```typescript
// components/ui/button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    screen.getByText('Click me').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Operações de Banco de Dados

### Migrations

```bash
# Criar migrations após mudanças em models.py
docker-compose exec api python manage.py makemigrations

# Aplicar migrations
docker-compose exec api python manage.py migrate

# Ver status das migrations
docker-compose exec api python manage.py showmigrations

# Ver SQL que será executado (sem executar)
docker-compose exec api python manage.py sqlmigrate accounts 0001

# Reverter migrations (⚠️ cuidado!)
docker-compose exec api python manage.py migrate accounts 0001

# Fake migrations (marca como aplicada sem executar)
docker-compose exec api python manage.py migrate --fake
```

### Backup e Restore

```bash
# Criar backup
docker-compose exec db pg_dump -U mindledger_user mindledger_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker-compose exec -T db psql -U mindledger_user mindledger_db < backups/backup_20260112_103045.sql

# Backup de um app específico (apenas dados)
docker-compose exec api python manage.py dumpdata accounts --indent 2 > backups/accounts_data.json

# Restaurar dados de um app
docker-compose exec -T api python manage.py loaddata < backups/accounts_data.json
```

### Queries Diretas

```bash
# Acessar psql
docker-compose exec db psql -U mindledger_user -d mindledger_db

# Exemplos de queries úteis
\dt                           # Listar tabelas
\d accounts_account          # Descrever tabela
\dx                          # Listar extensões (pgvector)

SELECT * FROM accounts_account LIMIT 10;
SELECT COUNT(*) FROM expenses_expense;
SELECT * FROM auth_user WHERE is_superuser = true;
```

### Reset do Banco de Dados

```bash
# ⚠️ ATENÇÃO: Apaga TODOS os dados!

# Método 1: Dropar e recriar banco
docker-compose exec db psql -U mindledger_user -d postgres -c "DROP DATABASE mindledger_db;"
docker-compose exec db psql -U mindledger_user -d postgres -c "CREATE DATABASE mindledger_db OWNER mindledger_user;"
docker-compose exec api python manage.py migrate

# Método 2: Flush (limpa dados, mantém estrutura)
docker-compose exec api python manage.py flush --no-input

# Método 3: Dropar volumes Docker
docker-compose down -v
docker-compose up -d
docker-compose exec api python manage.py migrate
```

## Comandos Personalizados do Django

O MindLedger possui comandos personalizados:

```bash
# Atualizar saldos das contas
docker-compose exec api python manage.py update_balances

# Configurar permissões de grupos de usuários
docker-compose exec api python manage.py setup_permissions

# Processar transferências existentes
docker-compose exec api python manage.py process_existing_transfers

# Criar superuser interativo
docker-compose exec api python manage.py createsuperuser
```

**Criar seu próprio comando:**

```python
# accounts/management/commands/meu_comando.py
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Descrição do meu comando'

    def add_arguments(self, parser):
        parser.add_argument('--param', type=str, help='Parâmetro opcional')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Comando executado!'))
```

Executar:

```bash
docker-compose exec api python manage.py meu_comando --param=valor
```

## Qualidade de Código

### Backend (Python)

```bash
# Formatar código com Black
docker-compose exec api black .

# Organizar imports com isort
docker-compose exec api isort .

# Lint com flake8
docker-compose exec api flake8 .

# Executar todos de uma vez
docker-compose exec api bash -c "black . && isort . && flake8 ."
```

**Configuração do Black:**

```toml
# api/pyproject.toml
[tool.black]
line-length = 100
target-version = ['py311']
exclude = '''
/(
    \.git
  | \.venv
  | migrations
  | __pycache__
)/
'''
```

**Configuração do isort:**

```toml
# api/pyproject.toml
[tool.isort]
profile = "black"
line_length = 100
skip = ["migrations", ".venv"]
```

**Configuração do flake8:**

```ini
# api/.flake8
[flake8]
max-line-length = 100
exclude = .git,__pycache__,*/migrations/*,venv
ignore = E203, W503
```

### Frontend (TypeScript)

```bash
# Lint com ESLint
cd frontend
npm run lint

# Lint com auto-fix
npm run lint -- --fix

# Type check com TypeScript
npx tsc --noEmit

# Formatar com Prettier (se configurado)
npx prettier --write "src/**/*.{ts,tsx}"
```

**Configuração do ESLint:**

```javascript
// frontend/eslint.config.js
export default {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

### Pre-commit Hooks (Opcional)

Crie `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running code quality checks..."

# Backend
docker-compose exec -T api black --check . || exit 1
docker-compose exec -T api flake8 . || exit 1

# Frontend
cd frontend && npm run lint || exit 1

echo "All checks passed!"
```

## Gerenciamento de Dependências

### Backend (Python)

```bash
# Instalar nova dependência
docker-compose exec api pip install nome-do-pacote

# Atualizar requirements.txt
docker-compose exec api pip freeze > api/requirements.txt

# Reinstalar dependências após atualizar requirements.txt
docker-compose up -d --build api
```

### Frontend (npm)

```bash
# Instalar nova dependência
docker-compose exec frontend npm install nome-do-pacote

# Instalar dependência de desenvolvimento
docker-compose exec frontend npm install --save-dev nome-do-pacote

# Atualizar dependências
docker-compose exec frontend npm update

# Reconstruir após adicionar dependências
docker-compose up -d --build frontend
```

### Atualizando Versões

**Python packages:**

```bash
# Ver pacotes desatualizados
docker-compose exec api pip list --outdated

# Atualizar específico
docker-compose exec api pip install --upgrade django

# Congelar versões
docker-compose exec api pip freeze > api/requirements.txt
```

**npm packages:**

```bash
# Ver pacotes desatualizados
cd frontend
npm outdated

# Atualizar específico
npm update react

# Atualizar para latest (pode quebrar)
npm install react@latest
```

## Fluxo de Trabalho Típico

### Adicionando uma Nova Feature

1. **Criar branch**
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. **Desenvolver** (com hot reload ativo)
   ```bash
   docker-compose up -d
   # Editar código
   # Ver mudanças automaticamente
   ```

3. **Testar**
   ```bash
   docker-compose exec api python manage.py test
   cd frontend && npm run lint
   ```

4. **Code quality**
   ```bash
   docker-compose exec api black .
   docker-compose exec api flake8 .
   ```

5. **Commit**
   ```bash
   git add .
   git commit -m "feat: adiciona nova feature X"
   ```

6. **Push e PR**
   ```bash
   git push origin feature/nome-da-feature
   # Criar Pull Request no GitHub
   ```

## Próximos Passos

- Leia o [Guia de Contribuição](./contribution_guide.md) para padrões de código
- Consulte [Troubleshooting](./troubleshooting.md) para resolver problemas
- Veja [Configuração](./configuration.md) para ajustes avançados

---

**Dica**: Mantenha o `docker-compose logs -f` sempre aberto em um terminal separado!
