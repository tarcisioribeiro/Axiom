import '../utils/formatters.dart';

/// Mirrors the subset of `LoanSerializer` (`apps/api/loans/serializers.py`)
/// the mobile screen needs. A loan always has both a `benefited` and a
/// `creditor` member; `loanType` says which side the user is on
/// (`borrowed` = user is benefited, `lent` = user is creditor).
class Loan {
  final int id;
  final String uuid;
  final String description;
  final double value;
  final double payedValue;
  final double remainingBalance;
  final DateTime date;
  final DateTime? dueDate;
  final String category;
  final int account;
  final String? accountName;
  final int benefited;
  final String? benefitedName;
  final int creditor;
  final String? creditorName;
  final int installments;
  final String status;
  final String loanType;
  final String paymentFrequency;
  final bool payed;
  final String? notes;

  const Loan({
    required this.id,
    required this.uuid,
    required this.description,
    required this.value,
    required this.payedValue,
    required this.remainingBalance,
    required this.date,
    required this.category,
    required this.account,
    required this.benefited,
    required this.creditor,
    required this.installments,
    required this.status,
    required this.loanType,
    required this.paymentFrequency,
    required this.payed,
    this.dueDate,
    this.accountName,
    this.benefitedName,
    this.creditorName,
    this.notes,
  });

  double get progress => value <= 0 ? 0 : (payedValue / value).clamp(0, 1);

  factory Loan.fromJson(Map<String, dynamic> json) => Loan(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        value: AppFormatters.toDouble(json['value']),
        payedValue: AppFormatters.toDouble(json['payed_value']),
        remainingBalance: AppFormatters.toDouble(json['remaining_balance']),
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        dueDate: AppFormatters.parseApiDate(json['due_date'] as String?),
        category: json['category'] as String? ?? 'loans',
        account: json['account'] as int,
        accountName: json['account_name'] as String?,
        benefited: json['benefited'] as int,
        benefitedName: json['benefited_name'] as String?,
        creditor: json['creditor'] as int,
        creditorName: json['creditor_name'] as String?,
        installments: json['installments'] as int? ?? 1,
        status: json['status'] as String? ?? 'active',
        loanType: json['loan_type'] as String? ?? 'lent',
        paymentFrequency: json['payment_frequency'] as String? ?? 'monthly',
        payed: json['payed'] as bool? ?? false,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'value': value,
        'date': AppFormatters.apiDate(date),
        'horary': '${DateTime.now().hour.toString().padLeft(2, '0')}:'
            '${DateTime.now().minute.toString().padLeft(2, '0')}:00',
        if (dueDate != null) 'due_date': AppFormatters.apiDate(dueDate!),
        'category': category,
        'account': account,
        'benefited': benefited,
        'creditor': creditor,
        'installments': installments,
        'payment_frequency': paymentFrequency,
        'loan_type': loanType,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
