from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from app.models import BaseModel

# ============================================================================
# CHOICE CONSTANTS
# ============================================================================

TASK_CATEGORY_CHOICES = (
    ("health", "Saúde"),
    ("intellect", "Intelecto"),
    ("spiritual", "Espiritual"),
    ("exercise", "Exercício Físico"),
    ("nutrition", "Nutrição"),
    ("work", "Trabalho"),
    ("social", "Social"),
    ("finance", "Finanças"),
    ("household", "Casa"),
    ("personal_care", "Cuidado Pessoal"),
    ("other", "Outros"),
)

PERIODICITY_CHOICES = (
    ("daily", "Diária"),
    ("weekdays", "Dias Úteis"),
    ("weekly", "Semanal"),
    ("monthly", "Mensal"),
    ("custom", "Personalizado"),
)

# Dias da semana para tarefas semanais
WEEKDAY_CHOICES = (
    (0, "Segunda-feira"),
    (1, "Terça-feira"),
    (2, "Quarta-feira"),
    (3, "Quinta-feira"),
    (4, "Sexta-feira"),
    (5, "Sábado"),
    (6, "Domingo"),
)

GOAL_TYPE_CHOICES = (
    ("consecutive_days", "Dias Consecutivos"),
    ("total_days", "Total de Dias"),
    ("avoid_habit", "Evitar Hábito"),
    ("custom", "Personalizado"),
)

PRIORITY_CHOICES = (
    ("low", "Baixa"),
    ("medium", "Média"),
    ("high", "Alta"),
    ("critical", "Crítica"),
)

UNIT_CHOICES = (
    ("vez", "vez"),
    ("minuto", "minuto"),
    ("hora", "hora"),
    ("ml", "ml"),
    ("copo", "copo"),
    ("litro", "litro"),
    ("página", "página"),
    ("km", "km"),
    ("metro", "metro"),
    ("passo", "passo"),
    ("repetição", "repetição"),
    ("série", "série"),
    ("capítulo", "capítulo"),
    ("exercício", "exercício"),
    ("dose", "dose"),
    ("comprimido", "comprimido"),
)

GOAL_STATUS_CHOICES = (
    ("active", "Ativo"),
    ("completed", "Concluído"),
    ("failed", "Falhou"),
    ("cancelled", "Cancelado"),
)

MOOD_CHOICES = (
    ("excellent", "Excelente"),
    ("good", "Bom"),
    ("neutral", "Neutro"),
    ("bad", "Ruim"),
    ("terrible", "Péssimo"),
)


# ============================================================================
# ROUTINE TASK MODEL
# ============================================================================


