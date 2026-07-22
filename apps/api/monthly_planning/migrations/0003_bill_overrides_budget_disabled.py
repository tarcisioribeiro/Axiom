from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monthly_planning", "0002_add_fixed_overrides"),
    ]

    operations = [
        migrations.AddField(
            model_name="monthlyplan",
            name="bill_overrides",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="monthlyplan",
            name="budget_disabled_categories",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
