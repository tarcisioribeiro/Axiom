import 'package:flutter/material.dart';

import '../utils/choice_labels.dart';

/// Seletor de mês (‹ Julho 2026 ›) compartilhado por orçamentos e
/// planejamento mensal.
class MonthNav extends StatelessWidget {
  final int month;
  final int year;
  final void Function(int month, int year) onChanged;

  const MonthNav({
    super.key,
    required this.month,
    required this.year,
    required this.onChanged,
  });

  void _shift(int delta) {
    final d = DateTime(year, month + delta);
    onChanged(d.month, d.year);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          tooltip: 'Mês anterior',
          onPressed: () => _shift(-1),
          icon: const Icon(Icons.chevron_left),
        ),
        Text(
          '${ChoiceLabels.monthNames[month - 1]} $year',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        IconButton(
          tooltip: 'Próximo mês',
          onPressed: () => _shift(1),
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    );
  }
}
