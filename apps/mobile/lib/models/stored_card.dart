/// Mirrors `StoredCreditCardSerializer` (`apps/api/security/serializers.py`)
/// — a card kept in the vault. The full number and CVV are never in this
/// payload; only `reveal/` / `copy/` return them (see [StoredCardReveal]).
class StoredCard {
  final int id;
  final String uuid;
  final String name;
  final String? cardNumberMasked;
  final String? cardholderName;
  final int? expirationMonth;
  final int? expirationYear;
  final String flag;
  final String? flagDisplay;
  final String? notes;
  final bool isFavorite;

  const StoredCard({
    required this.id,
    required this.uuid,
    required this.name,
    required this.flag,
    required this.isFavorite,
    this.cardNumberMasked,
    this.cardholderName,
    this.expirationMonth,
    this.expirationYear,
    this.flagDisplay,
    this.notes,
  });

  String get expiry {
    if (expirationMonth == null || expirationYear == null) return '—';
    final mm = expirationMonth.toString().padLeft(2, '0');
    return '$mm/$expirationYear';
  }

  factory StoredCard.fromJson(Map<String, dynamic> json) => StoredCard(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        cardNumberMasked: json['card_number_masked'] as String?,
        cardholderName: json['cardholder_name'] as String?,
        expirationMonth: json['expiration_month'] as int?,
        expirationYear: json['expiration_year'] as int?,
        flag: json['flag'] as String? ?? 'OTHER',
        flagDisplay: json['flag_display'] as String?,
        notes: json['notes'] as String?,
        isFavorite: json['is_favorite'] as bool? ?? false,
      );

  Map<String, dynamic> toJson({String? cardNumber, String? securityCode}) => {
        'name': name,
        if (cardNumber != null) 'card_number': cardNumber,
        if (securityCode != null) 'security_code': securityCode,
        if (cardholderName != null) 'cardholder_name': cardholderName,
        if (expirationMonth != null) 'expiration_month': expirationMonth,
        if (expirationYear != null) 'expiration_year': expirationYear,
        'flag': flag,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        'is_favorite': isFavorite,
      };
}

/// Response of `stored-cards/<id>/reveal/` and `.../copy/`.
class StoredCardReveal {
  final String cardNumber;
  final String securityCode;

  const StoredCardReveal({
    required this.cardNumber,
    required this.securityCode,
  });

  factory StoredCardReveal.fromJson(Map<String, dynamic> json) =>
      StoredCardReveal(
        cardNumber: json['card_number'] as String? ?? '',
        securityCode: json['security_code'] as String? ?? '',
      );
}
