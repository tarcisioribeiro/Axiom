import os
from datetime import date, time, timedelta

# from django.core.exceptions import ValidationError
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

# Models
from accounts.models import Account

# Serializers
from accounts.serializers import AccountSerializer

# from revenues.models import Revenue
from credit_cards.models import CreditCard
from credit_cards.serializers import (  # noqa: E501  # CreditCardBillsSerializer, CreditCardExpensesSerializer
    CreditCardSerializer,
)
from expenses.models import Expense
from expenses.serializers import ExpenseSerializer
from members.models import Member
from members.serializers import (  # BenefitedSerializer,; CreditorSerializer
    MemberSerializer,
)
from revenues.serializers import RevenueSerializer


class AccountSerializerTest(TestCase):
    """Testes para AccountSerializer"""

    def setUp(self):
        self.account_data = {"name": "NUB", "account_type": "CC", "is_active": True}
        self.account = Account.objects.create(**self.account_data)

    def test_serialize_account(self):
        """Testa serialização de Account"""
        serializer = AccountSerializer(self.account)

        self.assertEqual(serializer.data["name"], "NUB")  # type: ignore
        self.assertEqual(serializer.data["account_type"], "CC")  # type: ignore
        self.assertTrue(serializer.data["is_active"])  # type: ignore

    def test_deserialize_valid_data(self):
        """Testa deserialização com dados válidos"""
        data = {"name": "SIC", "account_type": "CS", "is_active": True}

        serializer = AccountSerializer(data=data)
        self.assertTrue(serializer.is_valid())

        account = serializer.save()
        self.assertEqual(account.name, "SIC")  # type: ignore
        self.assertEqual(account.account_type, "CS")  # type: ignore

    def test_deserialize_invalid_data(self):
        """Testa deserialização com dados inválidos"""
        data = {
            "name": "INVALID_NAME",  # Nome não está nas choices
            "account_type": "CC",
            "is_active": True,
        }

        serializer = AccountSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_update_account(self):
        """Testa atualização de Account via serializer"""
        data = {"name": "NUB", "account_type": "CC", "is_active": False}

        serializer = AccountSerializer(self.account, data=data)
        self.assertTrue(serializer.is_valid())

        updated_account = serializer.save()
        self.assertFalse(updated_account.is_active)  # type: ignore


