import calendar
from datetime import date
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from credit_cards.models import (
    CreditCard,
    CreditCardBill,
    CreditCardInstallment,
    CreditCardPurchase,
)
from credit_cards.utils import recalculate_bill_total


class CreditCardSerializer(serializers.ModelSerializer):
    security_code = serializers.CharField(
        max_length=4,
        min_length=3,
        write_only=True,
        help_text="CVV do cartão (3 ou 4 dígitos)",
    )
    card_number = serializers.CharField(
        max_length=19,
        write_only=True,
        required=False,
        allow_blank=True,
        help_text="Número do cartão (será criptografado)",
    )
    card_number_masked = serializers.SerializerMethodField(
        read_only=True, help_text="Número do cartão mascarado"
    )
    associated_account_name = serializers.CharField(
        source="associated_account.account_name",
        read_only=True,
        help_text="Nome da conta associada",
    )
    used_credit = serializers.SerializerMethodField(
        read_only=True, help_text="Crédito utilizado (parcelas não pagas)"
    )
    available_credit = serializers.SerializerMethodField(
        read_only=True, help_text="Crédito disponível"
    )

    class Meta:
        model = CreditCard
        exclude = ["_security_code", "_card_number"]

    def get_used_credit(self, obj):
        """
        Retorna a soma das parcelas não pagas do cartão.
        """
        from django.db.models import Sum

        result = CreditCardInstallment.objects.filter(
            purchase__card=obj,
            purchase__is_deleted=False,
            is_deleted=False,
            payed=False,
        ).aggregate(total=Sum("value"))
        return float(result["total"] or 0)

    def get_available_credit(self, obj):
        """
        Retorna o crédito disponível (limite - usado).
        """
        used = self.get_used_credit(obj)
        return float(obj.credit_limit) - used

    def get_card_number_masked(self, obj):
        """
        Retorna o número do cartão mascarado usando a propriedade do model.
        """
        return obj.card_number_masked

    def validate_security_code(self, value):
        """
        Validação customizada para o CVV.
        """
        if not value.isdigit():
            raise serializers.ValidationError("CVV deve conter apenas dígitos")
        if len(value) not in [3, 4]:
            raise serializers.ValidationError("CVV deve ter 3 ou 4 dígitos")
        return value

    def validate_validation_date(self, value):
        """
        Validação customizada para data de validade.
        """
        from datetime import date

        if value <= date.today():
            raise serializers.ValidationError(
                "Data de validade deve ser posterior à data atual"
            )
        return value

    def create(self, validated_data):
        """
        Override do create para lidar com os campos criptografados.
        """
        security_code = validated_data.pop("security_code", None)
        card_number = validated_data.pop("card_number", None)

        # Criar a instância sem salvar
        instance = CreditCard(**validated_data)

        # Definir o security_code via property (que criptografa e define
        # _security_code)
        if security_code:
            instance.security_code = security_code

        # Definir o card_number via property (que criptografa e define
        # _card_number)
        if card_number:
            instance.card_number = card_number

        # Agora salvar a instância com campos criptografados já definidos
        instance.save()
        return instance

    def update(self, instance, validated_data):
        """
        Override do update para lidar com os campos criptografados.
        """
        security_code = validated_data.pop("security_code", None)
        card_number = validated_data.pop("card_number", None)

        # Atualizar os campos do validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Definir o security_code via property se fornecido
        if security_code:
            instance.security_code = security_code

        # Definir o card_number via property se fornecido
        if card_number:
            instance.card_number = card_number

        # Salvar a instância
        instance.save()
        return instance


