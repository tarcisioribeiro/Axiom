import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/password_entry.dart';
import '../models/stored_account.dart';
import '../models/stored_card.dart';
import '../models/vault_status.dart';
import '../services/passwords_service.dart';
import '../services/stored_accounts_service.dart';
import '../services/stored_cards_service.dart';
import '../services/vault_service.dart';
import 'core_providers.dart';

final vaultServiceProvider =
    Provider((ref) => VaultService(ref.watch(apiClientProvider)));
final passwordsServiceProvider =
    Provider((ref) => PasswordsService(ref.watch(apiClientProvider)));
final storedCardsServiceProvider =
    Provider((ref) => StoredCardsService(ref.watch(apiClientProvider)));
final storedAccountsServiceProvider =
    Provider((ref) => StoredAccountsService(ref.watch(apiClientProvider)));

final vaultStatusProvider = FutureProvider.autoDispose<VaultStatus>(
  (ref) => ref.watch(vaultServiceProvider).status(),
);

/// The `security/*` list providers are only fetched once the vault is
/// confirmed unlocked (see `SecurityScreen`) — hitting them while locked
/// would 423.
final passwordsProvider = FutureProvider.autoDispose<List<PasswordEntry>>(
  (ref) => ref.watch(passwordsServiceProvider).getAll(),
);

final storedCardsProvider = FutureProvider.autoDispose<List<StoredCard>>(
  (ref) => ref.watch(storedCardsServiceProvider).getAll(),
);

final storedAccountsProvider = FutureProvider.autoDispose<List<StoredAccount>>(
  (ref) => ref.watch(storedAccountsServiceProvider).getAll(),
);

/// Latest vault activity (first page of `security/activity-logs/`).
final activityLogsProvider = FutureProvider.autoDispose<
    List<({String action, String description, DateTime? at})>>((ref) async {
  final response = await ref
      .watch(apiClientProvider)
      .dio
      .get<Map<String, dynamic>>('/api/v1/security/activity-logs/');
  final results = response.data?['results'] as List<dynamic>? ?? const [];
  return [
    for (final e in results.cast<Map<String, dynamic>>().take(30))
      (
        action: e['action_display'] as String? ?? e['action'] as String? ?? '',
        description: e['description'] as String? ?? '',
        at: DateTime.tryParse(e['created_at'] as String? ?? '')?.toLocal(),
      ),
  ];
});