class RoutineTask(BaseModel):
    """
    Modelo para tarefas rotineiras que devem ser cumpridas periodicamente.

    Exemplos: Meditar, Ir a academia, Beber 8 copos de agua, Ler 30 minutos
    """

    name = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Nome da Tarefa"
    )
    description = models.TextField(
        null=True, blank=True, verbose_name="Descricao"
    )
    category = models.CharField(
        max_length=50,
        choices=TASK_CATEGORY_CHOICES,
        null=False,
        blank=False,
        verbose_name="Categoria",
    )
    icon = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="Ícone",
        help_text="Nome do ícone do Lucide (ex: Heart, BookOpen, Dumbbell)",
    )
    periodicity = models.CharField(
        max_length=20,
        choices=PERIODICITY_CHOICES,
        default="daily",
        verbose_name="Periodicidade",
    )
    # Para tarefas semanais: especificar dia da semana
    weekday = models.IntegerField(
        choices=WEEKDAY_CHOICES,
        null=True,
        blank=True,
        verbose_name="Dia da Semana",
        help_text="Apenas para tarefas semanais (0=Segunda, 6=Domingo)",
    )
    # Para tarefas mensais: especificar dia do mes
    day_of_month = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Dia do Mes",
        help_text="Apenas para tarefas mensais (1-31)",
    )
    # Para periodicidade personalizada
    custom_weekdays = models.JSONField(
        null=True,
        blank=True,
        default=None,
        verbose_name="Dias da Semana Personalizados",
        help_text=(
            "Array de dias da semana [0-6]" " para periodicidade personalizada"
        ),
    )
    custom_month_days = models.JSONField(
        null=True,
        blank=True,
        default=None,
        verbose_name="Dias do Mês Personalizados",
        help_text=(
            "Array de dias do mês [1-31]" " para periodicidade personalizada"
        ),
    )
    times_per_week = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Vezes por Semana",
        help_text=(
            "Quantas vezes por semana" " (para periodicidade personalizada)"
        ),
    )
    times_per_month = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Vezes por Mês",
        help_text="Quantas vezes por mês (para periodicidade personalizada)",
    )
    interval_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Intervalo em Dias",
        help_text="A cada X dias (para periodicidade personalizada)",
    )
    interval_start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Data de Início do Intervalo",
        help_text="Data de referência para calcular intervalos",
    )
    is_active = models.BooleanField(default=True, verbose_name="Tarefa Ativa")
    target_quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Quantidade Alvo",
        help_text="Ex: 8 copos de agua, 30 minutos de leitura",
    )
    unit = models.CharField(
        max_length=50,
        choices=UNIT_CHOICES,
        default="vez",
        verbose_name="Unidade",
    )
    # Campos de agendamento de horário
    default_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Horário Padrão",
        help_text="Horário padrão para esta tarefa",
    )
    closing_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Horário de Encerramento",
        help_text=(
            "Horário de encerramento (apenas para tarefas"
            " com uma ocorrência por dia)"
        ),
    )
    daily_occurrences = models.PositiveIntegerField(
        default=1,
        verbose_name="Ocorrências por Dia",
        help_text="Quantas vezes a tarefa deve ser feita por dia",
    )
    interval_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Intervalo entre Repetições (horas)",
        help_text="Intervalo em horas entre cada ocorrência intradiária",
    )
    scheduled_times = models.JSONField(
        null=True,
        blank=True,
        default=None,
        verbose_name="Horários Programados",
        help_text='Lista de horários específicos ["08:00", "14:00", "20:00"]',
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="medium",
        verbose_name="Prioridade",
    )
    allowed_skips_per_month = models.PositiveIntegerField(
        default=0,
        verbose_name="Faltas Permitidas por Mês",
        help_text=(
            "Quantas faltas por mes sem quebrar o streak"
            " (0 = sem tolerancia)"
        ),
    )
    linked_financial_goal = models.ForeignKey(
        "vaults.FinancialGoal",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linked_routine_tasks",
        verbose_name="Meta Financeira Vinculada",
        help_text=(
            "Meta financeira que este hábito alimenta"
            " (ex: depósito mensal → meta de viagem)"
        ),
    )
    linked_book = models.ForeignKey(
        "library.Book",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linked_routine_tasks",
        verbose_name="Livro Vinculado",
        help_text="Livro em andamento vinculado a esta rotina de leitura",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="routine_tasks",
        verbose_name="Proprietario",
    )

    class Meta:
        verbose_name = "Tarefa Rotineira"
        verbose_name_plural = "Tarefas Rotineiras"
        ordering = ["default_time", "category", "name"]
        indexes = [
            models.Index(fields=["owner", "is_active"]),
            models.Index(fields=["periodicity", "is_active"]),
        ]

    def clean(self):
        """Valida que campos de periodicidade estao corretos."""
        super().clean()

        if self.periodicity == "weekly" and self.weekday is None:
            raise ValidationError(
                {
                    "weekday": (
                        "Dia da semana e obrigatorio" " para tarefas semanais"
                    )
                }
            )

        if self.periodicity == "monthly":
            if self.day_of_month is None:
                raise ValidationError(
                    {
                        "day_of_month": (
                            "Dia do mes e obrigatorio" " para tarefas mensais"
                        )
                    }
                )
            if self.day_of_month < 1 or self.day_of_month > 31:
                raise ValidationError(
                    {"day_of_month": "Dia do mes deve estar entre 1 e 31"}
                )

        # Validação para periodicidade personalizada
        if self.periodicity == "custom":
            has_weekdays = (
                self.custom_weekdays and len(self.custom_weekdays) > 0
            )
            has_month_days = (
                self.custom_month_days and len(self.custom_month_days) > 0
            )
            has_frequency = any(
                [self.times_per_week, self.times_per_month, self.interval_days]
            )

            if not (has_weekdays or has_month_days or has_frequency):
                raise ValidationError(
                    {
                        "periodicity": (
                            "Periodicidade personalizada requer:"
                            " dias da semana OU dias do mes OU frequencia"
                        )
                    }
                )

            # Validar valores dos dias da semana
            if self.custom_weekdays:
                if not all(
                    isinstance(d, int) and 0 <= d <= 6
                    for d in self.custom_weekdays
                ):
                    raise ValidationError(
                        {
                            "custom_weekdays": (
                                "Dias da semana devem estar entre"
                                " 0 (Segunda) e 6 (Domingo)"
                            )
                        }
                    )

            # Validar valores dos dias do mês
            if self.custom_month_days:
                if not all(
                    isinstance(d, int) and 1 <= d <= 31
                    for d in self.custom_month_days
                ):
                    raise ValidationError(
                        {
                            "custom_month_days": (
                                "Dias do mes devem estar" " entre 1 e 31"
                            )
                        }
                    )

            # Validar intervalo de dias
            if self.interval_days and not self.interval_start_date:
                raise ValidationError(
                    {
                        "interval_start_date": (
                            "Data de inicio e obrigatoria quando"
                            " intervalo de dias esta definido"
                        )
                    }
                )

        # Validação de campos de agendamento de horário
        if self.closing_time and (self.daily_occurrences or 1) > 1:
            raise ValidationError(
                {
                    "closing_time": (
                        "Horário de encerramento só é permitido para tarefas"
                        " com uma ocorrência por dia"
                    )
                }
            )

        if self.interval_hours and not self.default_time:
            raise ValidationError(
                {
                    "default_time": (
                        "Horário padrão é obrigatório quando"
                        " intervalo de horas está definido"
                    )
                }
            )

        if self.scheduled_times:
            import re

            time_pattern = re.compile(r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
            if not isinstance(self.scheduled_times, list):
                raise ValidationError(
                    {
                        "scheduled_times": (
                            "Horários programados devem" " ser uma lista"
                        )
                    }
                )
            for t in self.scheduled_times:
                if not isinstance(t, str) or not time_pattern.match(t):
                    raise ValidationError(
                        {
                            "scheduled_times": (
                                f"Horário inválido: {t}. Use formato HH:MM"
                            )
                        }
                    )

    def __str__(self):
        return f"{self.name} ({self.get_periodicity_display()})"

    def should_appear_on_date(self, date):
        """
        Verifica se esta tarefa deve aparecer em uma determinada data.

        Parameters
        ----------
        date : datetime.date
            Data a verificar

        Returns
        -------
        bool
            True se a tarefa deve aparecer nesta data
        """
        if not self.is_active:
            return False

        if self.periodicity == "daily":
            return True

        # Dias úteis (Segunda a Sexta)
        if self.periodicity == "weekdays":
            return date.weekday() in [0, 1, 2, 3, 4]

        if self.periodicity == "weekly":
            return date.weekday() == self.weekday

        if self.periodicity == "monthly":
            return date.day == self.day_of_month

        # Periodicidade personalizada
        if self.periodicity == "custom":
            # Verificar dias da semana específicos
            if self.custom_weekdays:
                if date.weekday() not in self.custom_weekdays:
                    return False

            # Verificar dias do mês específicos
            if self.custom_month_days:
                if date.day not in self.custom_month_days:
                    return False

            # Verificar intervalo (a cada X dias)
            if self.interval_days and self.interval_start_date:
                delta = (date - self.interval_start_date).days
                if delta < 0 or delta % self.interval_days != 0:
                    return False

            # NOTA: times_per_week e times_per_month requerem lógica adicional
            # (verificar quantas vezes já foi marcada na semana/mês atual)
            # Por simplicidade, se apenas frequency estiver definida,
            # sempre retorna True
            # A validação de frequência será feita no frontend/backend
            # ao criar registros

            return True

        return False


# ============================================================================
# GOAL MODEL
# ============================================================================


class Goal(BaseModel):
    """
    Modelo para rastreamento de objetivos pessoais.

    Exemplos:
    - 15 dias sem alcool
    - 30 dias consecutivos de academia
    - Meditar 100 dias no total
    """

    title = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        verbose_name="Titulo do Objetivo",
    )
    description = models.TextField(
        null=True, blank=True, verbose_name="Descricao"
    )
    goal_type = models.CharField(
        max_length=30,
        choices=GOAL_TYPE_CHOICES,
        null=False,
        blank=False,
        verbose_name="Tipo de Objetivo",
    )
    related_task = models.ForeignKey(
        RoutineTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goals",
        verbose_name="Tarefa Relacionada",
        help_text="Opcional: vincular objetivo a uma tarefa rotineira",
    )
    target_value = models.PositiveIntegerField(
        null=False,
        blank=False,
        verbose_name="Meta",
        help_text="Ex: 15 dias, 100 vezes, etc",
    )
    current_value = models.PositiveIntegerField(
        default=0, verbose_name="Valor Atual"
    )
    start_date = models.DateField(
        null=False,
        blank=False,
        default=timezone.now,
        verbose_name="Data de Inicio",
    )
    end_date = models.DateField(
        null=True, blank=True, verbose_name="Data de Conclusao"
    )
    status = models.CharField(
        max_length=20,
        choices=GOAL_STATUS_CHOICES,
        default="active",
        verbose_name="Status",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="goals",
        verbose_name="Proprietario",
    )

    class Meta:
        verbose_name = "Objetivo"
        verbose_name_plural = "Objetivos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    @property
    def calculated_current_value(self):
        """
        Calcula o valor atual do progresso automaticamente baseado no tipo de
        objetivo
        e nas tarefas relacionadas completadas.
        """
        from datetime import timedelta

        today = timezone.now().date()

        # Para objetivos do tipo consecutive_days
        if self.goal_type == "consecutive_days":
            if self.related_task:
                consecutive_days = 0
                check_date = today

                while check_date >= self.start_date:
                    should_appear = self.related_task.should_appear_on_date(
                        check_date
                    )
                    if should_appear:
                        completed_instance = TaskInstance.objects.filter(
                            template=self.related_task,
                            scheduled_date=check_date,
                            status="completed",
                            owner=self.owner,
                            deleted_at__isnull=True,
                        ).exists()
                        if completed_instance:
                            consecutive_days += 1
                        else:
                            break
                    check_date -= timedelta(days=1)

                return consecutive_days
            else:
                return self.days_active

        # Para objetivos do tipo avoid_habit (evitar um hábito)
        # Conta dias consecutivos desde start_date em que a tarefa NÃO foi
        # completada
        if self.goal_type == "avoid_habit":
            if self.related_task:
                consecutive_days = 0
                check_date = today

                while check_date >= self.start_date:
                    should_appear = self.related_task.should_appear_on_date(
                        check_date
                    )
                    if should_appear:
                        completed_instance = TaskInstance.objects.filter(
                            template=self.related_task,
                            scheduled_date=check_date,
                            status="completed",
                            owner=self.owner,
                            deleted_at__isnull=True,
                        ).exists()
                        if completed_instance:
                            # Hábito foi praticado — sequência quebrada
                            break
                        else:
                            consecutive_days += 1
                    else:
                        # Dia sem agenda: conta como dia limpo
                        consecutive_days += 1
                    check_date -= timedelta(days=1)

                return consecutive_days
            else:
                return self.days_active

        # Para objetivos do tipo total_days
        elif self.goal_type == "total_days":
            if self.related_task:
                # Contar total de dias que a tarefa foi completada
                return (
                    TaskInstance.objects.filter(
                        template=self.related_task,
                        scheduled_date__gte=self.start_date,
                        status="completed",
                        owner=self.owner,
                        deleted_at__isnull=True,
                    )
                    .values("scheduled_date")
                    .distinct()
                    .count()
                )
            else:
                return self.days_active

        # Para outros tipos, usar o valor armazenado
        return self.current_value

    @property
    def progress_percentage(self):
        """Calcula percentual de progresso do objetivo."""
        if self.target_value == 0:
            return 0.0
        if self.goal_type in ("consecutive_days", "avoid_habit", "total_days"):
            return min(
                (self.calculated_current_value / self.target_value) * 100,
                100.0,
            )
        return min((self.current_value / self.target_value) * 100, 100.0)

    @property
    def days_active(self):
        """Calcula quantos dias o objetivo esta ativo."""
        if self.end_date:
            return max(0, (self.end_date - self.start_date).days)
        return max(0, (timezone.now().date() - self.start_date).days)

    def __str__(self):
        return f"{self.title} ({self.current_value}/{self.target_value})"