class CreditCardBillsSerializer(serializers.ModelSerializer):
    credit_card_on_card_name = serializers.CharField(
        source="credit_card.on_card_name",
        read_only=True,
        help_text="Nome impresso no cartão",
    )
    credit_card_number_masked = serializers.SerializerMethodField(
        read_only=True, help_text="Últimos 4 dígitos do cartão"
    )
    credit_card_flag = serializers.CharField(
        source="credit_card.flag",
        read_only=True,
        help_text="Bandeira do cartão",
    )
    credit_card_associated_account_name = serializers.CharField(
        source="credit_card.associated_account.account_name",
        read_only=True,
        help_text="Nome da conta associada ao cartão",
    )

    class Meta:
        model = CreditCardBill
        fields = [
            "id",
            "uuid",
            "credit_card",
            "credit_card_on_card_name",
            "credit_card_number_masked",
            "credit_card_flag",
            "credit_card_associated_account_name",
            "year",
            "month",
            "invoice_beginning_date",
            "invoice_ending_date",
            "closed",
            "total_amount",
            "minimum_payment",
            "due_date",
            "paid_amount",
            "payment_date",
            "interest_charged",
            "late_fee",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_credit_card_number_masked(self, obj):
        """
        Retorna os últimos 4 dígitos do cartão mascarado.
        """
        if obj.credit_card and obj.credit_card.card_number_masked:
            masked = obj.credit_card.card_number_masked
            # Verifica se o cartão tem número válido (não é apenas asteriscos)
            if masked and masked != "****" and len(masked) >= 4:
                # Remove os asteriscos e pega apenas os últimos 4 dígitos
                # numéricos
                digits_only = "".join(c for c in masked if c.isdigit())
                if len(digits_only) >= 4:
                    return digits_only[-4:]
        return "****"

    def create(self, validated_data):
        """
        Override do create para inicializar valores padrão.
        Ao criar uma fatura:
        - total_amount = 0
        - minimum_payment = 0
        - paid_amount = 0
        - status = 'open'
        - closed = False
        - due_date = calculado automaticamente se não fornecido
        """
        import calendar
        from datetime import date

        validated_data["total_amount"] = 0
        validated_data["minimum_payment"] = 0
        validated_data["paid_amount"] = 0
        validated_data["status"] = "open"
        validated_data["closed"] = False

        # Calcular due_date automaticamente se não fornecido
        if not validated_data.get("due_date"):
            credit_card = validated_data.get("credit_card")
            if (
                credit_card
                and hasattr(credit_card, "due_day")
                and credit_card.due_day
            ):
                year_str = validated_data.get("year", str(date.today().year))
                month_str = validated_data.get("month", "Jan")
                month_map = {
                    "Jan": 1,
                    "Feb": 2,
                    "Mar": 3,
                    "Apr": 4,
                    "May": 5,
                    "Jun": 6,
                    "Jul": 7,
                    "Aug": 8,
                    "Sep": 9,
                    "Oct": 10,
                    "Nov": 11,
                    "Dec": 12,
                }
                year = int(year_str)
                month = month_map.get(month_str, 1)

                # Vencimento é no mês seguinte ao da fatura
                due_month = month + 1 if month < 12 else 1
                due_year = year if month < 12 else year + 1

                # Ajustar dia se exceder dias do mês
                due_day = credit_card.due_day
                max_day = calendar.monthrange(due_year, due_month)[1]
                if due_day > max_day:
                    due_day = max_day

                validated_data["due_date"] = date(due_year, due_month, due_day)

        return super().create(validated_data)


# ============================================================================
# SERIALIZERS FOR PURCHASE AND INSTALLMENT
# ============================================================================


class CreditCardInstallmentSerializer(serializers.ModelSerializer):
    """
    Serializer para leitura de parcelas.
    Inclui informações da compra para facilitar visualização.
    """

    value = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False
    )
    # Campos derivados da compra (read-only)
    description = serializers.CharField(
        source="purchase.description", read_only=True
    )
    category = serializers.CharField(
        source="purchase.category", read_only=True
    )
    card_id = serializers.IntegerField(
        source="purchase.card_id", read_only=True
    )
    card_name = serializers.CharField(
        source="purchase.card.name", read_only=True
    )
    total_installments = serializers.IntegerField(
        source="purchase.total_installments", read_only=True
    )
    merchant = serializers.CharField(
        source="purchase.merchant", read_only=True
    )
    member_id = serializers.IntegerField(
        source="purchase.member_id", read_only=True
    )
    member_name = serializers.CharField(
        source="purchase.member.name", read_only=True
    )
    purchase_date = serializers.DateField(
        source="purchase.purchase_date", read_only=True
    )
    # Informações da fatura
    bill_month = serializers.CharField(source="bill.month", read_only=True)
    bill_year = serializers.CharField(source="bill.year", read_only=True)

    class Meta:
        model = CreditCardInstallment
        fields = [
            "id",
            "uuid",
            "purchase",
            "installment_number",
            "value",
            "due_date",
            "bill",
            "payed",
            # Campos derivados da compra
            "description",
            "category",
            "card_id",
            "card_name",
            "total_installments",
            "merchant",
            "member_id",
            "member_name",
            "purchase_date",
            # Campos da fatura
            "bill_month",
            "bill_year",
            # Timestamps
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "purchase",
            "installment_number",
            "value",
            "due_date",
            "created_at",
            "updated_at",
        ]


class CreditCardInstallmentUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para atualização de parcelas.
    Permite alterar bill, payed e value.
    Atualiza automaticamente o status das faturas afetadas.
    """

    value = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False, required=False
    )

    class Meta:
        model = CreditCardInstallment
        fields = ["bill", "payed", "value"]

    def validate_value(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Valor deve ser maior que zero")
        return value

    def validate(self, data):
        new_bill = data.get("bill")
        if new_bill is not None and self.instance is not None:
            old_bill = self.instance.bill
            if new_bill != old_bill:
                due_date = self.instance.due_date
                if not (
                    new_bill.invoice_beginning_date
                    <= due_date
                    <= new_bill.invoice_ending_date
                ):
                    raise serializers.ValidationError(
                        {
                            "bill": (
                                "A data de vencimento da parcela "
                                f"({due_date}) não está dentro do período "
                                f"desta fatura "
                                f"({new_bill.invoice_beginning_date} a "
                                f"{new_bill.invoice_ending_date})."
                            )
                        }
                    )
        return data

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Atualiza a parcela e as faturas afetadas.
        Se a parcela for movida para uma fatura diferente, atualiza os totais e
        status.
        """
        old_bill = instance.bill
        new_bill = validated_data.get("bill", old_bill)

        # Verificar se a fatura mudou
        bill_changed = old_bill != new_bill

        # Atualizar a parcela
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Se a fatura mudou, recalcular a fatura antiga (o signal só recalcula
        # a nova)
        if bill_changed and old_bill:
            recalculate_bill_total(old_bill)

        # Ajustar status das faturas afetadas com valores frescos do banco
        bills_to_check = set()
        if old_bill:
            bills_to_check.add(old_bill.pk)
        if new_bill:
            bills_to_check.add(new_bill.pk)

        for bill_pk in bills_to_check:
            try:
                bill = CreditCardBill.objects.get(pk=bill_pk)
                if (
                    Decimal(str(bill.paid_amount)) >= bill.total_amount
                    and bill.total_amount > 0
                ):
                    if not bill.closed:
                        bill.status = "paid"
                elif bill.status == "paid" and not bill.closed:
                    if Decimal(str(bill.paid_amount)) < bill.total_amount:
                        bill.status = "open"
                bill.save()
            except CreditCardBill.DoesNotExist:
                pass

        return instance


class CreditCardInstallmentNestedSerializer(serializers.ModelSerializer):
    """
    Serializer simplificado para exibição aninhada em Purchase.
    """

    value = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False
    )
    bill_month = serializers.CharField(source="bill.month", read_only=True)
    bill_year = serializers.CharField(source="bill.year", read_only=True)

    class Meta:
        model = CreditCardInstallment
        fields = [
            "id",
            "installment_number",
            "value",
            "due_date",
            "bill",
            "payed",
            "bill_month",
            "bill_year",
        ]


