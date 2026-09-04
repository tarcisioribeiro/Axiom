import 'package:flutter/material.dart';

import '../models/installment.dart';
import '../theme/app_spacing.dart';
import '../theme/app_theme_variant.dart';
import '../utils/formatters.dart';
import 'loading_state.dart';

/// Read-only installment table for a loan / payable / receivable. The
/// recalculation / renegotiation preview tools stay on the web app.
void showInstallmentsSheet(
  BuildContext context, {
  required String title,
  required Future<List<Installment>> Function() load,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _InstallmentsSheet(title: title, load: load),
  );
}

class _InstallmentsSheet extends StatefulWidget {
  final String title;
  final Future<List<Installment>> Function() load;

  const _InstallmentsSheet({required this.title, required this.load});

  @override
  State<_InstallmentsSheet> createState() => _InstallmentsSheetState();
}

class _InstallmentsSheetState extends State<_InstallmentsSheet> {
  late Future<List<Installment>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.load();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title, style: theme.textTheme.titleMedium),
            SizedBox(height: AppSpacing.sm),
            FutureBuilder<List<Installment>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const LoadingState(
                      variant: LoadingVariant.list, itemCount: 3);
                }
                if (snap.hasError) {
                  return Text('Erro: ${snap.error}',
                      style: TextStyle(color: theme.colorScheme.error));
                }
                final items = snap.data ?? const <Installment>[];
                if (items.isEmpty) {
                  return const Text('Nenhuma parcela gerada.');
                }
                return Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final inst = items[i];
                      return ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          inst.settled
                              ? Icons.check_circle
                              : Icons.circle_outlined,
                          color: inst.settled
                              ? context.semanticColors.success
                              : theme.colorScheme.onSurfaceVariant,
                          size: 20,
                        ),
                        title: Text('Parcela ${inst.number}'),
                        subtitle: inst.dueDate == null
                            ? null
                            : Text(
                                'vence ${AppFormatters.date(inst.dueDate!)}'),
                        trailing: Text(
                          AppFormatters.currency(inst.value),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            decoration: inst.settled
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
            SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}