# ============================================================================
# DAILY REFLECTION MODEL
# ============================================================================


class DailyReflection(BaseModel):
    """
    Modelo para anotacoes/reflexoes diarias (post-it do dia).
    """

    date = models.DateField(null=False, blank=False, verbose_name="Data")
    reflection = models.TextField(
        null=False, blank=False, verbose_name="Reflexao do Dia"
    )
    mood = models.CharField(
        max_length=20,
        choices=MOOD_CHOICES,
        null=True,
        blank=True,
        verbose_name="Humor do Dia",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="daily_reflections",
        verbose_name="Proprietario",
    )

    class Meta:
        verbose_name = "Reflexao Diaria"
        verbose_name_plural = "Reflexoes Diarias"
        ordering = ["-date"]
        unique_together = [["date", "owner"]]
        indexes = [models.Index(fields=["owner", "-date"])]

    def __str__(self):
        return f"Reflexao de {self.date}"


# ============================================================================
# TASK INSTANCE MODEL
# ============================================================================

INSTANCE_STATUS_CHOICES = (
    ("pending", "Pendente"),
    ("in_progress", "Em Andamento"),
    ("completed", "Concluída"),
    ("skipped", "Pulada"),
    ("cancelled", "Cancelada"),
)


class TaskInstance(BaseModel):
    """
    Representa uma ocorrência específica de uma tarefa em um dia/horário.

    Pode ser gerada a partir de um template (RoutineTask) ou criada
    como tarefa avulsa (one-off task).

    Cada instância é independente e mantém seu próprio estado,
    preservando o histórico mesmo que o template seja alterado.
    """

    # Link ao template (nullable para tarefas avulsas)
    template = models.ForeignKey(
        RoutineTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instances",
        verbose_name="Tarefa Modelo",
    )

    # Snapshot dos dados do template no momento da geração
    task_name = models.CharField(max_length=200, verbose_name="Nome da Tarefa")
    task_description = models.TextField(
        null=True, blank=True, verbose_name="Descrição"
    )
    category = models.CharField(
        max_length=50, choices=TASK_CATEGORY_CHOICES, verbose_name="Categoria"
    )
    icon = models.CharField(
        max_length=50, null=True, blank=True, verbose_name="Ícone"
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="medium",
        verbose_name="Prioridade",
    )

    # Agendamento
    scheduled_date = models.DateField(verbose_name="Data Programada")
    scheduled_time = models.TimeField(
        null=True, blank=True, verbose_name="Horário Programado"
    )
    occurrence_index = models.PositiveIntegerField(
        default=0,
        verbose_name="Índice da Ocorrência",
        help_text="Para tarefas com múltiplas ocorrências no dia (0-based)",
    )

    # Status (Kanban)
    status = models.CharField(
        max_length=20,
        choices=INSTANCE_STATUS_CHOICES,
        default="pending",
        verbose_name="Status",
    )

    # Progresso
    target_quantity = models.PositiveIntegerField(
        default=1, verbose_name="Quantidade Alvo"
    )
    quantity_completed = models.PositiveIntegerField(
        default=0, verbose_name="Quantidade Realizada"
    )
    unit = models.CharField(
        max_length=50, default="vez", verbose_name="Unidade"
    )

    # Metadados de conclusão
    notes = models.TextField(null=True, blank=True, verbose_name="Observações")
    started_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Iniciada em"
    )
    completed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Concluída em"
    )

    # Proprietário
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="task_instances",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Instância de Tarefa"
        verbose_name_plural = "Instâncias de Tarefas"
        ordering = ["scheduled_date", "scheduled_time", "occurrence_index"]
        # Permite múltiplas instâncias por template+data, diferenciadas pelo
        # índice
        unique_together = [
            ["template", "scheduled_date", "occurrence_index", "owner"]
        ]
        indexes = [
            models.Index(fields=["owner", "scheduled_date"]),
            models.Index(fields=["template", "scheduled_date"]),
            models.Index(fields=["status", "scheduled_date"]),
            models.Index(fields=["scheduled_date", "scheduled_time"]),
        ]

    def save(self, *args, **kwargs):
        """
        Atualiza timestamps automaticamente baseado no status.
        """
        if self.status == "in_progress" and not self.started_at:
            self.started_at = timezone.now()
        elif self.status == "completed" and not self.completed_at:
            self.completed_at = timezone.now()
            self.quantity_completed = self.target_quantity
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        """Verifica se a tarefa está atrasada."""
        if self.status in ("completed", "skipped", "cancelled"):
            return False
        today = timezone.now().date()
        if self.scheduled_date < today:
            return True
        if self.scheduled_date == today and self.scheduled_time:
            return timezone.now().time() > self.scheduled_time
        return False

    @property
    def time_display(self):
        """Retorna o horário formatado ou None."""
        if self.scheduled_time:
            return self.scheduled_time.strftime("%H:%M")
        return None

    def __str__(self):
        time_str = f" às {self.time_display}" if self.scheduled_time else ""
        return (
            f"{self.task_name} ({self.scheduled_date}{time_str})"
            f" - {self.get_status_display()}"
        )


