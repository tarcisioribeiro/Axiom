from django.db import migrations
from django.utils import timezone


def create_receipt_installment(apps, schema_editor):
    """
    Cria uma parcela de recebimento única (já recebida) para empréstimos
    concedidos (`lent`) que foram totalmente recebidos mas não possuem
    nenhuma parcela registrada, para que o progresso de recebimento
    reflita a quitação. A data da parcela é a de criação do empréstimo.
    """
    Loan = apps.get_model("loans", "Loan")
    LoanInstallment = apps.get_model("loans", "LoanInstallment")

    loans = Loan.objects.filter(
        loan_type="lent", payed=True, is_deleted=False
    ).exclude(installment_schedule__isnull=False)

    LoanInstallment.objects.bulk_create(
        [
            LoanInstallment(
                loan=loan,
                installment_number=1,
                value=loan.value,
                due_date=timezone.localtime(loan.created_at).date(),
                payed=True,
                created_by_id=loan.created_by_id,
            )
            for loan in loans
        ]
    )


def reverse(apps, schema_editor):
    pass  # irreversível: não distingue parcelas criadas aqui das legítimas


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0011_backfill_loan_type_missing"),
    ]

    operations = [
        migrations.RunPython(create_receipt_installment, reverse),
    ]
