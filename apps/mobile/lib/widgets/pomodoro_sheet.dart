import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

/// Local-only Pomodoro timer (foco 25' / pausa 5'). Nothing is persisted —
/// it's a focus aid, not tracked work. Lives in a bottom sheet launched from
/// the Tarefas & Metas header.
void showPomodoroSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => const _PomodoroSheet(),
  );
}

class _PomodoroSheet extends StatefulWidget {
  const _PomodoroSheet();

  @override
  State<_PomodoroSheet> createState() => _PomodoroSheetState();
}

class _PomodoroSheetState extends State<_PomodoroSheet> {
  static const _focus = Duration(minutes: 25);
  static const _shortBreak = Duration(minutes: 5);

  bool _isBreak = false;
  bool _running = false;
  late Duration _remaining;
  Timer? _timer;
  int _completedFocus = 0;

  @override
  void initState() {
    super.initState();
    _remaining = _focus;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggle() {
    if (_running) {
      _timer?.cancel();
      setState(() => _running = false);
      return;
    }
    setState(() => _running = true);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_remaining.inSeconds <= 1) {
          _onPhaseEnd();
        } else {
          _remaining -= const Duration(seconds: 1);
        }
      });
    });
  }

  void _onPhaseEnd() {
    _timer?.cancel();
    _running = false;
    if (!_isBreak) _completedFocus++;
    _isBreak = !_isBreak;
    _remaining = _isBreak ? _shortBreak : _focus;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(SnackBar(
      content: Text(_isBreak ? 'Hora da pausa ☕' : 'De volta ao foco 🍅'),
    ));
  }

  void _reset() {
    _timer?.cancel();
    setState(() {
      _running = false;
      _isBreak = false;
      _remaining = _focus;
    });
  }

  String get _label {
    final m = _remaining.inMinutes.toString().padLeft(2, '0');
    final s = (_remaining.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = _isBreak ? _shortBreak : _focus;
    final progress = 1 - (_remaining.inSeconds / total.inSeconds);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_isBreak ? 'Pausa' : 'Foco',
                style: theme.textTheme.titleMedium),
            SizedBox(height: AppSpacing.md),
            SizedBox(
              width: 180,
              height: 180,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 180,
                    height: 180,
                    child: CircularProgressIndicator(
                      value: progress.clamp(0, 1),
                      strokeWidth: 8,
                      backgroundColor:
                          theme.colorScheme.surfaceContainerHighest,
                    ),
                  ),
                  Text(_label, style: theme.textTheme.displaySmall),
                ],
              ),
            ),
            SizedBox(height: AppSpacing.sm),
            Text('$_completedFocus ciclo(s) de foco concluído(s)',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                )),
            SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: _reset,
                  icon: const Icon(Icons.restart_alt_rounded),
                  label: const Text('Reiniciar'),
                ),
                SizedBox(width: AppSpacing.sm),
                FilledButton.icon(
                  onPressed: _toggle,
                  icon: Icon(_running
                      ? Icons.pause_rounded
                      : Icons.play_arrow_rounded),
                  label: Text(_running ? 'Pausar' : 'Iniciar'),
                ),
              ],
            ),
            SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}