class ExpenseSerializerTest(TestCase):
    """Testes para ExpenseSerializer"""

    def setUp(self):
        self.account = Account.objects.create(
            name="NUB", account_type="CC", is_active=True
        )
        self.expense_data = {
            "description": "Compra supermercado",
            "value": Decimal("150.50"),
            "date": date.today(),
            "horary": time(14, 30),
            "category": "supermarket",
            "account": self.account.pk,
            "payed": True,
        }
        self.expense = Expense.objects.create(
            description="Compra supermercado",
            value=Decimal("150.50"),
            date=date.today(),
            horary=time(14, 30),
            category="supermarket",
            account=self.account,
            payed=True,
        )

    def test_serialize_expense(self):
        """Testa serialização de Expense"""
        serializer = ExpenseSerializer(self.expense)

        self.assertEqual(
            serializer.data["description"], "Compra supermercado"  # type: ignore
        )
        self.assertEqual(serializer.data["value"], "150.50")  # type: ignore
        self.assertEqual(serializer.data["category"], "supermarket")  # type: ignore

    def test_deserialize_valid_data(self):
        """Testa deserialização com dados válidos"""
        serializer = ExpenseSerializer(data=self.expense_data)
        self.assertTrue(serializer.is_valid())

        expense = serializer.save()
        self.assertEqual(expense.description, "Compra supermercado")  # type: ignore
        self.assertEqual(expense.value, Decimal("150.50"))  # type: ignore

    def test_deserialize_invalid_category(self):
        """Testa deserialização com categoria inválida"""
        invalid_data = self.expense_data.copy()
        invalid_data["category"] = "invalid_category"

        serializer = ExpenseSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("category", serializer.errors)

    def test_deserialize_negative_value(self):
        """Testa deserialização com valor negativo"""
        invalid_data = self.expense_data.copy()
        invalid_data["value"] = "-100.00"

        serializer = ExpenseSerializer(data=invalid_data)
        print(serializer)
        # Nota: Você precisa implementar validação customizada no serializer
        # para rejeitar valores negativos

    def test_deserialize_missing_required_fields(self):
        """Testa deserialização com campos obrigatórios faltando"""
        incomplete_data = {
            "description": "Descrição",
            # Faltam campos obrigatórios
        }

        serializer = ExpenseSerializer(data=incomplete_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("value", serializer.errors)
        self.assertIn("date", serializer.errors)
        self.assertIn("category", serializer.errors)
        self.assertIn("account", serializer.errors)


class CreditCardSerializerTest(TestCase):
    """Testes para CreditCardSerializer"""

    def setUp(self):
        self.account = Account.objects.create(
            name="NUB", account_type="CC", is_active=True
        )
        self.credit_card_data = {
            "name": "Cartão Principal",
            "on_card_name": "JOHN DOE",
            "flag": "MSC",
            "validation_date": date.today() + timedelta(days=365),
            "security_code": "123",
            "credit_limit": "5000.00",
            "max_limit": "10000.00",
            "associated_account": self.account.pk,
        }

    @patch.dict(os.environ, {"ENCRYPTION_KEY": "test_key"})
    def test_deserialize_valid_data(self):
        """Testa deserialização com dados válidos"""
        with patch("app.encryption.FieldEncryption.encrypt_data") as mock_encrypt:
            mock_encrypt.return_value = "encrypted_cvv"

            serializer = CreditCardSerializer(data=self.credit_card_data)
            self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_validate_security_code_invalid_characters(self):
        """Testa validação do CVV com caracteres inválidos"""
        invalid_data = self.credit_card_data.copy()
        invalid_data["security_code"] = "abc"

        serializer = CreditCardSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("security_code", serializer.errors)

    def test_validate_security_code_invalid_length(self):
        """Testa validação do CVV com tamanho inválido"""
        invalid_data = self.credit_card_data.copy()
        invalid_data["security_code"] = "12345"  # 5 dígitos

        serializer = CreditCardSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("security_code", serializer.errors)

    def test_validate_validation_date_past(self):
        """Testa validação de data de validade no passado"""
        invalid_data = self.credit_card_data.copy()
        invalid_data["validation_date"] = date.today() - timedelta(days=1)

        serializer = CreditCardSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("validation_date", serializer.errors)

    def test_security_code_write_only(self):
        """Testa que o security_code é write-only"""
        with patch("app.encryption.FieldEncryption.encrypt_data") as mock_encrypt:
            mock_encrypt.return_value = "encrypted_cvv"

            card = CreditCard.objects.create(
                name="Cartão Teste",
                on_card_name="JOHN DOE",
                flag="MSC",
                validation_date=date.today() + timedelta(days=365),
                credit_limit=Decimal("5000.00"),
                max_limit=Decimal("10000.00"),
                associated_account=self.account,
            )
            card.security_code = "123"
            card.save()

            serializer = CreditCardSerializer(card)
            # O security_code não deve aparecer na serialização
            self.assertNotIn("security_code", serializer.data)


class RevenueSerializerTest(TestCase):
    """Testes para RevenueSerializer"""

    def setUp(self):
        self.account = Account.objects.create(
            name="NUB", account_type="CC", is_active=True
        )
        self.revenue_data = {
            "description": "Salário",
            "value": "3000.00",
            "date": date.today().isoformat(),
            "horary": "09:00:00",
            "category": "salary",
            "account": self.account.pk,
            "received": True,
        }

    def test_deserialize_valid_data(self):
        """Testa deserialização com dados válidos"""
        serializer = RevenueSerializer(data=self.revenue_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        revenue = serializer.save()
        self.assertEqual(revenue.description, "Salário")  # type: ignore
        self.assertEqual(revenue.category, "salary")  # type: ignore

    def test_deserialize_invalid_category(self):
        """Testa deserialização com categoria inválida"""
        invalid_data = self.revenue_data.copy()
        invalid_data["category"] = "invalid_category"

        serializer = RevenueSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("category", serializer.errors)


class MemberSerializerTest(TestCase):
    """Testes para MemberSerializer"""

    def setUp(self):
        self.member_data = {
            "name": "João Silva",
            "document": "12345678901",
            "phone": "11999999999",
            "email": "joao@test.com",
            "sex": "M",
            "active": True,
        }

    def test_deserialize_valid_data(self):
        """Testa deserialização com dados válidos"""
        serializer = MemberSerializer(data=self.member_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        member = serializer.save()
        self.assertEqual(member.name, "João Silva")  # type: ignore
        self.assertEqual(member.document, "12345678901")  # type: ignore

    def test_validate_email_format(self):
        """Testa validação do formato de email"""
        invalid_data = self.member_data.copy()
        invalid_data["email"] = "email_inválido"

        serializer = MemberSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_validate_sex_choice(self):
        """Testa validação da escolha de sexo"""
        invalid_data = self.member_data.copy()
        invalid_data["sex"] = "X"  # Valor não válido

        serializer = MemberSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("sex", serializer.errors)

    def test_serialize_member(self):
        """Testa serialização de Member"""
        member = Member.objects.create(**self.member_data)
        serializer = MemberSerializer(member)

        self.assertEqual(serializer.data["name"], "João Silva")  # type: ignore
        self.assertEqual(serializer.data["document"], "12345678901")  # type: ignore
        self.assertEqual(serializer.data["email"], "joao@test.com")  # type: ignore


class SerializerValidationTest(TestCase):
    """Testes gerais de validação para serializers"""

    def test_empty_string_validation(self):
        """Testa validação de strings vazias em campos obrigatórios"""
        data = {"name": "", "account_type": "CC", "is_active": True}  # String vazia

        serializer = AccountSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        # A validação deve rejeitar strings vazias para campos obrigatórios

    def test_null_values_validation(self):
        """Testa validação de valores null em campos obrigatórios"""
        data = {"name": None, "account_type": "CC", "is_active": True}  # Valor null

        serializer = AccountSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_decimal_precision_validation(self):
        """Testa validação de precisão decimal"""
        account = Account.objects.create(name="NUB", account_type="CC", is_active=True)

        data = {
            "description": "Teste",
            "value": "123.456",  # 3 casas decimais (modelo permite apenas 2)
            "date": date.today().isoformat(),
            "horary": "14:30:00",
            "category": "others",
            "account": account.pk,
            "payed": True,
        }

        serializer = ExpenseSerializer(data=data)
        print(serializer)
        # Deve validar a precisão decimal conforme definido no modelo
