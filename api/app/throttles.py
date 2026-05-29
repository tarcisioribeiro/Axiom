from rest_framework.throttling import UserRateThrottle


class ExportRateThrottle(UserRateThrottle):
    """Lower per-user rate limit for export endpoints (CSV/PDF/Markdown).

    Export requests are CPU- and memory-intensive (full DB query + rendering),
    so they are restricted independently of the global user throttle.
    """

    scope = "export"


class AgentRateThrottle(UserRateThrottle):
    """Rate limit for LLM agent endpoints (/ask/, /stream/).

    Each request may trigger an expensive LLM call (latency + token cost),
    so we apply a conservative per-user limit independently of the global
    throttle.
    """

    scope = "agent"
