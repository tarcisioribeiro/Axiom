"""Painel de permissões (/admin/permissions): staff e superuser gerenciam o
acesso por tela de usuários comuns. Staff e superuser nunca são alvo, então
ninguém altera o próprio acesso ao painel."""

from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, QuerySet
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.models import ScreenDefault, UserScreenAccess
from admin_panel.screens import MODULES, SCREENS
from app.permissions import IsStaffOrSuperuser
from app.request_utils import request_data


class PermissionsBaseView(APIView):
    permission_classes = [IsAuthenticated, IsStaffOrSuperuser]


def _clean_grants(raw: Any) -> dict[str, list[str]] | None:
    """Valida {tela: [ações]} contra o registro. None = payload inválido.
    Tela sem ``view`` é descartada (sem acesso)."""
    if not isinstance(raw, dict):
        return None
    grants: dict[str, list[str]] = {}
    for key, actions in raw.items():
        screen = SCREENS.get(key)
        if screen is None or not isinstance(actions, list):
            return None
        if any(a not in screen["actions"] for a in actions):
            return None
        if "view" in actions:
            grants[key] = [a for a in screen["actions"] if a in actions]
    return grants


def _common_users() -> "QuerySet[User]":
    return User.objects.filter(is_staff=False, is_superuser=False)


def _user_data(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "name": user.get_full_name(),
        "email": user.email,
        "is_active": user.is_active,
        "screen_count": UserScreenAccess.objects.filter(user=user).count(),
    }


class ScreenCatalogView(PermissionsBaseView):
    def get(self, request: Request) -> Response:
        return Response(
            [
                {
                    "key": module,
                    "label": label,
                    "screens": [
                        {
                            "key": key,
                            "label": s["label"],
                            "path": s["path"],
                            "actions": list(s["actions"]),
                        }
                        for key, s in SCREENS.items()
                        if s["module"] == module
                    ],
                }
                for module, label in MODULES.items()
            ]
        )


class PermissionUserListView(PermissionsBaseView):
    def get(self, request: Request) -> Response:
        users = _common_users().order_by("username")
        q = (request.query_params.get("q") or "").strip()
        if q:
            users = users.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(email__icontains=q)
            )
        return Response([_user_data(u) for u in users])


class PermissionUserDetailView(PermissionsBaseView):
    def _get_user(self, pk: int) -> User | None:
        return _common_users().filter(pk=pk).first()

    def get(self, request: Request, pk: int) -> Response:
        user = self._get_user(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        grants = dict(
            UserScreenAccess.objects.filter(user=user).values_list(
                "screen", "actions"
            )
        )
        return Response({**_user_data(user), "screens": grants})

    def put(self, request: Request, pk: int) -> Response:
        user = self._get_user(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        grants = _clean_grants(request_data(request).get("screens"))
        if grants is None:
            return Response(
                {"error": "Telas ou ações inválidas"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            UserScreenAccess.objects.filter(user=user).delete()
            UserScreenAccess.objects.bulk_create(
                [
                    UserScreenAccess(
                        user=user,
                        screen=key,
                        actions=actions,
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    for key, actions in grants.items()
                ]
            )
        return Response({**_user_data(user), "screens": grants})

    def patch(self, request: Request, pk: int) -> Response:
        user = self._get_user(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        is_active = request_data(request).get("is_active")
        if not isinstance(is_active, bool):
            return Response(
                {"error": "is_active deve ser booleano"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = is_active
        user.save(update_fields=["is_active"])
        return Response(_user_data(user))


class ScreenDefaultsView(PermissionsBaseView):
    def get(self, request: Request) -> Response:
        return Response(
            {
                "screens": dict(
                    ScreenDefault.objects.values_list("screen", "actions")
                )
            }
        )

    def put(self, request: Request) -> Response:
        grants = _clean_grants(request_data(request).get("screens"))
        if grants is None:
            return Response(
                {"error": "Telas ou ações inválidas"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            ScreenDefault.objects.all().delete()
            ScreenDefault.objects.bulk_create(
                [
                    ScreenDefault(
                        screen=key,
                        actions=actions,
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    for key, actions in grants.items()
                ]
            )
        return Response({"screens": grants})
