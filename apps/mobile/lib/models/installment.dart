import '../utils/formatters.dart';

/// One installment of a loan / payable / receivable
/// (`<resource>/<id>/installments/`). `settled` maps to `payed` (loans,
/// payables) or `received` (receivables).
class Installment {
  final int id;
  final int number;
  final double value;
  final DateTime? dueDate;
  final bool settled;

  const Installment({
    required this.id,
    required this.number,
    required this.value,
    required this.settled,
    this.dueDate,
  });

  factory Installment.fromJson(Map<String, dynamic> json) => Installment(
        id: json['id'] as int,
        number: json['installment_number'] as int? ?? 0,
        value: AppFormatters.toDouble(json['value']),
        dueDate: AppFormatters.parseApiDate(json['due_date'] as String?),
        settled: (json['payed'] ?? json['received'] ?? false) as bool,
      );
}
