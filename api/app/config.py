import os


def cfg(key: str, default: str = "") -> str:
    """
    Resolve a config key: SystemConfig DB first, then env var, then default.

    Uses a lazy import to avoid circular dependencies at module load time.
    Safe to call at request time from any app.

    NOTE: ENCRYPTION_KEY must NOT use this function — reading it from
    SystemConfig would cause infinite recursion because SystemConfig secrets
    are decrypted with FieldEncryption, which needs ENCRYPTION_KEY itself.
    """
    try:
        from admin_panel.models import SystemConfig  # noqa: PLC0415

        obj = SystemConfig.objects.get(key=key)  # type: ignore[attr-defined]
        value: str | None = obj.get_value()
        if value:
            return value
    except Exception:
        pass
    return os.getenv(key, default)
