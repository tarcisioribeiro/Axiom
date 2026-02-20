from rest_framework import permissions


class GlobalDefaultPermission(permissions.BasePermission):

    def has_permission(self, request, view):
        model_permission_codename = self._get_model_permission_codename(
            method=request.method,
            view=view,
        )

        if not model_permission_codename:
            return False

        return request.user.has_perm(model_permission_codename)

    def _get_model_permission_codename(self, method, view):
        try:
            # Tentar obter o queryset - pode ser atributo ou método
            queryset = view.queryset
            if queryset is None and hasattr(view, "get_queryset"):
                queryset = view.get_queryset()

            model_name = queryset.model._meta.model_name
            app_label = queryset.model._meta.app_label
            action = self._get_action_sufix(method)
            return f"{app_label}.{action}_{model_name}"
        except AttributeError:
            return None

    def _get_action_sufix(self, method):
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
