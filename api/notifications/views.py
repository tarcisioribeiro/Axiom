from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from app.permissions import GlobalDefaultPermission
from members.models import Member
from notifications.models import Notification, NotificationPreference
from notifications.serializers import (
    NotificationPreferenceSerializer,
    NotificationSerializer,
)


def _generate_notifications(member):
    """
    Gera notificações para o membro, consultando tarefas, payables, loans e
    bills.
    Usa get_or_create para evitar duplicatas (unique_together).
    Limpa notificações de itens já resolvidos.
    """
    today = timezone.now().date()
    soon = today + timedelta(days=3)

    # --- TaskInstance ---
    from personal_planning.models import TaskInstance

    # Tarefas do dia (pendentes/em andamento)
    today_tasks = TaskInstance.objects.filter(
        owner=member,
        scheduled_date=today,
        status__in=["pending", "in_progress"],
    )
    for task in today_tasks:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="task_today",
            content_type="task_instance",
            object_id=task.id,
            defaults={
                "title": f"Tarefa do dia: {task.task_name}",
                "message": task.task_description or "",
                "due_date": task.scheduled_date,
                "created_by": member.user,
            },
        )

    # Tarefas atrasadas
    overdue_tasks = TaskInstance.objects.filter(
        owner=member,
        scheduled_date__lt=today,
        status__in=["pending", "in_progress"],
    )
    for task in overdue_tasks:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="task_overdue",
            content_type="task_instance",
            object_id=task.id,
            defaults={
                "title": f"Tarefa atrasada: {task.task_name}",
                "message": (
                    f"Programada para"
                    f' {task.scheduled_date.strftime("%d/%m/%Y")}'
                ),
                "due_date": task.scheduled_date,
                "created_by": member.user,
            },
        )

    # Limpar notificações de tarefas resolvidas
    Notification.objects.filter(
        owner=member,
        content_type="task_instance",
    ).exclude(
        object_id__in=TaskInstance.objects.filter(
            owner=member,
            status__in=["pending", "in_progress"],
        ).values_list("id", flat=True)
    ).update(
        is_deleted=True, deleted_at=timezone.now()
    )

    # --- Payable ---
    from payables.models import Payable

    # Payables próximos do vencimento
    due_soon_payables = Payable.objects.filter(
        member=member,
        due_date__range=[today, soon],
        status="active",
    )
    for payable in due_soon_payables:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="payable_due_soon",
            content_type="payable",
            object_id=payable.id,
            defaults={
                "title": f"Vencimento próximo: {payable.description}",
                "message": f'Vence em {payable.due_date.strftime("%d/%m/%Y")}',
                "due_date": payable.due_date,
                "created_by": member.user,
            },
        )

    # Payables atrasados
    overdue_payables = Payable.objects.filter(
        member=member,
        due_date__lt=today,
        status__in=["active", "overdue"],
    )
    for payable in overdue_payables:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="payable_overdue",
            content_type="payable",
            object_id=payable.id,
            defaults={
                "title": f"Valor a pagar atrasado: {payable.description}",
                "message": (
                    "Venceu em " + payable.due_date.strftime("%d/%m/%Y")
                ),
                "due_date": payable.due_date,
                "created_by": member.user,
            },
        )

    # Limpar notificações de payables resolvidos
    Notification.objects.filter(
        owner=member,
        content_type="payable",
    ).exclude(
        object_id__in=Payable.objects.filter(
            member=member,
            status__in=["active", "overdue"],
        ).values_list("id", flat=True)
    ).update(is_deleted=True, deleted_at=timezone.now())

    # --- Loan ---
    from loans.models import Loan

    member_loans = Loan.objects.filter(
        Q(benefited=member) | Q(creditor=member),
    )

    # Loans próximos do vencimento
    due_soon_loans = member_loans.filter(
        due_date__range=[today, soon],
        status="active",
    )
    for loan in due_soon_loans:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="loan_due_soon",
            content_type="loan",
            object_id=loan.id,
            defaults={
                "title": (
                    "Empréstimo próximo do vencimento: " + loan.description
                ),
                "message": f'Vence em {loan.due_date.strftime("%d/%m/%Y")}',
                "due_date": loan.due_date,
                "created_by": member.user,
            },
        )

    # Loans atrasados
    overdue_loans = member_loans.filter(
        due_date__lt=today,
        status__in=["active", "overdue"],
    )
    for loan in overdue_loans:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="loan_overdue",
            content_type="loan",
            object_id=loan.id,
            defaults={
                "title": f"Empréstimo atrasado: {loan.description}",
                "message": f'Venceu em {loan.due_date.strftime("%d/%m/%Y")}',
                "due_date": loan.due_date,
                "created_by": member.user,
            },
        )

    # Limpar notificações de loans resolvidos
    active_loan_ids = Loan.objects.filter(
        Q(benefited=member) | Q(creditor=member),
        status__in=["active", "overdue"],
    ).values_list("id", flat=True)
    Notification.objects.filter(
        owner=member,
        content_type="loan",
    ).exclude(
        object_id__in=active_loan_ids
    ).update(is_deleted=True, deleted_at=timezone.now())

    # --- CreditCardBill ---
    from credit_cards.models import CreditCardBill

    member_bills = CreditCardBill.objects.filter(
        credit_card__owner=member,
    )

    # Bills próximas do vencimento
    due_soon_bills = member_bills.filter(
        due_date__range=[today, soon],
        status__in=["open", "closed"],
    )
    for bill in due_soon_bills:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="bill_due_soon",
            content_type="bill",
            object_id=bill.id,
            defaults={
                "title": (
                    "Fatura próxima do vencimento: " + bill.credit_card.name
                ),
                "message": f'Vence em {bill.due_date.strftime("%d/%m/%Y")}',
                "due_date": bill.due_date,
                "created_by": member.user,
            },
        )

    # Bills atrasadas
    overdue_bills = member_bills.filter(
        due_date__lt=today,
        status__in=["open", "closed"],
    )
    for bill in overdue_bills:
        Notification.objects.get_or_create(
            owner=member,
            notification_type="bill_overdue",
            content_type="bill",
            object_id=bill.id,
            defaults={
                "title": f"Fatura atrasada: {bill.credit_card.name}",
                "message": f'Venceu em {bill.due_date.strftime("%d/%m/%Y")}',
                "due_date": bill.due_date,
                "created_by": member.user,
            },
        )

    # Limpar notificações de bills resolvidas
    active_bill_ids = CreditCardBill.objects.filter(
        credit_card__owner=member,
        status__in=["open", "closed"],
    ).values_list("id", flat=True)
    Notification.objects.filter(
        owner=member,
        content_type="bill",
    ).exclude(
        object_id__in=active_bill_ids
    ).update(is_deleted=True, deleted_at=timezone.now())


