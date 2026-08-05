import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/password_entry.dart';
import '../../providers/security_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/choice_labels.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/logout_button.dart';
import '../../widgets/page_header.dart';
import 'password_detail_sheet.dart';
import 'password_form_sheet.dart';

class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(vaultStatusProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppPageHeader(
                title: 'Segurança',
                icon: Icons.shield_outlined,
                color: Theme.of(context).colorScheme.primary,
                trailing: const LogoutButton(),
              ),
              SizedBox(height: AppSpacing.md),
              Expanded(
                child: statusAsync.when(
                  loading: () => const LoadingState(),
                  error: (error, stackTrace) =>
                      Center(child: Text('Erro: $error')),
                  data: (status) {
                    if (!status.isConfigured) return const _VaultSetupForm();
                    if (!status.isUnlocked) return const _VaultUnlockForm();
                    return const _PasswordsList();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VaultSetupForm extends ConsumerStatefulWidget {
  const _VaultSetupForm();

  @override
  ConsumerState<_VaultSetupForm> createState() => _VaultSetupFormState();
}

class _VaultSetupFormState extends ConsumerState<_VaultSetupForm> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_passwordController.text != _confirmController.text) {
      setState(() => _error = 'As senhas não coincidem.');
      return;
    }
    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      await ref.read(vaultServiceProvider).setup(_passwordController.text);
      ref.invalidate(vaultStatusProvider);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline_rounded,
                    size: 40, color: Theme.of(context).colorScheme.primary),
                SizedBox(height: AppSpacing.sm),
                Text(
                  'Configure o cofre de senhas',
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: AppSpacing.xs),
                Text(
                  'Defina uma senha mestra para proteger suas senhas guardadas.',
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Senha mestra'),
                  validator: (v) => (v == null || v.length < 8)
                      ? 'Mínimo de 8 caracteres'
                      : null,
                ),
                SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _confirmController,
                  obscureText: true,
                  decoration:
                      const InputDecoration(labelText: 'Confirme a senha'),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Confirme a senha' : null,
                ),
                if (_error != null) ...[
                  SizedBox(height: AppSpacing.sm),
                  Text(
                    _error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isSaving ? null : _submit,
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Configurar cofre'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VaultUnlockForm extends ConsumerStatefulWidget {
  const _VaultUnlockForm();

  @override
  ConsumerState<_VaultUnlockForm> createState() => _VaultUnlockFormState();
}

class _VaultUnlockFormState extends ConsumerState<_VaultUnlockForm> {
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_passwordController.text.isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref.read(vaultServiceProvider).unlock(_passwordController.text);
      ref.invalidate(vaultStatusProvider);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_person_outlined,
                size: 40, color: Theme.of(context).colorScheme.primary),
            SizedBox(height: AppSpacing.sm),
            Text(
              'Cofre bloqueado',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            SizedBox(height: AppSpacing.md),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Senha mestra'),
              onSubmitted: (_) => _submit(),
            ),
            if (_error != null) ...[
              SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Desbloquear'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PasswordsList extends ConsumerStatefulWidget {
  const _PasswordsList();

  @override
  ConsumerState<_PasswordsList> createState() => _PasswordsListState();
}

class _PasswordsListState extends ConsumerState<_PasswordsList> {
  final _searchController = TextEditingController();
  bool _favoritesOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final passwordsAsync = ref.watch(passwordsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showPasswordFormSheet(context),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(passwordsProvider);
          await ref.read(passwordsProvider.future);
        },
        child: passwordsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => Center(child: Text('Erro: $error')),
          data: (all) {
            final query = _searchController.text.trim().toLowerCase();
            final entries = all.where((e) {
              if (_favoritesOnly && !e.isFavorite) return false;
              if (query.isEmpty) return true;
              return e.title.toLowerCase().contains(query) ||
                  (e.site?.toLowerCase().contains(query) ?? false);
            }).toList();

            return ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          isDense: true,
                          hintText: 'Buscar senhas...',
                          prefixIcon: Icon(Icons.search_rounded, size: 20),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        _favoritesOnly
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        color: _favoritesOnly ? Colors.amber : null,
                      ),
                      onPressed: () =>
                          setState(() => _favoritesOnly = !_favoritesOnly),
                    ),
                  ],
                ),
                SizedBox(height: AppSpacing.sm),
                if (entries.isEmpty)
                  const EmptyState(
                    icon: Icons.key_outlined,
                    title: 'Nenhuma senha encontrada',
                  )
                else
                  ...entries.map(
                    (entry) => _PasswordTile(
                      entry: entry,
                      onTap: () => showPasswordDetailSheet(context, entry),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _PasswordTile extends StatelessWidget {
  final PasswordEntry entry;
  final VoidCallback onTap;

  const _PasswordTile({required this.entry, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: AppRadius.mdRadius,
      onTap: onTap,
      child: Container(
        margin: EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: AppRadius.mdRadius,
          border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor:
                  theme.colorScheme.primary.withValues(alpha: 0.12),
              child: Text(
                entry.title.isNotEmpty ? entry.title[0].toUpperCase() : '?',
                style: TextStyle(color: theme.colorScheme.primary),
              ),
            ),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.title, style: theme.textTheme.titleSmall),
                  Text(
                    '${ChoiceLabels.of(ChoiceLabels.passwordCategories, entry.category)}'
                    '${entry.username != null ? ' · ${entry.username}' : ''}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            if (entry.isFavorite)
              const Icon(Icons.star_rounded, color: Colors.amber, size: 18),
          ],
        ),
      ),
    );
  }
}
