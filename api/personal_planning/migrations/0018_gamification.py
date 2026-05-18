import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("personal_planning", "0017_remove_goal_deadline"),
        ("members", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Badge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("slug", models.CharField(max_length=80, unique=True, verbose_name="Slug")),
                ("name", models.CharField(max_length=100, verbose_name="Nome")),
                ("description", models.CharField(max_length=300, verbose_name="Descrição")),
                ("category", models.CharField(choices=[("streak", "Sequência"), ("completion", "Conclusão"), ("goal", "Meta"), ("milestone", "Marco"), ("special", "Especial")], max_length=20, verbose_name="Categoria")),
                ("icon", models.CharField(default="🏅", max_length=10, verbose_name="Ícone (emoji)")),
                ("xp_reward", models.PositiveSmallIntegerField(default=0, verbose_name="XP bônus")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="badge_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="badge_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="badge_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Badge", "verbose_name_plural": "Badges", "ordering": ["category", "name"]},
        ),
        migrations.CreateModel(
            name="GamificationProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("total_xp", models.PositiveIntegerField(default=0, verbose_name="XP Total")),
                ("current_level", models.PositiveSmallIntegerField(default=1, verbose_name="Nível")),
                ("current_streak", models.PositiveIntegerField(default=0, verbose_name="Sequência atual (dias)")),
                ("longest_streak", models.PositiveIntegerField(default=0, verbose_name="Maior sequência (dias)")),
                ("last_activity_date", models.DateField(blank=True, null=True, verbose_name="Última atividade")),
                ("tasks_completed_total", models.PositiveIntegerField(default=0, verbose_name="Total de tarefas concluídas")),
                ("member", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="gamification_profile", to="members.member", verbose_name="Membro")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="gamificationprofile_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="gamificationprofile_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="gamificationprofile_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Perfil de Gamificação", "verbose_name_plural": "Perfis de Gamificação"},
        ),
        migrations.CreateModel(
            name="XPTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("amount", models.IntegerField(verbose_name="XP ganho/perdido")),
                ("event", models.CharField(choices=[("task_completed", "Tarefa concluída"), ("goal_completed", "Objetivo concluído"), ("streak_7", "Sequência de 7 dias"), ("streak_30", "Sequência de 30 dias"), ("streak_100", "Sequência de 100 dias"), ("badge_earned", "Badge conquistado"), ("daily_reflection", "Reflexão diária")], max_length=50, verbose_name="Evento")),
                ("description", models.CharField(blank=True, max_length=200, verbose_name="Descrição")),
                ("total_after", models.PositiveIntegerField(verbose_name="XP total após")),
                ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="xp_transactions", to="personal_planning.gamificationprofile", verbose_name="Perfil")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="xptransaction_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="xptransaction_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="xptransaction_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Transação de XP", "verbose_name_plural": "Transações de XP", "ordering": ["-created_at"], "indexes": [models.Index(fields=["profile", "-created_at"], name="pp_xptx_profile_idx")]},
        ),
        migrations.CreateModel(
            name="UserBadge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("uuid", models.UUIDField(default=None, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("earned_at", models.DateTimeField(auto_now_add=True, verbose_name="Conquistado em")),
                ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_badges", to="personal_planning.gamificationprofile", verbose_name="Perfil")),
                ("badge", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_badges", to="personal_planning.badge", verbose_name="Badge")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="userbadge_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="userbadge_updated", to=settings.AUTH_USER_MODEL)),
                ("deleted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="userbadge_deleted", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Badge do Usuário", "verbose_name_plural": "Badges dos Usuários", "ordering": ["-earned_at"], "unique_together": {("profile", "badge")}},
        ),
    ]
