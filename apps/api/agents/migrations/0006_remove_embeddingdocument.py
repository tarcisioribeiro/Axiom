from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0005_agentembedding_hnsw_index"),
    ]

    operations = [
        migrations.DeleteModel(
            name="EmbeddingDocument",
        ),
    ]
