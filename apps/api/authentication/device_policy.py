"""
Política de dispositivo da versão Web: o app web só atende PCs/notebooks.

Escopo (só a experiência Web, nunca a API inteira):
- endpoints que emitem/renovam os cookies JWT (login, 2FA, refresh);
- requisições autenticadas pelo cookie ``access_token``/``refresh_token``
  sem header ``Authorization`` explícito — a "sessão Web".

Clientes que mandam ``Authorization: Bearer``/``ThemeSync`` (futuros apps
React Native e Electron, integrações), endpoints públicos sem cookie,
health checks e o Django Admin não passam pela política.

LIMITAÇÃO: ``User-Agent`` e Client Hints são declarados pelo cliente e podem
ser omitidos ou falsificados. Isto é política de UX, não autenticação nem
prova de identidade — autenticação, permissões e CSRF continuam valendo.
Requisição sem ``User-Agent`` é permitida (não há sinal de dispositivo
móvel). iPadOS em modo desktop se apresenta como Mac e só é detectável no
navegador (``maxTouchPoints``), o que o frontend faz.
"""

import re
from typing import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse

BLOCK_CODE = "web_device_not_allowed"

# Mesma lista do frontend (apps/web/src/lib/web-access.ts)
_MOBILE_UA = re.compile(
    r"Mobi|Android|iPhone|iPad|iPod|Tablet|Silk|Kindle|PlayBook|"
    r"BlackBerry|IEMobile|Opera Mini|webOS",
    re.IGNORECASE,
)

WEB_LOGIN_PATHS = frozenset(
    {
        "/api/v1/authentication/token/",
        "/api/v1/authentication/token/refresh/",
        "/api/v1/users/2fa/verify/",
    }
)
# Logout segue liberado para o navegador conseguir apagar os cookies
EXEMPT_PATHS = frozenset({"/api/v1/authentication/logout/"})


def is_mobile_device(request: HttpRequest) -> bool:
    if request.META.get("HTTP_SEC_CH_UA_MOBILE") == "?1":
        return True
    return bool(_MOBILE_UA.search(request.META.get("HTTP_USER_AGENT", "")))


def is_web_request(request: HttpRequest) -> bool:
    path = request.path
    if not path.startswith("/api/") or path in EXEMPT_PATHS:
        return False
    if path in WEB_LOGIN_PATHS:
        return True
    has_web_cookie = "access_token" in request.COOKIES or (
        "refresh_token" in request.COOKIES
    )
    return has_web_cookie and not request.META.get("HTTP_AUTHORIZATION")


class WebDevicePolicyMiddleware:
    """Responde 403 ``web_device_not_allowed`` para a experiência Web
    acessada de smartphone/tablet. Desligável com
    ``WEB_BLOCK_MOBILE_DEVICES=False``. Deve vir antes do
    ``JWTCookieMiddleware``, que copia o cookie para ``Authorization``."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if (
            getattr(settings, "WEB_BLOCK_MOBILE_DEVICES", True)
            and is_web_request(request)
            and is_mobile_device(request)
        ):
            return JsonResponse(
                {
                    "detail": (
                        "A versão Web está disponível somente para PCs "
                        "e notebooks."
                    ),
                    "code": BLOCK_CODE,
                },
                status=403,
            )
        return self.get_response(request)
