import '../utils/formatters.dart';

/// Mirrors the subset of `RevenueSerializer`
/// (`apps/api/revenues/serializers.py`) the mobile quick-entry form needs —
/// same simplification rationale as [Expense].
class Revenue {
  final int id;
  final String uuid;
  final String description;
  final double value;
  final DateTime date;
  final String category;
  final int account;
  final String? accountName;
  final bool received;
  final String? source;
  final String? notes;

  const Revenue({
    required this.id,
    required this.uuid,
    required this.description,
    required this.value,
    required this.date,
    required this.category,
    required this.account,
    required this.received,
    this.accountName,
    this.source,
    this.notes,
  });

  factory Revenue.fromJson(Map<String, dynamic> json) => Revenue(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        value: AppFormatters.toDouble(json['value']),
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        category: json['category'] as String? ?? '',
        account: json['account'] as int,
        accountName: json['account_name'] as String?,
        received: json['received'] as bool? ?? false,
        source: json['source'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'value': value,
        'date': AppFormatters.apiDate(date),
        'category': category,
        'account': account,
        'received': received,
        if (source != null) 'source': source,
        if (notes != null) 'notes': notes,
      };
}
