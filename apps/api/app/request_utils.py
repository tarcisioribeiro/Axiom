from typing import Any

from rest_framework.request import Request


def request_data(request: Request) -> dict[str, Any]:
    """DRF types Request.data as dict[str, Any] | list[Any] since a JSON body
    can legally be a top-level array. Every call site here expects an object
    body, so a non-dict payload is treated as empty rather than raising."""
    data = request.data
    return data if isinstance(data, dict) else {}
