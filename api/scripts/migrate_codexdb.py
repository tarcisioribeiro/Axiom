#!/usr/bin/env python
"""
Script de Migração: CodexDB (PostgreSQL) → MindLedger (PostgreSQL)

Este script migra todos os dados do CodexDB para o módulo Library do MindLedger.

Migrações:
1. authors.Author → library.Author
2. publishers.Publisher → library.Publisher
3. books.Book → library.Book
4. summaries.Summary → library.Summary
5. readings.Reading → library.Reading

Uso:
    python scripts/migrate_codexdb.py
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

import psycopg2  # noqa: E402

from library.models import Author, Book, Publisher, Reading, Summary  # noqa: E402
from members.models import Member  # noqa: E402

# Configuração do PostgreSQL (CodexDB)
CODEXDB_CONFIG = {
    "host": input("CodexDB Host (default: localhost): ") or "localhost",
    "port": int(input("CodexDB Port (default: 5433): ") or 5433),
    "user": input("CodexDB User (default: admin): ") or "admin",
    "password": input("CodexDB Password: "),
    "database": input("CodexDB Database (default: codexdb): ") or "codexdb",
}


def get_codexdb_connection():
    """Conecta ao banco PostgreSQL do CodexDB."""
    try:
        conn = psycopg2.connect(**CODEXDB_CONFIG)
        print(f"✓ Conectado ao CodexDB: {CODEXDB_CONFIG['database']}")
        return conn
    except psycopg2.Error as err:
        print(f"✗ Erro ao conectar ao CodexDB: {err}")
        sys.exit(1)


def get_default_member():
    """Retorna ou cria um Member padrão para ownership."""
    try:
        # Tenta pegar o primeiro member disponível
        member = Member.objects.first()
        if member:
            print(f"  ℹ Usando Member existente: {member.name}")
            return member

        # Se não houver members, cria um
        user = User.objects.first()
        if not user:
            print(
                "  ✗ Nenhum usuário encontrado no MindLedger. Crie um usuário primeiro."
            )
            sys.exit(1)

        member = Member.objects.create(
            name="Admin Library",
            document="LIBRARY001",
            phone="0000000000",
            email=user.email,
            sex="M",
            user=user,
            owner=user,
            created_by=user,
            updated_by=user,
        )
        print(f"  ✓ Member criado: {member.name}")
        return member

    except Exception as e:
        print(f"  ✗ Erro ao obter/criar Member: {e}")
        sys.exit(1)


def migrate_authors(cursor, default_member):
    """
    Migra autores do CodexDB para MindLedger.

    CodexDB.authors.Author → MindLedger.library.Author
    """
    print("\n[1/5] Migrando autores...")

    cursor.execute("SELECT * FROM authors_author")
    authors = cursor.fetchall()

    migrated = 0
    errors = 0
    author_id_map = {}  # Mapeia old_id → new_id

    for row in authors:
        try:
            # Dados do CodexDB
            old_id = row[0]  # id
            name = row[1]  # name
            birthday = row[2]  # birthday
            death_date = row[3]  # death_date
            nationality = row[4]  # nationality
            biography = row[5]  # biography

            # Verificar se já existe
            if Author.objects.filter(name=name).exists():
                author = Author.objects.get(name=name)
                author_id_map[old_id] = author.id
                print(f"  ⚠ Autor '{name}' já existe, pulando...")
                continue

            # Criar Author
            author = Author.objects.create(
                name=name,
                birthday=birthday,
                death_date=death_date,
                nationality=nationality,
                biography=biography or "",
                owner=default_member,
                created_by=default_member.user,
                updated_by=default_member.user,
            )

            author_id_map[old_id] = author.id
            migrated += 1
            print(f"  ✓ Autor '{name}' migrado")

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar autor {row[1]}: {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated, author_id_map


def migrate_publishers(cursor, default_member):
    """Migra editoras do CodexDB para MindLedger."""
    print("\n[2/5] Migrando editoras...")

    cursor.execute("SELECT * FROM publishers_publisher")
    publishers = cursor.fetchall()

    migrated = 0
    errors = 0
    publisher_id_map = {}

    for row in publishers:
        try:
            old_id = row[0]
            name = row[1]
            description = row[2]
            website = row[3]
            country = row[4]
            founded_year = row[5]

            if Publisher.objects.filter(name=name).exists():
                publisher = Publisher.objects.get(name=name)
                publisher_id_map[old_id] = publisher.id
                print(f"  ⚠ Editora '{name}' já existe, pulando...")
                continue

            publisher = Publisher.objects.create(
                name=name,
                description=description,
                website=website,
                country=country,
                founded_year=founded_year,
                owner=default_member,
                created_by=default_member.user,
                updated_by=default_member.user,
            )

            publisher_id_map[old_id] = publisher.id
            migrated += 1
            print(f"  ✓ Editora '{name}' migrada")

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar editora {row[1]}: {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated, publisher_id_map


def migrate_books(cursor, default_member, author_id_map, publisher_id_map):
    """Migra livros do CodexDB para MindLedger."""
    print("\n[3/5] Migrando livros...")

    cursor.execute("SELECT * FROM books_book")
    books = cursor.fetchall()

    migrated = 0
    errors = 0
    book_id_map = {}

    for row in books:
        try:
            old_id = row[0]
            title = row[1]
            pages = row[2]
            publisher_id = row[3]
            language = row[4]
            genre = row[5]
            literarytype = row[6]
            publish_date = row[7]
            synopsis = row[8]
            edition = row[9]
            media_type = row[10]
            rating = row[13] if len(row) > 13 else 1

            if Book.objects.filter(title=title).exists():
                book = Book.objects.get(title=title)
                book_id_map[old_id] = book.id
                print(f"  ⚠ Livro '{title}' já existe, pulando...")
                continue

            # Mapear publisher
            new_publisher_id = publisher_id_map.get(publisher_id)
            if not new_publisher_id:
                print(
                    f"  ⚠ Publisher {publisher_id} não encontrado"
                    f" para '{title}', pulando..."
                )
                continue

            publisher = Publisher.objects.get(id=new_publisher_id)

            book = Book.objects.create(
                title=title,
                pages=pages,
                publisher=publisher,
                language=language,
                genre=genre,
                literarytype=literarytype,
                publish_date=publish_date,
                synopsis=synopsis or "Sem sinopse disponível.",
                edition=edition,
                media_type=media_type,
                rating=rating,
                owner=default_member,
                created_by=default_member.user,
                updated_by=default_member.user,
            )

            # Buscar e adicionar autores (ManyToMany)
            cursor.execute(
                "SELECT author_id FROM books_book_authors WHERE book_id = %s", (old_id,)
            )
            author_ids = cursor.fetchall()

            for (author_id,) in author_ids:
                new_author_id = author_id_map.get(author_id)
                if new_author_id:
                    author = Author.objects.get(id=new_author_id)
                    book.authors.add(author)

            book_id_map[old_id] = book.id
            migrated += 1
            print(f"  ✓ Livro '{title}' migrado")

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar livro {row[1]}: {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated, book_id_map


def migrate_summaries(cursor, default_member, book_id_map):
    """Migra resumos do CodexDB para MindLedger."""
    print("\n[4/5] Migrando resumos...")

    cursor.execute("SELECT * FROM summaries_summary")
    summaries = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in summaries:
        try:
            title = row[1]
            book_id = row[2]
            text = row[3]

            new_book_id = book_id_map.get(book_id)
            if not new_book_id:
                print(
                    f"  ⚠ Livro {book_id} não encontrado"
                    f" para resumo '{title}', pulando..."
                )
                continue

            book = Book.objects.get(id=new_book_id)

            if Summary.objects.filter(book=book).exists():
                print(f"  ⚠ Resumo para '{book.title}' já existe, pulando...")
                continue

            Summary.objects.create(
                title=title,
                book=book,
                text=text,
                is_vectorized=False,  # Será vetorizado depois
                owner=default_member,
                created_by=default_member.user,
                updated_by=default_member.user,
            )

            migrated += 1
            print(f"  ✓ Resumo de '{book.title}' migrado")

        except Exception as e:
            errors += 1
            print(f"  ✗ Erro ao migrar resumo {row[1]}: {e}")

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def migrate_readings(cursor, default_member, book_id_map):
    """Migra leituras do CodexDB para MindLedger."""
    print("\n[5/5] Migrando leituras...")

    cursor.execute("SELECT * FROM readings_reading")
    readings = cursor.fetchall()

    migrated = 0
    errors = 0

    for row in readings:
        try:
            book_id = row[1]
            reading_date = row[2]
            reading_time = row[3]
            pages_read = row[4]

            new_book_id = book_id_map.get(book_id)
            if not new_book_id:
                print(f"  ⚠ Livro {book_id} não encontrado para leitura, pulando...")
                continue

            book = Book.objects.get(id=new_book_id)

            Reading.objects.create(
                book=book,
                reading_date=reading_date,
                reading_time=reading_time,
                pages_read=pages_read,
                owner=default_member,
                created_by=default_member.user,
                updated_by=default_member.user,
            )

            migrated += 1

        except Exception:
            errors += 1
            # Não imprimir todos os erros de leitura
            pass

    print(f"\n  Total: {migrated} migrados, {errors} erros")
    return migrated


def main():
    """Executa a migração completa."""
    print("=" * 60)
    print("MIGRAÇÃO: CodexDB → MindLedger Library Module")
    print("=" * 60)

    # Conectar ao CodexDB
    codexdb_conn = get_codexdb_connection()
    cursor = codexdb_conn.cursor()

    # Obter member padrão
    default_member = get_default_member()

    try:
        # Executar migrações em ordem
        with transaction.atomic():
            total_authors, author_map = migrate_authors(cursor, default_member)
            total_publishers, publisher_map = migrate_publishers(cursor, default_member)
            total_books, book_map = migrate_books(
                cursor, default_member, author_map, publisher_map
            )
            total_summaries = migrate_summaries(cursor, default_member, book_map)
            total_readings = migrate_readings(cursor, default_member, book_map)

        # Resumo
        print("\n" + "=" * 60)
        print("RESUMO DA MIGRAÇÃO")
        print("=" * 60)
        print(f"✓ Autores migrados:    {total_authors}")
        print(f"✓ Editoras migradas:   {total_publishers}")
        print(f"✓ Livros migrados:     {total_books}")
        print(f"✓ Resumos migrados:    {total_summaries}")
        print(f"✓ Leituras migradas:   {total_readings}")
        print("=" * 60)
        print("\n✓ Migração concluída com sucesso!")
        print("\nNOTA: Os resumos precisam ser vetorizados.")
        print("      Use o endpoint /api/v1/library/summaries/{id}/vectorize/")

    except Exception as e:
        print(f"\n✗ ERRO CRÍTICO na migração: {e}")
        import traceback

        traceback.print_exc()

    finally:
        cursor.close()
        codexdb_conn.close()
        print("\n✓ Conexão CodexDB encerrada.")


if __name__ == "__main__":
    # Confirmação antes de executar
    print("\n⚠ ATENÇÃO: Este script irá migrar dados do CodexDB para o MindLedger.")
    print("  Certifique-se de ter um backup antes de continuar.")
    confirm = input("\nDeseja continuar? (sim/não): ")

    if confirm.lower() in ["sim", "s", "yes", "y"]:
        main()
    else:
        print("Migração cancelada.")
