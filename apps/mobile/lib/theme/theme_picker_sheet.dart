import 'package:flutter/material.dart';

import 'app_theme_variant.dart';
import 'app_themes.dart';
import 'theme_controller.dart';

/// Bottom sheet listing every theme variant grouped by light/dark mode,
/// mirroring `apps/frontend/src/components/common/ThemeToggle.tsx`.
Future<void> showThemePickerSheet(
  BuildContext context,
  ThemeController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _ThemePickerContent(controller: controller),
  );
}

class _ThemePickerContent extends StatelessWidget {
  final ThemeController controller;

  const _ThemePickerContent({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.75,
            ),
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                _SectionLabel('Modo Claro'),
                ...kLightVariants.map(
                  (variant) => _VariantTile(
                    variant: variant,
                    isActive: !controller.isDark &&
                        controller.lightVariantId == variant.id,
                    onTap: () => controller.selectLightVariant(variant.id),
                  ),
                ),
                const Divider(height: 24),
                _SectionLabel('Modo Escuro'),
                ...kDarkVariants.map(
                  (variant) => _VariantTile(
                    variant: variant,
                    isActive: controller.isDark &&
                        controller.darkVariantId == variant.id,
                    onTap: () => controller.selectDarkVariant(variant.id),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;

  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 4),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _VariantTile extends StatelessWidget {
  final AppThemeVariant variant;
  final bool isActive;
  final VoidCallback onTap;

  const _VariantTile({
    required this.variant,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: Container(
        width: 20,
        height: 20,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: variant.border),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            stops: const [0.5, 0.5],
            colors: [variant.background, variant.primary],
          ),
        ),
      ),
      title: Text(variant.label),
      trailing:
          isActive ? Icon(Icons.check, color: variant.primary, size: 18) : null,
    );
  }
}
