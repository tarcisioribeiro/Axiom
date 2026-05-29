import uuid
from datetime import timedelta
from typing import Any

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


@api_view(["GET"])
def current_date(request: Request) -> Response:
    """
    Returns the current date in the server's timezone (America/Sao_Paulo).
    This ensures frontend and backend use the same date reference.
    No authentication required - this is a public utility endpoint.
    """
    today = timezone.now().date()
    return Response({"date": today.isoformat()})


class PurgeDeletedSerializer(serializers.Serializer):
    days = serializers.IntegerField(
        default=90,
        min_value=1,
        help_text=(
            "Records soft-deleted more than this many days"
            " ago will be purged."
        ),
    )
    dry_run = serializers.BooleanField(
        default=False,
        help_text="When true, simulate the purge without making any changes.",
    )


class PurgeDeletedView(APIView):
    """
    POST /api/v1/admin/purge-deleted/

    Hard-delete soft-deleted sensitive/PII records older than N days
    for LGPD/GDPR compliance. Restricted to staff/admin users.

    Request body:
    {
        "days": 90,       // retention period in days (default 90)
        "dry_run": false  // when true, only reports what would be purged
    }

    Response:
    {
        "purged": {
            "members.Member": 2,
            "security.Password": 5
        },
        "total": 7,
        "dry_run": false,
        "cutoff_date": "2025-11-22"
    }
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request: Request) -> Response:
        serializer = PurgeDeletedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        days = serializer.validated_data["days"]
        dry_run = serializer.validated_data["dry_run"]
        cutoff = timezone.now() - timedelta(days=days)

        results = {}
        total = 0

        for label, model, anonymize_fn in self._get_sensitive_models():
            qs = model.all_objects.filter(
                is_deleted=True, deleted_at__lte=cutoff
            )
            count = qs.count()

            if not dry_run and count > 0:
                purged = 0
                for instance in qs.iterator():
                    try:
                        anonymize_fn(instance)
                        self._log_purge(instance, label, request.user)
                        instance.delete()
                        purged += 1
                    except Exception:
                        pass
                results[label] = purged
                total += purged
            else:
                results[label] = count
                total += count

        return Response(
            {
                "purged": results,
                "total": total,
                "dry_run": dry_run,
                "cutoff_date": cutoff.date().isoformat(),
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Sensitive model registry (mirrors management command)
    # ------------------------------------------------------------------

    def _get_sensitive_models(self) -> list[Any]:
        from accounts.models import Account
        from credit_cards.models import CreditCard
        from members.models import Member
        from security.models import (
            Archive,
            Password,
            StoredBankAccount,
            StoredCreditCard,
        )

        return [
            ("members.Member", Member, self._anonymize_member),
            ("accounts.Account", Account, self._anonymize_account),
            (
                "credit_cards.CreditCard",
                CreditCard,
                self._anonymize_credit_card,
            ),
            ("security.Password", Password, self._anonymize_password),
            (
                "security.StoredCreditCard",
                StoredCreditCard,
                self._anonymize_stored_card,
            ),
            (
                "security.StoredBankAccount",
                StoredBankAccount,
                self._anonymize_stored_bank_account,
            ),
            ("security.Archive", Archive, self._anonymize_archive),
        ]

    # ------------------------------------------------------------------
    # Anonymization functions
    # ------------------------------------------------------------------

    def _anonymize_member(self, instance: Any) -> None:
        instance.name = "[REMOVIDO]"
        instance.document = str(uuid.uuid4())
        instance.phone = "[REMOVIDO]"
        instance.email = None
        instance.address = None
        instance.birth_date = None
        instance.emergency_contact = None
        instance.occupation = None
        instance.notes = None

    def _anonymize_account(self, instance: Any) -> None:
        instance._account_number = None

    def _anonymize_credit_card(self, instance: Any) -> None:
        instance._card_number = None
        instance._security_code = None

    def _anonymize_password(self, instance: Any) -> None:
        instance._password = None

    def _anonymize_stored_card(self, instance: Any) -> None:
        instance._card_number = None
        instance._security_code = None

    def _anonymize_stored_bank_account(self, instance: Any) -> None:
        instance._account_number = None
        instance._password = None
        instance._digital_password = None

    def _anonymize_archive(self, instance: Any) -> None:
        instance._encrypted_text = None
        if instance.encrypted_file:
            try:
                instance.encrypted_file.delete(save=False)
            except Exception:
                pass

    def _log_purge(self, instance: Any, label: str, triggered_by: Any) -> None:
        try:
            from security.models import ActivityLog

            ActivityLog.log_action(
                user=triggered_by,
                action="purge",
                description=(
                    f"Registro {label} id={instance.pk}"
                    f" (uuid={instance.uuid}) "
                    "permanentemente removido por política"
                    " de retenção LGPD/GDPR."
                ),
                model_name=label,
                object_id=instance.pk,
                ip_address=None,
                user_agent="admin_api:purge_deleted_records",
                description_key="record.purge",
                description_params={
                    "label": label,
                    "id": instance.pk,
                    "uuid": str(instance.uuid),
                },
            )
        except Exception:
            pass
