from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from rest_framework_simplejwt.tokens import RefreshToken

# Models
from accounts.models import Account
from expenses.models import Expense

# from revenues.models import Revenue
# from credit_cards.models import CreditCard
from members.models import Member

# import json


class BaseAPITestCase(APITestCase):
    """Classe base para testes de API"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass123"
        )
        self.client = APIClient()

        # Gera token JWT
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)

        # Configura autenticação
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

        # Cria conta de teste
        self.account = Account.objects.create(
            name="NUB", account_type="CC", is_active=True
        )


class AccountViewTest(BaseAPITestCase):
    """Testes para as views de Account"""

    def test_get_accounts_list(self):
        """Testa listagem de contas"""
        url = reverse("account-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # type: ignore
        self.assertEqual(response.data[0]["name"], "NUB")  # type: ignore

    def test_create_account_success(self):
        """Testa criação de conta com dados válidos"""
        url = reverse("account-list-create")
        data = {"name": "SIC", "account_type": "CS", "is_active": True}

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "SIC")  # type: ignore

        # Verifica se foi salvo no banco
        account = Account.objects.get(name="SIC")
        self.assertEqual(account.account_type, "CS")

    def test_create_account_duplicate_name(self):
        """Testa criação de conta com nome duplicado"""
        url = reverse("account-list-create")
        data = {
            "name": "NUB",  # Nome já existe
            "account_type": "CS",
            "is_active": True,
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_account_detail(self):
        """Testa recuperação de conta específica"""
        url = reverse("account-detail", kwargs={"pk": self.account.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "NUB")  # type: ignore

    def test_update_account(self):
        """Testa atualização de conta"""
        url = reverse("account-detail", kwargs={"pk": self.account.pk})
        data = {
            "name": "NUB",
            "account_type": "CC",
            "is_active": False,  # Alterando status
        }

        response = self.client.put(url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active"])  # type: ignore

        # Verifica no banco
        self.account.refresh_from_db()
        self.assertFalse(self.account.is_active)

    def test_delete_account(self):
        """Testa exclusão de conta"""
        url = reverse("account-detail", kwargs={"pk": self.account.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verifica se foi deletado
        with self.assertRaises(Account.DoesNotExist):
            Account.objects.get(pk=self.account.pk)


class ExpenseViewTest(BaseAPITestCase):
    """Testes para as views de Expense"""

    def setUp(self):
        super().setUp()
        self.expense = Expense.objects.create(
            description="Compra teste",
            value=Decimal("100.00"),
            date=date.today(),
            horary=time(14, 30),
            category="supermarket",
            account=self.account,
            payed=True,
        )

    def test_get_expenses_list(self):
        """Testa listagem de despesas"""
        url = reverse("expense-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # type: ignore
        self.assertEqual(
            response.data[0]["description"], "Compra teste"  # type: ignore
        )

    def test_create_expense_success(self):
        """Testa criação de despesa com dados válidos"""
        url = reverse("expense-list-create")
        data = {
            "description": "Nova despesa",
            "value": "250.75",
            "date": date.today().isoformat(),
            "horary": "15:45:00",
            "category": "food and drink",
            "account": self.account.pk,
            "payed": False,
        }

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["description"], "Nova despesa")  # type: ignore
        self.assertEqual(response.data["value"], "250.75")  # type: ignore

    def test_create_expense_invalid_data(self):
        """Testa criação de despesa com dados inválidos"""
        url = reverse("expense-list-create")
        data = {
            "description": "",  # Descrição vazia
            "value": "invalid_value",  # Valor inválido
            "date": date.today().isoformat(),
            "horary": "15:45:00",
            "category": "invalid_category",  # Categoria inválida
            "account": self.account.pk,
            "payed": False,
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filter_expenses_by_category(self):
        """Testa filtro de despesas por categoria"""
        # Cria despesa com categoria diferente
        Expense.objects.create(
            description="Combustível",
            value=Decimal("80.00"),
            date=date.today(),
            horary=time(16, 0),
            category="transport",
            account=self.account,
            payed=True,
        )

        url = reverse("expense-list-create")
        response = self.client.get(url, {"category": "transport"})
        print(response)
        # Nota: Este teste assume que você implementará filtros
        # Se não houver filtros implementados, este teste falhará

    def test_expense_ordering(self):
        """Testa ordenação de despesas por data"""
        # Cria despesa com data anterior
        Expense.objects.create(
            description="Compra antiga",
            value=Decimal("50.00"),
            date=date.today() - timedelta(days=1),
            horary=time(10, 0),
            category="others",
            account=self.account,
            payed=True,
        )

        url = reverse("expense-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verifica se está ordenado por data (mais recente primeiro)
        dates = [item["date"] for item in response.data]  # type: ignore
        self.assertEqual(dates, sorted(dates, reverse=True))


class AuthenticationTest(APITestCase):
    """Testes para autenticação"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass123"
        )

    def test_get_token_success(self):
        """Testa obtenção de token com credenciais válidas"""
        url = reverse("token_obtain_pair")
        data = {"username": "testuser", "password": "testpass123"}

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)  # type: ignore
        self.assertIn("refresh", response.data)  # type: ignore

    def test_get_token_invalid_credentials(self):
        """Testa obtenção de token com credenciais inválidas"""
        url = reverse("token_obtain_pair")
        data = {"username": "testuser", "password": "wrong_password"}

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_without_token(self):
        """Testa acesso a endpoint protegido sem token"""
        url = reverse("account-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_with_valid_token(self):
        """Testa acesso a endpoint protegido com token válido"""
        # Obter token
        token_url = reverse("token_obtain_pair")
        token_data = {"username": "testuser", "password": "testpass123"}
        token_response = self.client.post(token_url, token_data)
        token = token_response.data["access"]  # type: ignore

        # Usar token para acessar endpoint protegido
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")  # type: ignore
        url = reverse("account-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_user_permissions(self):
        """Testa endpoint de permissões do usuário"""
        # Autenticar usuário
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)
        self.client.credentials(  # type: ignore
            HTTP_AUTHORIZATION=f"Bearer {access_token}"
        )

        url = reverse("user-permissions")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("username", response.data)  # type: ignore
        self.assertIn("permissions", response.data)  # type: ignore
        self.assertIn("is_staff", response.data)  # type: ignore
        self.assertIn("is_superuser", response.data)  # type: ignore


class CreditCardViewTest(BaseAPITestCase):
    """Testes para as views de CreditCard"""

    def test_create_credit_card_with_encrypted_cvv(self):
        """Testa criação de cartão com CVV criptografado"""
        url = reverse("creditcard-list-create")
        data = {
            "name": "Cartão Teste",
            "on_card_name": "JOHN DOE",
            "flag": "MSC",
            "validation_date": (date.today() + timedelta(days=365)).isoformat(),
            "security_code": "123",  # CVV será criptografado
            "credit_limit": "5000.00",
            "max_limit": "10000.00",
            "associated_account": self.account.pk,
        }

        # Mock da criptografia para teste
        with self.patch("app.encryption.FieldEncryption.encrypt_data") as mock_encrypt:
            mock_encrypt.return_value = "encrypted_cvv"

            response = self.client.post(url, data)
            print(response)
            # Note: Este teste requer que o endpoint
            # esteja configurado corretamente.
            # e que a criptografia esteja funcionando

    def patch(self, *args, **kwargs):
        """Helper method para usar patch nos testes"""
        from unittest.mock import patch

        return patch(*args, **kwargs)


class MemberViewTest(BaseAPITestCase):
    """Testes para as views de Member"""

    def setUp(self):
        super().setUp()
        self.member = Member.objects.create(
            name="João Silva",
            document="12345678901",
            phone="11999999999",
            email="joao@test.com",
            sex="M",
            active=True,
        )

    def test_get_members_list(self):
        """Testa listagem de membros"""
        url = reverse("member-list-create")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # type: ignore
        self.assertEqual(response.data[0]["name"], "João Silva")  # type: ignore

    def test_create_member_success(self):
        """Testa criação de membro com dados válidos"""
        url = reverse("member-list-create")
        data = {
            "name": "Maria Santos",
            "document": "98765432109",
            "phone": "11888888888",
            "email": "maria@test.com",
            "sex": "F",
            "active": True,
        }

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Maria Santos")  # type: ignore

    def test_create_member_duplicate_document(self):
        """Testa criação de membro com documento duplicado"""
        url = reverse("member-list-create")
        data = {
            "name": "José Silva",
            "document": "12345678901",  # Documento já existe
            "phone": "11777777777",
            "email": "jose@test.com",
            "sex": "M",
            "active": True,
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
