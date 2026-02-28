# Autenticação e Segurança do MindLedger

Documentação completa do sistema de autenticação e segurança do MindLedger, incluindo JWT em cookies HttpOnly, sistema de permissões Django e criptografia de dados sensíveis.

## Índice da Documentação

### 1. [Fluxo de Autenticação](./authentication_flow.md)
Documentação completa do sistema de autenticação JWT baseado em cookies HttpOnly, incluindo:
- Arquitetura do sistema de autenticação
- Fluxo de login, refresh e logout
- Middleware JWTCookieMiddleware
- Implementação no frontend (Zustand + Axios)
- Troubleshooting de autenticação

### 2. [Sistema de Permissões](./permissions_system.md)
Sistema de permissões baseado em grupos Django e permissões por modelo:
- Arquitetura de permissões
- GlobalDefaultPermission
- Grupos de usuários (admins, members)
- Management command `setup_permissions`
- Integração com frontend

### 3. [Criptografia de Dados](./data_encryption.md)
Criptografia de campos sensíveis usando Fernet (symmetric encryption):
- FieldEncryption class
- Campos criptografados (CVV, senhas, números de cartão)
- Geração e gerenciamento de ENCRYPTION_KEY
- Implementação em modelos Django
- Rotação de chaves e backups

### 4. [Boas Práticas de Segurança](./security_best_practices.md)
Guia completo de segurança baseado em OWASP Top 10:
- Headers de segurança (CSP, HSTS, X-Frame-Options)
- Proteção contra CSRF, XSS e SQL Injection
- CORS e SameSite cookies
- Auditoria e logging
- Rate limiting e throttling
- Segurança em produção

## Visão Geral do Sistema

### Arquitetura de Segurança

O MindLedger implementa múltiplas camadas de segurança:

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                            │
│  - Cookies HttpOnly (JWT)                              │
│  - CSRF Protection (SameSite)                          │
│  - XSS Protection (Content-Security-Policy)            │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS
                 │
┌────────────────▼────────────────────────────────────────┐
│                  DJANGO MIDDLEWARE                      │
│  - JWTCookieMiddleware (extrai tokens)                 │
│  - AuditLoggingMiddleware (registra ações)             │
│  - SecurityHeadersMiddleware (headers seguros)         │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                   DRF AUTHENTICATION                    │
│  - JWTAuthentication (valida tokens)                   │
│  - GlobalDefaultPermission (controle de acesso)        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                      MODELS                             │
│  - FieldEncryption (Fernet)                            │
│  - Dados sensíveis criptografados em repouso           │
└─────────────────────────────────────────────────────────┘
```

### Principais Componentes

#### 1. Autenticação JWT em Cookies HttpOnly
- **Tokens nunca expostos ao JavaScript** (proteção XSS)
- **Cookies SameSite=Lax** (proteção CSRF)
- **Renovação automática** de tokens expirados
- **Access token**: 15 minutos
- **Refresh token**: 1 hora

#### 2. Sistema de Permissões Granular
- Baseado em grupos Django (admins, members)
- Permissões por modelo e ação (view, add, change, delete)
- GlobalDefaultPermission mapeia HTTP methods para permissões
- Superusuários bloqueados de interfaces específicas

#### 3. Criptografia de Dados Sensíveis
- **Fernet** (symmetric encryption) para dados em repouso
- Campos criptografados:
  - CVV de cartões de crédito
  - Números de cartão de crédito (StoredCreditCard)
  - Senhas armazenadas (Password)
- **ENCRYPTION_KEY** de 44 caracteres (base64)
- **CRÍTICO**: Nunca alterar chave após criptografar dados

#### 4. Auditoria e Logging
- Registro automático de todas as operações (POST, PUT, PATCH, DELETE)
- Informações de usuário, IP, timestamp, duração
- Campos sensíveis automaticamente redatados
- Logs estruturados em JSON

#### 5. Headers de Segurança
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **X-Frame-Options**: DENY
- **Content-Security-Policy**: Política restritiva
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restringe APIs sensíveis

## Configuração Rápida

### Variáveis de Ambiente Críticas

```bash
# Chave secreta Django (50+ caracteres aleatórios)
SECRET_KEY=your-django-secret-key-here

# Chave de criptografia Fernet (44 caracteres base64)
# NUNCA ALTERE após criptografar dados!
ENCRYPTION_KEY=your-fernet-encryption-key-here

# Configuração de segurança
DEBUG=False  # SEMPRE False em produção
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Database (PostgreSQL recomendado)
DB_NAME=mindledger_db
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_HOST=db
DB_PORT=5435
```

### Gerando Chaves Seguras

```bash
# SECRET_KEY (Django)
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# ENCRYPTION_KEY (Fernet)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Checklist de Segurança para Produção

- [ ] `DEBUG=False` no .env
- [ ] `ALLOWED_HOSTS` configurado corretamente
- [ ] HTTPS habilitado (certificado SSL/TLS)
- [ ] `SECURE_SSL_REDIRECT=True` em settings.py
- [ ] Habilitar HSTS em SecurityHeadersMiddleware
- [ ] CORS configurado apenas para domínios confiáveis
- [ ] ENCRYPTION_KEY em vault seguro (não no repositório)
- [ ] Backup da ENCRYPTION_KEY em local seguro
- [ ] PostgreSQL com senha forte
- [ ] Firewall configurado (apenas portas necessárias)
- [ ] Rate limiting configurado adequadamente
- [ ] Logs configurados para monitoramento
- [ ] Dependências atualizadas (`pip list --outdated`)
- [ ] Revisão de segurança com ferramentas (Bandit, Safety)

## Recursos Adicionais

### Ferramentas de Segurança Recomendadas

- **Bandit**: Análise estática de segurança Python
  ```bash
  pip install bandit
  bandit -r api/ -ll
  ```

- **Safety**: Verifica vulnerabilidades em dependências
  ```bash
  pip install safety
  safety check
  ```

- **Django Check**: Verificações integradas do Django
  ```bash
  python manage.py check --deploy
  ```

### Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Django Security](https://docs.djangoproject.com/en/stable/topics/security/)
- [DRF Security](https://www.django-rest-framework.org/topics/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Cryptography (Fernet)](https://cryptography.io/en/latest/fernet/)

## Suporte e Contribuição

Para reportar vulnerabilidades de segurança, entre em contato diretamente com os mantenedores do projeto. **Não abra issues públicas para vulnerabilidades.**

---

**Última atualização**: 2026-01-12
**Versão**: 1.0
