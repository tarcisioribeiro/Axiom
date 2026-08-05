/// Mirrors `security/vault/status/` — whether the current user has ever set
/// up a vault master password, and whether it's currently unlocked (the key
/// is cached server-side in Redis for a limited time after unlock).
class VaultStatus {
  final bool isConfigured;
  final bool isUnlocked;

  const VaultStatus({required this.isConfigured, required this.isUnlocked});

  factory VaultStatus.fromJson(Map<String, dynamic> json) => VaultStatus(
        isConfigured: json['is_configured'] as bool? ?? false,
        isUnlocked: json['is_unlocked'] as bool? ?? false,
      );
}
