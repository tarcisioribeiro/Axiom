import '../utils/formatters.dart';

/// Mirrors `AccountSerializer` (`apps/api/accounts/serializers.py`).
/// `accountNumber` is write-only (plaintext in, encrypted server-side);
/// `accountNumberMasked` is what list/detail responses expose instead.
class Account {
  final int id;
  final String uuid;
  final String accountName;
  final String accountType;
  final String institution;
  final String? accountNumberMasked;
  final double balance;
  final double minimumBalance;
  final double overdraftLimit;
  final DateTime? openingDate;
  final String? description;
  final int? owner;
  final bool isActive;

  const Account({
    required this.id,
    required this.uuid,
    required this.accountName,
    required this.accountType,
    required this.institution,
    required this.balance,
    required this.minimumBalance,
    required this.overdraftLimit,
    required this.isActive,
    this.accountNumberMasked,
    this.openingDate,
    this.description,
    this.owner,
  });

  double get availableBalance => balance + overdraftLimit;

  factory Account.fromJson(Map<String, dynamic> json) => Account(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        accountName: json['account_name'] as String? ?? '',
        accountType: json['account_type'] as String? ?? '',
        institution: json['institution'] as String? ?? '',
        accountNumberMasked: json['account_number_masked'] as String?,
        balance: AppFormatters.toDouble(json['balance']),
        minimumBalance: AppFormatters.toDouble(json['minimum_balance']),
        overdraftLimit: AppFormatters.toDouble(json['overdraft_limit']),
        openingDate:
            AppFormatters.parseApiDate(json['opening_date'] as String?),
        description: json['description'] as String?,
        owner: json['owner'] as int?,
        isActive: json['is_active'] as bool? ?? true,
      );

  Map<String, dynamic> toJson({String? accountNumber}) => {
        'account_name': accountName,
        'account_type': accountType,
        'institution': institution,
        if (accountNumber != null) 'account_number': accountNumber,
        'balance': balance,
        'minimum_balance': minimumBalance,
        'overdraft_limit': overdraftLimit,
        if (openingDate != null)
          'opening_date': AppFormatters.apiDate(openingDate!),
        'description': description,
        'owner': owner,
        'is_active': isActive,
      };
}
