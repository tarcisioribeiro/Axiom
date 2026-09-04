import 'package:axiom_mobile/models/loan.dart';
import 'package:axiom_mobile/models/stored_account.dart';
import 'package:axiom_mobile/models/stored_card.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Loan.fromJson parses parties, progress and remaining balance', () {
    final loan = Loan.fromJson({
      'id': 1,
      'uuid': 'u',
      'description': 'Empréstimo p/ João',
      'value': '1000.00',
      'payed_value': '250.00',
      'remaining_balance': '750.00',
      'date': '2026-01-05',
      'due_date': '2026-02-05',
      'category': 'loans',
      'account': 3,
      'benefited': 7,
      'creditor': 2,
      'installments': 4,
      'status': 'active',
      'loan_type': 'lent',
      'payment_frequency': 'monthly',
    });

    expect(loan.loanType, 'lent');
    expect(loan.benefited, 7);
    expect(loan.creditor, 2);
    expect(loan.remainingBalance, 750);
    expect(loan.progress, closeTo(0.25, 1e-9));

    final payload = loan.toJson();
    expect(payload['benefited'], 7);
    expect(payload['creditor'], 2);
    expect(payload['horary'], matches(r'^\d{2}:\d{2}:00$'));
  });

  test('StoredCard.expiry formats month/year, "—" when missing', () {
    final withDate = StoredCard.fromJson({
      'id': 1,
      'uuid': 'u',
      'name': 'Nubank',
      'expiration_month': 3,
      'expiration_year': 2029,
      'flag': 'MSC',
      'is_favorite': true,
    });
    expect(withDate.expiry, '03/2029');

    final noDate = StoredCard.fromJson({
      'id': 2,
      'uuid': 'u',
      'name': 'Outro',
      'flag': 'OTHER',
      'is_favorite': false,
    });
    expect(noDate.expiry, '—');
  });

  test('StoredAccount.toJson omits blank secrets', () {
    final account = StoredAccount.fromJson({
      'id': 1,
      'uuid': 'u',
      'name': 'Conta principal',
      'institution_name': 'Sicoob',
      'account_type': 'CC',
      'is_favorite': false,
    });
    final payload = account.toJson(accountNumber: '123', password: '');
    expect(payload['account_number'], '123');
    expect(payload.containsKey('password'), isFalse);
  });
}
