/// Mirrors `StoredBankAccountSerializer` (`apps/api/security/
/// serializers.py`) — bank-account credentials kept in the vault. The full
/// account number and passwords are only returned by `reveal/` / `copy/`.
class StoredAccount {
  final int id;
  final String uuid;
  final String name;
  final String institutionName;
  final String? institutionCode;
  final String accountType;
  final String? accountTypeDisplay;
  final String? accountNumberMasked;
  final String? agency;
  final String? notes;
  final bool isFavorite;

  const StoredAccount({
    required this.id,
    required this.uuid,
    required this.name,
    required this.institutionName,
    required this.accountType,
    required this.isFavorite,
    this.institutionCode,
    this.accountTypeDisplay,
    this.accountNumberMasked,
    this.agency,
    this.notes,
  });

  factory StoredAccount.fromJson(Map<String, dynamic> json) => StoredAccount(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        institutionName: json['institution_name'] as String? ?? '',
        institutionCode: json['institution_code'] as String?,
        accountType: json['account_type'] as String? ?? 'CC',
        accountTypeDisplay: json['account_type_display'] as String?,
        accountNumberMasked: json['account_number_masked'] as String?,
        agency: json['agency'] as String?,
        notes: json['notes'] as String?,
        isFavorite: json['is_favorite'] as bool? ?? false,
      );

  Map<String, dynamic> toJson({
    String? accountNumber,
    String? password,
    String? digitalPassword,
  }) =>
      {
        'name': name,
        'institution_name': institutionName,
        if (institutionCode != null) 'institution_code': institutionCode,
        'account_type': accountType,
        if (accountNumber != null) 'account_number': accountNumber,
        if (agency != null) 'agency': agency,
        if (password != null && password.isNotEmpty) 'password': password,
        if (digitalPassword != null && digitalPassword.isNotEmpty)
          'digital_password': digitalPassword,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
        'is_favorite': isFavorite,
      };
}

/// Response of `stored-accounts/<id>/reveal/` and `.../copy/`.
class StoredAccountReveal {
  final String accountNumber;
  final String? agency;
  final String? password;
  final String? digitalPassword;

  const StoredAccountReveal({
    required this.accountNumber,
    this.agency,
    this.password,
    this.digitalPassword,
  });

  factory StoredAccountReveal.fromJson(Map<String, dynamic> json) =>
      StoredAccountReveal(
        accountNumber: json['account_number'] as String? ?? '',
        agency: json['agency'] as String?,
        password: json['password'] as String?,
        digitalPassword: json['digital_password'] as String?,
      );
}
