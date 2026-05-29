# Funcionalidades Pendentes de Implementação

Este documento cataloga funcionalidades que possuem infraestrutura parcial no codebase mas que ainda precisam de trabalho para funcionar completamente. Cada seção descreve o que já existe, o que falta, e um guia detalhado de como implementar.

## Índice

- [Notificações por Email](#1-notificações-por-email)
- [Reset de Senha](#2-reset-de-senha)
- [Confirmação de Email no Cadastro](#3-confirmação-de-email-no-cadastro)
- [Export ZIP do Módulo Security](#4-export-zip-do-módulo-security)
- [Import de Extrato Bancário — Frontend](#5-import-de-extrato-bancário--frontend)
- [Vault Health Report — Página Dedicada](#6-vault-health-report--página-dedicada)
- [2FA / Autenticação de Dois Fatores](#7-2fa--autenticação-de-dois-fatores)

---

## Status Geral

| Funcionalidade | Backend | Frontend | Esforço estimado |
|---|---|---|---|
| Notificações por email | ✅ Pronto | ✅ Pronto | Baixo — só configuração |
| Reset de senha | ❌ Falta tudo | ❌ Falta tudo | Médio |
| Confirmação de email | ❌ Falta tudo | ❌ Falta tudo | Médio |
| Export ZIP (Security) | ❌ Falta endpoint | ❌ Falta UI | Médio |
| Import extrato (frontend) | ✅ Pronto | 🚧 Incompleto | Baixo |
| Vault Health Report UI | ✅ Pronto | ✅ Implementado | — |
| 2FA / TOTP | ❌ Falta tudo | ❌ Falta tudo | Alto |

---

## 1. Notificações por Email

### O que já existe

- ✅ `api/notifications/services.py` — `NotificationEmailService` completo com método `send_notification_email()`
- ✅ `api/notifications/templates/email/notification_email.html` — template HTML responsivo
- ✅ `api/notifications/management/commands/send_due_notifications.py` — command para acionar via cron
- ✅ `api/notifications/models.py` — `Notification` e `NotificationPreference` (canal: in_app / email / both)
- ✅ `frontend/src/pages/NotificationPreferences.tsx` — UI de preferências completamente funcional
- ✅ `api/app/settings.py` (linhas 437–456) — backend SMTP configurável via variáveis de ambiente

### O que falta

- ❌ Variáveis de ambiente SMTP não preenchidas no `.env`
- ❌ Cron job não configurado para disparar o management command

### Como implementar

#### Passo 1 — Configurar variáveis de ambiente SMTP

Adicione as seguintes variáveis ao `.env` da raiz do projeto:

```bash
# ============================================
# EMAIL CONFIGURATION
# ============================================

# Backend de email (smtp para produção; console para desenvolvimento)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend

# Host SMTP
# Gmail: smtp.gmail.com
# SendGrid: smtp.sendgrid.net
# Mailgun: smtp.mailgun.org
EMAIL_HOST=smtp.gmail.com

# Porta SMTP
# 587 com TLS (recomendado)
# 465 com SSL
# 25 sem criptografia (não recomendado)
EMAIL_PORT=587

# Ativar TLS (recomendado para porta 587)
EMAIL_USE_TLS=True

# Ativar SSL (alternativo ao TLS, para porta 465)
EMAIL_USE_SSL=False

# Endereço de email remetente
EMAIL_HOST_USER=noreply@seudominio.com

# Senha ou token do email remetente
# Gmail: use uma App Password (não a senha normal da conta)
# SendGrid: use a API key
EMAIL_HOST_PASSWORD=sua_senha_ou_app_password_aqui

# Endereço padrão de "remetente" (aparece no "De:" do email)
DEFAULT_FROM_EMAIL=Axiom <noreply@seudominio.com>
```

> **💡 Gmail**: Para usar o Gmail como SMTP, é necessário criar uma **App Password** em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). A conta deve ter verificação em duas etapas ativada.

> **💡 Desenvolvimento**: Para testar sem enviar emails reais, use o backend console:
> ```bash
> EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
> ```
> Os emails serão exibidos no terminal do container.

#### Passo 2 — Verificar que o settings.py lê as variáveis

As variáveis já são lidas corretamente em `api/app/settings.py`:

```python
# api/app/settings.py (linhas 437-456) — já implementado, apenas verificar
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
```

#### Passo 3 — Testar envio manual

```bash
# Abrir shell Django
docker compose exec api python manage.py shell

# Testar envio direto
from django.core.mail import send_mail
send_mail(
    subject='Teste Axiom',
    message='Funcionou!',
    from_email='noreply@seudominio.com',
    recipient_list=['seu@email.com'],
)
```

#### Passo 4 — Configurar cron job para notificações automáticas

O management command `send_due_notifications` já está implementado. Configure um cron no host ou no container:

**Opção A — crontab no servidor**

```bash
# Adicionar ao crontab do servidor
crontab -e

# Executar todo dia às 8h da manhã (horário de Brasília)
0 8 * * * docker compose -f /caminho/para/docker-compose.yml exec -T api python manage.py send_due_notifications >> /var/log/axiom-notifications.log 2>&1
```

**Opção B — adicionar ao docker-compose.yml como serviço separado**

```yaml
# docker-compose.yml — adicionar serviço
scheduler:
  build:
    context: .
    dockerfile: api/Dockerfile
  command: >
    sh -c "while true; do
      python manage.py send_due_notifications;
      sleep 86400;
    done"
  env_file:
    - .env
  depends_on:
    - db
    - redis
```

#### Passo 5 — Testar o fluxo completo

```bash
# Disparar notificações manualmente
docker compose exec api python manage.py send_due_notifications

# Ver logs
docker compose logs api | grep notification
```

---

## 2. Reset de Senha

### O que já existe

- ✅ Sistema JWT completo em `api/authentication/views.py`
- ✅ Middleware de autenticação em `api/authentication/middleware.py`
- ✅ Configuração SMTP em `api/app/settings.py`
- ✅ Página de login em `frontend/src/pages/Login.tsx`
- ✅ Serviço de email em `api/notifications/services.py` (pode ser reutilizado)

### O que falta

- ❌ View `PasswordResetRequestView` (backend)
- ❌ View `PasswordResetConfirmView` (backend)
- ❌ Model ou tabela para tokens de reset
- ❌ Endpoint `/api/v1/auth/password-reset/` (backend)
- ❌ Endpoint `/api/v1/auth/password-reset/confirm/` (backend)
- ❌ Template de email para reset
- ❌ Página `/forgot-password` (frontend)
- ❌ Página `/reset-password/:token` (frontend)
- ❌ Link "Esqueci minha senha" na página de login

### Como implementar

#### Passo 1 — Criar model de token de reset

O Django possui `django.contrib.auth.tokens.PasswordResetTokenGenerator` nativo. Não é necessário criar uma tabela nova — o token é gerado de forma stateless a partir do hash da senha atual + timestamp + user ID.

```python
# api/authentication/utils.py — criar este arquivo
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth import get_user_model

User = get_user_model()
token_generator = PasswordResetTokenGenerator()


def generate_reset_token(user):
    """Gera uidb64 e token para reset de senha."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    return uid, token


def validate_reset_token(uidb64, token):
    """Valida token de reset. Retorna user ou None."""
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None

    if token_generator.check_token(user, token):
        return user
    return None
```

#### Passo 2 — Criar template de email para reset

```html
<!-- api/authentication/templates/email/password_reset_email.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Redefinição de Senha — Axiom</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2 style="color: #6d28d9;">Axiom</h2>
    <h3>Redefinição de Senha</h3>
    <p>Olá, {{ user.username }}!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <a href="{{ reset_url }}"
       style="display: inline-block; background: #6d28d9; color: #fff;
              padding: 12px 24px; border-radius: 6px; text-decoration: none;
              margin: 16px 0;">
      Redefinir Senha
    </a>
    <p style="color: #666; font-size: 14px;">
      Este link é válido por <strong>24 horas</strong>.<br>
      Se você não solicitou a redefinição, ignore este email.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #999; font-size: 12px;">Axiom — Gestão Financeira Pessoal</p>
  </div>
</body>
</html>
```

#### Passo 3 — Criar as views de reset

```python
# api/authentication/views.py — adicionar ao final do arquivo

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .utils import generate_reset_token, validate_reset_token


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/
    Body: { "email": "user@example.com" }

    Envia email com link de reset. Retorna 200 mesmo se email não existe
    (para não revelar se o email está cadastrado).
    """
    permission_classes = (AllowAny,)
    throttle_classes = ()  # adicionar throttle se necessário

    def post(self, request):
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"detail": "Email é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Buscar usuário — resposta 200 mesmo se não encontrado
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            uid, token = generate_reset_token(user)

            frontend_url = settings.FRONTEND_URL  # adicionar ao .env
            reset_url = f"{frontend_url}/reset-password/{uid}/{token}/"

            html_message = render_to_string(
                "email/password_reset_email.html",
                {"user": user, "reset_url": reset_url},
            )

            send_mail(
                subject="Redefinição de Senha — Axiom",
                message=f"Acesse: {reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=True,
            )
        except User.DoesNotExist:
            pass  # não revelar que o email não existe

        return Response(
            {"detail": "Se este email estiver cadastrado, você receberá as instruções em breve."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/
    Body: { "uid": "...", "token": "...", "new_password": "...", "confirm_password": "..." }
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not all([uid, token, new_password, confirm_password]):
            return Response(
                {"detail": "Todos os campos são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "As senhas não coincidem."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "A senha deve ter pelo menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = validate_reset_token(uid, token)
        if user is None:
            return Response(
                {"detail": "Link inválido ou expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response(
            {"detail": "Senha redefinida com sucesso."},
            status=status.HTTP_200_OK,
        )
```

#### Passo 4 — Registrar as URLs

```python
# api/authentication/urls.py — adicionar as rotas

from .views import PasswordResetRequestView, PasswordResetConfirmView

urlpatterns = [
    # ... rotas existentes ...
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
```

#### Passo 5 — Adicionar FRONTEND_URL ao .env

```bash
# .env
FRONTEND_URL=http://localhost:39101
# Em produção: FRONTEND_URL=https://seudominio.com
```

E ler no settings.py:

```python
# api/app/settings.py
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:39101")
```

#### Passo 6 — Criar o serviço no frontend

```typescript
// frontend/src/services/auth-service.ts — adicionar métodos

async requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/password-reset/', { email });
}

async confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  await apiClient.post('/auth/password-reset/confirm/', {
    uid,
    token,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}
```

#### Passo 7 — Criar páginas no frontend

**Arquivo**: `frontend/src/pages/ForgotPassword.tsx`

Deve conter:
- Formulário com campo de email
- Botão "Enviar instruções"
- Mensagem de sucesso após envio
- Link de volta para Login

**Arquivo**: `frontend/src/pages/ResetPassword.tsx`

Deve conter:
- Campos "Nova senha" e "Confirmar senha"
- Lê `uid` e `token` da URL (`useParams`)
- Chama `confirmPasswordReset()` ao submeter
- Redireciona para `/login` após sucesso
- Exibe erro se token inválido/expirado

#### Passo 8 — Adicionar rotas no router

```typescript
// frontend/src/App.tsx ou router — adicionar rotas públicas

{ path: '/forgot-password', element: <ForgotPassword /> },
{ path: '/reset-password/:uid/:token', element: <ResetPassword /> },
```

#### Passo 9 — Adicionar link na página de Login

```tsx
// frontend/src/pages/Login.tsx — adicionar abaixo do botão de login

<Link to="/forgot-password" className="text-sm text-muted-foreground hover:underline">
  Esqueci minha senha
</Link>
```

---

## 3. Confirmação de Email no Cadastro

### O que já existe

- ✅ `api/authentication/views.py` — função `create_user_with_member()` salva o email
- ✅ `api/members/models.py` — campo `email` no model `Member`
- ✅ `api/app/settings.py` — SMTP configurável
- ✅ `frontend/src/pages/Register.tsx` — formulário de cadastro completo

### O que falta

- ❌ Campo `email_verified` no model `User` ou `Member`
- ❌ Token de verificação de email
- ❌ Endpoint `/api/v1/auth/verify-email/`
- ❌ Envio de email de boas-vindas + link de verificação
- ❌ Página `/verify-email/:token` (frontend)
- ❌ Banner/aviso de "email não verificado" na UI

### Como implementar

#### Passo 1 — Adicionar campo ao model Member

```python
# api/members/models.py — adicionar campo ao model Member

email_verified = models.BooleanField(default=False)
email_verification_token = models.UUIDField(null=True, blank=True)
email_verification_sent_at = models.DateTimeField(null=True, blank=True)
```

Após editar, criar e aplicar a migration:

```bash
docker compose exec api python manage.py makemigrations members
docker compose exec api python manage.py migrate
```

> **⚠️ ATENÇÃO**: Sempre execute `makemigrations` localmente e comite os arquivos gerados antes de fazer push. O entrypoint do container executa `--check --dry-run` e recusa iniciar se houver migrations pendentes.

#### Passo 2 — Criar template de email de verificação

```html
<!-- api/authentication/templates/email/email_verification.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Confirme seu Email — Axiom</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
    <h2 style="color: #6d28d9;">Bem-vindo ao Axiom!</h2>
    <p>Olá, {{ user.username }}! Sua conta foi criada com sucesso.</p>
    <p>Para ativar sua conta, confirme seu endereço de email:</p>
    <a href="{{ verification_url }}"
       style="display: inline-block; background: #6d28d9; color: #fff;
              padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
      Confirmar Email
    </a>
    <p style="color: #666; font-size: 14px;">Este link é válido por <strong>48 horas</strong>.</p>
  </div>
</body>
</html>
```

#### Passo 3 — Criar view de verificação

```python
# api/authentication/views.py — adicionar

import uuid
from django.utils import timezone

class EmailVerificationSendView(APIView):
    """POST /api/v1/auth/verify-email/send/ — reenvia email de verificação."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        member = request.user.member
        if member.email_verified:
            return Response({"detail": "Email já verificado."}, status=status.HTTP_200_OK)

        token = uuid.uuid4()
        member.email_verification_token = token
        member.email_verification_sent_at = timezone.now()
        member.save(update_fields=["email_verification_token", "email_verification_sent_at"])

        verification_url = f"{settings.FRONTEND_URL}/verify-email/{token}/"
        html_message = render_to_string(
            "email/email_verification.html",
            {"user": request.user, "verification_url": verification_url},
        )
        send_mail(
            subject="Confirme seu Email — Axiom",
            message=f"Acesse: {verification_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[request.user.email],
            html_message=html_message,
            fail_silently=True,
        )
        return Response({"detail": "Email de verificação enviado."}, status=status.HTTP_200_OK)


class EmailVerificationConfirmView(APIView):
    """GET /api/v1/auth/verify-email/confirm/?token=<uuid> — confirma o token."""
    permission_classes = (AllowAny,)

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            return Response({"detail": "Token ausente."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = Member.objects.get(email_verification_token=token)
        except Member.DoesNotExist:
            return Response({"detail": "Token inválido."}, status=status.HTTP_400_BAD_REQUEST)

        # Token expira em 48h
        if member.email_verification_sent_at:
            elapsed = timezone.now() - member.email_verification_sent_at
            if elapsed.total_seconds() > 172800:  # 48h
                return Response({"detail": "Token expirado."}, status=status.HTTP_400_BAD_REQUEST)

        member.email_verified = True
        member.email_verification_token = None
        member.save(update_fields=["email_verified", "email_verification_token"])

        return Response({"detail": "Email confirmado com sucesso."}, status=status.HTTP_200_OK)
```

#### Passo 4 — Disparar verificação no registro

```python
# api/authentication/views.py — função create_user_with_member()
# Após criar o usuário, adicionar:

# Enviar email de verificação em background
token = uuid.uuid4()
member.email_verification_token = token
member.email_verification_sent_at = timezone.now()
member.save(update_fields=["email_verification_token", "email_verification_sent_at"])

# Enviar email (fail_silently=True para não bloquear o cadastro)
verification_url = f"{settings.FRONTEND_URL}/verify-email/{token}/"
# ... send_mail(...)
```

#### Passo 5 — Frontend

- **Página** `frontend/src/pages/VerifyEmail.tsx`: lê token da URL, chama o endpoint confirm, exibe sucesso/erro
- **Rota pública**: `/verify-email/:token`
- **Banner opcional**: em `frontend/src/components/common/PageContainer.tsx` ou similar, verificar se `user.member.email_verified === false` e exibir aviso com botão "Reenviar email"

---

## 4. Export ZIP do Módulo Security

### O que já existe

- ✅ `api/security/views.py` — `ArchiveDownloadView` (download individual de arquivo)
- ✅ `api/security/models.py` — models completos: `Password`, `StoredCreditCard`, `StoredBankAccount`, `Archive`
- ✅ `api/app/export_utils.py` — utilitários de export CSV/PDF (referência de padrão)
- ✅ Vault unlock/lock com `VaultLockedMixin`
- ✅ Páginas frontend: `Passwords.tsx`, `StoredCards.tsx`, `StoredAccounts.tsx`, `Archives.tsx`

### O que falta

- ❌ Endpoint `GET /api/v1/security/export/zip/` no backend
- ❌ Botão "Exportar cofre" na UI do frontend
- ❌ Geração de ZIP em memória com arquivos + CSV de credenciais

### Como implementar

#### Passo 1 — Criar a view de export ZIP

```python
# api/security/views.py — adicionar ao final

import csv
import io
import zipfile
from django.http import HttpResponse
from django.utils import timezone


class VaultExportZipView(APIView):
    """
    GET /api/v1/security/vault/export/
    Requer vault desbloqueado. Gera ZIP com:
    - passwords.csv
    - stored_cards.csv
    - stored_accounts.csv
    - archives/ (arquivos binários)
    """
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)

    def get(self, request):
        # Verificar vault desbloqueado
        vault_key = get_vault_key_from_cache(request.user.id)  # helper já existente
        if vault_key is None:
            return Response(
                {"detail": "Cofre bloqueado. Desbloqueie antes de exportar."},
                status=status.HTTP_403_FORBIDDEN,
            )

        buffer = io.BytesIO()

        with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            # --- passwords.csv ---
            passwords = Password.objects.filter(
                owner=request.user, is_deleted=False
            )
            pw_buf = io.StringIO()
            pw_writer = csv.writer(pw_buf)
            pw_writer.writerow(["Nome", "URL", "Usuário", "Senha", "Notas", "Atualizado em"])
            for pw in passwords:
                pw_writer.writerow([
                    pw.name,
                    pw.url or "",
                    pw.username or "",
                    pw.decrypt_password(vault_key),  # decriptografar com vault_key
                    pw.notes or "",
                    pw.updated_at.strftime("%Y-%m-%d"),
                ])
            zf.writestr("passwords.csv", pw_buf.getvalue())

            # --- stored_cards.csv ---
            cards = StoredCreditCard.objects.filter(
                owner=request.user, is_deleted=False
            )
            cards_buf = io.StringIO()
            cards_writer = csv.writer(cards_buf)
            cards_writer.writerow(["Nome", "Número", "Validade", "CVV", "Banco", "Notas"])
            for card in cards:
                cards_writer.writerow([
                    card.name,
                    card.decrypt_card_number(vault_key),
                    card.expiration_date or "",
                    card.decrypt_cvv(vault_key),
                    card.bank_name or "",
                    card.notes or "",
                ])
            zf.writestr("stored_cards.csv", cards_buf.getvalue())

            # --- stored_accounts.csv ---
            accounts = StoredBankAccount.objects.filter(
                owner=request.user, is_deleted=False
            )
            acc_buf = io.StringIO()
            acc_writer = csv.writer(acc_buf)
            acc_writer.writerow(["Banco", "Agência", "Conta", "Tipo", "Notas"])
            for acc in accounts:
                acc_writer.writerow([
                    acc.bank_name,
                    acc.decrypt_agency(vault_key),
                    acc.decrypt_account_number(vault_key),
                    acc.account_type or "",
                    acc.notes or "",
                ])
            zf.writestr("stored_accounts.csv", acc_buf.getvalue())

            # --- archives/ ---
            archives = Archive.objects.filter(
                owner=request.user, is_deleted=False
            )
            for archive in archives:
                # Ler arquivo do MinIO/storage
                try:
                    file_content = archive.file.read()
                    zf.writestr(f"archives/{archive.filename}", file_content)
                except Exception:
                    pass  # pular arquivo se falhar leitura

        buffer.seek(0)
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        filename = f"axiom_vault_{timestamp}.zip"

        response = HttpResponse(buffer.read(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
```

#### Passo 2 — Registrar a URL

```python
# api/security/urls.py — adicionar

from .views import VaultExportZipView

urlpatterns = [
    # ... rotas existentes ...
    path("vault/export/", VaultExportZipView.as_view(), name="vault-export-zip"),
]
```

#### Passo 3 — Criar serviço no frontend

```typescript
// frontend/src/services/security-service.ts — adicionar método

async exportVaultZip(): Promise<void> {
  const response = await apiClient.get('/security/vault/export/', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `axiom_vault_${timestamp}.zip`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
```

#### Passo 4 — Adicionar botão na UI

Adicionar um botão "Exportar cofre" em `frontend/src/pages/Passwords.tsx` (ou criar uma página `/security/vault` agregadora), protegido pela verificação de vault desbloqueado.

---

## 5. Import de Extrato Bancário — Frontend

### O que já existe

- ✅ `api/bank_reconciliation/parsers.py` — parsers OFX 1.x SGML e CSV com auto-detecção
- ✅ `api/bank_reconciliation/views.py` — `BankStatementImportCreateView` (upload, preview, confirm)
- ✅ Detecção de duplicatas por hash SHA-256
- ✅ Auto-matching de transações com expenses/revenues existentes
- ✅ `frontend/src/pages/PasswordImport.tsx` — referência de UX completa com 3 etapas (upload → preview → resumo)
- ✅ Upload básico em `frontend/src/pages/Accounts.tsx`

### O que falta

- ❌ Fluxo de 3 etapas (igual ao `PasswordImport.tsx`) para extratos bancários no frontend
- ❌ Tela de preview com listagem de transações detectadas antes de confirmar
- ❌ Indicação visual de duplicatas (transações que já existem)
- ❌ Botão de confirmação que chama o endpoint confirm

### Como implementar

#### Passo 1 — Criar a página BankStatementImport

Criar `frontend/src/pages/BankStatementImport.tsx` seguindo exatamente o mesmo padrão do `PasswordImport.tsx`:

**Etapa 1 — Upload**
- Drag-and-drop ou seleção de arquivo (`.ofx`, `.csv`)
- Selecionar a conta bancária de destino
- Chamar `POST /api/v1/bank-reconciliation/import/` com `multipart/form-data`
- Resposta: lista de transações detectadas com flags de duplicata

**Etapa 2 — Preview**
- Tabela com as transações detectadas
- Colunas: Data, Descrição, Valor, Tipo (despesa/receita), Status (novo / duplicado)
- Transações duplicadas exibidas com fundo amarelo e badge "Já existe"
- Checkbox para selecionar quais importar (duplicatas desmarcadas por padrão)
- Botão "Confirmar importação"

**Etapa 3 — Resumo**
- Total importado
- Total ignorado
- Total de duplicatas detectadas
- Botão "Ver contas"

#### Passo 2 — Adicionar rota

```typescript
// frontend/src/App.tsx — adicionar rota protegida

{ path: '/accounts/import', element: <BankStatementImport /> },
```

#### Passo 3 — Adicionar botão de acesso

Em `frontend/src/pages/Accounts.tsx`, adicionar botão "Importar extrato" que navega para `/accounts/import`.

---

## 6. Vault Health Report — Página Dedicada

### O que já existe

- ✅ `api/security/views.py` — `VaultHealthReportView` totalmente funcional
  - Analisa força de senhas (weak / medium / strong)
  - Detecta senhas duplicadas por hash
  - Identifica senhas desatualizadas (>90 dias)
  - Calcula score geral 0–100
- ✅ Endpoint `GET /api/v1/security/vault/health/`

### O que falta

- ❌ Página dedicada no frontend para exibir o relatório
- ❌ Cards com score, contadores e lista de senhas problemáticas
- ❌ Link de acesso no menu/sidebar do módulo Security

### Como implementar

#### Passo 1 — Criar a página VaultHealthReport

Criar `frontend/src/pages/VaultHealthReport.tsx`:

**Layout sugerido**:
- Card de destaque com o **score geral** (0–100) usando um medidor circular ou barra de progresso colorida (verde/amarelo/vermelho)
- Cards resumo: total de senhas fracas, total de duplicatas, total desatualizadas
- Lista de senhas fracas com botão "Atualizar senha"
- Lista de senhas duplicadas agrupadas
- Lista de senhas desatualizadas (>90 dias) ordenadas pela mais antiga

```typescript
// frontend/src/services/security-service.ts — adicionar método

async getVaultHealthReport(): Promise<VaultHealthReport> {
  const response = await apiClient.get<VaultHealthReport>('/security/vault/health/');
  return response.data;
}
```

**Tipos esperados**:
```typescript
interface VaultHealthReport {
  score: number;
  total_passwords: number;
  weak_passwords: PasswordSummary[];
  duplicate_passwords: PasswordSummary[][];
  outdated_passwords: PasswordSummary[];
  strong_count: number;
  medium_count: number;
  weak_count: number;
}
```

#### Passo 2 — Adicionar rota

```typescript
{ path: '/security/health', element: <VaultHealthReport /> },
```

#### Passo 3 — Adicionar link no sidebar/menu

Adicionar entrada "Saúde do Cofre" no menu lateral do módulo Security, com ícone de escudo.

---

## 7. 2FA / Autenticação de Dois Fatores

### O que já existe

- ✅ Sistema JWT seguro via HttpOnly cookies
- ✅ `LoginRateThrottle` limitando tentativas de login
- ✅ Proteção CSRF com SameSite Strict

### O que falta (implementação completa do zero)

- ❌ Dependência `pyotp` para geração/validação de TOTP
- ❌ Model `TOTPDevice` para armazenar secret do usuário
- ❌ Endpoint para gerar QR code de setup
- ❌ Endpoint para ativar 2FA (valida primeiro código)
- ❌ Endpoint para desativar 2FA
- ❌ Endpoint para verificar código durante login
- ❌ Backup codes (códigos de recuperação)
- ❌ UI completa de configuração e login com 2FA

### Como implementar

#### Passo 1 — Instalar dependência

```bash
# api/requirements.txt — adicionar (versão exata conforme política do projeto)
pyotp==2.9.0
qrcode[pil]==8.0
```

Após editar `requirements.txt`:

```bash
# Rebuildar o container
docker compose up --build -d
```

#### Passo 2 — Criar model TOTPDevice

```python
# api/authentication/models.py — criar ou adicionar ao arquivo

import pyotp
from django.db import models
from django.contrib.auth import get_user_model
from app.models import BaseModel

User = get_user_model()


class TOTPDevice(BaseModel):
    """
    Armazena o secret TOTP de um usuário para autenticação de dois fatores.
    Um usuário pode ter apenas um device ativo.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="totp_device")
    secret = models.CharField(max_length=64)  # base32 secret
    is_active = models.BooleanField(default=False)  # False até verificar primeiro código
    backup_codes = models.JSONField(default=list)  # lista de códigos de backup (hashed)
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "TOTP Device"

    def generate_provisioning_uri(self, issuer="Axiom"):
        totp = pyotp.TOTP(self.secret)
        return totp.provisioning_uri(
            name=self.user.email or self.user.username,
            issuer_name=issuer,
        )

    def verify_token(self, token: str) -> bool:
        totp = pyotp.TOTP(self.secret)
        return totp.verify(token, valid_window=1)  # ±30s de tolerância
```

Criar e aplicar migration:

```bash
docker compose exec api python manage.py makemigrations authentication
docker compose exec api python manage.py migrate
```

#### Passo 3 — Criar views de 2FA

```python
# api/authentication/views.py — adicionar

import pyotp
import qrcode
import io
import base64
from django.utils import timezone


class TwoFactorSetupView(APIView):
    """GET /api/v1/auth/2fa/setup/ — Gera QR code para setup inicial."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        device, created = TOTPDevice.objects.get_or_create(
            user=request.user,
            defaults={"secret": pyotp.random_base32()},
        )
        if device.is_active:
            return Response(
                {"detail": "2FA já está ativado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uri = device.generate_provisioning_uri()

        # Gerar imagem QR code em base64
        qr = qrcode.make(uri)
        img_buffer = io.BytesIO()
        qr.save(img_buffer, format="PNG")
        qr_base64 = base64.b64encode(img_buffer.getvalue()).decode()

        return Response({
            "secret": device.secret,
            "qr_code": f"data:image/png;base64,{qr_base64}",
            "manual_entry_key": device.secret,
        })


class TwoFactorActivateView(APIView):
    """POST /api/v1/auth/2fa/activate/ — Ativa 2FA após verificar primeiro código."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        code = request.data.get("code", "")
        try:
            device = TOTPDevice.objects.get(user=request.user, is_active=False)
        except TOTPDevice.DoesNotExist:
            return Response(
                {"detail": "Nenhum setup de 2FA pendente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not device.verify_token(code):
            return Response(
                {"detail": "Código inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Gerar backup codes
        import secrets
        backup_codes = [secrets.token_hex(5).upper() for _ in range(8)]
        import hashlib
        hashed_codes = [hashlib.sha256(c.encode()).hexdigest() for c in backup_codes]

        device.is_active = True
        device.backup_codes = hashed_codes
        device.activated_at = timezone.now()
        device.save()

        return Response({
            "detail": "2FA ativado com sucesso.",
            "backup_codes": backup_codes,  # Exibir uma única vez — não armazenar em texto claro
        })


class TwoFactorVerifyView(APIView):
    """
    POST /api/v1/auth/2fa/verify/
    Usado durante o login quando 2FA está ativo.
    Body: { "code": "123456", "session_token": "..." }
    """
    permission_classes = (AllowAny,)
    # Implementação completa depende do fluxo de login escolhido
    # Opção 1: login retorna um token temporário se 2FA ativo; este endpoint valida e retorna JWT
    # Opção 2: 2FA code enviado junto com username/password no login


class TwoFactorDisableView(APIView):
    """POST /api/v1/auth/2fa/disable/ — Desativa 2FA."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        password = request.data.get("password", "")
        if not request.user.check_password(password):
            return Response(
                {"detail": "Senha incorreta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TOTPDevice.objects.filter(user=request.user).delete()
        return Response({"detail": "2FA desativado."}, status=status.HTTP_200_OK)
```

#### Passo 4 — Modificar o fluxo de login

A view de login (`LoginView`) em `api/authentication/views.py` deve ser modificada para:

1. Verificar se o usuário tem `TOTPDevice` ativo após validar username/password
2. Se sim: retornar `{ "requires_2fa": true, "temp_token": "..." }` em vez dos cookies JWT
3. O frontend exibe tela de código 2FA
4. Após validar o código em `TwoFactorVerifyView`, os cookies JWT são setados normalmente

#### Passo 5 — Frontend

Criar `frontend/src/pages/TwoFactorSetup.tsx`:
- Exibe QR code retornado pelo backend
- Campo para digitar código de confirmação
- Exibe backup codes após ativação (com aviso para salvar)

Modificar `frontend/src/pages/Login.tsx`:
- Após login bem-sucedido, checar se resposta tem `requires_2fa: true`
- Se sim, exibir campo de código 2FA antes de prosseguir

Adicionar página de configuração de 2FA em Configurações do usuário.

---

## Notas Gerais de Implementação

### Ordem de implementação sugerida

Considerando esforço × impacto:

1. **Notificações por email** — só precisa de configuração SMTP no `.env`. Zero código novo.
2. **Vault Health Report UI** — backend pronto, apenas criar página no frontend.
3. **Import de extrato bancário** — backend pronto, replicar padrão do `PasswordImport.tsx`.
4. **Export ZIP do Security** — ~100 linhas de código backend + ~30 de frontend.
5. **Reset de senha** — implementação completa mas bem definida, Django tem helpers nativos.
6. **Confirmação de email** — similar ao reset de senha em complexidade.
7. **2FA** — maior esforço, requer mudança no fluxo de login.

### Variáveis de ambiente a adicionar

Consolidando todas as variáveis necessárias para as funcionalidades acima:

```bash
# .env — variáveis a adicionar para habilitar as funcionalidades pendentes

# Email (obrigatório para: notificações, reset de senha, confirmação de email)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=noreply@seudominio.com
EMAIL_HOST_PASSWORD=sua_app_password
DEFAULT_FROM_EMAIL=Axiom <noreply@seudominio.com>

# URL do frontend (obrigatório para: reset de senha, confirmação de email)
FRONTEND_URL=http://localhost:39101
```

### Testes a escrever

Cada funcionalidade implementada deve ter testes em `api/tests/`:

```python
# Padrão mínimo para cada funcionalidade nova
class PasswordResetTestCase(BaseAPITestCase):
    def test_request_with_valid_email_returns_200(self): ...
    def test_request_with_unknown_email_still_returns_200(self): ...  # segurança
    def test_confirm_with_valid_token_changes_password(self): ...
    def test_confirm_with_invalid_token_returns_400(self): ...
    def test_confirm_with_mismatched_passwords_returns_400(self): ...
```

---

[Voltar ao índice de desenvolvimento](./README.md) | [Voltar à documentação geral](../README.md)

---

**Última atualização**: Abril de 2026
