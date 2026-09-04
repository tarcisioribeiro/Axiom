import '../utils/formatters.dart';

/// Mirrors the subset of `VaultSerializer` (`apps/api/vaults/serializers.py`)
/// the mobile screen needs. A cofre is a reserve tied to a bank account with
/// an optional annual yield rate. Yield mechanics (Revenue upsert, balance
/// reconciliation) live entirely server-side — see the `vault-yield-model`
/// design note.
class Vault {
  final int id;
  final String uuid;
  final String description;
  final int account;
  final String? accountName;
  final double currentBalance;
  final double accumulatedYield;
  final double annualYieldRate;
  final double annualYieldRatePercentage;
  final double pendingYield;
  final double totalDeposits;
  final double totalWithdrawals;
  final DateTime? lastYieldDate;
  final bool isActive;
  final String? notes;

  const Vault({
    required this.id,
    required this.uuid,
    required this.description,
    required this.account,
    required this.currentBalance,
    required this.accumulatedYield,
    required this.annualYieldRate,
    required this.annualYieldRatePercentage,
    required this.pendingYield,
    required this.totalDeposits,
    required this.totalWithdrawals,
    required this.isActive,
    this.accountName,
    this.lastYieldDate,
    this.notes,
  });

  double get principal => currentBalance - accumulatedYield;

  factory Vault.fromJson(Map<String, dynamic> json) => Vault(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        account: json['account'] as int,
        accountName: json['account_name'] as String?,
        currentBalance: AppFormatters.toDouble(json['current_balance']),
        accumulatedYield: AppFormatters.toDouble(json['accumulated_yield']),
        annualYieldRate: AppFormatters.toDouble(json['annual_yield_rate']),
        annualYieldRatePercentage:
            AppFormatters.toDouble(json['annual_yield_rate_percentage']),
        pendingYield: AppFormatters.toDouble(json['pending_yield']),
        totalDeposits: AppFormatters.toDouble(json['total_deposits']),
        totalWithdrawals: AppFormatters.toDouble(json['total_withdrawals']),
        lastYieldDate:
            AppFormatters.parseApiDate(json['last_yield_date'] as String?),
        isActive: json['is_active'] as bool? ?? true,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'account': account,
        'annual_yield_rate': annualYieldRate,
        'is_active': isActive,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}

/// Mirrors `VaultTransactionSerializer` — one deposit / withdrawal / yield
/// movement inside a cofre.
class VaultTransaction {
  final int id;
  final String transactionType;
  final String? transactionTypeDisplay;
  final double amount;
  final double balanceAfter;
  final String? description;
  final DateTime? transactionDate;

  const VaultTransaction({
    required this.id,
    required this.transactionType,
    required this.amount,
    required this.balanceAfter,
    this.transactionTypeDisplay,
    this.description,
    this.transactionDate,
  });

  factory VaultTransaction.fromJson(Map<String, dynamic> json) =>
      VaultTransaction(
        id: json['id'] as int,
        transactionType: json['transaction_type'] as String? ?? '',
        transactionTypeDisplay: json['transaction_type_display'] as String?,
        amount: AppFormatters.toDouble(json['amount']),
        balanceAfter: AppFormatters.toDouble(json['balance_after']),
        description: json['description'] as String?,
        transactionDate: AppFormatters.parseApiDate(
          (json['transaction_date'] as String?)?.split('T').first,
        ),
      );
}