class NotificationListView(generics.ListAPIView):
    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()

    def get_queryset(self):
        member = Member.objects.select_related("user").get(
            user=self.request.user
        )
        _generate_notifications(member)
        return Notification.objects.filter(
            owner=member,
        ).select_related("owner")


class NotificationUpdateView(generics.UpdateAPIView):
    permission_classes = (
        IsAuthenticated,
        GlobalDefaultPermission,
    )
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()
    http_method_names = ["patch"]

    def get_queryset(self):
        member = Member.objects.select_related("user").get(
            user=self.request.user
        )
        return Notification.objects.filter(
            owner=member,
        ).select_related("owner")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    member = Member.objects.get(user=request.user)
    count = Notification.objects.filter(
        owner=member,
        is_read=False,
    ).update(is_read=True)
    return Response({"marked_read": count}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_summary(request):
    member = Member.objects.get(user=request.user)
    unread_count = Notification.objects.filter(
        owner=member,
        is_read=False,
    ).count()
    return Response({"unread_count": unread_count}, status=status.HTTP_200_OK)


class NotificationPreferenceListCreateView(generics.ListCreateAPIView):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = NotificationPreferenceSerializer

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return NotificationPreference.objects.filter(
            owner=member,
            is_deleted=False,
        )

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        member = Member.objects.get(user=self.request.user)
        notification_type = serializer.validated_data.get("notification_type")
        if NotificationPreference.objects.filter(
            owner=member,
            notification_type=notification_type,
            is_deleted=False,
        ).exists():
            raise ValidationError(
                {"notification_type": "Preferência para este tipo já existe."}
            )
        serializer.save(owner=member, created_by=self.request.user)


class NotificationPreferenceRetrieveUpdateDestroyView(
    generics.RetrieveUpdateDestroyAPIView
):
    permission_classes = (IsAuthenticated, GlobalDefaultPermission)
    serializer_class = NotificationPreferenceSerializer
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        member = Member.objects.get(user=self.request.user)
        return NotificationPreference.objects.filter(
            owner=member,
            is_deleted=False,
        )

    def perform_destroy(self, instance):
        from django.utils import timezone as tz

        instance.is_deleted = True
        instance.deleted_at = tz.now()
        instance.deleted_by = self.request.user
        instance.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
