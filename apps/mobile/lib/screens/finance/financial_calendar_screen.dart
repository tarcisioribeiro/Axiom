import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/finance_providers.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_card.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/page_header.dart';

/// Calendário financeiro — plots due dates (contas a pagar/receber,
/// empréstimos, faturas de cartão) on a month grid. Pure client-side
/// aggregation, mirroring the web's `FinancialCalendar` page (which has no
/// dedicated backend endpoint either).
class FinancialCalendarScreen extends ConsumerStatefulWidget {
  const FinancialCalendarScreen({super.key});

  @override
  ConsumerState<FinancialCalendarScreen> createState() =>
      _FinancialCalendarScreenState();
}

enum _EventKind { payable, receivable, loan, bill }

class _CalendarEvent {
  final DateTime date;
  final _EventKind kind;
  final String label;
  final double amount;

  const _CalendarEvent({
    required this.date,
    required this.kind,
    required this.label,
    required this.amount,
  });

  Color color(BuildContext context) {
    final c = context.semanticColors;
    switch (kind) {
      case _EventKind.payable:
        return Theme.of(context).colorScheme.error;
      case _EventKind.receivable:
        return c.success;
      case _EventKind.loan:
        return c.warning;
      case _EventKind.bill:
        return c.info;
    }
  }

  String get kindLabel {
    switch (kind) {
      case _EventKind.payable:
        return 'A pagar';
      case _EventKind.receivable:
        return 'A receber';
      case _EventKind.loan:
        return 'Empréstimo';
      case _EventKind.bill:
        return 'Fatura';
    }
  }
}

class _FinancialCalendarScreenState
    extends ConsumerState<FinancialCalendarScreen> {
  late DateTime _visibleMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month);
  }

  void _shiftMonth(int delta) {
    setState(() => _visibleMonth =
        DateTime(_visibleMonth.year, _visibleMonth.month + delta));
  }

  List<_CalendarEvent> _collectEvents() {
    final events = <_CalendarEvent>[];

    for (final p in ref.watch(payablesProvider).valueOrNull ?? const []) {
      if (p.dueDate != null && p.remainingValue > 0) {
        events.add(_CalendarEvent(
          date: p.dueDate!,
          kind: _EventKind.payable,
          label: p.description,
          amount: p.remainingValue,
        ));
      }
    }
    for (final r in ref.watch(receivablesProvider).valueOrNull ?? const []) {
      if (r.dueDate != null && r.remainingValue > 0) {
        events.add(_CalendarEvent(
          date: r.dueDate!,
          kind: _EventKind.receivable,
          label: r.description,
          amount: r.remainingValue,
        ));
      }
    }
    for (final l in ref.watch(loansProvider).valueOrNull ?? const []) {
      if (l.dueDate != null && l.remainingBalance > 0) {
        events.add(_CalendarEvent(
          date: l.dueDate!,
          kind: _EventKind.loan,
          label: l.description,
          amount: l.remainingBalance,
        ));
      }
    }
    for (final b
        in ref.watch(allCreditCardBillsProvider).valueOrNull ?? const []) {
      if (b.dueDate != null && b.status != 'paid' && b.totalAmount > 0) {
        events.add(_CalendarEvent(
          date: b.dueDate!,
          kind: _EventKind.bill,
          label: 'Fatura ${b.creditCardOnCardName ?? ''}'.trim(),
          amount: b.totalAmount,
        ));
      }
    }
    return events;
  }

  @override
  Widget build(BuildContext context) {
    final payables = ref.watch(payablesProvider);
    final receivables = ref.watch(receivablesProvider);
    final loans = ref.watch(loansProvider);
    final bills = ref.watch(allCreditCardBillsProvider);

    final loading = payables.isLoading ||
        receivables.isLoading ||
        loans.isLoading ||
        bills.isLoading;

    final events = _collectEvents();
    final byDay = <int, List<_CalendarEvent>>{};
    for (final e in events) {
      if (e.date.year == _visibleMonth.year &&
          e.date.month == _visibleMonth.month) {
        byDay.putIfAbsent(e.date.day, () => []).add(e);
      }
    }

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(payablesProvider);
            ref.invalidate(receivablesProvider);
            ref.invalidate(loansProvider);
            ref.invalidate(allCreditCardBillsProvider);
            await ref.read(payablesProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppPageHeader(
                title: 'Calendário financeiro',
                icon: Icons.event_note_rounded,
                color: context.semanticColors.info,
              ),
              SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    onPressed: () => _shiftMonth(-1),
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                  Text(
                    _monthLabel(_visibleMonth),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  IconButton(
                    onPressed: () => _shiftMonth(1),
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
              SizedBox(height: AppSpacing.sm),
              if (loading)
                const LoadingState(variant: LoadingVariant.list, itemCount: 2)
              else ...[
                _MonthGrid(
                  month: _visibleMonth,
                  eventsByDay: byDay,
                  onDayTap: (day) => _showDay(context, day, byDay[day] ?? []),
                ),
                SizedBox(height: AppSpacing.md),
                _Legend(),
                SizedBox(height: AppSpacing.md),
                ..._upcoming(events),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _upcoming(List<_CalendarEvent> events) {
    final today = DateTime.now();
    final soon = events
        .where((e) =>
            !e.date.isBefore(DateTime(today.year, today.month, today.day)))
        .toList()
      ..sort((a, b) => a.date.compareTo(b.date));
    if (soon.isEmpty) {
      return [
        Text('Nada previsto.', style: Theme.of(context).textTheme.bodySmall),
      ];
    }
    return [
      Text('Próximos vencimentos',
          style: Theme.of(context).textTheme.titleSmall),
      SizedBox(height: AppSpacing.sm),
      ...soon.take(8).map((e) => _EventRow(event: e)),
    ];
  }

  void _showDay(BuildContext context, int day, List<_CalendarEvent> dayEvents) {
    if (dayEvents.isEmpty) return;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${day.toString().padLeft(2, '0')}/'
                '${_visibleMonth.month.toString().padLeft(2, '0')}/'
                '${_visibleMonth.year}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              SizedBox(height: AppSpacing.sm),
              ...dayEvents.map((e) => _EventRow(event: e)),
            ],
          ),
        ),
      ),
    );
  }

  static String _monthLabel(DateTime d) {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return '${months[d.month - 1]} ${d.year}';
  }
}

