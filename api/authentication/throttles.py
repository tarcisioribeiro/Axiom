from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Stricter per-IP rate limit on the login endpoint to prevent attacks."""

    scope = "login"


class RegisterRateThrottle(AnonRateThrottle):
    """Per-IP rate limit on the registration endpoint to prevent spam account."""

    scope = "register"


class ShareTokenRateThrottle(AnonRateThrottle):
    """Strict per-IP rate limit on the public share-token redemption endpoint."""

    scope = "share_token"
