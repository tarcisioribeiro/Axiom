import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('library', '0013_book_file_upload_to_per_book_folder'),
    ]

    operations = [
        # Book: remove global unique on title
        migrations.AlterField(
            model_name='book',
            name='title',
            field=models.CharField(max_length=200, verbose_name='Título'),
        ),
        # Book: add ISBN
        migrations.AddField(
            model_name='book',
            name='isbn',
            field=models.CharField(blank=True, max_length=13, null=True, verbose_name='ISBN'),
        ),
        # Book: add series_name
        migrations.AddField(
            model_name='book',
            name='series_name',
            field=models.CharField(blank=True, max_length=200, null=True, verbose_name='Série'),
        ),
        # Book: add series_order
        migrations.AddField(
            model_name='book',
            name='series_order',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Volume da Série'),
        ),
        # Book: unique_together (title, owner)
        migrations.AlterUniqueTogether(
            name='book',
            unique_together={('title', 'owner')},
        ),
        # ReadingGoal: add pages_goal
        migrations.AddField(
            model_name='readinggoal',
            name='pages_goal',
            field=models.PositiveIntegerField(blank=True, default=0, verbose_name='Meta de Páginas'),
        ),
        # Summary: remove unique on title, change default
        migrations.AlterField(
            model_name='summary',
            name='title',
            field=models.CharField(default='Resumo', max_length=200, verbose_name='Título'),
        ),
        # Summary: change book from OneToOneField to ForeignKey
        migrations.AlterField(
            model_name='summary',
            name='book',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='summaries',
                to='library.book',
                verbose_name='Livro',
            ),
        ),
        # Summary: unique_together (title, book, owner)
        migrations.AlterUniqueTogether(
            name='summary',
            unique_together={('title', 'book', 'owner')},
        ),
    ]
