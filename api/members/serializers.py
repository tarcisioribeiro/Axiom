from django.contrib.auth.models import Permission
from rest_framework import serializers

from members.models import Member


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = [
            "id",
            "uuid",
            "name",
            "document",
            "phone",
            "email",
            "sex",
            "user",
            "is_creditor",
            "is_benefited",
            "active",
            "birth_date",
            "address",
            "profile_photo",
            "emergency_contact",
            "monthly_income",
            "occupation",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "uuid",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer para permissões do Django"""

    class Meta:
        model = Permission
        fields = ["id", "name", "codename", "content_type"]


class MemberPermissionsSerializer(serializers.Serializer):
    """Serializer para gerenciar permissões de um membro"""

    permission_codenames = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        help_text="Lista de codenames de permissões a serem atribuídas ao membro",
    )
