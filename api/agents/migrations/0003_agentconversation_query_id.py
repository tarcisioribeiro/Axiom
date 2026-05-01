from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0002_agentembedding"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentconversation",
            name="query_id",
            field=models.UUIDField(
                blank=True,
                db_index=True,
                null=True,
                verbose_name="ID da Consulta",
            ),
        ),
    ]
