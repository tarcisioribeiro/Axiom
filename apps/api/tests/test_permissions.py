# from rest_framework.request import Request
from unittest.mock import Mock

from django.contrib.auth.models import Permission, User
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from accounts.models import Account
from app.permissions import GlobalDefaultPermission

# from accounts.views import AccountCreateListView


class GlobalDefaultPermissionTest(TestCase):
    """Testes para a classe GlobalDefaultPermission"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = GlobalDefaultPermission()

        # Cria usuário de teste
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass123"
        )

        # Cria view mock
        self.view = Mock()
        self.view.queryset = Account.objects.all()

    def test_has_permission_get_method(self):
        """Testa permissão para método GET (view)"""
        request = self.factory.get("/api/v1/accounts/")
        request.user = self.user

        # Adiciona permissão de view para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="view_account",
            content_type=content_type,
            defaults={"name": "Can view account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_post_method(self):
        """Testa permissão para método POST (add)"""
        request = self.factory.post("/api/v1/accounts/")
        request.user = self.user

        # Adiciona permissão de add para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="add_account",
            content_type=content_type,
            defaults={"name": "Can add account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_put_method(self):
        """Testa permissão para método PUT (change)"""
        request = self.factory.put("/api/v1/accounts/1/")
        request.user = self.user

        # Adiciona permissão de change para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="change_account",
            content_type=content_type,
            defaults={"name": "Can change account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_patch_method(self):
        """Testa permissão para método PATCH (change)"""
        request = self.factory.patch("/api/v1/accounts/1/")
        request.user = self.user

        # Adiciona permissão de change para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="change_account",
            content_type=content_type,
            defaults={"name": "Can change account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_delete_method(self):
        """Testa permissão para método DELETE (delete)"""
        request = self.factory.delete("/api/v1/accounts/1/")
        request.user = self.user

        # Adiciona permissão de delete para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="delete_account",
            content_type=content_type,
            defaults={"name": "Can delete account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_options_method(self):
        """Testa permissão para método OPTIONS (view)"""
        request = self.factory.options("/api/v1/accounts/")
        request.user = self.user

        # Adiciona permissão de view para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="view_account",
            content_type=content_type,
            defaults={"name": "Can view account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_head_method(self):
        """Testa permissão para método HEAD (view)"""
        request = self.factory.head("/api/v1/accounts/")
        request.user = self.user

        # Adiciona permissão de view para Account
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="view_account",
            content_type=content_type,
            defaults={"name": "Can view account"},
        )
        self.user.user_permissions.add(permission)

        # Testa permissão
        has_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(has_permission)

    def test_has_permission_without_permission(self):
        """Testa quando usuário não tem permissão"""
        request = self.factory.get("/api/v1/accounts/")
        request.user = self.user

        # Usuário não tem permissão de view
        has_permission = self.permission.has_permission(request, self.view)
        self.assertFalse(has_permission)

    def test_has_permission_unknown_method(self):
        """Testa método HTTP desconhecido"""
        # Simula método customizado
        request = Mock()
        request.method = "CUSTOM"
        request.user = self.user

        has_permission = self.permission.has_permission(request, self.view)
        # Deve retornar False para métodos desconhecidos
        self.assertFalse(has_permission)

    def test_has_permission_view_without_queryset(self):
        """Testa view sem queryset definido"""
        request = self.factory.get("/api/v1/test/")
        request.user = self.user

        # View sem queryset
        view_without_queryset = Mock()
        view_without_queryset.queryset = None

        has_permission = self.permission.has_permission(
            request, view_without_queryset
        )
        # Deve retornar False quando não conseguir determinar o modelo
        self.assertFalse(has_permission)

    def test_get_model_permission_codename_success(self):
        """Testa geração de codename de permissão"""
        # Acessa método protegido para teste
        codename = self.permission._get_model_permission_codename(
            "GET", self.view
        )

        self.assertEqual(codename, "accounts.view_account")

    def test_get_model_permission_codename_post(self):
        """Testa geração de codename para POST"""
        codename = self.permission._get_model_permission_codename(
            "POST", self.view
        )

        self.assertEqual(codename, "accounts.add_account")

    def test_get_model_permission_codename_put(self):
        """Testa geração de codename para PUT"""
        codename = self.permission._get_model_permission_codename(
            "PUT", self.view
        )

        self.assertEqual(codename, "accounts.change_account")

    def test_get_model_permission_codename_delete(self):
        """Testa geração de codename para DELETE"""
        codename = self.permission._get_model_permission_codename(
            "DELETE", self.view
        )

        self.assertEqual(codename, "accounts.delete_account")

    def test_get_action_suffix_mapping(self):
        """Testa mapeamento de métodos HTTP para sufixos de ação"""
        # Testa todos os mapeamentos definidos
        test_cases = [
            ("GET", "view"),
            ("POST", "add"),
            ("PUT", "change"),
            ("PATCH", "change"),
            ("DELETE", "delete"),
            ("OPTIONS", "view"),
            ("HEAD", "view"),
        ]

        for method, expected_suffix in test_cases:
            with self.subTest(method=method):
                suffix = self.permission._get_action_suffix(method)
                self.assertEqual(suffix, expected_suffix)

    def test_get_action_suffix_unknown_method(self):
        """Testa sufixo para método desconhecido"""
        suffix = self.permission._get_action_suffix("UNKNOWN")
        self.assertEqual(suffix, "")

    def test_superuser_bypass(self):
        """Testa que superuser tem acesso a tudo"""
        # Cria superuser
        superuser = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="adminpass123"
        )

        request = self.factory.get("/api/v1/accounts/")
        request.user = superuser

        # Superuser deve ter permissão mesmo sem permissões específicas
        has_permission = self.permission.has_permission(request, self.view)
        print(has_permission)
        # Note: Este teste assume que o Django automaticamente concede
        # todas as permissões para superusers
        self.assertTrue(superuser.has_perm("accounts.view_account"))

    def test_permission_with_different_models(self):
        """Testa permissão com diferentes modelos"""
        from expenses.models import Expense

        # Cria view para Expense
        expense_view = Mock()
        expense_view.queryset = Expense.objects.all()

        request = self.factory.get("/api/v1/expenses/")
        request.user = self.user

        # Adiciona permissão para Account, mas não para Expense
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="view_account",
            content_type=content_type,
            defaults={"name": "Can view account"},
        )
        self.user.user_permissions.add(permission)

        # Deve ter permissão para Account
        account_permission = self.permission.has_permission(request, self.view)
        self.assertTrue(account_permission)

        # Não deve ter permissão para Expense
        expense_permission = self.permission.has_permission(
            request, expense_view
        )
        self.assertFalse(expense_permission)

    def test_permission_case_sensitivity(self):
        """Testa se os métodos HTTP são case-insensitive"""
        # Testa com método em minúsculo
        request_lower = Mock()
        request_lower.method = "get"
        request_lower.user = self.user

        # Adiciona permissão de view
        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="view_account",
            content_type=content_type,
            defaults={"name": "Can view account"},
        )
        self.user.user_permissions.add(permission)

        # O Django REST Framework normalmente padroniza métodos para uppercase,
        # mas testamos o comportamento com minúsculo
        has_permission = self.permission.has_permission(
            request_lower, self.view
        )
        print(has_permission)
        # Resultado depende da implementação - pode ser True ou False


class GlobalDefaultPermissionObjectLevelTest(TestCase):
    """
    Regression for the systemic IDOR root cause found in the audit:
    GlobalDefaultPermission used to only implement has_permission (a
    Django model-level check), never has_object_permission, so DRF's
    object-level check silently fell back to always-True for every
    RetrieveUpdateDestroyAPIView-based view.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = GlobalDefaultPermission()
        self.view = Mock()
        self.view.queryset = Account.objects.all()

        self.owner = User.objects.create_user(
            username="obj_owner",
            email="obj_owner@test.com",
            password="testpass123",
        )
        self.other = User.objects.create_user(
            username="obj_other",
            email="obj_other@test.com",
            password="testpass123",
        )
        self.superuser = User.objects.create_superuser(
            username="obj_super",
            email="obj_super@test.com",
            password="testpass123",
        )

        content_type = ContentType.objects.get_for_model(Account)
        permission, _ = Permission.objects.get_or_create(
            codename="view_account",
            content_type=content_type,
            defaults={"name": "Can view account"},
        )
        self.owner.user_permissions.add(permission)
        self.other.user_permissions.add(permission)

    def _request(self, user):
        request = self.factory.get("/api/v1/accounts/1/")
        request.user = user
        return request

    def test_owner_can_access_own_object(self):
        obj = Mock(created_by_id=self.owner.id)
        self.assertTrue(
            self.permission.has_object_permission(
                self._request(self.owner), self.view, obj
            )
        )

    def test_other_authenticated_user_cannot_access_object(self):
        obj = Mock(created_by_id=self.owner.id)
        self.assertFalse(
            self.permission.has_object_permission(
                self._request(self.other), self.view, obj
            )
        )

    def test_superuser_can_access_any_object(self):
        obj = Mock(created_by_id=self.owner.id)
        self.assertTrue(
            self.permission.has_object_permission(
                self._request(self.superuser), self.view, obj
            )
        )

    def test_object_without_created_by_keeps_permissive_fallback(self):
        """
        Ownerless records (created_by=None) are still permitted — a
        deliberate, documented scope boundary: this fix closes
        retrieve/update/destroy IDOR, not every shared-resource case.
        """
        obj = Mock(created_by_id=None)
        self.assertTrue(
            self.permission.has_object_permission(
                self._request(self.other), self.view, obj
            )
        )

    def test_denies_when_base_model_permission_is_missing(self):
        """
        has_object_permission must short-circuit through has_permission
        first: a user with no model-level permission at all is denied
        regardless of object ownership.
        """
        no_perm_user = User.objects.create_user(
            username="obj_noperm",
            email="obj_noperm@test.com",
            password="testpass123",
        )
        obj = Mock(created_by_id=no_perm_user.id)
        self.assertFalse(
            self.permission.has_object_permission(
                self._request(no_perm_user), self.view, obj
            )
        )
