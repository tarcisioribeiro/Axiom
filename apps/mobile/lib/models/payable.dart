import '../utils/formatters.dart';

/// Mirrors the subset of `PayableSerializer` (`apps/api/payables/
/// serializers.py`) the mobile screen needs. A payable tracks money the
/// user owes that isn't a loan (dentist bill, car repair). Recording a
/// payment does NOT create an expense on its own — that only happens via
/// the `pay/` action, which debits the chosen account.
class Payable {
  final int id;
  final String uuid;
  final String description;
  final double value;
  final double paidValue;
  final double remainingValue;
  final DateTime date;
  final DateTime? dueDate;
  final String category;
  final String status;
  final String? statusDisplay;
  final int? member;
  final String? memberName;
  final int installments;
  final String? notes;

  const Payable({
    required this.id,
    required this.uuid,
    required this.description,
    required this.value,
    required this.paidValue,
    required this.remainingValue,
    required this.date,
    required this.category,
    required this.status,
    this.installments = 1,
    this.dueDate,
    this.statusDisplay,
    this.member,
    this.memberName,
    this.notes,
  });

  double get progress => value <= 0 ? 0 : (paidValue / value).clamp(0, 1);

  factory Payable.fromJson(Map<String, dynamic> json) => Payable(
        id: json['id'] as int,
        uuid: json['uuid'] as String? ?? '',
        description: json['description'] as String? ?? '',
        value: AppFormatters.toDouble(json['value']),
        paidValue: AppFormatters.toDouble(json['paid_value']),
        remainingValue: AppFormatters.toDouble(json['remaining_value']),
        date: AppFormatters.parseApiDate(json['date'] as String?) ??
            DateTime.now(),
        dueDate: AppFormatters.parseApiDate(json['due_date'] as String?),
        category: json['category'] as String? ?? 'others',
        status: json['status'] as String? ?? 'active',
        statusDisplay: json['status_display'] as String?,
        member: json['member'] as int?,
        memberName: json['member_name'] as String?,
        installments: json['installments'] as int? ?? 1,
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
