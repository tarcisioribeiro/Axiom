"""
Cookie-based JWT Authentication

Este módulo implementa autenticação JWT usando httpOnly cookies
para maior segurança, prevenindo ataques XSS.
"""

from typing import Any

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .throttles import LoginRateThrottle


class CookieTokenObtainPairView(TokenObtainPairView):
    """
    View customizada para login que armazena tokens em httpOnly cookies.

    Em vez de retornar tokens no body da resposta (localStorage),
    armazena em cookies seguros e httpOnly.
    """

    throttle_classes = [LoginRateThrottle]

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        import secrets as _secrets

        from django.core.cache import cache

        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        # Verificar se o usuário tem 2FA ativo
        user = serializer.user  # type: ignore[attr-defined]
        try:
            from .models import TOTPDevice

            device = user.totp_device  # type: ignore[attr-defined]
            if device.is_active:
                # Gerar temp token e armazenar user_id no cache por 5 minutos
                temp_token = _secrets.token_urlsafe(32)
                cache.set(f"2fa_temp:{temp_token}", user.pk, timeout=300)
                return Response(
                    {
                        "requires_2fa": True,
                        "temp_token": temp_token,
                        "message": "Código de dois fatores necessário.",
                    },
                    status=status.HTTP_200_OK,
                )
        except TOTPDevice.DoesNotExist:
            pass

        # Criar response com dados do usuário (sem tokens no body)
        response = Response(
            {
                "message": "Login realizado com sucesso",
                "user": {
                    "username": request.data.get("username"),
                },
            },
            status=status.HTTP_200_OK,
        )

        # Armazenar tokens em httpOnly cookies
        access_token = serializer.validated_data.get("access")
        refresh_token = serializer.validated_data.get("refresh")

        # Cookie de access token (15 minutos)
        response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=60 * 15,  # 15 minutos
            httponly=True,
            secure=settings.DEBUG is False,  # True em produção (HTTPS)
            samesite="Strict",  # Proteção CSRF
            path="/",
        )

        # Cookie de refresh token (1 hora)
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=60 * 60,  # 1 hora
            httponly=True,
            secure=settings.DEBUG is False,  # True em produção (HTTPS)
            samesite="Strict",  # Proteção CSRF
            path="/api/v1/authentication/",  # Apenas para refresh endpoint
        )

        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    View customizada para refresh que lê/escreve tokens de/para cookies.

    Lê o refresh token do cookie, valida, e retorna um novo
    access token também em cookie.
    """

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        # Ler refresh token do cookie
        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token não encontrado"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Criar dados com o refresh token do cookie
        data = {"refresh": refresh_token}
        serializer = self.get_serializer(data=data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response(
                {"detail": "Token inválido ou expirado"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Criar response
        response = Response(
            {"message": "Token renovado com sucesso"},
            status=status.HTTP_200_OK,
        )

        # Atualizar access token no cookie
        access_token = serializer.validated_data.get("access")
        response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=60 * 15,  # 15 minutos
            httponly=True,
            secure=settings.DEBUG is False,
            samesite="Strict",
            path="/",
        )

        # Atualizar refresh token rotacionado no cookie
        new_refresh_token = serializer.validated_data.get("refresh")
        if new_refresh_token:
            response.set_cookie(
                key="refresh_token",
                value=new_refresh_token,
                max_age=60 * 60,  # 1 hora
                httponly=True,
                secure=settings.DEBUG is False,
                samesite="Strict",
                path="/api/v1/authentication/",
            )

        return response


class CookieTokenVerifyView(TokenRefreshView):
    """
    View para verificar se o access token do cookie ainda é válido.
    """

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        access_token = request.COOKIES.get("access_token")

        if not access_token:
            return Response(
                {"detail": "Access token não encontrado"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Verificar validade do token
        from rest_framework_simplejwt.tokens import AccessToken

        try:
            AccessToken(access_token)  # type: ignore[arg-type]
            return Response(
                {"detail": "Token válido"}, status=status.HTTP_200_OK
            )
        except TokenError:
            return Response(
                {"detail": "Token inválido ou expirado"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request: Request) -> Response:
    """
    View de logout que invalida o refresh token no servidor e remove os
    cookies.
    """
    refresh_token = request.COOKIES.get("refresh_token")
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)  # type: ignore[arg-type]
            token.blacklist()
        except TokenError:
            pass  # Token já expirado ou inválido — sem ação necessária

    response = Response(
        {"message": "Logout realizado com sucesso"}, status=status.HTTP_200_OK
    )
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/authentication/")

    return response
