from django.db import migrations


def backfill_loan_type(apps, schema_editor):
    """
    Reaplica o backfill de loan_type feito em 0008_populate_loan_type.

    Empréstimos criados pelo frontend entre a migration 0008 e a
    correção de loans-service.ts (que nunca enviava `loan_type` na
    criação) ficaram novamente com a coluna NULL.
    """
    Loan = apps.get_model("loans", "Loan")
    Member = apps.get_model("members", "Member")

    member_user_map = dict(
        Member.objects.filter(user_id__isnull=False).values_list(
            "id", "user_id"
        )
    )

    null_loans = Loan.objects.filter(loan_type__isnull=True).values(
        "id", "creditor_id", "benefited_id", "created_by_id"
    )

    for loan in null_loans:
        creditor_user = member_user_map.get(loan["creditor_id"])
        benefited_user = member_user_map.get(loan["benefited_id"])

        if creditor_user and creditor_user == loan["created_by_id"]:
            Loan.objects.filter(pk=loan["id"]).update(loan_type="lent")
        elif benefited_user and benefited_user == loan["created_by_id"]:
            Loan.objects.filter(pk=loan["id"]).update(loan_type="borrowed")


def reverse_backfill_loan_type(apps, schema_editor):
    pass  # irreversível: não há como recuperar os dados originais


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0010_backfill_loan_initial_payed_value"),
    ]

    operations = [
        migrations.RunPython(backfill_loan_type, reverse_backfill_loan_type),
    ]