class _MonthGrid extends StatelessWidget {
  final DateTime month;
  final Map<int, List<_CalendarEvent>> eventsByDay;
  final void Function(int day) onDayTap;

  const _MonthGrid({
    required this.month,
    required this.eventsByDay,
    required this.onDayTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // Dart weekday: Mon=1..Sun=7. Grid starts on Monday.
    final leadingBlanks = DateTime(month.year, month.month, 1).weekday - 1;
    final cells = <Widget>[];

    for (final label in const ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']) {
      cells.add(Center(
        child: Text(label,
            style: theme.textTheme.labelSmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      ));
    }
    for (var i = 0; i < leadingBlanks; i++) {
      cells.add(const SizedBox.shrink());
    }
    final today = DateTime.now();
    for (var day = 1; day <= daysInMonth; day++) {
      final dayEvents = eventsByDay[day] ?? const [];
      final isToday = today.year == month.year &&
          today.month == month.month &&
          today.day == day;
      cells.add(
        InkWell(
          borderRadius: AppRadius.smRadius,
          onTap: dayEvents.isEmpty ? null : () => onDayTap(day),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: AppRadius.smRadius,
              color: isToday
                  ? theme.colorScheme.primary.withValues(alpha: 0.12)
                  : null,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('$day', style: theme.textTheme.bodySmall),
                SizedBox(height: 2),
                Wrap(
                  spacing: 2,
                  children: dayEvents
                      .take(4)
                      .map((e) => Container(
                            width: 5,
                            height: 5,
                            decoration: BoxDecoration(
                              color: e.color(context),
                              shape: BoxShape.circle,
                            ),
                          ))
                      .toList(),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: GridView.count(
        crossAxisCount: 7,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 0.85,
        children: cells,
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    Widget dot(Color c, String label) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: c, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
            Text(label, style: Theme.of(context).textTheme.labelSmall),
          ],
        );
    final c = context.semanticColors;
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: [
        dot(Theme.of(context).colorScheme.error, 'A pagar'),
        dot(c.success, 'A receber'),
        dot(c.warning, 'Empréstimo'),
        dot(c.info, 'Fatura'),
      ],
    );
  }
}

class _EventRow extends StatelessWidget {
  final _CalendarEvent event;

  const _EventRow({required this.event});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
                color: event.color(context), shape: BoxShape.circle),
          ),
          SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              '${AppFormatters.date(event.date)} · ${event.kindLabel} · ${event.label}',
              style: theme.textTheme.bodySmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(width: AppSpacing.sm),
          Text(AppFormatters.currency(event.amount),
              style: theme.textTheme.bodySmall
                  ?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
