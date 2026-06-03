from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0025_fix_intellect_badge_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="skill",
            name="books",
            field=models.ManyToManyField(
                blank=True,
                related_name="related_skills",
                to="library.book",
                verbose_name="Livros relacionados",
            ),
        ),
        migrations.AddField(
            model_name="skill",
            name="courses",
            field=models.ManyToManyField(
                blank=True,
                related_name="related_skills",
                to="library.course",
                verbose_name="Cursos relacionados",
            ),
        ),
    ]
