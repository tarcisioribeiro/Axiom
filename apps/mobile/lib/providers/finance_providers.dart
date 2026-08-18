import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/account.dart';
import '../models/credit_card.dart';
import '../models/credit_card_bill.dart';
import '../models/credit_card_installment.dart';
import '../models/dashboard_stats.dart';
import '../models/expense.dart';
import '../models/revenue.dart';
import '../models/transfer.dart';
import '../services/accounts_service.dart';
import '../services/credit_card_bills_service.dart';
import '../services/credit_card_purchases_service.dart';
import '../services/credit_cards_service.dart';
import '../services/dashboard_service.dart';
import '../services/expenses_service.dart';
import '../services/revenues_service.dart';
import '../services/transfers_service.dart';
import 'core_providers.dart';

final accountsServiceProvider =
    Provider((ref) => AccountsService(ref.watch(apiClientProvider)));
final expensesServiceProvider =
    Provider((ref) => ExpensesService(ref.watch(apiClientProvider)));
final revenuesServiceProvider =
    Provider((ref) => RevenuesService(ref.watch(apiClientProvider)));
final creditCardsServiceProvider =
    Provider((ref) => CreditCardsService(ref.watch(apiClientProvider)));
final creditCardBillsServiceProvider =
    Provider((ref) => CreditCardBillsService(ref.watch(apiClientProvider)));
final creditCardPurchasesServiceProvider = Provider(
  (ref) => CreditCardPurchasesService(ref.watch(apiClientProvider)),
);
final transfersServiceProvider =
    Provider((ref) => TransfersService(ref.watch(apiClientProvider)));
final dashboardServiceProvider =
    Provider((ref) => DashboardService(ref.watch(apiClientProvider)));

/// List providers — `FutureProvider.autoDispose` fetches once per branch
/// lifetime (see `router/app_router.dart`: `StatefulShellRoute.indexedStack`
/// keeps each tab's widget tree, and therefore these providers, alive while
/// switching tabs) and is invalidated explicitly after mutations, mirroring
/// `queryClient.invalidateQueries` on the web app.
final accountsProvider = FutureProvider.autoDispose<List<Account>>(
  (ref) => ref.watch(accountsServiceProvider).getAll(),
);

final expensesProvider = FutureProvider.autoDispose<List<Expense>>(
  (ref) => ref.watch(expensesServiceProvider).getAll(),
);

final revenuesProvider = FutureProvider.autoDispose<List<Revenue>>(
  (ref) => ref.watch(revenuesServiceProvider).getAll(),
);

final creditCardsProvider = FutureProvider.autoDispose<List<CreditCard>>(
  (ref) => ref.watch(creditCardsServiceProvider).getAll(),
);

final creditCardBillsProvider =
    FutureProvider.autoDispose.family<List<CreditCardBill>, int>(
  (ref, cardId) =>
      ref.watch(creditCardBillsServiceProvider).getAll(query: {'card': cardId}),
);

final transfersProvider = FutureProvider.autoDispose<List<Transfer>>(
  (ref) => ref.watch(transfersServiceProvider).getAll(),
);

final creditCardByIdProvider =
    FutureProvider.autoDispose.family<CreditCard, int>(
  (ref, id) => ref.watch(creditCardsServiceProvider).getById(id),
);

final creditCardBillByIdProvider =
    FutureProvider.autoDispose.family<CreditCardBill, int>(
  (ref, id) => ref.watch(creditCardBillsServiceProvider).getById(id),
);

final creditCardBillItemsProvider =
    FutureProvider.autoDispose.family<List<CreditCardInstallment>, int>(
  (ref, billId) => ref.watch(creditCardBillsServiceProvider).items(billId),
);

final dashboardStatsProvider = FutureProvider.autoDispose<DashboardStats>(
  (ref) => ref.watch(dashboardServiceProvider).stats(),
);

final financialAlertsProvider =
    FutureProvider.autoDispose<List<FinancialAlert>>(
  (ref) => ref.watch(dashboardServiceProvider).financialAlerts(),
);

final healthScoreProvider = FutureProvider.autoDispose<HealthScore>(
  (ref) => ref.watch(dashboardServiceProvider).healthScore(),
);

final cashFlowForecastProvider = FutureProvider.autoDispose<CashFlowForecast>(
  (ref) => ref.watch(dashboardServiceProvider).cashFlowForecast(),
);
