from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bank_reconciliation", "0002_alter_bankstatemententry_match_confidence"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bankstatementimport",
            name="file_format",
            field=models.CharField(
                choices=[
                    ("ofx", "OFX"),
                    ("csv", "CSV"),
                    ("cnab240", "CNAB 240"),
                    ("cnab400", "CNAB 400"),
                ],
                max_length=20,
                verbose_name="Formato",
            ),
        ),
    ]