# ============================================================================
# GAMIFICATION MODELS
# ============================================================================

BADGE_CATEGORY_CHOICES = (
    ("streak", "Sequência"),
    ("completion", "Conclusão"),
    ("goal", "Meta"),
    ("milestone", "Marco"),
    ("special", "Especial"),
)

XP_EVENT_CHOICES = (
    ("task_completed", "Tarefa concluída"),
    ("goal_completed", "Objetivo concluído"),
    ("streak_7", "Sequência de 7 dias"),
    ("streak_30", "Sequência de 30 dias"),
    ("streak_100", "Sequência de 100 dias"),
    ("badge_earned", "Badge conquistado"),
    ("daily_reflection", "Reflexão diária"),
)


class GamificationProfile(BaseModel):
    """Perfil de gamificação de um membro —
    XP acumulado, nível e streak atual."""

    member = models.OneToOneField(
        "members.Member",
        on_delete=models.CASCADE,
        related_name="gamification_profile",
        verbose_name="Membro",
    )
    total_xp = models.PositiveIntegerField(default=0, verbose_name="XP Total")
    current_level = models.PositiveSmallIntegerField(
        default=1, verbose_name="Nível"
    )
    current_streak = models.PositiveIntegerField(
        default=0, verbose_name="Sequência atual (dias)"
    )
    longest_streak = models.PositiveIntegerField(
        default=0, verbose_name="Maior sequência (dias)"
    )
    last_activity_date = models.DateField(
        null=True, blank=True, verbose_name="Última atividade"
    )
    tasks_completed_total = models.PositiveIntegerField(
        default=0, verbose_name="Total de tarefas concluídas"
    )

    class Meta:
        verbose_name = "Perfil de Gamificação"
        verbose_name_plural = "Perfis de Gamificação"

    def __str__(self):
        return (
            f"{self.member} — Nível {self.current_level} ({self.total_xp} XP)"
        )

    @staticmethod
    def xp_for_level(level: int) -> int:
        """XP necessário para atingir o nível informado (curva quadrática)."""
        return 100 * (level**2)

    def add_xp(
        self, amount: int, event: str, description: str = ""
    ) -> "XPTransaction":
        self.total_xp += amount
        new_level = self._calculate_level()
        leveled_up = new_level > self.current_level
        self.current_level = new_level
        self.save(update_fields=["total_xp", "current_level", "updated_at"])
        tx = XPTransaction.objects.create(
            profile=self,
            amount=amount,
            event=event,
            description=description,
            total_after=self.total_xp,
            created_by=self.created_by,
        )
        if leveled_up:
            self._award_level_badge(new_level)
        return tx

    def _calculate_level(self) -> int:
        level = 1
        while self.total_xp >= self.xp_for_level(level + 1):
            level += 1
        return level

    def _award_level_badge(self, level: int):
        slug = f"level_{level}"
        badge, _ = Badge.objects.get_or_create(
            slug=slug,
            defaults={
                "name": f"Nível {level}",
                "description": f"Atingiu o nível {level}",
                "category": "milestone",
                "icon": "🏆",
                "xp_reward": 0,
                "created_by": self.created_by,
            },
        )
        UserBadge.objects.get_or_create(
            profile=self,
            badge=badge,
            defaults={"created_by": self.created_by},
        )

    def update_streak(self, activity_date=None):
        from django.utils import timezone

        today = activity_date or timezone.now().date()
        if self.last_activity_date is None:
            self.current_streak = 1
        elif (today - self.last_activity_date).days == 1:
            self.current_streak += 1
        elif (today - self.last_activity_date).days == 0:
            return  # já registrado hoje
        else:
            self.current_streak = 1

        if self.current_streak > self.longest_streak:
            self.longest_streak = self.current_streak

        self.last_activity_date = today
        self.save(
            update_fields=[
                "current_streak",
                "longest_streak",
                "last_activity_date",
                "updated_at",
            ]
        )

        for days, slug, name, xp in [
            (7, "streak_7", "Semana Perfeita 🔥", 50),
            (30, "streak_30", "Mês Consistente 💪", 200),
            (100, "streak_100", "100 Dias! 🌟", 1000),
        ]:
            if self.current_streak == days:
                self.add_xp(xp, f"streak_{days}", f"Sequência de {days} dias!")
                badge, _ = Badge.objects.get_or_create(
                    slug=slug,
                    defaults={
                        "name": name,
                        "description": (
                            f"Completou {days} dias consecutivos de atividade"
                        ),
                        "category": "streak",
                        "icon": (
                            "🔥"
                            if days == 7
                            else ("💪" if days == 30 else "🌟")
                        ),
                        "xp_reward": xp,
                        "created_by": self.created_by,
                    },
                )
                UserBadge.objects.get_or_create(
                    profile=self,
                    badge=badge,
                    defaults={"created_by": self.created_by},
                )


