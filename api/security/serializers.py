from rest_framework import serializers

from security.activity_logs.models import ActivityLog
from security.models import Archive, Password, StoredBankAccount, StoredCreditCard

# ============================================================================
# PASSWORD SERIALIZERS
# ============================================================================


class PasswordSerializer(serializers.ModelSerializer):
    """Serializer para visualização de senhas (sem revelar a senha)."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Password
        fields = [
            "id",
            "uuid",
            "title",
            "site",
            "username",
            "category",
            "category_display",
            "notes",
            "last_password_change",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "last_password_change", "created_at", "updated_at"]


class PasswordCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de senhas (aceita senha em texto)."""

    password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )

    class Meta:
        model = Password
        fields = [
            "id",
            "title",
            "site",
            "username",
            "password",
            "category",
            "notes",
            "owner",
        ]

    def create(self, validated_data):
        password_text = validated_data.pop("password")
        instance = Password(**validated_data)
        instance.password = password_text  # Property setter criptografa
        instance.save()
        return instance

    def update(self, instance, validated_data):
        password_text = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password_text:
            instance.password = password_text
            instance.save()

        instance.save()
        return instance


class PasswordRevealSerializer(serializers.Serializer):
    """Serializer para revelar senha descriptografada."""

    id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    password = serializers.SerializerMethodField()

    def get_password(self, obj):
        """Retorna a senha descriptografada."""
        return obj.password  # Property getter descriptografa


# ============================================================================
# STORED CREDIT CARD SERIALIZERS
# ============================================================================


