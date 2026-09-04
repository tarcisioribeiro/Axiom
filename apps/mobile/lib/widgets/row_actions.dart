import 'dart:async';

import 'package:flutter/material.dart';

import 'confirm.dart';

/// Compact overflow menu (⋮) for list-row actions. Replaces the pair of
/// bare 18px `IconButton`s that every list screen hand-rolled — those put a
/// safe action (edit) and an irreversible one (delete) side by side at equal
/// weight, in a touch target barely wide enough for one thumb.
///
/// The menu gives each action a full-width row with a label, keeps the
/// destructive one visually distinct (`error` colour), and always routes
/// deletion through [confirmDelete].
class RowActionsMenu extends StatelessWidget {
  final VoidCallback? onEdit;
  final FutureOr<void> Function()? onDelete;
  final String deleteConfirmTitle;
  final String? deleteConfirmMessage;

  const RowActionsMenu({
    super.key,
    this.onEdit,
    this.onDelete,
    this.deleteConfirmTitle = 'Excluir',
    this.deleteConfirmMessage,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return PopupMenuButton<int>(
      tooltip: 'Mais ações',
      icon: const Icon(Icons.more_vert_rounded),
      onSelected: (value) async {
        if (value == 0) {
          onEdit?.call();
        } else if (value == 1 && onDelete != null) {
          final ok = await confirmDelete(
            context,
            title: deleteConfirmTitle,
            message: deleteConfirmMessage,
          );
          if (ok) await onDelete!();
        }
      },
      itemBuilder: (context) => [
        if (onEdit != null)
          const PopupMenuItem(
            value: 0,
            child: ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.edit_outlined),
              title: Text('Editar'),
            ),
          ),
        if (onDelete != null)
          PopupMenuItem(
            value: 1,
            child: ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.delete_outline, color: scheme.error),
              title: Text('Excluir', style: TextStyle(color: scheme.error)),
            ),
          ),
      ],
    );
  }
}