class XPTransaction(BaseModel):
    """Log imutável de cada ganho/perda de XP."""

    profile = models.ForeignKey(
        GamificationProfile,
        on_delete=models.CASCADE,
        related_name="xp_transactions",
        verbose_name="Perfil",
    )
    amount = models.IntegerField(verbose_name="XP ganho/perdido")
    event = models.CharField(
        max_length=50, choices=XP_EVENT_CHOICES, verbose_name="Evento"
    )
    description = models.CharField(
        max_length=200, blank=True, verbose_name="Descrição"
    )
    total_after = models.PositiveIntegerField(verbose_name="XP total após")

    class Meta:
        verbose_name = "Transação de XP"
        verbose_name_plural = "Transações de XP"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["profile", "-created_at"])]

    def __str__(self):
        return f"+{self.amount} XP — {self.event}"


class Badge(BaseModel):
    """Definição de um badge conquistável."""

    slug = models.CharField(max_length=80, unique=True, verbose_name="Slug")
    name = models.CharField(max_length=100, verbose_name="Nome")
    description = models.CharField(max_length=300, verbose_name="Descrição")
    category = models.CharField(
        max_length=20, choices=BADGE_CATEGORY_CHOICES, verbose_name="Categoria"
    )
    icon = models.CharField(
        max_length=50, default="Medal", verbose_name="Ícone"
    )
    xp_reward = models.PositiveSmallIntegerField(
        default=0, verbose_name="XP bônus"
    )

    class Meta:
        verbose_name = "Badge"
        verbose_name_plural = "Badges"
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.icon} {self.name}"


