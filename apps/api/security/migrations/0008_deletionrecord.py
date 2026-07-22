import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security", "0007_credential_share_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="DeletionRecord",
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
                    "record_uuid",
                    models.UUIDField(verbose_name="UUID do Registro"),
                ),
                (
                    "model_name",
                    models.CharField(max_length=200, verbose_name="Modelo"),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="Excluído Em (Soft Delete)",
                        help_text="Timestamp do soft-delete original",
                    ),
                ),
                (
                    "purged_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        verbose_name="Removido Em (Hard Delete)",
                        help_text="Timestamp em que o registro foi permanentemente removido",
                    ),
                ),
            ],
            options={
                "verbose_name": "Certificado de Remoção",
                "verbose_name_plural": "Certificados de Remoção",
                "ordering": ["-purged_at"],
            },
        ),
        migrations.AddIndex(
            model_name="deletionrecord",
            index=models.Index(
                fields=["record_uuid"], name="security_de_record__idx"
            ),
        ),
        migrations.AddIndex(
            model_name="deletionrecord",
            index=models.Index(
                fields=["model_name", "purged_at"],
                name="security_de_model_n_idx",
            ),
        ),
    ]
