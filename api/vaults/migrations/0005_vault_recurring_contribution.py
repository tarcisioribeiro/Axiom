import uuid

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("expenses", "0012_expense_auto_categorized_categorizationrule"),
        ("vaults", "0004_alter_financialgoal_deleted_by_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VaultRecurringContribution",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "uuid",
                    models.UUIDField(
                        default=uuid.uuid4,
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
                    "amount",
                    models.DecimalField(
                        decimal_places=2, max_digits=15, verbose_name="Valor"
                    ),
                ),
                (
                    "day_of_month",
                    models.PositiveIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(31),
                        ],
                        verbose_name="Dia do Mês",
                    ),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="Ativa")),
                ("start_date", models.DateField(verbose_name="Data de Início")),
                (
                    "end_date",
                    models.DateField(
                        blank=True, null=True, verbose_name="Data de Término"
                    ),
                ),
                (
                    "description",
                    models.CharField(max_length=200, verbose_name="Descrição"),
                ),
                (
                    "last_generated_month",
                    models.CharField(
                        blank=True,
                        max_length=7,
                        null=True,
                        verbose_name="Último Mês Gerado",
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
                    "fixed_expense",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="vault_contribution",
                        to="expenses.fixedexpense",
                        verbose_name="Despesa Fixa Associada",
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
                (
                    "vault",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recurring_contributions",
                        to="vaults.vault",
                        verbose_name="Cofre",
                    ),
                ),
            ],
            options={
                "verbose_name": "Contribuição Recorrente",
                "verbose_name_plural": "Contribuições Recorrentes",
                "ordering": ["day_of_month", "description"],
            },
        ),
        migrations.AddIndex(
            model_name="vaultrecurringcontribution",
            index=models.Index(
                fields=["vault", "is_active"], name="vaults_vrc_vault_active_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="vaultrecurringcontribution",
            index=models.Index(
                fields=["is_active", "is_deleted"], name="vaults_vrc_active_del_idx"
            ),
        ),
        migrations.AddField(
            model_name="vaulttransaction",
            name="recurring_contribution",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="generated_transactions",
                to="vaults.vaultrecurringcontribution",
                verbose_name="Contribuição Recorrente",
            ),
        ),
    ]
