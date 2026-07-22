from django.contrib import admin

from admin_panel.models import SystemConfig


@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = [
        "key",
        "label",
        "category",
        "is_secret",
        "requires_restart",
        "updated_at",
    ]
    list_filter = ["category", "is_secret", "requires_restart"]
    search_fields = ["key", "label"]
    readonly_fields = ["updated_at", "updated_by"]

    def get_fields(self, request, obj=None):  # type: ignore[override,no-untyped-def]  # noqa: E501
        fields = super().get_fields(request, obj)
        # Nunca exibir _value diretamente no admin Django
        return [f for f in fields if f != "_value"]
