from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("members", "0002_add_deleted_by"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="member",
            name="document",
        ),
        migrations.AddField(
            model_name="member",
            name="_document",
            field=models.TextField(
                blank=True,
                null=True,
                verbose_name="Documento (Criptografado)",
            ),
        ),
        migrations.AddField(
            model_name="member",
            name="document_hash",
            field=models.CharField(
                default="",
                max_length=64,
                verbose_name="Hash do Documento",
            ),
            preserve_default=False,
        ),
    ]
