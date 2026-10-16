from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc: Exception, context: dict) -> Response | None:
    """DRF handler that also turns model-level ValidationError (raised by
    full_clean() in save()) into a 400 instead of a 500."""
    if isinstance(exc, DjangoValidationError):
        detail: Any = (
            exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        )
        exc = ValidationError(detail=detail)
    return exception_handler(exc, context)
