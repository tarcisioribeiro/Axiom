#!/usr/bin/env python
"""
Script de Migração: StreamFort (MySQL) → MindLedger (PostgreSQL)

Este script migra todos os dados do StreamFort para o módulo Security do MindLedger.

Migrações:
1. usuarios → Django User + Member
2. senhas → security.Password
3. cartao_credito → security.StoredCreditCard
4. contas_bancarias → security.StoredBankAccount
5. arquivo_texto → security.Archive
6. logs_atividades → security.ActivityLog

Uso:
    python scripts/migrate_streamfort.py
"""

import os
import sys
from pathlib import Path

import django

# Setup Django
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.db import transaction  # noqa: E402

import mysql.connector  # noqa: E402

from members.models import Member  # noqa: E402
from security.activity_logs.models import ActivityLog  # noqa: E402
from security.models import (  # noqa: E402
    Archive,
    Password,
    StoredBankAccount,
    StoredCreditCard,
)

# Configuração do MySQL (StreamFort)
MYSQL_CONFIG = {
    "host": input("MySQL Host (default: localhost): ") or "localhost",
    "port": int(input("MySQL Port (default: 3306): ") or 3306),
    "user": input("MySQL User (default: root): ") or "root",
    "password": input("MySQL Password: "),
    "database": input("MySQL Database (default: seguranca): ") or "seguranca",
    "charset": "utf8mb4",
}


def get_mysql_connection():
    """Conecta ao banco MySQL do StreamFort."""
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        print(f"✓ Conectado ao MySQL: {MYSQL_CONFIG['database']}")
        return conn
    except mysql.connector.Error as err:
        print(f"✗ Erro ao conectar ao MySQL: {err}")
        sys.exit(1)


