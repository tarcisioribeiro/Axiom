import 'package:flutter/material.dart';

/// Shared confirmation dialog for destructive actions. Every "excluir" path
/// in the app routes through this so the wording, button order and the
/// `error`-coloured confirm button stay identical — and so no delete is one
/// stray tap away from happening, which several list screens used to allow.
///
/// Returns `true` only when the user explicitly confirms.
Future<bool> confirmDelete(
  BuildContext context, {
  required String title,
  String? message,
  String confirmLabel = 'Excluir',
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) {
      final scheme = Theme.of(context).colorScheme;
      return AlertDialog(
        title: Text(title),
        content: Text(message ?? 'Essa ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: scheme.error,
              foregroundColor: scheme.onError,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text(confirmLabel),
          ),
        ],
      );
    },
  );
  return result ?? false;
}
