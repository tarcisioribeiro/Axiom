import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/core_providers.dart';
import '../theme/app_spacing.dart';

/// Shows "Caps Lock está ativado" while Caps Lock is on. Only physical
/// keyboards report lock modes, so this stays hidden on soft keyboards.
class CapsLockWarning extends ConsumerStatefulWidget {
  const CapsLockWarning({super.key});

  @override
  ConsumerState<CapsLockWarning> createState() => _CapsLockWarningState();
}

class _CapsLockWarningState extends ConsumerState<CapsLockWarning> {
  bool _capsLockOn = _isCapsLockEnabled();

  static bool _isCapsLockEnabled() => HardwareKeyboard.instance.lockModesEnabled
      .contains(KeyboardLockMode.capsLock);

  bool _onHardwareKey(KeyEvent event) {
    final capsLockOn = _isCapsLockEnabled();
    if (capsLockOn != _capsLockOn && mounted) {
      setState(() => _capsLockOn = capsLockOn);
    }
    return false;
  }

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_onHardwareKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onHardwareKey);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_capsLockOn) return const SizedBox.shrink();
    final color = ref.watch(themeControllerProvider).activeVariant.warning;
    return Padding(
      padding: EdgeInsets.only(top: AppSpacing.xs),
      child: Row(
        children: [
          Icon(Icons.warning_rounded, size: 16, color: color),
          SizedBox(width: AppSpacing.xs),
          Text(
            'Caps Lock está ativado',
            style: TextStyle(color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
