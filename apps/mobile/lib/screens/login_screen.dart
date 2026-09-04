import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/api_environment.dart';
import '../providers/core_providers.dart';
import '../theme/app_spacing.dart';
import '../theme/theme_picker_sheet.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _twoFactorCodeController = TextEditingController();
  final _devUrlController = TextEditingController();

  bool _isSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  String? _pendingTempToken;

  @override
  void initState() {
    super.initState();
    _devUrlController.text = ref.read(environmentControllerProvider).devBaseUrl;
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _twoFactorCodeController.dispose();
    _devUrlController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final authService = ref.read(authServiceProvider);
    final result = _pendingTempToken == null
        ? await authService.login(
            username: _usernameController.text.trim(),
            password: _passwordController.text,
          )
        : await authService.verifyTwoFactor(
            tempToken: _pendingTempToken!,
            code: _twoFactorCodeController.text.trim(),
          );

    if (!mounted) return;

    if (result.isTwoFactor) {
      setState(() {
        _pendingTempToken = result.tempToken;
        _isSubmitting = false;
      });
      return;
    }

    if (!result.isSuccess) {
      setState(() {
        _errorMessage = result.errorMessage;
        _isSubmitting = false;
      });
      return;
    }

    final confirmed = await authService.fetchCurrentUser();
    if (!mounted) return;

    setState(() => _isSubmitting = false);

    if (confirmed) {
      ref.read(sessionControllerProvider).markAuthenticated();
      if (!mounted) return;
      context.go('/finance');
      return;
    }

    _showStatusSnackBar(
      'Login aceito, mas não foi possível confirmar a sessão.',
      icon: Icons.warning_rounded,
      color: ref.read(themeControllerProvider).activeVariant.warning,
    );
  }

  void _showStatusSnackBar(
    String message, {
    required IconData icon,
    required Color color,
  }) {
    final onColor = ref.read(themeControllerProvider).activeVariant.onPrimary;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: color,
          elevation: 4,
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          duration: const Duration(seconds: 3),
          content: Row(
            children: [
              Icon(icon, color: onColor),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: TextStyle(
                    color: onColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
  }

  void _showEnvironmentSheet(ApiEnvironmentController environmentController) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _EnvironmentSheet(
        controller: environmentController,
        devUrlController: _devUrlController,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeController = ref.watch(themeControllerProvider);
    final environmentController = ref.watch(environmentControllerProvider);

    // Side effect (not just a rebuild): whenever the selected environment
    // changes, point the shared ApiClient at its base URL.
    ref.listen(environmentControllerProvider, (previous, next) {
      ref.read(apiClientProvider).updateBaseUrl(next.current.baseUrl);
    });

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            tooltip: 'Ambiente da API',
            icon: const Icon(Icons.dns_outlined),
            onPressed: () => _showEnvironmentSheet(environmentController),
          ),
          IconButton(
            tooltip: 'Selecionar tema',
            icon: Icon(
              themeController.isDark
                  ? Icons.light_mode_outlined
                  : Icons.dark_mode_outlined,
            ),
            onPressed: () => showThemePickerSheet(context, themeController),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset(
                      themeController.isDark
                          ? 'assets/images/logo-dark.png'
                          : 'assets/images/logo-light.png',
                      height: 96,
                      semanticLabel: 'Axiom',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      environmentController.current.label,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    if (_pendingTempToken == null) ...[
                      TextFormField(
                        controller: _usernameController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Usuário ou e-mail',
                        ),
                        enabled: !_isSubmitting,
                        validator: (value) => (value == null || value.isEmpty)
                            ? 'Informe o usuário ou e-mail'
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        decoration: InputDecoration(
                          labelText: 'Senha',
                          suffixIcon: IconButton(
                            tooltip: _obscurePassword
                                ? 'Mostrar senha'
                                : 'Ocultar senha',
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: _isSubmitting
                                ? null
                                : () => setState(
                                      () =>
                                          _obscurePassword = !_obscurePassword,
                                    ),
                          ),
                        ),
                        enabled: !_isSubmitting,
                        validator: (value) => (value == null || value.isEmpty)
                            ? 'Informe a senha'
                            : null,
                      ),
                    ] else ...[
                      Text(
                        'Digite o código de dois fatores gerado pelo seu app autenticador.',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _twoFactorCodeController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Código 2FA'),
                        enabled: !_isSubmitting,
                        validator: (value) => (value == null || value.isEmpty)
                            ? 'Informe o código'
                            : null,
                      ),
                    ],
                    if (_errorMessage != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        _errorMessage!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _isSubmitting ? null : _handleSubmit,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(_pendingTempToken == null
                                ? 'Entrar'
                                : 'Verificar'),
                      ),
                    ),
                    if (_pendingTempToken != null)
                      TextButton(
                        onPressed: _isSubmitting
                            ? null
                            : () => setState(() {
                                  _pendingTempToken = null;
                                  _twoFactorCodeController.clear();
                                  _errorMessage = null;
                                }),
                        child: const Text('Voltar'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EnvironmentSheet extends StatelessWidget {
  final ApiEnvironmentController controller;
  final TextEditingController devUrlController;

  const _EnvironmentSheet({
    required this.controller,
    required this.devUrlController,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ambiente da API',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                RadioListTile<ApiEnvironmentType>(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Desenvolvimento (Docker local)'),
                  value: ApiEnvironmentType.development,
                  groupValue: controller.type,
                  onChanged: (value) => controller.setType(value!),
                ),
                if (controller.type == ApiEnvironmentType.development)
                  Padding(
                    padding: const EdgeInsets.only(left: 16, bottom: 8),
                    child: TextField(
                      controller: devUrlController,
                      decoration: InputDecoration(
                        labelText: 'URL da API local',
                        hintText: 'http://$kDevMachineLanIPv4:39100',
                      ),
                      onSubmitted: controller.setDevBaseUrl,
                      onEditingComplete: () => controller
                          .setDevBaseUrl(devUrlController.text.trim()),
                    ),
                  ),
                RadioListTile<ApiEnvironmentType>(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Produção (VPS)'),
                  subtitle: Text(kProductionBaseUrl),
                  value: ApiEnvironmentType.production,
                  groupValue: controller.type,
                  onChanged: (value) => controller.setType(value!),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
