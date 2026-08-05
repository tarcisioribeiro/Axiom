import '../utils/formatters.dart';

/// Mirrors the subset of `TransferSerializer`
/// (`apps/api/transfers/serializers.py`) the mobile quick-entry form needs.
class Transfer {
  final int id;
  final String uuid;
  final String description;
  final double value;
  final DateTime date;
  final String category;
  final int originAccount;
  final String? originAccountName;
  final int destinyAccount;
  final String? destinyAccountName;
  final bool transfered;
  final String status;
  final String? notes;

  const Transfer({
    required this.id,
    required this.uuid,
    required this.description,
    required this.value,
    required this.date,
    required this.category,
    required this.originAccount,
    required this.destinyAccount,
    required this.transfered,
    required this.status,
    this.originAccountName,
    this.destinyAccountName,
    this.notes,
  });

  factory Transfer.fromJson(Map<String, dynamic> json) => Transfer(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        value: AppFormatters.toDouble(json['value']),
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        category: json['category'] as String? ?? '',
        originAccount: json['origin_account'] as int,
        originAccountName: json['origin_account_name'] as String?,
        destinyAccount: json['destiny_account'] as int,
        destinyAccountName: json['destiny_account_name'] as String?,
        transfered: json['transfered'] as bool? ?? false,
        status: json['status'] as String? ?? 'pending',
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'value': value,
        'date': AppFormatters.apiDate(date),
        'horary': '${DateTime.now().hour.toString().padLeft(2, '0')}:'
            '${DateTime.now().minute.toString().padLeft(2, '0')}:00',
        'category': category,
        'origin_account': originAccount,
        'destiny_account': destinyAccount,
        'transfered': transfered,
        if (notes != null) 'notes': notes,
      };
}
