import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("members", "0004_alter_member_deleted_by_alter_member_document_hash_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Budget",
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
                    "category",
                    models.CharField(
                        choices=[
                            ("food and drink", "Comida e bebida"),
                            ("bills and services", "Contas e serviços"),
                            ("electronics", "Eletrônicos"),
                            ("family and friends", "Amizades e Família"),
                            ("pets", "Animais de estimação"),
                            ("digital signs", "Assinaturas digitais"),
                            ("house", "Casa"),
                            ("purchases", "Compras"),
                            ("donate", "Doações"),
                            ("education", "Educação"),
                            ("loans", "Empréstimos"),
                            ("entertainment", "Entretenimento"),
                            ("taxes", "Impostos"),
                            ("investments", "Investimentos"),
                            ("others", "Outros"),
                            ("vestuary", "Roupas"),
                            ("health and care", "Saúde e cuidados pessoais"),
                            ("professional services", "Serviços profissionais"),
                            ("supermarket", "Supermercado"),
                            ("rates", "Taxas"),
                            ("transport", "Transporte"),
                            ("travels", "Viagens"),
                        ],
                        max_length=200,
                        verbose_name="Categoria",
                    ),
                ),
                (
                    "limit_amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        verbose_name="Valor Limite",
                    ),
                ),
                (
                    "month",
                    models.PositiveIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(12),
                        ],
                        verbose_name="Mês",
                    ),
                ),
                (
                    "year",
                    models.PositiveIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(2000),
                            django.core.validators.MaxValueValidator(2100),
                        ],
                        verbose_name="Ano",
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
                    "member",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="budgets",
                        to="members.member",
                        verbose_name="Membro",
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
                "verbose_name": "Orçamento",
                "verbose_name_plural": "Orçamentos",
                "ordering": ["year", "month", "category"],
            },
        ),
        migrations.AddIndex(
            model_name="budget",
            index=models.Index(
                fields=["month", "year"], name="budgets_bud_month_year_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="budget",
            index=models.Index(
                fields=["category", "month", "year"],
                name="budgets_bud_cat_month_year_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="budget",
            constraint=models.UniqueConstraint(
                fields=["category", "month", "year", "member"],
                name="unique_budget_category_month_year_member",
            ),
        ),
    ]
