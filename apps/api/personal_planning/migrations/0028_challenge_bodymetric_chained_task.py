import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0006_member_email_verification'),
        ('personal_planning', '0027_add_user_routine_template'),
    ]

    operations = [
        # chained_task FK on RoutineTask (habit stacking)
        migrations.AddField(
            model_name='routinetask',
            name='chained_task',
            field=models.ForeignKey(
                blank=True,
                help_text='Tarefa que será ativada automaticamente quando esta for concluída (habit stacking)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='triggered_by',
                to='personal_planning.routinetask',
                verbose_name='Tarefa Encadeada',
            ),
        ),
        # Challenge model
        migrations.CreateModel(
            name='Challenge',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('title', models.CharField(max_length=255, verbose_name='Título')),
                ('description', models.TextField(blank=True, verbose_name='Descrição')),
                ('duration_days', models.IntegerField(
                    choices=[(7, '7 dias'), (21, '21 dias'), (30, '30 dias'), (66, '66 dias'), (100, '100 dias')],
                    verbose_name='Duração (dias)',
                )),
                ('start_date', models.DateField(verbose_name='Data de Início')),
                ('end_date', models.DateField(verbose_name='Data de Término')),
                ('status', models.CharField(
                    choices=[('active', 'Ativo'), ('completed', 'Concluído'), ('failed', 'Falhado'), ('cancelled', 'Cancelado')],
                    default='active',
                    max_length=20,
                    verbose_name='Status',
                )),
                ('completion_rate', models.DecimalField(decimal_places=2, default=0, max_digits=5, verbose_name='Taxa de Conclusão (%)')),
                ('owner', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='challenges',
                    to='members.member',
                    verbose_name='Proprietário',
                )),
                ('template_task', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='challenges',
                    to='personal_planning.routinetask',
                    verbose_name='Tarefa de Referência',
                )),
            ],
            options={
                'verbose_name': 'Desafio',
                'verbose_name_plural': 'Desafios',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='challenge',
            index=models.Index(fields=['owner', 'status'], name='challenge_owner_status_idx'),
        ),
        migrations.AddIndex(
            model_name='challenge',
            index=models.Index(fields=['start_date', 'end_date'], name='challenge_dates_idx'),
        ),
        # BodyMetric model
        migrations.CreateModel(
            name='BodyMetric',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('measured_at', models.DateField(verbose_name='Data da Medição')),
                ('weight_kg', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='Peso (kg)')),
                ('waist_cm', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='Cintura (cm)')),
                ('arm_cm', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='Braço (cm)')),
                ('hip_cm', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='Quadril (cm)')),
                ('body_fat_pct', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, verbose_name='Gordura Corporal (%)')),
                ('notes', models.TextField(blank=True, verbose_name='Observações')),
                ('owner', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='body_metrics',
                    to='members.member',
                    verbose_name='Proprietário',
                )),
            ],
            options={
                'verbose_name': 'Métrica Corporal',
                'verbose_name_plural': 'Métricas Corporais',
                'ordering': ['-measured_at'],
            },
        ),
        migrations.AddIndex(
            model_name='bodymetric',
            index=models.Index(fields=['owner', '-measured_at'], name='bodymetric_owner_date_idx'),
        ),
    ]
