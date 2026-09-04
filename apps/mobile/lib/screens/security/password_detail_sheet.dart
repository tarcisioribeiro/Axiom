import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/password_entry.dart';
import '../../providers/security_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/confirm.dart';
import 'password_form_sheet.dart';

const _autoHideSeconds = 30;

void showPasswordDetailSheet(BuildContext context, PasswordEntry entry) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _PasswordDetailSheet(entry: entry),
  );
}

class _PasswordDetailSheet extends ConsumerStatefulWidget {
  final PasswordEntry entry;

  const _PasswordDetailSheet({required this.entry});

  @override
  ConsumerState<_PasswordDetailSheet> createState() =>
      _PasswordDetailSheetState();
}

class _PasswordDetailSheetState extends ConsumerState<_PasswordDetailSheet> {
  PasswordReveal? _revealed;
  int _secondsLeft = 0;
  Timer? _timer;
  bool _isRevealing = false;
  String? _error;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    _secondsLeft = _autoHideSeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _secondsLeft -= 1);
      if (_secondsLeft <= 0) {
        timer.cancel();
        setState(() => _revealed = null);
      }
    });
  }

  Future<void> _reveal() async {
    setState(() {
      _isRevealing = true;
      _error = null;
    });
    try {
      final revealed =
          await ref.read(passwordsServiceProvider).reveal(widget.entry.id);
      setState(() => _revealed = revealed);
      _startCountdown();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isRevealing = false);
    }
  }

  Future<void> _copy() async {
    try {
      final revealed =
          await ref.read(passwordsServiceProvider).copy(widget.entry.id);
      await Clipboard.setData(ClipboardData(text: revealed.password));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Senha copiada.')));
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _toggleFavorite() async {
    try {
      await ref.read(passwordsServiceProvider).toggleFavorite(widget.entry.id);
      ref.invalidate(passwordsProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _delete() async {
    final confirmed = await confirmDelete(
      context,
      title: 'Excluir senha',
      message: 'Excluir "${widget.entry.title}" do cofre? '
          'Essa ação não pode ser desfeita.',
    );
    if (!confirmed) return;
    try {
      await ref.read(passwordsServiceProvider).delete(widget.entry.id);
      ref.invalidate(passwordsProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: AppSpacing.md + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(entry.title, style: theme.textTheme.titleLarge),
                ),
                IconButton(
                  icon: Icon(
                    entry.isFavorite
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    color: entry.isFavorite ? Colors.amber : null,
                  ),
                  onPressed: _toggleFavorite,
                ),
              ],
            ),
            Text(
              ChoiceLabels.of(ChoiceLabels.passwordCategories, entry.category),
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            SizedBox(height: AppSpacing.md),
            if (entry.site != null)
              _DetailRow(label: 'Site', value: entry.site!),
            if (entry.username != null)
              _DetailRow(label: 'Usuário', value: entry.username!),
            SizedBox(height: AppSpacing.sm),
            if (_revealed != null)
              Container(
                padding: const EdgeInsets.all(AppSpacing.smd),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.08),
                  borderRadius: AppRadius.mdRadius,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: SelectableText(
                        _revealed!.password,
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontFamily: 'monospace'),
                      ),
                    ),
                    Text(
                      '${_secondsLeft}s',
                      style: theme.textTheme.labelSmall,
                    ),
                  ],
                ),
              )
            else
              OutlinedButton.icon(
                onPressed: _isRevealing ? null : _reveal,
                icon: _isRevealing
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.visibility_outlined, size: 18),
                label: const Text('Revelar senha'),
              ),
            SizedBox(height: AppSpacing.sm),
            if (_revealed?.totpEnabled == true && _revealed?.totpCode != null)
              Text(
                'TOTP: ${_revealed!.totpCode} (${_revealed!.totpSecondsRemaining ?? '-'}s)',
                style: theme.textTheme.bodyMedium,
              ),
            if (entry.notes != null) ...[
              SizedBox(height: AppSpacing.sm),
              _DetailRow(label: 'Notas', value: entry.notes!),
            ],
            if (_error != null) ...[
              SizedBox(height: AppSpacing.sm),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
            SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                FilledButton.icon(
                  onPressed: _copy,
                  icon: const Icon(Icons.copy_outlined, size: 18),
                  label: const Text('Copiar'),
                ),
                OutlinedButton.icon(
                  onPressed: () async {
                    Navigator.of(context).pop();
                    await showPasswordFormSheet(context, existing: entry);
                  },
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Editar'),
                ),
                OutlinedButton.icon(
                  onPressed: _delete,
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: const Text('Excluir'),
                ),
              ],
            ),
            SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          SizedBox(
            width: 70,
            child: Text(
              label,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
