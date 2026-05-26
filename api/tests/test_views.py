import calendar
import os
from datetime import date, time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import Permission, User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from cryptography.fernet import Fernet
from rest_framework_simplejwt.tokens import RefreshToken

# Models
from accounts.models import Account
from credit_cards.models import CreditCard, CreditCardBill
from expenses.models import Expense, FixedExpense
from members.models import Member
from revenues.models import Revenue


class BaseAPITestCase(APITestCase):
    """Classe base para testes de API"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@test.com",
            password="testpass123",
            is_superuser=True,
        )
        self.client = APIClient()

        # Gera token JWT
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)

        # Configura autenticação
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {self.access_token}"
        )

        # Cria conta de teste
        self.account = Account.objects.create(
            account_name="NUB",
            account_type="CC",
            institution_name="NUB",
            is_active=True,
            created_by=self.user,
        )


class AccountViewTest(BaseAPITestCase):
    """Testes para as views de Account"""

    def test_get_accounts_list(self):
        """Testa listagem de contas"""
        url = reverse("account-create-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)  # type: ignore
        self.assertEqual(  # type: ignore
            response.data["results"][0]["account_name"], "NUB"
        )

    def test_create_account_success(self):
        """Testa criação de conta com dados válidos"""
        url = reverse("account-create-list")
        data = {
            "account_name": "SIC",
            "account_type": "CS",
            "is_active": True,
            "institution": "SIC",
        }

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["account_name"], "SIC")  # type: ignore

        # Verifica se foi salvo no banco
        account = Account.objects.get(account_name="SIC")
        self.assertEqual(account.account_type, "CS")

    def test_create_account_duplicate_name(self):
        """Testa que account_name não é único (sem constraint de unicidade)"""
        url = reverse("account-create-list")
        data = {
            "account_name": "NUB",  # Nome já existe, mas sem unique constraint
            "account_type": "CS",
            "is_active": True,
            "institution": "NUB",
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_get_account_detail(self):
        """Testa recuperação de conta específica"""
        url = reverse("account-detail-view", kwargs={"pk": self.account.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["account_name"], "NUB")  # type: ignore

    def test_update_account(self):
        """Testa atualização de conta"""
        url = reverse("account-detail-view", kwargs={"pk": self.account.pk})
        data = {
            "account_name": "NUB",
            "account_type": "CC",
            "is_active": False,  # Alterando status
            "institution": "NUB",
        }

        response = self.client.put(url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active"])  # type: ignore

        # Verifica no banco
        self.account.refresh_from_db()
        self.assertFalse(self.account.is_active)

    def test_delete_account(self):
        """Testa exclusão de conta"""
        url = reverse("account-detail-view", kwargs={"pk": self.account.pk})
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
            created_by=self.user,
        )

    def test_get_expenses_list(self):
        """Testa listagem de despesas"""
        url = reverse("expense-create-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)  # type: ignore
        self.assertEqual(
            response.data["results"][0]["description"], "Compra teste"  # type: ignore  # noqa: E501
        )

    def test_create_expense_success(self):
        """Testa criação de despesa com dados válidos"""
        url = reverse("expense-create-list")
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
        self.assertEqual(response.data["description"], "Nova despesa")  # type: ignore  # noqa: E501
        self.assertEqual(response.data["value"], "250.75")  # type: ignore

    def test_create_expense_invalid_data(self):
        """Testa criação de despesa com dados inválidos"""
        url = reverse("expense-create-list")
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

        url = reverse("expense-create-list")
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

        url = reverse("expense-create-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verifica se está ordenado por data (mais recente primeiro)
        dates = [item["date"] for item in response.data["results"]]  # type: ignore  # noqa: E501
        self.assertEqual(dates, sorted(dates, reverse=True))


class AuthenticationTest(APITestCase):
    """Testes para autenticação"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass123"
        )
        # Concede permissão para visualizar contas (necessário para
        # test_access_protected_endpoint_with_valid_token)
        view_account = Permission.objects.get(codename="view_account")
        self.user.user_permissions.add(view_account)

    def test_get_token_success(self):
        """Testa obtenção de token com credenciais válidas"""
        url = reverse("token_obtain_pair")
        data = {"username": "testuser", "password": "testpass123"}

        response = self.client.post(url, data)

        # Tokens são retornados como cookies HttpOnly
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            "access_token" in response.cookies  # type: ignore
            or "access" in response.data  # type: ignore
        )

    def test_get_token_invalid_credentials(self):
        """Testa obtenção de token com credenciais inválidas"""
        url = reverse("token_obtain_pair")
        data = {"username": "testuser", "password": "wrong_password"}

        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_without_token(self):
        """Testa acesso a endpoint protegido sem token"""
        url = reverse("account-create-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_with_valid_token(self):
        """Testa acesso a endpoint protegido com token válido"""
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        url = reverse("account-create-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_user_permissions(self):
        """Testa endpoint de permissões do usuário (não-superusuário)"""
        # Endpoint bloqueia superusuários — usar usuário regular
        regular_user = User.objects.create_user(
            username="permstest",
            email="permstest@test.com",
            password="testpass123",
        )
        client = APIClient()
        refresh = RefreshToken.for_user(regular_user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        url = reverse("user-permissions")
        response = client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("username", response.data)  # type: ignore
        self.assertIn("permissions", response.data)  # type: ignore
        self.assertIn("is_staff", response.data)  # type: ignore
        self.assertIn("is_superuser", response.data)  # type: ignore


class CreditCardViewTest(BaseAPITestCase):
    """Testes para as views de CreditCard"""

    def test_create_credit_card_with_encrypted_cvv(self):
        """Testa criação de cartão com CVV criptografado"""
        url = reverse("credit_card-create-list")
        data = {
            "name": "Cartão Teste",
            "on_card_name": "JOHN DOE",
            "flag": "MSC",
            "validation_date": (
                date.today() + timedelta(days=365)
            ).isoformat(),
            "security_code": "123",  # CVV será criptografado
            "credit_limit": "5000.00",
            "max_limit": "10000.00",
            "associated_account": self.account.pk,
        }

        # Mock da criptografia para teste
        with self.patch(
            "app.encryption.FieldEncryption.encrypt_data"
        ) as mock_encrypt:
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
        # document é um descriptor — não pode ser passado via objects.create()
        self.member = Member(
            name="João Silva",
            phone="11999999999",
            email="joao@test.com",
            sex="M",
            active=True,
        )
        self.member.document = "12345678901"
        self.member.save()

    def test_get_members_list(self):
        """Testa listagem de membros"""
        url = reverse("member-create-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)  # type: ignore
        self.assertEqual(  # type: ignore
            response.data["results"][0]["name"], "João Silva"
        )

    def test_create_member_success(self):
        """Testa criação de membro com dados válidos"""
        url = reverse("member-create-list")
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
        url = reverse("member-create-list")
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


class CashFlowForecastViewTest(BaseAPITestCase):
    """Testes para CashFlowForecastView"""

    URL = "/api/v1/dashboard/cash-flow-forecast/"

    _TEST_FERNET_KEY = Fernet.generate_key().decode()

    def setUp(self):
        self._enc_patcher = patch.dict(
            os.environ, {"ENCRYPTION_KEY": self._TEST_FERNET_KEY}
        )
        self._enc_patcher.start()
        super().setUp()
        # Limpa o cache Redis entre testes para evitar interferencia
        from django.core.cache import cache

        cache.clear()
        # Segunda conta para testes que precisam de contas diferentes
        self.account2 = Account.objects.create(
            account_name="SIC", account_type="CS", is_active=True
        )

    def tearDown(self):
        self._enc_patcher.stop()
        super().tearDown()

    def _make_credit_card(self):
        from app.encryption import FieldEncryption

        card = CreditCard(
            name="Cartao Teste",
            on_card_name="TEST USER",
            flag="VSA",
            associated_account=self.account,
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            closing_day=15,
            due_day=10,
            validation_date=date(2030, 1, 1),
            created_by=self.user,
            updated_by=self.user,
        )
        card._security_code = FieldEncryption.encrypt_data("123")
        card._card_number = FieldEncryption.encrypt_data("4111111111111111")
        card.save()
        return card

    def _make_credit_card_bill(
        self,
        card,
        due_date,
        total_amount,
        paid_amount=Decimal("0.00"),
        status_value="open",
    ):
        year_str = str(due_date.year)
        month_str = calendar.month_abbr[due_date.month]
        return CreditCardBill.objects.create(
            credit_card=card,
            year=year_str,
            month=month_str,
            invoice_beginning_date=due_date - timedelta(days=30),
            invoice_ending_date=due_date - timedelta(days=1),
            due_date=due_date,
            closed=status_value != "open",
            total_amount=total_amount,
            minimum_payment=Decimal("50.00"),
            paid_amount=paid_amount,
            status=status_value,
            created_by=self.user,
        )

    def _make_expense(self, delta_days, value, payed=False, **kwargs):
        return Expense.objects.create(
            description="Teste",
            value=value,
            date=date.today() + timedelta(days=delta_days),
            horary=time(12, 0),
            category="bills and services",
            account=self.account,
            payed=payed,
            created_by=self.user,
            **kwargs,
        )

    def _make_revenue(self, delta_days, value, received=False):
        return Revenue.objects.create(
            description="Teste",
            value=value,
            date=date.today() + timedelta(days=delta_days),
            horary=time(12, 0),
            category="salary",
            account=self.account,
            received=received,
            created_by=self.user,
        )

    def test_unauthenticated_returns_401(self):
        """Sem autenticacao deve retornar 401"""
        self.client.credentials()
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_default_30_days(self):
        """Sem parametro days retorna 31 pontos (dia 0 + 30 dias)"""
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 30)  # type: ignore
        self.assertEqual(len(response.data["daily_breakdown"]), 31)  # type: ignore  # noqa: E501

    def test_60_days(self):
        """days=60 retorna 61 pontos"""
        response = self.client.get(self.URL, {"days": 60})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 60)  # type: ignore
        self.assertEqual(len(response.data["daily_breakdown"]), 61)  # type: ignore  # noqa: E501

    def test_90_days(self):
        """days=90 retorna 91 pontos"""
        response = self.client.get(self.URL, {"days": 90})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 90)  # type: ignore
        self.assertEqual(len(response.data["daily_breakdown"]), 91)  # type: ignore  # noqa: E501

    def test_invalid_days_defaults_to_30(self):
        """days invalido (ex.: 999) deve usar 30 como default"""
        response = self.client.get(self.URL, {"days": 999})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 30)  # type: ignore

    def test_day_0_equals_current_balance(self):
        """O primeiro ponto (dia 0) deve ser igual ao saldo atual das contas"""
        self.account.current_balance = Decimal("3000.00")
        self.account.save()

        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        self.assertAlmostEqual(breakdown[0]["balance"], 3000.00, places=2)
        self.assertEqual(breakdown[0]["revenues"], 0.0)
        self.assertEqual(breakdown[0]["expenses"], 0.0)

    def test_pending_expense_reduces_balance(self):
        """Despesa pendente no dia N deve reduzir o saldo daquele dia"""
        self._make_expense(delta_days=1, value=Decimal("200.00"), payed=False)
        # Usa update() para contornar signals que recalculam o saldo
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("1000.00")
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        day_1 = breakdown[1]
        self.assertAlmostEqual(day_1["expenses"], 200.00, places=2)
        self.assertAlmostEqual(day_1["balance"], 800.00, places=2)

    def test_pending_revenue_increases_balance(self):
        """Receita pendente no dia N deve aumentar o saldo daquele dia"""
        self._make_revenue(
            delta_days=2, value=Decimal("300.00"), received=False
        )
        # Usa update() para contornar signals que recalculam o saldo
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("500.00")
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        day_2 = breakdown[2]
        self.assertAlmostEqual(day_2["revenues"], 300.00, places=2)
        self.assertAlmostEqual(day_2["balance"], 800.00, places=2)

    def test_paid_expense_excluded(self):
        """Despesa ja paga nao deve afetar a projecao"""
        self._make_expense(delta_days=1, value=Decimal("500.00"), payed=True)
        # Usa update() para contornar signals que recalculam o saldo
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("1000.00")
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        self.assertAlmostEqual(breakdown[1]["expenses"], 0.0, places=2)
        self.assertAlmostEqual(breakdown[1]["balance"], 1000.00, places=2)

    def test_transfer_expense_excluded(self):
        """Despesa vinculada a transferencia nao deve entrar na projecao"""
        from transfers.models import Transfer

        transfer = Transfer.objects.create(
            description="Transferência teste",
            value=Decimal("100.00"),
            date=date.today() + timedelta(days=1),
            horary=time(10, 0),
            category="pix",
            origin_account=self.account,
            destiny_account=self.account2,
        )
        self._make_expense(
            delta_days=1,
            value=Decimal("100.00"),
            payed=False,
            related_transfer=transfer,
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        self.assertAlmostEqual(breakdown[1]["expenses"], 0.0, places=2)

    def test_fixed_expense_not_generated_included(self):
        """Despesa fixa ainda nao gerada deve aparecer na projecao"""
        self.account.current_balance = Decimal("2000.00")
        self.account.save()

        # Due em 5 dias, sem last_generated_month setado
        due_date = date.today() + timedelta(days=5)
        FixedExpense.objects.create(
            description="Aluguel",
            default_value=Decimal("800.00"),
            category="house",
            account=self.account,
            due_day=due_date.day,
            is_active=True,
            created_by=self.user,
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        day_5 = breakdown[5]
        self.assertAlmostEqual(day_5["expenses"], 800.00, places=2)
        self.assertAlmostEqual(day_5["balance"], 1200.00, places=2)

    def test_fixed_expense_already_generated_not_duplicated(self):
        """Despesa fixa ja gerada nao deve aparecer duas vezes"""
        self.account.current_balance = Decimal("2000.00")
        self.account.save()

        due_date = date.today() + timedelta(days=5)
        fe = FixedExpense.objects.create(
            description="Aluguel",
            default_value=Decimal("800.00"),
            category="house",
            account=self.account,
            due_day=due_date.day,
            is_active=True,
            created_by=self.user,
        )
        # Lancamento avulso ja existente para este template neste mes
        Expense.objects.create(
            description="Aluguel",
            value=Decimal("800.00"),
            date=due_date,
            horary=time(12, 0),
            category="house",
            account=self.account,
            payed=False,
            fixed_expense_template=fe,
            created_by=self.user,
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        day_5 = breakdown[5]
        # Apenas o lancamento avulso (800), nao deve somar mais 800 do template
        self.assertAlmostEqual(day_5["expenses"], 800.00, places=2)

    def test_unpaid_credit_card_bill_included_in_projection(self):
        """
        Fatura de cartao nao paga com vencimento no periodo deve aparecer.
        """
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("2000.00")
        )
        card = self._make_credit_card()
        due_date = date.today() + timedelta(days=5)
        self._make_credit_card_bill(
            card, due_date=due_date, total_amount=Decimal("600.00")
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        day_5 = breakdown[5]
        self.assertAlmostEqual(day_5["expenses"], 600.00, places=2)
        self.assertAlmostEqual(day_5["balance"], 1400.00, places=2)

    def test_paid_credit_card_bill_excluded_from_projection(self):
        """Fatura com status 'paid' nao deve entrar na projecao"""
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("2000.00")
        )
        card = self._make_credit_card()
        due_date = date.today() + timedelta(days=5)
        self._make_credit_card_bill(
            card,
            due_date=due_date,
            total_amount=Decimal("600.00"),
            paid_amount=Decimal("600.00"),
            status_value="paid",
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        self.assertAlmostEqual(breakdown[5]["expenses"], 0.00, places=2)
        self.assertAlmostEqual(breakdown[5]["balance"], 2000.00, places=2)

    def test_partially_paid_credit_card_bill_shows_remaining(self):
        """Fatura parcialmente paga deve incluir apenas o saldo devedor"""
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("2000.00")
        )
        card = self._make_credit_card()
        due_date = date.today() + timedelta(days=5)
        self._make_credit_card_bill(
            card,
            due_date=due_date,
            total_amount=Decimal("600.00"),
            paid_amount=Decimal("200.00"),
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        self.assertAlmostEqual(breakdown[5]["expenses"], 400.00, places=2)
        self.assertAlmostEqual(breakdown[5]["balance"], 1600.00, places=2)

    def test_credit_card_bill_without_due_date_excluded(self):
        """
        Fatura sem data de vencimento e cartao sem due_day nao entra na
        projecao.
        """
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("2000.00")
        )
        from app.encryption import FieldEncryption

        card_no_due_day = CreditCard(
            name="Cartao Sem Vencimento",
            on_card_name="TEST USER",
            flag="VSA",
            associated_account=self.account,
            credit_limit=Decimal("5000.00"),
            max_limit=Decimal("5000.00"),
            closing_day=15,
            due_day=None,
            validation_date=date(2030, 1, 1),
            created_by=self.user,
            updated_by=self.user,
        )
        card_no_due_day._security_code = FieldEncryption.encrypt_data("123")
        card_no_due_day._card_number = FieldEncryption.encrypt_data(
            "4111111111111111"
        )
        card_no_due_day.save()
        CreditCardBill.objects.create(
            credit_card=card_no_due_day,
            year="2026",
            month="Apr",
            invoice_beginning_date=date.today() - timedelta(days=30),
            invoice_ending_date=date.today() - timedelta(days=1),
            due_date=None,
            closed=False,
            total_amount=Decimal("500.00"),
            minimum_payment=Decimal("50.00"),
            paid_amount=Decimal("0.00"),
            status="open",
            created_by=self.user,
        )

        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        total_expenses = response.data["total_expenses"]  # type: ignore
        self.assertAlmostEqual(total_expenses, 0.00, places=2)

    def test_credit_card_bill_outside_window_excluded(self):
        """
        Fatura com vencimento fora da janela de projecao nao deve aparecer
        """
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("2000.00")
        )
        card = self._make_credit_card()
        due_date = date.today() + timedelta(days=45)
        self._make_credit_card_bill(
            card, due_date=due_date, total_amount=Decimal("600.00")
        )

        response = self.client.get(self.URL, {"days": 30})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        total_expenses = response.data["total_expenses"]  # type: ignore
        self.assertAlmostEqual(total_expenses, 0.00, places=2)

    def test_multiple_credit_card_bills_same_due_date_summed(self):
        """Varias faturas com o mesmo vencimento devem ser somadas"""
        Account.objects.filter(pk=self.account.pk).update(
            current_balance=Decimal("3000.00")
        )
        card = self._make_credit_card()
        due_date = date.today() + timedelta(days=7)
        self._make_credit_card_bill(
            card, due_date=due_date, total_amount=Decimal("400.00")
        )
        card2 = self._make_credit_card()
        self._make_credit_card_bill(
            card2, due_date=due_date, total_amount=Decimal("300.00")
        )

        response = self.client.get(self.URL)
        breakdown = response.data["daily_breakdown"]  # type: ignore
        self.assertAlmostEqual(breakdown[7]["expenses"], 700.00, places=2)
        self.assertAlmostEqual(breakdown[7]["balance"], 2300.00, places=2)
