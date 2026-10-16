from typing import Any, Callable

from django.contrib.auth.models import User
from django.http import HttpRequest, HttpResponse, JsonResponse

from rest_framework_simplejwt.authentication import JWTAuthentication

from admin_panel import screens
from admin_panel.access import get_user_actions


def _authenticate(request: HttpRequest) -> User | None:
    # APIClient.force_authenticate (testes) não passa pelo JWT
    forced = getattr(request, "_force_auth_user", None)
    if forced is not None:
        return forced  # type: ignore[no-any-return]
    if request.user.is_authenticated:
        return request.user  # type: ignore[return-value]
    auth = JWTAuthentication()
    try:
        result = auth.authenticate(request)  # type: ignore[arg-type]
    except Exception:  # token inválido/expirado: a view responde 401
        return None
    return result[0] if result else None  # type: ignore[return-value]


class ScreenAccessMiddleware:
    """Aplica o controle de acesso por tela às rotas registradas em
    `admin_panel.screens`. Staff e superuser passam direto; requisições sem
    usuário seguem para a view, que responde 401."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        return self.get_response(request)

    def process_view(
        self,
        request: HttpRequest,
        view_func: Any,
        view_args: Any,
        view_kwargs: Any,
    ) -> HttpResponse | None:
        match = request.resolver_match
        name = match.url_name if match else None
        if not name or not screens.is_registered(name):
            return None
        user = _authenticate(request)
        if user is None or user.is_staff or user.is_superuser:
            return None
        if screens.is_allowed(
            name, request.method or "GET", get_user_actions(user)
        ):
            return None
        return JsonResponse(
            {"detail": "Você não tem acesso a esta funcionalidade."},
            status=403,
        )
