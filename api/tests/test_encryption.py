import os
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase

from cryptography.fernet import Fernet

from app.encryption import FieldEncryption


class FieldEncryptionTest(TestCase):
    """Testes para a classe FieldEncryption"""

    def setUp(self):
        # Gera uma chave de teste válida
        self.test_key = Fernet.generate_key()
        self.test_data = "123456789"

    @patch.dict(os.environ, {"ENCRYPTION_KEY": ""})
    def test_get_encryption_key_missing(self):
        """Testa erro quando a chave de criptografia não está definida"""
        # Remove a chave do ambiente
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValidationError) as context:
                FieldEncryption.get_encryption_key()

            self.assertIn("ENCRYPTION_KEY não encontrada", str(context.exception))

    @patch.dict(os.environ)
    def test_get_encryption_key_success(self):
        """Testa obtenção de chave de criptografia válida"""
        # Define chave de teste no ambiente
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        key = FieldEncryption.get_encryption_key()
        self.assertEqual(key, self.test_key)

    @patch.dict(os.environ)
    def test_encrypt_data_success(self):
        """Testa criptografia de dados com sucesso"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        encrypted = FieldEncryption.encrypt_data(self.test_data)

        # Verifica que os dados foram criptografados
        self.assertNotEqual(encrypted, self.test_data)
        self.assertIsInstance(encrypted, str)
        self.assertTrue(len(encrypted) > 0)

    @patch.dict(os.environ)
    def test_decrypt_data_success(self):
        """Testa descriptografia de dados com sucesso"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Criptografa dados
        encrypted = FieldEncryption.encrypt_data(self.test_data)

        # Descriptografa dados
        decrypted = FieldEncryption.decrypt_data(encrypted)

        # Verifica que os dados foram descriptografados corretamente
        self.assertEqual(decrypted, self.test_data)

    @patch.dict(os.environ)
    def test_encrypt_empty_data(self):
        """Testa criptografia de dados vazios"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Testa string vazia
        result = FieldEncryption.encrypt_data("")
        self.assertEqual(result, "")

        # Testa None
        result = FieldEncryption.encrypt_data(None)
        self.assertIsNone(result)

    @patch.dict(os.environ)
    def test_decrypt_empty_data(self):
        """Testa descriptografia de dados vazios"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Testa string vazia
        result = FieldEncryption.decrypt_data("")
        self.assertEqual(result, "")

        # Testa None
        result = FieldEncryption.decrypt_data(None)
        self.assertIsNone(result)

    @patch.dict(os.environ)
    def test_decrypt_invalid_data(self):
        """Testa descriptografia de dados inválidos"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Testa dados não criptografados
        with self.assertRaises(ValidationError) as context:
            FieldEncryption.decrypt_data("dados_nao_criptografados")

        self.assertIn("Erro ao descriptografar dados", str(context.exception))

    @patch.dict(os.environ)
    def test_encrypt_with_wrong_key_format(self):
        """Testa criptografia com formato de chave inválido"""
        os.environ["ENCRYPTION_KEY"] = "chave_invalida"

        with self.assertRaises(ValidationError) as context:
            FieldEncryption.encrypt_data(self.test_data)

        self.assertIn("Erro ao criptografar dados", str(context.exception))

    @patch.dict(os.environ)
    def test_encrypt_decrypt_cycle_with_numbers(self):
        """Testa ciclo completo de criptografia/descriptografia com números"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Testa com dados numéricos convertidos para string
        numeric_data = "123"
        encrypted = FieldEncryption.encrypt_data(numeric_data)
        decrypted = FieldEncryption.decrypt_data(encrypted)

        self.assertEqual(decrypted, numeric_data)

    @patch.dict(os.environ)
    def test_encrypt_decrypt_cycle_with_special_characters(self):
        """Testa ciclo completo com caracteres especiais"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Testa com caracteres especiais
        special_data = "!@#$%^&*()_+-={}[]|\\:;\"'<>?,./"
        encrypted = FieldEncryption.encrypt_data(special_data)
        decrypted = FieldEncryption.decrypt_data(encrypted)

        self.assertEqual(decrypted, special_data)

    @patch.dict(os.environ)
    def test_encrypt_decrypt_cycle_with_unicode(self):
        """Testa ciclo completo com caracteres Unicode"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Testa com caracteres Unicode
        unicode_data = "áéíóúçñü中文字符"
        encrypted = FieldEncryption.encrypt_data(unicode_data)
        decrypted = FieldEncryption.decrypt_data(encrypted)

        self.assertEqual(decrypted, unicode_data)

    def test_generate_key_format(self):
        """Testa geração de chave de criptografia"""
        key = FieldEncryption.generate_key()

        # Verifica se é uma string
        self.assertIsInstance(key, str)

        # Verifica se tem o tamanho correto para uma chave Fernet em base64
        # Uma chave Fernet tem 32 bytes, que em base64 são 44 caracteres
        self.assertEqual(len(key), 44)

        # Verifica se pode ser usada para criar um objeto Fernet
        try:
            fernet = Fernet(key.encode())
            # Testa se consegue criptografar/descriptografar
            test_data = "test"
            encrypted = fernet.encrypt(test_data.encode())
            decrypted = fernet.decrypt(encrypted).decode()
            self.assertEqual(decrypted, test_data)
        except Exception as e:
            self.fail(f"Chave gerada não é válida: {e}")

    def test_generate_unique_keys(self):
        """Testa se chaves geradas são únicas"""
        key1 = FieldEncryption.generate_key()
        key2 = FieldEncryption.generate_key()

        # Verifica se são diferentes
        self.assertNotEqual(key1, key2)

    @patch.dict(os.environ)
    def test_multiple_encryptions_same_data(self):
        """Testa que a mesma informação gera criptografias diferentes"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Criptografa os mesmos dados duas vezes
        encrypted1 = FieldEncryption.encrypt_data(self.test_data)
        encrypted2 = FieldEncryption.encrypt_data(self.test_data)

        # As criptografias devem ser diferentes (devido ao IV/nonce aleatório)
        self.assertNotEqual(encrypted1, encrypted2)

        # Mas ambas devem descriptografar para o mesmo valor original
        decrypted1 = FieldEncryption.decrypt_data(encrypted1)
        decrypted2 = FieldEncryption.decrypt_data(encrypted2)

        self.assertEqual(decrypted1, self.test_data)
        self.assertEqual(decrypted2, self.test_data)
        self.assertEqual(decrypted1, decrypted2)

    @patch.dict(os.environ)
    def test_encrypt_large_data(self):
        """Testa criptografia de dados grandes"""
        os.environ["ENCRYPTION_KEY"] = self.test_key.decode()

        # Cria string grande (1MB)
        large_data = "A" * (1024 * 1024)

        # Deve conseguir criptografar e descriptografar
        encrypted = FieldEncryption.encrypt_data(large_data)
        decrypted = FieldEncryption.decrypt_data(encrypted)

        self.assertEqual(decrypted, large_data)
