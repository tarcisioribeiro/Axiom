"""
Middleware para autenticação via cookies httpOnly

Este middleware lê o access token do cookie httpOnly e o adiciona
ao header Authorization, permitindo que o JWTAuthentication do DRF
funcione normalmente.
"""


class JWTCookieMiddleware:
    """
    Middleware que extrai JWT token de cookies httpOnly.

    Se o cookie 'access_token' existe e não há header Authorization,
    adiciona o token ao header no formato 'Bearer <token>'.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Ler access token do cookie
        access_token = request.COOKIES.get("access_token")

        # Se existe token no cookie e não há Authorization header
        if access_token and not request.META.get("HTTP_AUTHORIZATION"):
            # Adicionar token ao header Authorization
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {access_token}"

        response = self.get_response(request)
        return response
