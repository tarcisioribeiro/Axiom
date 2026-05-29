from django.conf import settings
from django.http import HttpRequest


def get_client_ip(request: HttpRequest) -> str:
    """
    Return the real client IP address, accounting for trusted reverse proxies.

    Uses NUM_PROXIES (default 1) to determine how many XFF entries were added
    by trusted infrastructure. With N trusted proxies, the IP at xff[-N] is the
    real client — entries to the left are attacker-controlled and ignored.

    With NUM_PROXIES=0 (direct connections, no proxy), REMOTE_ADDR is used
    unconditionally.
    """
    num_proxies: int = getattr(settings, "NUM_PROXIES", 1)

    if num_proxies == 0:
        return str(request.META.get("REMOTE_ADDR", ""))

    x_forwarded_for: str = str(request.META.get("HTTP_X_FORWARDED_FOR", ""))
    if x_forwarded_for:
        ips = [ip.strip() for ip in x_forwarded_for.split(",")]
        # Take the IP that the Nth-from-right trusted proxy saw as its client.
        # If the chain is shorter than expected (misconfigured proxy or direct
        # connection), fall back to REMOTE_ADDR which is always socket-level.
        if len(ips) >= num_proxies:
            return ips[-num_proxies]

    return str(request.META.get("REMOTE_ADDR", ""))
