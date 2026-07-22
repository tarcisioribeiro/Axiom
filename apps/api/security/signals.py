import logging

from django.db import transaction
from django.db.models.signals import pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(pre_save, sender="security.Password")
def save_password_history(sender, instance, **kwargs):
    """Salva a senha anterior em PasswordHistory antes de cada atualização."""
    if not instance.pk:
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    except Exception:
        return

    if not old._password or old._password == instance._password:
        return

    try:
        from security.models import PasswordHistory

        sid = transaction.savepoint()
        try:
            history = PasswordHistory(password=old)
            history._old_password = old._password
            history.changed_by = getattr(instance, "_changed_by", None)
            history.save()
            transaction.savepoint_commit(sid)
        except Exception:
            transaction.savepoint_rollback(sid)
            logger.exception("Falha ao registrar histórico de senha")
    except Exception:
        logger.exception(
            "Falha ao inicializar savepoint para histórico de senha"
        )
