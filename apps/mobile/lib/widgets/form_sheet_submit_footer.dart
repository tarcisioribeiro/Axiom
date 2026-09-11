import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

/// The error message + submit button footer repeated at the bottom of every
/// create/edit bottom-sheet form (`*_form_sheet.dart`) — pulls the
/// loading/error/submit chrome into one place instead of ~20 near-identical
/// copies, one per resource.
class FormSheetSubmitFooter extends StatelessWidget {
  final String? error;
  final bool isSaving;
  final VoidCallback? onSubmit;
  final String label;

  const FormSheetSubmitFooter({
    super.key,
    required this.error,
    required this.isSaving,
    required this.onSubmit,
    this.label = 'Salvar',
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (error != null) ...[
          SizedBox(height: AppSpacing.sm),
          Text(error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        SizedBox(height: AppSpacing.md),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: isSaving ? null : onSubmit,
            child: isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(label),
          ),
        ),
      ],
    );
  }
}
