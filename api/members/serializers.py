from django.contrib.auth.models import Permission
from rest_framework import serializers

from members.models import Member


class MemberSerializer(serializers.ModelSerializer):
    # Declare explicitly so DRF treats it as writable (descriptor, not a DB
    # field)
    document = serializers.CharField(required=True)
    profile_photo = serializers.SerializerMethodField()

    def get_profile_photo(self, obj):
        if not obj.profile_photo:
            return None
        return f"/api/v1/members/{obj.pk}/photo/"

    class Meta:
        model = Member
        fields = [
            "id",
            "uuid",
            "name",
            "document",
            "phone",
            "email",
            "email_verified",
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
            "email_verified",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate_document(self, value):
        from members.models import compute_document_hash

        doc_hash = compute_document_hash(value)
        qs = Member.objects.filter(document_hash=doc_hash, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Documento já cadastrado.")
        return value

    def create(self, validated_data):
        document = validated_data.pop("document", None)
        instance = Member(**validated_data)
        if document:
            instance.document = document
        instance.save()
        return instance

    def update(self, instance, validated_data):
        document = validated_data.pop("document", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if document is not None:
            instance.document = document
        instance.save()
        return instance


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
        help_text=(
            "Lista de codenames de permissões" " a serem atribuídas ao membro"
        ),
    )
