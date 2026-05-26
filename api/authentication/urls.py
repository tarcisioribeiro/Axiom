from django.urls import path

from .cookie_auth import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CookieTokenVerifyView,
    logout_view,
)
from .views import (
    ChangePasswordView,
    EmailVerificationConfirmView,
    EmailVerificationSendView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    TwoFactorActivateView,
    TwoFactorDisableView,
    TwoFactorSetupView,
    TwoFactorStatusView,
    TwoFactorVerifyView,
    create_user_with_member,
    get_available_users,
    get_current_user,
    get_user_permissions,
)

urlpatterns = [
    # Autenticação com httpOnly cookies (recomendado)
    path(
        "authentication/token/",
        CookieTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "authentication/token/refresh/",
        CookieTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "authentication/token/verify/",
        CookieTokenVerifyView.as_view(),
        name="token_verify",
    ),
    path("authentication/logout/", logout_view, name="logout"),
    path("me/", get_current_user, name="current-user"),
    path("user/permissions/", get_user_permissions, name="user-permissions"),
    path("users/available/", get_available_users, name="available-users"),
    path("users/register/", create_user_with_member, name="register-user"),
    path(
        "users/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "users/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path(
        "users/email-verification/send/",
        EmailVerificationSendView.as_view(),
        name="email-verification-send",
    ),
    path(
        "users/email-verification/confirm/",
        EmailVerificationConfirmView.as_view(),
        name="email-verification-confirm",
    ),
    path(
        "users/change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
    # 2FA / TOTP
    path("users/2fa/setup/", TwoFactorSetupView.as_view(), name="2fa-setup"),
    path(
        "users/2fa/activate/",
        TwoFactorActivateView.as_view(),
        name="2fa-activate",
    ),
    path(
        "users/2fa/verify/", TwoFactorVerifyView.as_view(), name="2fa-verify"
    ),
    path(
        "users/2fa/disable/",
        TwoFactorDisableView.as_view(),
        name="2fa-disable",
    ),
    path(
        "users/2fa/status/", TwoFactorStatusView.as_view(), name="2fa-status"
    ),
]
