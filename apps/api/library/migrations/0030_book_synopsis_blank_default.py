from django.db import migrations, models

OLD_DEFAULT = "Sem sinopse disponível."


def clear_placeholder_synopsis(apps, schema_editor):
    Book = apps.get_model("library", "Book")
    Book.objects.filter(synopsis=OLD_DEFAULT).update(synopsis="")


def restore_placeholder_synopsis(apps, schema_editor):
    Book = apps.get_model("library", "Book")
    Book.objects.filter(synopsis="").update(synopsis=OLD_DEFAULT)


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0029_alter_flashcard_created_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="book",
            name="synopsis",
            field=models.TextField(
                blank=True, default="", verbose_name="Sinopse"
            ),
        ),
        migrations.RunPython(
            clear_placeholder_synopsis, restore_placeholder_synopsis
        ),
    ]
