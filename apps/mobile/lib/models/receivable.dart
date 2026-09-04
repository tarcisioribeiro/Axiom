import '../utils/formatters.dart';

/// Mirrors `ReceivableSerializer` (`apps/api/receivables/serializers.py`) —
/// the revenue-side twin of [Payable]. Money owed to the user that isn't a
/// loan (fees, reimbursements). Recording receipt via the `receive/` action
/// credits the chosen account and creates the revenue.
class Receivable {
  final int id;
  final String uuid;
  final String description;
  final double value;
  final double receivedValue;
  final double remainingValue;
  final DateTime date;
  final DateTime? dueDate;
  final String category;
  final String status;
  final String? statusDisplay;
  final int? member;
  final String? memberName;
  final String? notes;

  const Receivable({
    required this.id,
    required this.uuid,
    required this.description,
    required this.value,
    required this.receivedValue,
    required this.remainingValue,
    required this.date,
    required this.category,
    required this.status,
    this.dueDate,
    this.statusDisplay,
    this.member,
    this.memberName,
    this.notes,
  });

  double get progress => value <= 0 ? 0 : (receivedValue / value).clamp(0, 1);

  factory Receivable.fromJson(Map<String, dynamic> json) => Receivable(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        value: AppFormatters.toDouble(json['value']),
        receivedValue: AppFormatters.toDouble(json['received_value']),
        remainingValue: AppFormatters.toDouble(json['remaining_value']),
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        dueDate: AppFormatters.parseApiDate(json['due_date'] as String?),
        category: json['category'] as String? ?? 'income',
        status: json['status'] as String? ?? 'active',
        statusDisplay: json['status_display'] as String?,
        member: json['member'] as int?,
        memberName: json['member_name'] as String?,
        notes: json['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'description': description,
        'value': value,
        'date': AppFormatters.apiDate(date),
        if (dueDate != null) 'due_date': AppFormatters.apiDate(dueDate!),
        'category': category,
        if (member != null) 'member': member,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
