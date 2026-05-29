import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("members", "0003_alter_member_deleted_by"),
        ("members", "0003_encrypt_document"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="member",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="member_deleted",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Excluído por",
            ),
        ),
        migrations.AlterField(
            model_name="member",
            name="document_hash",
            field=models.CharField(
                max_length=64,
                unique=True,
                verbose_name="Hash do Documento",
            ),
        ),
    ]
