import '../utils/formatters.dart';

/// Mirrors `PasswordSerializer` (`apps/api/security/passwords/
/// serializers.py`) — the plaintext password is never in this payload,
/// only `reveal/`/`copy/` return it (see [PasswordReveal]).
class PasswordEntry {
  final int id;
  final String uuid;
  final String title;
  final String? site;
  final String? username;
  final String category;
  final String? notes;
  final bool isFavorite;
  final int strengthScore;
  final DateTime? lastPasswordChange;

  const PasswordEntry({
    required this.id,
    required this.uuid,
    required this.title,
    required this.category,
    required this.isFavorite,
    required this.strengthScore,
    this.site,
    this.username,
    this.notes,
    this.lastPasswordChange,
  });

  factory PasswordEntry.fromJson(Map<String, dynamic> json) => PasswordEntry(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        title: json['title'] as String? ?? '',
        site: json['site'] as String?,
        username: json['username'] as String?,
        category: json['category'] as String? ?? 'other',
        notes: json['notes'] as String?,
        isFavorite: json['is_favorite'] as bool? ?? false,
        strengthScore: json['strength_score'] as int? ?? 0,
        lastPasswordChange: AppFormatters.parseApiDate(
          (json['last_password_change'] as String?)?.split('T').first,
        ),
      );

  Map<String, dynamic> toJson({String? password}) => {
        'title': title,
        if (site != null) 'site': site,
        if (username != null) 'username': username,
        if (password != null) 'password': password,
        'category': category,
        if (notes != null) 'notes': notes,
        'is_favorite': isFavorite,
      };
}

/// Response of `passwords/<id>/reveal/` and `.../copy/` — only returned
/// while the vault is unlocked.
class PasswordReveal {
  final String password;
  final bool totpEnabled;
  final String? totpCode;
  final int? totpSecondsRemaining;

  const PasswordReveal({
    required this.password,
    required this.totpEnabled,
    this.totpCode,
    this.totpSecondsRemaining,
  });

  factory PasswordReveal.fromJson(Map<String, dynamic> json) => PasswordReveal(
        password: json['password'] as String? ?? '',
        totpEnabled: json['totp_enabled'] as bool? ?? false,
        totpCode: json['totp_code'] as String?,
        totpSecondsRemaining: json['totp_seconds_remaining'] as int?,
      );
}