def migrate_users(cursor):
    """
    Migra usuários do StreamFort para Django User + Member.

    StreamFort.usuarios → Django User + Member
    """
    print("\n[1/6] Migrando usuários...")

    cursor.execute("SELECT * FROM usuarios")
    users = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in users:
        try:
            # Dados do StreamFort
            user_id = row[0]  # id_usuario
            login = row[1]  # login
            # row[2] is senha (bcrypt hash bytes) - not migrated
            nome = row[3]  # nome
            documento = row[4]  # documento_usuario (CPF)
            sexo = row[5]  # sexo (M/F)

            # Verificar se usuário já existe
            if User.objects.filter(username=login).exists():
                print(f"  ⚠ Usuário '{login}' já existe, pulando...")
                continue

            # Criar Django User
            # Nota: senha já está em bcrypt, Django aceita
            user = User.objects.create(
                username=login,
                email=f"{login}@mindledger.local",  # Email fake
                first_name=nome.split()[0] if nome else login,
                last_name=" ".join(nome.split()[1:]) if len(nome.split()) > 1 else "",
            )

            # Definir senha bcrypt diretamente
            # Django aceita bcrypt com prefixo 'bcrypt$'
            # Mas como a senha do StreamFort já está em bytes bcrypt,
            # vamos definir uma senha temporária e pedir ao usuário para trocar
            user.set_password("MindLedger2024!")  # Senha temporária
            user.save()

            # Criar Member
            Member.objects.create(
                name=nome,
                document=documento or f"TEMP{user_id}",  # CPF ou ID temporário
                phone="0000000000",  # Placeholder
                email=user.email,
                sex=sexo,
                user=user,
                owner=user,  # Self-owned
                created_by=user,
                updated_by=user,
            )

            migrated += 1
            print(f"  ✓ Usuário '{login}' migrado (senha temporária: MindLedger2024!)")

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar usuário {row[1]}: {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def migrate_passwords(cursor):
    """
    Migra senhas do StreamFort para security.Password.

    StreamFort.senhas → security.Password
    """
    print("\n[2/6] Migrando senhas...")

    cursor.execute("SELECT * FROM senhas WHERE ativa = 'S'")
    passwords = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in passwords:
        try:
            # Dados do StreamFort
            nome_site = row[1]  # nome_site
            url_site = row[2]  # url_site
            login = row[3]  # login
            senha_bytes = row[4]  # senha (criptografada em bytes)
            usuario_associado = row[5]  # usuario_associado (nome)
            documento = row[6]  # documento_usuario_associado

            # Encontrar Member pelo documento
            try:
                member = Member.objects.get(document=documento)
            except Member.DoesNotExist:
                print(
                    f"  ⚠ Member com documento '{documento}' não encontrado, pulando..."
                )
                continue

            # Converter senha de bytes para string (já criptografada no StreamFort)
            # Vamos recriptografar com Fernet
            senha_str = (
                senha_bytes.decode("utf-8")
                if isinstance(senha_bytes, bytes)
                else str(senha_bytes)
            )

            # Criar Password
            password_obj = Password(
                title=nome_site,
                site=url_site if url_site else None,
                username=login,
                category="other",  # Usuário pode categorizar depois
                notes=f"Migrado do StreamFort. Usuário original: {usuario_associado}",
                owner=member,
                created_by=member.user,
                updated_by=member.user,
            )

            # Usar property setter que criptografa automaticamente
            password_obj.password = senha_str
            password_obj.save()

            migrated += 1

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar senha '{row[1]}': {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def migrate_credit_cards(cursor):
    """
    Migra cartões de crédito do StreamFort para security.StoredCreditCard.

    StreamFort.cartao_credito → security.StoredCreditCard
    """
    print("\n[3/6] Migrando cartões de crédito...")

    cursor.execute("SELECT * FROM cartao_credito WHERE ativo = 'S'")
    cards = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in cards:
        try:
            # Dados do StreamFort
            nome_cartao = row[1]  # nome_cartao
            numero_cartao = row[2]  # numero_cartao
            nome_titular = row[3]  # nome_titular
            proprietario = row[4]  # proprietario_cartao
            documento = row[5]  # documento_titular
            data_validade = row[6]  # data_validade (DATE)
            cvv = row[7]  # codigo_seguranca

            # Encontrar Member
            try:
                member = Member.objects.get(document=documento)
            except Member.DoesNotExist:
                print(
                    f"  ⚠ Member com documento '{documento}' não encontrado, pulando..."
                )
                continue

            # Extrair mês e ano da validade
            expiration_month = data_validade.month
            expiration_year = data_validade.year

            # Determinar bandeira (heurística simples)
            first_digit = str(numero_cartao)[0]
            if first_digit == "4":
                flag = "VSA"
            elif first_digit in ["5", "2"]:
                flag = "MSC"
            else:
                flag = "OTHER"

            # Criar StoredCreditCard
            card = StoredCreditCard(
                name=nome_cartao,
                cardholder_name=nome_titular,
                expiration_month=expiration_month,
                expiration_year=expiration_year,
                flag=flag,
                notes=f"Migrado do StreamFort. Proprietário: {proprietario}",
                owner=member,
                created_by=member.user,
                updated_by=member.user,
            )

            # Usar property setters para criptografar
            card.card_number = numero_cartao
            card.security_code = cvv
            card.save()

            migrated += 1

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar cartão '{row[1]}': {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def migrate_bank_accounts(cursor):
    """
    Migra contas bancárias do StreamFort para security.StoredBankAccount.

    StreamFort.contas_bancarias → security.StoredBankAccount
    """
    print("\n[4/6] Migrando contas bancárias...")

    cursor.execute("SELECT * FROM contas_bancarias")
    accounts = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in accounts:
        try:
            # Dados do StreamFort
            nome_conta = row[1]  # nome_conta
            instituicao = row[2]  # instituicao_financeira
            agencia = row[4]  # agencia
            numero_conta = row[5]  # numero_conta
            senha_bancaria = row[7]  # senha_bancaria_conta
            senha_digital = row[8]  # senha_digital_conta
            proprietario = row[9]  # nome_proprietario_conta
            documento = row[10]  # documento_proprietario_conta

            # Encontrar Member
            try:
                member = Member.objects.get(document=documento)
            except Member.DoesNotExist:
                print(
                    f"  ⚠ Member com documento '{documento}' não encontrado, pulando..."
                )
                continue

            # Criar StoredBankAccount
            account = StoredBankAccount(
                name=nome_conta,
                institution_name=instituicao,
                account_type="CC",  # Assumir Conta Corrente por padrão
                agency=agencia,
                notes=f"Migrado do StreamFort. Proprietário: {proprietario}",
                owner=member,
                created_by=member.user,
                updated_by=member.user,
            )

            # Usar property setters para criptografar
            account.account_number = numero_conta
            if senha_bancaria:
                account.password = senha_bancaria
            if senha_digital:
                account.digital_password = senha_digital

            account.save()

            migrated += 1

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar conta '{row[1]}': {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def migrate_archives(cursor):
    """
    Migra arquivos de texto do StreamFort para security.Archive.

    StreamFort.arquivo_texto → security.Archive
    """
    print("\n[5/6] Migrando arquivos...")

    cursor.execute("SELECT * FROM arquivo_texto")
    archives = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in archives:
        try:
            # Dados do StreamFort
            nome_arquivo = row[1]  # nome_arquivo
            conteudo = row[2]  # conteudo (TEXT)
            usuario_associado = row[3]  # usuario_associado
            documento = row[4]  # documento_usuario_associado

            # Encontrar Member
            try:
                member = Member.objects.get(document=documento)
            except Member.DoesNotExist:
                print(
                    f"  ⚠ Member com documento '{documento}' não encontrado, pulando..."
                )
                continue

            # Criar Archive
            archive = Archive(
                title=nome_arquivo or "Arquivo sem título",
                category="other",
                archive_type="text",
                notes=f"Migrado do StreamFort. Usuário: {usuario_associado}",
                owner=member,
                created_by=member.user,
                updated_by=member.user,
            )

            # Usar property setter para criptografar conteúdo
            if conteudo:
                archive.text_content = conteudo

            archive.save()

            migrated += 1

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar arquivo '{row[1]}': {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def migrate_activity_logs(cursor):
    """
    Migra logs de atividades do StreamFort para security.ActivityLog.

    StreamFort.logs_atividades → security.ActivityLog
    """
    print("\n[6/6] Migrando logs de atividades...")

    cursor.execute("SELECT * FROM logs_atividades ORDER BY data_log, horario_log")
    logs = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in logs:
        try:
            # Dados do StreamFort
            data_log = row[1]  # data_log
            horario_log = row[2]  # horario_log
            usuario_log = row[3]  # usuario_log (login)
            tipo_log = row[4]  # tipo_log
            conteudo_log = row[5]  # conteudo_log

            # Encontrar User pelo login
            try:
                user = User.objects.get(username=usuario_log)
            except User.DoesNotExist:
                user = None

            # Mapear tipo_log para ACTION_TYPES
            action_map = {
                "Registro": "create",
                "Acesso": "view",
                "Consulta": "view",
                "Cadastro": "create",
                "Login": "login",
                "Logout": "logout",
            }
            action = action_map.get(tipo_log, "other")

            # Criar ActivityLog
            from datetime import datetime, time

            # Combinar data e hora
            if isinstance(horario_log, time):
                created_at = datetime.combine(data_log, horario_log)
            else:
                created_at = datetime.combine(data_log, datetime.min.time())

            ActivityLog.objects.create(
                action=action,
                description=conteudo_log,
                user=user,
                created_at=created_at,
            )

            migrated += 1

        except Exception:
            errors += 1
            # Logs são opcionais, não imprimir erro para cada um
            pass

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def main():
    """Executa a migração completa."""
    print("=" * 60)
    print("MIGRAÇÃO: StreamFort → MindLedger Security Module")
    print("=" * 60)

    # Conectar ao MySQL
    mysql_conn = get_mysql_connection()
    cursor = mysql_conn.cursor()

    try:
        # Executar migrações em ordem
        with transaction.atomic():
            total_users = migrate_users(cursor)
            total_passwords = migrate_passwords(cursor)
            total_cards = migrate_credit_cards(cursor)
            total_accounts = migrate_bank_accounts(cursor)
            total_archives = migrate_archives(cursor)
            total_logs = migrate_activity_logs(cursor)

        # Resumo
        print("\n" + "=" * 60)
        print("RESUMO DA MIGRAÇÃO")
        print("=" * 60)
        print(f"✓ Usuários migrados:        {total_users}")
        print(f"✓ Senhas migradas:          {total_passwords}")
        print(f"✓ Cartões migrados:         {total_cards}")
        print(f"✓ Contas bancárias migradas:{total_accounts}")
        print(f"✓ Arquivos migrados:        {total_archives}")
        print(f"✓ Logs migrados:            {total_logs}")
        print("=" * 60)
        print("\n✓ Migração concluída com sucesso!")
        print("\nNOTA: Todos os usuários foram criados com senha temporária:")
        print("      Senha: MindLedger2024!")
        print("      Os usuários devem trocar a senha no primeiro login.")

    except Exception as e:
        print(f"\n✗ ERRO CRÍTICO na migração: {e}")
        import traceback

        traceback.print_exc()

    finally:
        cursor.close()
        mysql_conn.close()
        print("\n✓ Conexão MySQL encerrada.")


if __name__ == "__main__":
    # Confirmação antes de executar
    print("\n⚠ ATENÇÃO: Este script irá migrar dados do StreamFort para o MindLedger.")
    print("  Certifique-se de ter um backup antes de continuar.")
    confirm = input("\nDeseja continuar? (sim/não): ")

    if confirm.lower() in ["sim", "s", "yes", "y"]:
        main()
    else:
        print("Migração cancelada.")
