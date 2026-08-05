import '../utils/formatters.dart';

/// Mirrors `CreditCardSerializer` (`apps/api/credit_cards/serializers.py`).
/// `cardNumber`/`securityCode` are write-only (plaintext in, encrypted
/// server-side); `cardNumberMasked` is what reads expose instead.
class CreditCard {
  final int id;
  final String uuid;
  final String name;
  final String onCardName;
  final String flag;
  final DateTime? validationDate;
  final double creditLimit;
  final double maxLimit;
  final int associatedAccount;
  final String? associatedAccountName;
  final String? cardNumberMasked;
  final double usedCredit;
  final double availableCredit;
  final bool isActive;
  final int closingDay;
  final int dueDay;
  final double? interestRate;
  final double? annualFee;
  final int? owner;
  final String? notes;

  const CreditCard({
    required this.id,
    required this.uuid,
    required this.name,
    required this.onCardName,
    required this.flag,
    required this.creditLimit,
    required this.maxLimit,
    required this.associatedAccount,
    required this.usedCredit,
    required this.availableCredit,
    required this.isActive,
    required this.closingDay,
    required this.dueDay,
    this.validationDate,
    this.associatedAccountName,
    this.cardNumberMasked,
    this.interestRate,
    this.annualFee,
    this.owner,
    this.notes,
  });

  double get usagePct =>
      creditLimit <= 0 ? 0 : (usedCredit / creditLimit).clamp(0, 1);

  factory CreditCard.fromJson(Map<String, dynamic> json) => CreditCard(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        onCardName: json['on_card_name'] as String? ?? '',
        flag: json['flag'] as String? ?? '',
        validationDate:
            AppFormatters.parseApiDate(json['validation_date'] as String?),
        creditLimit: AppFormatters.toDouble(json['credit_limit']),
        maxLimit: AppFormatters.toDouble(json['max_limit']),
        associatedAccount: json['associated_account'] as int,
        associatedAccountName: json['associated_account_name'] as String?,
        cardNumberMasked: json['card_number_masked'] as String?,
        usedCredit: AppFormatters.toDouble(json['used_credit']),
        availableCredit: AppFormatters.toDouble(json['available_credit']),
        isActive: json['is_active'] as bool? ?? true,
        closingDay: json['closing_day'] as int? ?? 1,
        dueDay: json['due_day'] as int? ?? 10,
        interestRate: json['interest_rate'] == null
            ? null
            : AppFormatters.toDouble(json['interest_rate']),
        annualFee: json['annual_fee'] == null
            ? null
            : AppFormatters.toDouble(json['annual_fee']),
        owner: json['owner'] as int?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson({String? cardNumber, String? securityCode}) => {
        'name': name,
        'on_card_name': onCardName,
        'flag': flag,
        if (validationDate != null)
          'validation_date': AppFormatters.apiDate(validationDate!),
        if (cardNumber != null) 'card_number': cardNumber,
        if (securityCode != null) 'security_code': securityCode,
        'credit_limit': creditLimit,
        'max_limit': maxLimit,
        'associated_account': associatedAccount,
        'is_active': isActive,
        'closing_day': closingDay,
        'due_day': dueDay,
        if (interestRate != null) 'interest_rate': interestRate,
        if (annualFee != null) 'annual_fee': annualFee,
        if (owner != null) 'owner': owner,
        if (notes != null) 'notes': notes,
      };
}
