# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transfers', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transfer',
            name='transfered',
            field=models.BooleanField(default=False, verbose_name='Transferido'),
        ),
    ]