class StoredCreditCardSerializer(serializers.ModelSerializer):
    """Serializer para visualização de cartões (número mascarado)."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    flag_display = serializers.CharField(source="get_flag_display", read_only=True)
    card_number_masked = serializers.CharField(read_only=True)
    finance_card_name = serializers.CharField(
        source="finance_card.name", read_only=True, allow_null=True
    )

    class Meta:
        model = StoredCreditCard
        fields = [
            "id",
            "uuid",
            "name",
            "card_number_masked",
            "cardholder_name",
            "expiration_month",
            "expiration_year",
            "flag",
            "flag_display",
            "notes",
            "owner",
            "owner_name",
            "finance_card",
            "finance_card_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "card_number_masked", "created_at", "updated_at"]


class StoredCreditCardCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de cartões (aceita dados sensíveis)."""

    card_number = serializers.CharField(write_only=True, required=True)
    security_code = serializers.CharField(write_only=True, required=True, max_length=4)

    class Meta:
        model = StoredCreditCard
        fields = [
            "id",
            "name",
            "card_number",
            "security_code",
            "cardholder_name",
            "expiration_month",
            "expiration_year",
            "flag",
            "notes",
            "owner",
            "finance_card",
        ]

    def create(self, validated_data):
        card_number = validated_data.pop("card_number")
        security_code = validated_data.pop("security_code")

        instance = StoredCreditCard(**validated_data)
        instance.card_number = card_number  # Property setter criptografa
        instance.security_code = security_code
        instance.save()
        return instance

    def update(self, instance, validated_data):
        card_number = validated_data.pop("card_number", None)
        security_code = validated_data.pop("security_code", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if card_number:
            instance.card_number = card_number
        if security_code:
            instance.security_code = security_code

        instance.save()
        return instance


class StoredCreditCardRevealSerializer(serializers.Serializer):
    """Serializer para revelar dados completos do cartão."""

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    card_number = serializers.SerializerMethodField()
    security_code = serializers.SerializerMethodField()
    cardholder_name = serializers.CharField(read_only=True)
    expiration_month = serializers.IntegerField(read_only=True)
    expiration_year = serializers.IntegerField(read_only=True)

    def get_card_number(self, obj):
        return obj.card_number  # Property getter descriptografa

    def get_security_code(self, obj):
        return obj.security_code


# ============================================================================
# STORED BANK ACCOUNT SERIALIZERS
# ============================================================================


class StoredBankAccountSerializer(serializers.ModelSerializer):
    """Serializer para visualização de contas bancárias (número mascarado)."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    account_type_display = serializers.CharField(
        source="get_account_type_display", read_only=True
    )
    account_number_masked = serializers.CharField(read_only=True)
    finance_account_name = serializers.CharField(
        source="finance_account.account_name", read_only=True, allow_null=True
    )

    class Meta:
        model = StoredBankAccount
        fields = [
            "id",
            "uuid",
            "name",
            "institution_name",
            "account_type",
            "account_type_display",
            "account_number_masked",
            "agency",
            "notes",
            "owner",
            "owner_name",
            "finance_account",
            "finance_account_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "account_number_masked", "created_at", "updated_at"]


class StoredBankAccountCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de contas bancárias."""

    account_number = serializers.CharField(write_only=True, required=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    digital_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = StoredBankAccount
        fields = [
            "id",
            "name",
            "institution_name",
            "account_type",
            "account_number",
            "agency",
            "password",
            "digital_password",
            "notes",
            "owner",
            "finance_account",
        ]

    def create(self, validated_data):
        account_number = validated_data.pop("account_number")
        password = validated_data.pop("password", None)
        digital_password = validated_data.pop("digital_password", None)

        instance = StoredBankAccount(**validated_data)
        instance.account_number = account_number
        if password:
            instance.password = password
        if digital_password:
            instance.digital_password = digital_password
        instance.save()
        return instance

    def update(self, instance, validated_data):
        account_number = validated_data.pop("account_number", None)
        password = validated_data.pop("password", None)
        digital_password = validated_data.pop("digital_password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if account_number:
            instance.account_number = account_number
        if password:
            instance.password = password
        if digital_password:
            instance.digital_password = digital_password

        instance.save()
        return instance


class StoredBankAccountRevealSerializer(serializers.Serializer):
    """Serializer para revelar dados completos da conta bancária."""

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    institution_name = serializers.CharField(read_only=True)
    account_number = serializers.SerializerMethodField()
    agency = serializers.CharField(read_only=True)
    password = serializers.SerializerMethodField()
    digital_password = serializers.SerializerMethodField()

    def get_account_number(self, obj):
        return obj.account_number

    def get_password(self, obj):
        return obj.password

    def get_digital_password(self, obj):
        return obj.digital_password


# ============================================================================
# ARCHIVE SERIALIZERS
# ============================================================================


class ArchiveSerializer(serializers.ModelSerializer):
    """Serializer para visualização de arquivos (sem conteúdo)."""

    owner_name = serializers.CharField(source="owner.name", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    archive_type_display = serializers.CharField(
        source="get_archive_type_display", read_only=True
    )
    has_text = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = Archive
        fields = [
            "id",
            "uuid",
            "title",
            "category",
            "category_display",
            "archive_type",
            "archive_type_display",
            "file_name",
            "file_size",
            "notes",
            "tags",
            "has_text",
            "has_file",
            "encrypted_file",
            "owner",
            "owner_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "uuid",
            "file_name",
            "file_size",
            "created_at",
            "updated_at",
        ]

    def get_has_text(self, obj):
        return obj.has_text_content()

    def get_has_file(self, obj):
        return obj.has_file_content()


class ArchiveCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/atualização de arquivos."""

    text_content = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    encrypted_file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Archive
        fields = [
            "id",
            "title",
            "category",
            "archive_type",
            "text_content",
            "encrypted_file",
            "notes",
            "tags",
            "owner",
        ]

    def create(self, validated_data):
        text_content = validated_data.pop("text_content", None)
        encrypted_file = validated_data.get("encrypted_file", None)

        instance = Archive(**validated_data)

        if text_content:
            instance.text_content = text_content  # Property setter criptografa

        # Salvar o nome original do arquivo
        if encrypted_file:
            instance.file_name = encrypted_file.name
            instance.file_size = encrypted_file.size

        instance.save()
        return instance

    def update(self, instance, validated_data):
        text_content = validated_data.pop("text_content", None)
        encrypted_file = validated_data.get("encrypted_file", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Só atualizar text_content se foi fornecido um valor não-vazio
        # String vazia '' também não atualiza para preservar conteúdo existente
        if text_content:
            instance.text_content = text_content
        elif text_content == "":
            # String vazia explícita - não atualizar, preservar existente
            # Se quiser limpar, deve deletar o arquivo
            pass

        # Atualizar o nome do arquivo se um novo arquivo foi enviado
        if encrypted_file:
            instance.file_name = encrypted_file.name
            instance.file_size = encrypted_file.size

        instance.save()
        return instance


class ArchiveRevealSerializer(serializers.Serializer):
    """Serializer para revelar conteúdo de texto descriptografado."""

    id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(read_only=True)
    text_content = serializers.CharField(read_only=True, allow_null=True, default=None)
    error = serializers.CharField(read_only=True, allow_null=True, default=None)
    error_type = serializers.CharField(read_only=True, allow_null=True, default=None)


# ============================================================================
# ACTIVITY LOG SERIALIZERS
# ============================================================================


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer para visualização de logs de atividades."""

    username = serializers.CharField(
        source="user.username", read_only=True, allow_null=True
    )
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "action",
            "action_display",
            "model_name",
            "object_id",
            "description",
            "ip_address",
            "user_agent",
            "user",
            "username",
            "created_at",
        ]
        read_only_fields = ["created_at"]