class UserBadge(BaseModel):
    """Associação entre perfil e badge conquistado."""

    profile = models.ForeignKey(
        GamificationProfile,
        on_delete=models.CASCADE,
        related_name="user_badges",
        verbose_name="Perfil",
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name="user_badges",
        verbose_name="Badge",
    )
    earned_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Conquistado em"
    )

    class Meta:
        verbose_name = "Badge do Usuário"
        verbose_name_plural = "Badges dos Usuários"
        unique_together = [["profile", "badge"]]
        ordering = ["-earned_at"]

    def __str__(self):
        return f"{self.profile.member} — {self.badge.name}"


# ============================================================================
# MEASUREMENT UNIT CHOICES (treino + nutrição)
# ============================================================================

MEASUREMENT_UNIT_CHOICES = (
    # Massa
    ("g", "g"),
    ("kg", "kg"),
    ("mg", "mg"),
    ("lb", "lb"),
    ("oz", "oz"),
    # Volume
    ("ml", "ml"),
    ("l", "l"),
    ("dl", "dl"),
    ("cl", "cl"),
    # Culinário
    ("teaspoon", "colher de chá"),
    ("tablespoon", "colher de sopa"),
    ("dessert_spoon", "colher de sobremesa"),
    ("cup", "xícara"),
    ("glass", "copo"),
    ("slice", "fatia"),
    ("portion", "porção"),
    ("pinch", "pitada"),
    ("drizzle", "fio"),
    ("to_taste", "a gosto"),
    ("at_will", "à vontade"),
    # Contagem
    ("unit", "unidade"),
    ("piece", "peça"),
    ("segment", "gomo"),
    ("clove", "dente"),
    ("leaf", "folha"),
    ("sprig", "ramo"),
    ("handful", "punhado"),
    ("scoop", "scoop"),
    # Fitness
    ("rep", "repetição"),
    ("set", "série"),
    ("minute", "minuto"),
    ("second", "segundo"),
    ("hour", "hora"),
    ("km", "km"),
    ("m", "metro"),
    ("step", "passo"),
    # Saúde / Suplementos
    ("dose", "dose"),
    ("tablet", "comprimido"),
    ("capsule", "cápsula"),
    ("mcg", "mcg"),
    ("ui", "UI"),
)


# ============================================================================
# WORKOUT MODELS
# ============================================================================


