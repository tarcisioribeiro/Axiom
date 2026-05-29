# Configuração de Email

O Axiom usa o backend de email do Django para envio de notificações, links de redefinição de senha e emails transacionais. Todas as configurações ficam na categoria `email` do painel admin e podem ser alteradas **sem reiniciar o container**.

## Índice

- [Visão Geral das Configurações](#visão-geral-das-configurações)
- [Configuração por Provedor](#configuração-por-provedor)
  - [Gmail](#gmail)
  - [Outlook / Microsoft 365](#outlook--microsoft-365)
  - [Amazon SES](#amazon-ses)
  - [SendGrid](#sendgrid)
  - [Servidor SMTP Próprio](#servidor-smtp-próprio)
- [Modo de Desenvolvimento](#modo-de-desenvolvimento)
- [Verificando a Configuração](#verificando-a-configuração)
- [Solução de Problemas](#solução-de-problemas)

---

## Visão Geral das Configurações

| Chave | Label no Painel | Obrigatória | Padrão | Requer Restart |
|-------|----------------|-------------|--------|----------------|
| `EMAIL_BACKEND` | Backend de Email | Sim | `smtp.EmailBackend` | Não |
| `EMAIL_HOST` | Servidor SMTP | Sim | `localhost` | Não |
| `EMAIL_PORT` | Porta SMTP | Sim | `587` | Não |
| `EMAIL_USE_TLS` | Usar TLS | Sim | `True` | Não |
| `EMAIL_HOST_USER` | Usuário SMTP | Sim | — | Não |
| `EMAIL_HOST_PASSWORD` | Senha SMTP 🔒 | Sim | — | Não |
| `DEFAULT_FROM_EMAIL` | Email Remetente | Sim | `Axiom <noreply@axiom.app>` | Não |
| `SITE_URL` | URL do Site | Recomendado | — | Não |

> 🔒 Campos marcados com este ícone são armazenados **criptografados** no banco de dados e exibidos como `••••••••` no painel.

### Descrição detalhada de cada chave

**`EMAIL_BACKEND`**
Classe Python do backend de email do Django.
- **Produção**: `django.core.mail.backends.smtp.EmailBackend`
- **Desenvolvimento** (imprime no terminal em vez de enviar): `django.core.mail.backends.console.EmailBackend`

**`EMAIL_HOST`**
Endereço (hostname) do servidor SMTP. Exemplos: `smtp.gmail.com`, `smtp.office365.com`, `email-smtp.us-east-1.amazonaws.com`.

**`EMAIL_PORT`**
Porta do servidor SMTP. As opções comuns são:
- `587` — STARTTLS (mais comum, use com `EMAIL_USE_TLS=True`)
- `465` — SSL implícito (use com `EMAIL_USE_SSL=True` e `EMAIL_USE_TLS=False`)
- `25` — sem criptografia (não recomendado em produção)

**`EMAIL_USE_TLS`**
Ativa STARTTLS (`True`/`False`). Use com porta `587`. **Nunca defina `EMAIL_USE_TLS=True` e `EMAIL_USE_SSL=True` ao mesmo tempo.**

**`EMAIL_HOST_USER`**
Usuário para autenticação SMTP — geralmente o endereço de email completo.

**`EMAIL_HOST_PASSWORD`**
Senha para autenticação SMTP. Armazenada criptografada. Para Gmail, use uma **App Password** (não a senha da conta Google).

**`DEFAULT_FROM_EMAIL`**
Endereço exibido no campo "De" dos emails. Formato recomendado: `Nome <email@dominio.com>`. O endereço deve estar autorizado pelo provedor SMTP para evitar rejeição como spam.

**`SITE_URL`**
URL pública do frontend, usada para gerar links clicáveis dentro dos emails (ex: link de redefinição de senha). Exemplo: `https://axiom.seudominio.com`.

---

## Configuração por Provedor

### Gmail

O Gmail bloqueia login via senha de conta quando a verificação em duas etapas está ativa. É necessário criar uma **App Password** (senha de aplicativo) dedicada.

#### Passo a passo para criar a App Password

1. Acesse [myaccount.google.com](https://myaccount.google.com).
2. Vá em **Segurança** → **Verificação em duas etapas** (ative se ainda não estiver ativa).
3. Ainda em **Segurança**, procure por **Senhas de app** (ou acesse diretamente: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Em "Selecionar app", escolha **Outro (nome personalizado)** e escreva `Axiom`.
5. Clique em **Gerar**.
6. Copie a senha de 16 caracteres exibida (ela só aparece uma vez).

#### Valores para o painel admin

| Chave | Valor |
|-------|-------|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USE_TLS` | `True` |
| `EMAIL_HOST_USER` | `seu@gmail.com` |
| `EMAIL_HOST_PASSWORD` | senha de 16 caracteres gerada acima |
| `DEFAULT_FROM_EMAIL` | `Axiom <seu@gmail.com>` |

> **⚠️ Atenção**: contas Gmail gratuitas têm limite de 500 emails/dia. Para volumes maiores, use o **Google Workspace** ou um provedor transacional (SES, SendGrid).

---

### Outlook / Microsoft 365

O Microsoft 365 requer que o **SMTP AUTH** esteja habilitado para a caixa de correio.

#### Habilitando SMTP AUTH no Microsoft 365

1. Acesse o [Centro de Administração do Microsoft 365](https://admin.microsoft.com).
2. Vá em **Usuários** → **Usuários Ativos** → selecione o usuário.
3. Na aba **Email**, clique em **Gerenciar configurações de email**.
4. Ative **SMTP Autenticado**.

> Para contas pessoais Outlook.com (hotmail.com, outlook.com), o SMTP AUTH geralmente já está disponível.

#### Valores para o painel admin

| Chave | Valor |
|-------|-------|
| `EMAIL_HOST` | `smtp.office365.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USE_TLS` | `True` |
| `EMAIL_HOST_USER` | `seu@seudominio.com` |
| `EMAIL_HOST_PASSWORD` | senha da conta Microsoft |
| `DEFAULT_FROM_EMAIL` | `Axiom <seu@seudominio.com>` |

---

### Amazon SES

O Amazon SES é um serviço de email transacional escalável. Novos ambientes ficam em **modo sandbox** (só pode enviar para endereços verificados). Solicite acesso à produção pelo Console da AWS antes de usar em produção.

#### Criando credenciais SMTP no SES

1. Acesse o [Console AWS SES](https://console.aws.amazon.com/ses/).
2. No menu lateral, clique em **SMTP Settings**.
3. Clique em **Create SMTP credentials**.
4. Dê um nome ao usuário IAM (ex: `axiom-smtp`) e clique em **Create**.
5. Faça download ou copie o **SMTP Username** e a **SMTP Password** gerados — eles só aparecem uma vez.

> As credenciais SMTP do SES **são diferentes** das chaves de API da AWS. Não use sua `AWS_ACCESS_KEY_ID` diretamente.

#### Identificando o endpoint SMTP da sua região

O host varia por região. Exemplos:
- `us-east-1` → `email-smtp.us-east-1.amazonaws.com`
- `sa-east-1` → `email-smtp.sa-east-1.amazonaws.com`
- `eu-west-1` → `email-smtp.eu-west-1.amazonaws.com`

Confira no console SES em **SMTP Settings** → **SMTP endpoint**.

#### Valores para o painel admin

| Chave | Valor |
|-------|-------|
| `EMAIL_HOST` | `email-smtp.<sua-regiao>.amazonaws.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USE_TLS` | `True` |
| `EMAIL_HOST_USER` | SMTP Username gerado no Console SES |
| `EMAIL_HOST_PASSWORD` | SMTP Password gerado no Console SES |
| `DEFAULT_FROM_EMAIL` | `Axiom <noreply@seudominio.com>` (domínio verificado no SES) |

---

### SendGrid

O SendGrid usa a própria chave de API como senha SMTP, com o usuário fixo `apikey`.

#### Criando uma chave de API com permissão de envio

1. Acesse [app.sendgrid.com](https://app.sendgrid.com).
2. Vá em **Settings** → **API Keys** → **Create API Key**.
3. Escolha **Restricted Access** e ative apenas **Mail Send** (Full Access).
4. Clique em **Create & View** e copie a chave (começa com `SG.`).

#### Valores para o painel admin

| Chave | Valor |
|-------|-------|
| `EMAIL_HOST` | `smtp.sendgrid.net` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USE_TLS` | `True` |
| `EMAIL_HOST_USER` | `apikey` (literal, não muda) |
| `EMAIL_HOST_PASSWORD` | chave API gerada (começa com `SG.`) |
| `DEFAULT_FROM_EMAIL` | `Axiom <noreply@seudominio.com>` (domínio autenticado no SendGrid) |

---

### Servidor SMTP Próprio

Se você opera um servidor de email próprio (Postfix, Exim, etc.):

| Chave | Valor |
|-------|-------|
| `EMAIL_HOST` | IP ou hostname do seu servidor (ex: `mail.seudominio.com`) |
| `EMAIL_PORT` | `587` (STARTTLS) ou `465` (SSL) |
| `EMAIL_USE_TLS` | `True` para porta 587; `False` para porta 465 |
| `EMAIL_HOST_USER` | Usuário de autenticação SMTP |
| `EMAIL_HOST_PASSWORD` | Senha SMTP |
| `DEFAULT_FROM_EMAIL` | `Axiom <noreply@seudominio.com>` |

---

## Modo de Desenvolvimento

Para desenvolvimento local, em vez de configurar um servidor SMTP real, use o backend de console — os emails são impressos no stdout do container:

```
EMAIL_BACKEND = django.core.mail.backends.console.EmailBackend
```

Visualize no terminal:

```bash
docker compose logs -f api | grep -A 20 "Content-Type: text/plain"
```

O health check retornará `"status": "not_configured"` com a mensagem `"Backend de console ativo (desenvolvimento)"` — isso é esperado e não indica erro.

---

## Verificando a Configuração

### Pelo painel admin (recomendado)

Após salvar as configurações, use o botão **Enviar email de teste** na UI do painel admin, ou chame o endpoint diretamente:

```bash
curl -X POST http://localhost:39100/api/v1/admin/email/test/ \
  -H "Content-Type: application/json" \
  -d '{"to_email": "seu@email.com"}' \
  -b "access_token=<seu_token>"
```

**Resposta de sucesso:**
```json
{"message": "Email enviado para seu@email.com com sucesso."}
```

**Resposta de falha:**
```json
{"error": "Falha ao enviar email: (535, b'5.7.8 Username and Password not accepted...')"}
```

### Pelo health check

```bash
curl http://localhost:39100/api/v1/admin/health/ -b "access_token=<seu_token>" \
  | python -m json.tool | grep -A 2 '"email"'
```

---

## Solução de Problemas

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| `(535) Authentication credentials invalid` | Senha incorreta ou App Password não criada | Verifique `EMAIL_HOST_PASSWORD`; para Gmail, crie uma App Password |
| `(534) Please log in via your web browser` | Acesso menos seguro bloqueado | Use App Password no Gmail ou habilite SMTP AUTH no Microsoft 365 |
| `Connection refused` | Host ou porta errados | Verifique `EMAIL_HOST` e `EMAIL_PORT`; teste com `telnet smtp.gmail.com 587` |
| `SSL: WRONG_VERSION_NUMBER` | `EMAIL_USE_TLS` e `EMAIL_USE_SSL` ambos `True` | Deixe apenas `EMAIL_USE_TLS=True` com porta 587 |
| Email entregue mas vai para spam | `DEFAULT_FROM_EMAIL` com domínio não verificado | Configure SPF/DKIM/DMARC no DNS do domínio remetente |
| `EMAIL_HOST não configurado` | `EMAIL_HOST` está vazio no banco | Preencha `EMAIL_HOST` no painel admin |
