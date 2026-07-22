import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0005_alter_account_deleted_by"),
        ("expenses", "0012_expense_auto_categorized_categorizationrule"),
        ("revenues", "0005_alter_revenue_deleted_by"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BankStatementImport",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "uuid",
                    models.UUIDField(
                        default=__import__("uuid").uuid4,
                        editable=False,
                        unique=True,
                        verbose_name="UUID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Criado em"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Atualizado em"),
                ),
                (
                    "is_deleted",
                    models.BooleanField(default=False, verbose_name="Excluído"),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Excluído em"
                    ),
                ),
                (
                    "file_hash",
                    models.CharField(max_length=64, verbose_name="Hash do Arquivo"),
                ),
                (
                    "original_filename",
                    models.CharField(
                        max_length=255, verbose_name="Nome Original do Arquivo"
                    ),
                ),
                (
                    "file_format",
                    models.CharField(
                        choices=[("ofx", "OFX"), ("csv", "CSV")],
                        max_length=3,
                        verbose_name="Formato",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("processing", "Processando"),
                            ("completed", "Concluído"),
                            ("failed", "Falhou"),
                        ],
                        default="processing",
                        max_length=12,
                        verbose_name="Status",
                    ),
                ),
                (
                    "total_entries",
                    models.PositiveIntegerField(
                        default=0, verbose_name="Total de Entradas"
                    ),
                ),
                (
                    "matched_count",
                    models.PositiveIntegerField(default=0, verbose_name="Conciliados"),
                ),
                (
                    "unmatched_count",
                    models.PositiveIntegerField(default=0, verbose_name="Divergentes"),
                ),
                (
                    "ignored_count",
                    models.PositiveIntegerField(default=0, verbose_name="Ignorados"),
                ),
                (
                    "error_message",
                    models.TextField(
                        blank=True, null=True, verbose_name="Mensagem de Erro"
                    ),
                ),
                (
                    "account",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bank_statement_imports",
                        to="accounts.account",
                        verbose_name="Conta",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Criado por",
                    ),
                ),
                (
                    "deleted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_deleted",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Excluído por",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bank_statement_imports",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Proprietário",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Atualizado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "Importação de Extrato",
                "verbose_name_plural": "Importações de Extrato",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="BankStatementEntry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "uuid",
                    models.UUIDField(
                        default=__import__("uuid").uuid4,
                        editable=False,
                        unique=True,
                        verbose_name="UUID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Criado em"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Atualizado em"),
                ),
                (
                    "is_deleted",
                    models.BooleanField(default=False, verbose_name="Excluído"),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True, null=True, verbose_name="Excluído em"
                    ),
                ),
                (
                    "transaction_id",
                    models.CharField(
                        blank=True, max_length=255, verbose_name="ID da Transação"
                    ),
                ),
                ("date", models.DateField(verbose_name="Data")),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2, max_digits=12, verbose_name="Valor"
                    ),
                ),
                (
                    "description",
                    models.CharField(max_length=500, verbose_name="Descrição"),
                ),
                (
                    "transaction_type",
                    models.CharField(
                        choices=[("debit", "Débito"), ("credit", "Crédito")],
                        max_length=6,
                        verbose_name="Tipo",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pendente"),
                            ("matched", "Conciliado"),
                            ("unmatched", "Divergente"),
                            ("ignored", "Ignorado"),
                        ],
                        default="pending",
                        max_length=10,
                        verbose_name="Status",
                    ),
                ),
                (
                    "match_confidence",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("high", "Alta"),
                            ("medium", "Média"),
                            ("low", "Baixa"),
                        ],
                        max_length=6,
                        null=True,
                        verbose_name="Confiança do Match",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Criado por",
                    ),
                ),
                (
                    "deleted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_deleted",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Excluído por",
                    ),
                ),
                (
                    "matched_expense",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="bank_reconciliation_entries",
                        to="expenses.expense",
                        verbose_name="Despesa Conciliada",
                    ),
                ),
                (
                    "matched_revenue",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="bank_reconciliation_entries",
                        to="revenues.revenue",
                        verbose_name="Receita Conciliada",
                    ),
                ),
                (
                    "statement_import",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entries",
                        to="bank_reconciliation.bankstatementimport",
                        verbose_name="Importação",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Atualizado por",
                    ),
                ),
            ],
            options={
                "verbose_name": "Entrada do Extrato",
                "verbose_name_plural": "Entradas do Extrato",
                "ordering": ["date"],
            },
        ),
        migrations.AddIndex(
            model_name="bankstatementimport",
            index=models.Index(
                fields=["owner", "file_hash"],
                name="brec_import_owner_hash_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="bankstatemententry",
            index=models.Index(
                fields=["statement_import", "status"],
                name="brec_entry_import_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="bankstatemententry",
            index=models.Index(
                fields=["statement_import", "date"],
                name="brec_entry_import_date_idx",
            ),
        ),
    ]