class Exercise(BaseModel):
    """Catálogo de exercícios disponíveis para uso nos planos de treino."""

    name = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Nome"
    )
    muscle_groups = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Grupos Musculares",
        help_text="Ex: Peitoral / Tríceps",
    )
    description = models.TextField(
        null=True, blank=True, verbose_name="Descrição"
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="exercises_catalog",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Exercício"
        verbose_name_plural = "Exercícios"
        ordering = ["name"]
        indexes = [models.Index(fields=["owner", "name"])]

    def __str__(self):
        return self.name


class WorkoutPlan(BaseModel):
    """Plano de treino do usuário (pode ter múltiplas divisões)."""

    name = models.CharField(
        max_length=200, null=False, blank=False, verbose_name="Nome do Plano"
    )
    description = models.TextField(
        null=True, blank=True, verbose_name="Descrição"
    )
    is_active = models.BooleanField(default=True, verbose_name="Plano Ativo")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="workout_plans",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Plano de Treino"
        verbose_name_plural = "Planos de Treino"
        ordering = ["-is_active", "-created_at"]
        indexes = [models.Index(fields=["owner", "is_active"])]

    def __str__(self):
        return f"{self.name} ({'ativo' if self.is_active else 'inativo'})"


class WorkoutDay(BaseModel):
    """Divisão de treino dentro de um plano
    (ex: Treino A — Costas/Ombro/Bíceps)."""

    plan = models.ForeignKey(
        WorkoutPlan,
        on_delete=models.CASCADE,
        related_name="days",
        verbose_name="Plano de Treino",
    )
    name = models.CharField(
        max_length=100,
        null=False,
        blank=False,
        verbose_name="Nome da Divisão",
        help_text="Ex: Treino A",
    )
    muscle_groups = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Grupos Musculares",
        help_text="Ex: Costas / Ombro / Bíceps",
    )
    order = models.PositiveIntegerField(
        default=0,
        verbose_name="Ordem",
        help_text="Ordem de exibição dentro do plano",
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="workout_days",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Divisão de Treino"
        verbose_name_plural = "Divisões de Treino"
        ordering = ["plan", "order", "name"]
        indexes = [models.Index(fields=["plan", "order"])]

    def __str__(self):
        return f"{self.plan.name} — {self.name}"


LOAD_UNIT_CHOICES = [
    ("kg", "kg"),
    ("lb", "lb"),
    ("bw", "Peso corporal"),
]


class WorkoutExercise(BaseModel):
    """Exercício dentro de uma divisão de treino, vinculado ao catálogo."""

    workout_day = models.ForeignKey(
        WorkoutDay,
        on_delete=models.CASCADE,
        related_name="exercises",
        verbose_name="Divisão de Treino",
    )
    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="workout_exercises",
        verbose_name="Exercício do Catálogo",
    )
    name = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        verbose_name="Nome do Exercício",
        help_text="Preenchido automaticamente a partir do catálogo.",
    )
    sets = models.PositiveIntegerField(
        default=3, verbose_name="Séries", help_text="Número de séries"
    )
    reps_min = models.PositiveIntegerField(
        default=8, verbose_name="Repetições Mínimas"
    )
    reps_max = models.PositiveIntegerField(
        default=12, verbose_name="Repetições Máximas"
    )
    load = models.CharField(
        max_length=20, null=True, blank=True, verbose_name="Carga"
    )
    load_unit = models.CharField(
        max_length=10,
        choices=LOAD_UNIT_CHOICES,
        default="kg",
        verbose_name="Unidade de Carga",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordem")
    notes = models.TextField(null=True, blank=True, verbose_name="Observações")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="workout_exercises",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Exercício de Treino"
        verbose_name_plural = "Exercícios de Treino"
        ordering = ["workout_day", "order", "name"]
        indexes = [models.Index(fields=["workout_day", "order"])]

    def __str__(self):
        load_str = f" @ {self.load}{self.load_unit}" if self.load else ""
        return (
            f"{self.name} — {self.sets}x"
            f"{self.reps_min}-{self.reps_max}{load_str}"
        )


class WorkoutSession(BaseModel):
    """Sessão de treino executada (log de um dia de treino realizado)."""

    workout_day = models.ForeignKey(
        WorkoutDay,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sessions",
        verbose_name="Divisão de Treino",
        help_text="Divisão executada (opcional — permite sessão avulsa)",
    )
    date = models.DateField(
        null=False, blank=False, verbose_name="Data do Treino"
    )
    started_at = models.TimeField(
        null=True, blank=True, verbose_name="Hora de Início"
    )
    finished_at = models.TimeField(
        null=True, blank=True, verbose_name="Hora de Término"
    )
    notes = models.TextField(null=True, blank=True, verbose_name="Observações")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="workout_sessions",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Sessão de Treino"
        verbose_name_plural = "Sessões de Treino"
        ordering = ["-date", "-started_at"]
        indexes = [
            models.Index(fields=["owner", "-date"]),
            models.Index(fields=["workout_day", "-date"]),
        ]

    @property
    def duration_minutes(self):
        """Duração da sessão em minutos, se início e fim estão definidos."""
        if self.started_at and self.finished_at:
            from datetime import datetime

            start = datetime.combine(self.date, self.started_at)
            end = datetime.combine(self.date, self.finished_at)
            delta = end - start
            return max(0, int(delta.total_seconds() / 60))
        return None

    def __str__(self):
        label = self.workout_day.name if self.workout_day else "Avulso"
        return f"Sessão {label} — {self.date}"


class WorkoutSessionExercise(BaseModel):
    """Exercício executado dentro de uma sessão de treino."""

    session = models.ForeignKey(
        WorkoutSession,
        on_delete=models.CASCADE,
        related_name="session_exercises",
        verbose_name="Sessão de Treino",
    )
    exercise = models.ForeignKey(
        WorkoutExercise,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="session_exercises",
        verbose_name="Exercício do Plano",
        help_text=(
            "Referência ao exercício do plano"
            " (nullable para exercício avulso)"
        ),
    )
    exercise_name = models.CharField(
        max_length=200,
        verbose_name="Nome do Exercício",
        help_text=(
            "Snapshot do nome — preservado mesmo"
            " se o exercício for alterado"
        ),
    )
    sets_target = models.PositiveIntegerField(
        default=3, verbose_name="Séries Alvo"
    )
    reps_target_min = models.PositiveIntegerField(
        default=8, verbose_name="Repetições Alvo (mín.)"
    )
    reps_target_max = models.PositiveIntegerField(
        default=12, verbose_name="Repetições Alvo (máx.)"
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordem")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="session_exercises",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Exercício da Sessão"
        verbose_name_plural = "Exercícios da Sessão"
        ordering = ["session", "order"]
        indexes = [models.Index(fields=["session", "order"])]

    def __str__(self):
        return f"{self.exercise_name} — {self.session}"


class WorkoutSessionSet(BaseModel):
    """Série individual executada dentro de um exercício da sessão."""

    session_exercise = models.ForeignKey(
        WorkoutSessionExercise,
        on_delete=models.CASCADE,
        related_name="sets",
        verbose_name="Exercício da Sessão",
    )
    set_number = models.PositiveIntegerField(
        verbose_name="Número da Série", help_text="Ex: 1, 2, 3..."
    )
    load = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Carga",
        help_text=(
            "Peso utilizado (deixe em branco para"
            " exercícios com peso corporal)"
        ),
    )
    load_unit = models.CharField(
        max_length=20,
        choices=MEASUREMENT_UNIT_CHOICES,
        default="kg",
        verbose_name="Unidade da Carga",
    )
    reps_done = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Repetições Realizadas"
    )
    completed = models.BooleanField(
        default=True, verbose_name="Série Concluída"
    )
    notes = models.CharField(
        max_length=300, null=True, blank=True, verbose_name="Observações"
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="session_sets",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Série da Sessão"
        verbose_name_plural = "Séries da Sessão"
        ordering = ["session_exercise", "set_number"]
        unique_together = [["session_exercise", "set_number"]]
        indexes = [models.Index(fields=["session_exercise", "set_number"])]

    def __str__(self):
        load_str = f"{self.load}{self.load_unit}" if self.load else "s/carga"
        reps_str = f"×{self.reps_done}" if self.reps_done else ""
        return f"Série {self.set_number} — {load_str}{reps_str}"


# ============================================================================
# NUTRITION MODELS
# ============================================================================


class Food(BaseModel):
    """Alimento/ingrediente cadastrado pelo usuário."""

    name = models.CharField(
        max_length=200,
        null=False,
        blank=False,
        verbose_name="Nome do Alimento",
    )
    description = models.TextField(
        null=True, blank=True, verbose_name="Descrição"
    )
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="foods",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Alimento"
        verbose_name_plural = "Alimentos"
        ordering = ["name"]
        unique_together = [["name", "owner"]]
        indexes = [models.Index(fields=["owner", "name"])]

    def __str__(self):
        return self.name


class MealType(BaseModel):
    """Tipo de refeição definido pelo usuário (ex: Café da Manhã, Almoço)."""

    name = models.CharField(
        max_length=100,
        null=False,
        blank=False,
        verbose_name="Nome da Refeição",
    )
    suggested_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Horário Sugerido",
        help_text="Horário de referência para esta refeição",
    )
    order = models.PositiveIntegerField(
        default=0, verbose_name="Ordem", help_text="Ordem de exibição"
    )
    is_active = models.BooleanField(default=True, verbose_name="Ativa")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="meal_types",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Tipo de Refeição"
        verbose_name_plural = "Tipos de Refeição"
        ordering = ["order", "suggested_time", "name"]
        indexes = [models.Index(fields=["owner", "is_active"])]

    def __str__(self):
        time_str = (
            f" ({self.suggested_time.strftime('%H:%M')})"
            if self.suggested_time
            else ""
        )
        return f"{self.name}{time_str}"


