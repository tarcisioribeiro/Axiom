from django.urls import path

from .cookie_auth import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CookieTokenVerifyView,
    logout_view,
)
from .views import (
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
]