class CreditCardPurchaseSerializer(serializers.ModelSerializer):
    """
    Serializer para leitura de compras.
    Inclui parcelas aninhadas.
    """

    total_value = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False
    )
    installment_value = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False, read_only=True
    )
    installments = CreditCardInstallmentNestedSerializer(
        many=True, read_only=True
    )
    # Informações do cartão
    card_name = serializers.CharField(source="card.name", read_only=True)
    card_flag = serializers.CharField(source="card.flag", read_only=True)
    card_number_masked = serializers.CharField(
        source="card.card_number_masked", read_only=True
    )
    # Informações do membro
    member_name = serializers.CharField(source="member.name", read_only=True)

    class Meta:
        model = CreditCardPurchase
        fields = [
            "id",
            "uuid",
            "description",
            "total_value",
            "installment_value",
            "purchase_date",
            "purchase_time",
            "category",
            "card",
            "card_name",
            "card_flag",
            "card_number_masked",
            "total_installments",
            "merchant",
            "member",
            "member_name",
            "notes",
            "receipt",
            "installments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "uuid", "created_at", "updated_at"]


class CreditCardPurchaseCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para criação de compras.
    Cria automaticamente as parcelas.
    """

    total_value = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=False
    )

    class Meta:
        model = CreditCardPurchase
        fields = [
            "description",
            "total_value",
            "purchase_date",
            "purchase_time",
            "category",
            "card",
            "total_installments",
            "merchant",
            "member",
            "notes",
            "receipt",
        ]

    def validate_total_installments(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "Quantidade de parcelas deve ser pelo menos 1"
            )
        if value > 48:
            raise serializers.ValidationError(
                "Quantidade máxima de parcelas é 48"
            )
        return value

    def validate_total_value(self, value):
        if value <= 0:
            raise serializers.ValidationError("Valor deve ser maior que zero")
        return value

    @transaction.atomic
    def create(self, validated_data):
        """
        Cria a compra e gera automaticamente as parcelas.
        Atualiza o total_amount das faturas e redefine o status se necessário.
        """
        # Criar a compra
        purchase = CreditCardPurchase.objects.create(**validated_data)

        # Calcular valor de cada parcela
        total_installments = validated_data.get("total_installments", 1)
        total_value = Decimal(str(validated_data["total_value"]))
        installment_value = total_value / total_installments

        # Obter data inicial
        purchase_date = validated_data["purchase_date"]
        card = validated_data["card"]

        # Buscar faturas existentes para o cartão
        bills = CreditCardBill.objects.filter(
            credit_card=card, is_deleted=False
        ).order_by("invoice_beginning_date")

        # Rastrear faturas afetadas
        affected_bill_ids = set()

        # Criar parcelas
        for i in range(total_installments):
            # Calcular data de vencimento (mês a mês)
            due_date = self._add_months(purchase_date, i)

            # Tentar encontrar fatura correspondente
            matching_bill = None
            for bill in bills:
                if (
                    bill.invoice_beginning_date
                    <= due_date
                    <= bill.invoice_ending_date
                ):
                    matching_bill = bill
                    break

            CreditCardInstallment.objects.create(
                purchase=purchase,
                installment_number=i + 1,
                value=installment_value,
                due_date=due_date,
                bill=matching_bill,
                payed=False,
            )

            if matching_bill:
                affected_bill_ids.add(matching_bill.id)

        # Ajustar status das faturas afetadas
        # (total já recalculado pelo signal post_save)
        for bill_id in affected_bill_ids:
            try:
                bill = CreditCardBill.objects.get(pk=bill_id)
                if bill.status == "paid" and not bill.closed:
                    if Decimal(str(bill.paid_amount)) < bill.total_amount:
                        bill.status = "open"
                        bill.save()
            except CreditCardBill.DoesNotExist:
                pass

        return purchase

    def _add_months(self, source_date, months):
        """
        Adiciona meses a uma data, ajustando o dia se necessário.
        """
        month = source_date.month - 1 + months
        year = source_date.year + month // 12
        month = month % 12 + 1
        day = min(source_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)


class CreditCardPurchaseUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para atualização de compras.
    Não permite alterar valor total ou número de parcelas após criação.
    """

    class Meta:
        model = CreditCardPurchase
        fields = [
            "description",
            "category",
            "merchant",
            "member",
            "notes",
        ]


class PayCreditCardBillSerializer(serializers.Serializer):
    """
    Serializer para pagamento de fatura de cartão de crédito.
    """

    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=True,
        help_text="Valor do pagamento",
    )
    payment_date = serializers.DateField(
        required=True, help_text="Data do pagamento"
    )
    notes = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Observações sobre o pagamento",
    )
    scheduled = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Se True, cria a despesa como pendente (agendamento futuro)",
    )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "O valor do pagamento deve ser maior que zero"
            )
        return value

    def validate(self, attrs):
        """
        Validação customizada para verificar se o valor não excede o saldo
        restante.
        O contexto deve conter a fatura (bill) para esta validação.
        """
        bill = self.context.get("bill")
        if bill:
            remaining = Decimal(str(bill.total_amount)) - Decimal(
                str(bill.paid_amount)
            )
            if attrs["amount"] > remaining:
                raise serializers.ValidationError(
                    {
                        "amount": (
                            "O valor não pode exceder o saldo restante"
                            f" da fatura (R$ {remaining:.2f})"
                        )
                    }
                )
        return attrs
