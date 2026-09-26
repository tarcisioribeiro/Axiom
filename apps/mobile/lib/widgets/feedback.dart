import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../services/base_service.dart';
import '../theme/app_spacing.dart';
import '../theme/app_theme_variant.dart';
import 'motion.dart';

/// User-facing text for an exception — never the raw `toString()`.
String describeError(Object error) {
  if (error is ApiException) return error.message;
  if (error is DioException) {
    return switch (error.type) {
      DioExceptionType.connectionError ||
      DioExceptionType.connectionTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.sendTimeout =>
        'Não foi possível conectar ao servidor. Verifique sua conexão.',
      _ => 'Erro inesperado ao comunicar com o servidor.',
    };
  }
  return 'Algo deu errado. Tente novamente.';
}

/// Failed-load placeholder with a retry action — the mobile counterpart of
/// the web's global query-error toast + `ErrorBoundary`.
class ErrorState extends StatelessWidget {
  final Object error;
  final VoidCallback? onRetry;

  const ErrorState({super.key, required this.error, this.onRetry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = theme.colorScheme.error;
    return Center(
      child: FadeIn(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_rounded, size: 40, color: color),
              SizedBox(height: AppSpacing.smd),
              Text(
                'Não foi possível carregar',
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              SizedBox(height: AppSpacing.xs),
              Text(
                describeError(error),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              if (onRetry != null) ...[
                SizedBox(height: AppSpacing.md),
                OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Tentar novamente'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

enum ToastKind { success, error, info }

/// Single entry point for mutation feedback (mirrors `use-toast.ts`):
/// semantic color + icon, floating, replaces whatever toast is showing.
void showAppToast(
  BuildContext context,
  String message, {
  ToastKind kind = ToastKind.success,
}) {
  final scheme = Theme.of(context).colorScheme;
  final semantic = context.semanticColors;
  final (color, icon) = switch (kind) {
    ToastKind.success => (semantic.success, Icons.check_circle_rounded),
    ToastKind.error => (scheme.error, Icons.error_rounded),
    ToastKind.info => (semantic.info, Icons.info_rounded),
  };
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        backgroundColor: scheme.inverseSurface,
        content: Row(
          children: [
            Icon(icon, color: color, size: 20),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: scheme.onInverseSurface),
              ),
            ),
          ],
        ),
      ),
    );
}

/// Error toast for a caught exception.
void showErrorToast(BuildContext context, Object error) =>
    showAppToast(context, describeError(error), kind: ToastKind.error);
