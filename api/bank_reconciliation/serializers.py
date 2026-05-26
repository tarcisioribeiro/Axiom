from rest_framework import serializers

from .models import BankStatementEntry, BankStatementImport


class MatchedExpenseSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    description = serializers.CharField()
    value = serializers.DecimalField(max_digits=10, decimal_places=2)
    date = serializers.DateField()


class MatchedRevenueSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    description = serializers.CharField()
    value = serializers.DecimalField(max_digits=10, decimal_places=2)
    date = serializers.DateField()


class BankStatementEntrySerializer(serializers.ModelSerializer):
    matched_expense = serializers.SerializerMethodField()
    matched_revenue = serializers.SerializerMethodField()

    class Meta:
        model = BankStatementEntry
        fields = [
            "id",
            "uuid",
            "transaction_id",
            "date",
            "amount",
            "description",
            "transaction_type",
            "status",
            "matched_expense",
            "matched_revenue",
            "match_confidence",
        ]
        read_only_fields = fields

    def get_matched_expense(self, obj):
        if obj.matched_expense_id is None:
            return None
        try:
            exp = obj.matched_expense
            return {
                "id": exp.id,
                "description": exp.description,
                "value": str(exp.value),
                "date": str(exp.date),
            }
        except Exception:
            return None

    def get_matched_revenue(self, obj):
        if obj.matched_revenue_id is None:
            return None
        try:
            rev = obj.matched_revenue
            return {
                "id": rev.id,
                "description": rev.description,
                "value": str(rev.value),
                "date": str(rev.date),
            }
        except Exception:
            return None


class BankStatementImportSerializer(serializers.ModelSerializer):
    entries = BankStatementEntrySerializer(many=True, read_only=True)

    class Meta:
        model = BankStatementImport
        fields = [
            "id",
            "uuid",
            "account",
            "original_filename",
            "file_format",
            "status",
            "total_entries",
            "matched_count",
            "unmatched_count",
            "ignored_count",
            "error_message",
            "entries",
            "created_at",
        ]
        read_only_fields = fields


class BankStatementImportListSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatementImport
        fields = [
            "id",
            "uuid",
            "account",
            "original_filename",
            "file_format",
            "status",
            "total_entries",
            "matched_count",
            "unmatched_count",
            "ignored_count",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields


class BankStatementEntryManualMatchSerializer(serializers.Serializer):
    matched_expense_id = serializers.IntegerField(
        required=False, allow_null=True
    )
    matched_revenue_id = serializers.IntegerField(
        required=False, allow_null=True
    )

    def validate(self, attrs):
        exp_id = attrs.get("matched_expense_id")
        rev_id = attrs.get("matched_revenue_id")
        if exp_id and rev_id:
            raise serializers.ValidationError(
                "Informe apenas matched_expense_id"
                " ou matched_revenue_id, não ambos."
            )
        if not exp_id and not rev_id:
            raise serializers.ValidationError(
                "Informe matched_expense_id ou matched_revenue_id."
            )
        return attrs


class BankStatementEntryUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatementEntry
        fields = [
            "status",
            "matched_expense",
            "matched_revenue",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        if not request:
            return attrs

        matched_expense = attrs.get("matched_expense")
        matched_revenue = attrs.get("matched_revenue")

        if matched_expense and matched_expense.created_by != request.user:
            raise serializers.ValidationError(
                {"matched_expense": "Despesa não pertence ao usuário."}
            )

        if matched_revenue and matched_revenue.created_by != request.user:
            raise serializers.ValidationError(
                {"matched_revenue": "Receita não pertence ao usuário."}
            )

        return attrs
