from typing import Any, Optional

from rest_framework import permissions


class IsSuperuser(permissions.BasePermission):
    """Restringe a superusuários. `IsAdminUser` do DRF checa só `is_staff`."""

    def has_permission(self, request: Any, view: Any) -> bool:
        return bool(request.user and request.user.is_superuser)


class IsStaffOrSuperuser(permissions.BasePermission):
    """Painel de permissões: staff (gerencia usuários comuns) e superuser."""

    def has_permission(self, request: Any, view: Any) -> bool:
        user = request.user
        return bool(user and (user.is_staff or user.is_superuser))


class GlobalDefaultPermission(permissions.BasePermission):

    def has_permission(self, request: Any, view: Any) -> bool:
        model_permission_codename = self._get_model_permission_codename(
            method=request.method,
            view=view,
        )

        if not model_permission_codename:
            return False

        return bool(request.user.has_perm(model_permission_codename))

    def has_object_permission(self, request: Any, view: Any, obj: Any) -> bool:
        if not self.has_permission(request, view):
            return False
        if request.user.is_superuser:
            return True
        owner_id = getattr(obj, "created_by_id", None)
        if owner_id is None:
            return True
        return bool(owner_id == request.user.id)

    def _get_model_permission_codename(
        self, method: str, view: Any
    ) -> Optional[str]:
        try:
            # Tentar obter o queryset - pode ser atributo ou método
            queryset = view.queryset
            if queryset is None and hasattr(view, "get_queryset"):
                queryset = view.get_queryset()

            model_name = queryset.model._meta.model_name
            app_label = queryset.model._meta.app_label
            action = self._get_action_suffix(method)
            return f"{app_label}.{action}_{model_name}"
        except AttributeError:
            return None

    def _get_action_suffix(self, method: str) -> str:
        method_actions = {
            "GET": "view",
            "POST": "add",
            "PUT": "change",
            "PATCH": "change",
            "DELETE": "delete",
            "OPTIONS": "view",
            "HEAD": "view",
        }
        return method_actions.get(method, "")
