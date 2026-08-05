import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/agents_service.dart';
import 'core_providers.dart';

final agentsServiceProvider =
    Provider((ref) => AgentsService(ref.watch(apiClientProvider)));

final agentStatusProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) => ref.watch(agentsServiceProvider).status(),
);
