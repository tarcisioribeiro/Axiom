from django.db import migrations


def populate_loan_type(apps, schema_editor):
    """
    Infere loan_type para empréstimos com NULL comparando o user vinculado
    ao membro creditor/benefited com o created_by do empréstimo.
    """
    Loan = apps.get_model('loans', 'Loan')
    Member = apps.get_model('members', 'Member')

    # Mapeamento member_id → user_id para membros vinculados a um usuário
    member_user_map = dict(
        Member.objects.filter(user_id__isnull=False).values_list('id', 'user_id')
    )

    null_loans = Loan.objects.filter(
        loan_type__isnull=True
    ).values('id', 'creditor_id', 'benefited_id', 'created_by_id')

    for loan in null_loans:
        creditor_user = member_user_map.get(loan['creditor_id'])
        benefited_user = member_user_map.get(loan['benefited_id'])

        if creditor_user and creditor_user == loan['created_by_id']:
            Loan.objects.filter(pk=loan['id']).update(loan_type='lent')
        elif benefited_user and benefited_user == loan['created_by_id']:
            Loan.objects.filter(pk=loan['id']).update(loan_type='borrowed')


def reverse_populate_loan_type(apps, schema_editor):
    pass  # irreversível: não há como recuperar os dados originais


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0007_loan_loan_type'),
    ]

    operations = [
        migrations.RunPython(populate_loan_type, reverse_populate_loan_type),
    ]
