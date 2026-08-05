import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/password_entry.dart';
import '../models/vault_status.dart';
import '../services/passwords_service.dart';
import '../services/vault_service.dart';
import 'core_providers.dart';

final vaultServiceProvider =
    Provider((ref) => VaultService(ref.watch(apiClientProvider)));
final passwordsServiceProvider =
    Provider((ref) => PasswordsService(ref.watch(apiClientProvider)));

final vaultStatusProvider = FutureProvider.autoDispose<VaultStatus>(
  (ref) => ref.watch(vaultServiceProvider).status(),
);

/// Only fetched once the vault is confirmed unlocked (see
/// `SecurityScreen`) — attempting this while locked would 423.
final passwordsProvider = FutureProvider.autoDispose<List<PasswordEntry>>(
  (ref) => ref.watch(passwordsServiceProvider).getAll(),
);
