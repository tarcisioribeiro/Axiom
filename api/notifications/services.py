import logging

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from app.config import cfg
from notifications.models import Notification, NotificationPreference

logger = logging.getLogger("axiom")


def _get_channel(member, notification_type: str) -> str:
    """Returns the delivery channel for a given member + notification_type.

    Falls back to 'in_app' when no preference is configured.
    """
    try:
        pref = NotificationPreference.objects.get(
            owner=member,
            notification_type=notification_type,
            is_deleted=False,
        )
        return pref.channel
    except NotificationPreference.DoesNotExist:
        return "in_app"


def _send_email_notification(notification: Notification) -> None:
    """
    Sends a single-notification email for the given Notification instance.
    """
    user = notification.owner.user
    recipient_email = user.email if user is not None else ""
    if not recipient_email:
        logger.warning(
            "Skipping email for notification %s: owner has no email address",
            notification.pk,
        )
        return

    context = {
        "notification": notification,
        "owner_name": notification.owner.name,
        "app_name": "Axiom",
        "site_url": cfg("SITE_URL"),
    }

    subject = notification.title
    html_body = render_to_string("email/notification_email.html", context)
    text_body = strip_tags(html_body)

    from_email = cfg("DEFAULT_FROM_EMAIL", "noreply@axiom.app")
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[recipient_email],
    )
    msg.attach_alternative(html_body, "text/html")

    try:
        msg.send(fail_silently=False)
        logger.info(
            "Email notification sent to %s for notification %s",
            recipient_email,
            notification.pk,
        )
    except Exception:
        logger.exception(
            "Failed to send email notification %s to %s",
            notification.pk,
            recipient_email,
        )


def dispatch_notification(notification: Notification) -> None:
    """Dispatches a notification according to the owner's channel preference.

    - 'in_app': no action (notification already exists in DB)
    - 'email': send email only
    - 'both': send email (in-app already exists in DB)
    """
    channel = _get_channel(notification.owner, notification.notification_type)
    if channel in ("email", "both"):
        _send_email_notification(notification)
