from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0022_add_current_cfi_to_reading"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="completion_certificate",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="courses/certificates/",
                verbose_name="Comprovante de conclusão",
            ),
        ),
    ]
