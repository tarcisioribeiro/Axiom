import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/account.dart';
import '../models/credit_card.dart';
import '../models/credit_card_bill.dart';
import '../models/credit_card_installment.dart';
import '../models/dashboard_stats.dart';
import '../models/expense.dart';
import '../models/financial_goal.dart';
import '../models/loan.dart';
import '../models/member.dart';
import '../models/payable.dart';
import '../models/receivable.dart';
import '../models/revenue.dart';
import '../models/transfer.dart';
import '../models/vault.dart';
import '../services/accounts_service.dart';
import '../services/credit_card_bills_service.dart';
import '../services/credit_card_purchases_service.dart';
import '../services/credit_cards_service.dart';
import '../services/dashboard_service.dart';
import '../services/expenses_service.dart';
import '../services/financial_goals_service.dart';
import '../services/loans_service.dart';
import '../services/members_service.dart';
import '../services/payables_service.dart';
import '../services/receivables_service.dart';
import '../services/revenues_service.dart';
import '../services/transfers_service.dart';
import '../services/vaults_service.dart';
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
final payablesServiceProvider =
    Provider((ref) => PayablesService(ref.watch(apiClientProvider)));
final receivablesServiceProvider =
    Provider((ref) => ReceivablesService(ref.watch(apiClientProvider)));
final loansServiceProvider =
    Provider((ref) => LoansService(ref.watch(apiClientProvider)));
final membersServiceProvider =
    Provider((ref) => MembersService(ref.watch(apiClientProvider)));
final vaultsServiceProvider =
    Provider((ref) => VaultsService(ref.watch(apiClientProvider)));
final financialGoalsServiceProvider =
    Provider((ref) => FinancialGoalsService(ref.watch(apiClientProvider)));
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

/// Every bill across every card — used by the financial calendar to plot
/// due dates. The per-card [creditCardBillsProvider] stays for the card
/// detail screen.
final allCreditCardBillsProvider =
    FutureProvider.autoDispose<List<CreditCardBill>>(
  (ref) => ref.watch(creditCardBillsServiceProvider).getAll(),
);

final transfersProvider = FutureProvider.autoDispose<List<Transfer>>(
  (ref) => ref.watch(transfersServiceProvider).getAll(),
);

final payablesProvider = FutureProvider.autoDispose<List<Payable>>(
  (ref) => ref.watch(payablesServiceProvider).getAll(),
);

final receivablesProvider = FutureProvider.autoDispose<List<Receivable>>(
  (ref) => ref.watch(receivablesServiceProvider).getAll(),
);

final loansProvider = FutureProvider.autoDispose<List<Loan>>(
  (ref) => ref.watch(loansServiceProvider).getAll(),
);

final membersProvider = FutureProvider.autoDispose<List<Member>>(
  (ref) => ref.watch(membersServiceProvider).getAll(),
);

final currentMemberProvider = FutureProvider.autoDispose<Member?>(
  (ref) => ref.watch(membersServiceProvider).me(),
);

final vaultsProvider = FutureProvider.autoDispose<List<Vault>>(
  (ref) => ref.watch(vaultsServiceProvider).getAll(),
);

final vaultTransactionsProvider =
    FutureProvider.autoDispose.family<List<VaultTransaction>, int>(
  (ref, vaultId) => ref.watch(vaultsServiceProvider).transactions(vaultId),
);

final financialGoalsProvider = FutureProvider.autoDispose<List<FinancialGoal>>(
  (ref) => ref.watch(financialGoalsServiceProvider).getAll(),
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