class MenuOption(BaseModel):
    """Opção de cardápio dentro de um tipo de refeição
    (ex: Opção 1, Opção 2)."""

    meal_type = models.ForeignKey(
        MealType,
        on_delete=models.CASCADE,
        related_name="options",
        verbose_name="Tipo de Refeição",
    )
    name = models.CharField(
        max_length=100,
        null=False,
        blank=False,
        verbose_name="Nome da Opção",
        help_text="Ex: Opção 1",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordem")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="menu_options",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Opção de Cardápio"
        verbose_name_plural = "Opções de Cardápio"
        ordering = ["meal_type", "order", "name"]
        indexes = [models.Index(fields=["meal_type", "order"])]

    def __str__(self):
        return f"{self.meal_type.name} — {self.name}"


class MenuOptionIngredient(BaseModel):
    """Ingrediente dentro de uma opção de cardápio."""

    menu_option = models.ForeignKey(
        MenuOption,
        on_delete=models.CASCADE,
        related_name="ingredients",
        verbose_name="Opção de Cardápio",
    )
    food = models.ForeignKey(
        Food,
        on_delete=models.PROTECT,
        related_name="menu_ingredients",
        verbose_name="Alimento",
    )
    quantity = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Quantidade",
        help_text="Deixe em branco para quantidades do tipo 'a gosto'",
    )
    unit = models.CharField(
        max_length=20,
        choices=MEASUREMENT_UNIT_CHOICES,
        verbose_name="Unidade",
    )
    is_optional = models.BooleanField(
        default=False, verbose_name="Ingrediente Opcional"
    )
    notes = models.CharField(
        max_length=300,
        null=True,
        blank=True,
        verbose_name="Observações",
        help_text="Ex: tempero a gosto, orégano à vontade",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordem")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="menu_ingredients",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Ingrediente da Opção"
        verbose_name_plural = "Ingredientes da Opção"
        ordering = ["menu_option", "order"]
        indexes = [models.Index(fields=["menu_option", "order"])]

    def __str__(self):
        qty_str = (
            f"{self.quantity} {self.unit}" if self.quantity else self.unit
        )
        opt_str = " (opcional)" if self.is_optional else ""
        return f"{self.food.name} — {qty_str}{opt_str}"


class MealLog(BaseModel):
    """Registro de uma refeição realizada pelo usuário."""

    meal_type = models.ForeignKey(
        MealType,
        on_delete=models.PROTECT,
        related_name="logs",
        verbose_name="Tipo de Refeição",
    )
    menu_option = models.ForeignKey(
        MenuOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
        verbose_name="Opção de Cardápio Seguida",
        help_text="Qual opção foi seguida (nulo em caso de refeição livre)",
    )
    is_free_meal = models.BooleanField(
        default=False,
        verbose_name="Refeição Livre",
        help_text="Marque quando for a refeição livre permitida pelo plano",
    )
    date = models.DateField(null=False, blank=False, verbose_name="Data")
    time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Horário Real",
        help_text="Horário em que a refeição foi feita",
    )
    notes = models.TextField(null=True, blank=True, verbose_name="Observações")
    owner = models.ForeignKey(
        "members.Member",
        on_delete=models.PROTECT,
        related_name="meal_logs",
        verbose_name="Proprietário",
    )

    class Meta:
        verbose_name = "Registro de Refeição"
        verbose_name_plural = "Registros de Refeição"
        ordering = ["-date", "meal_type__order"]
        indexes = [
            models.Index(fields=["owner", "-date"]),
            models.Index(fields=["meal_type", "-date"]),
        ]

    def __str__(self):
        option_str = self.menu_option.name if self.menu_option else "Livre"
        return f"{self.meal_type.name} ({option_str}) — {self.date}"
