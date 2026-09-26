import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/password_entry.dart';
import '../../providers/security_providers.dart';
import '../../services/base_service.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../utils/choice_labels.dart';
import '../../utils/formatters.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/app_card.dart';
import '../../widgets/caps_lock_warning.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/feedback.dart';
import '../../widgets/header_actions.dart';
import '../../widgets/loading_state.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';
import 'password_detail_sheet.dart';
import 'password_form_sheet.dart';
import 'stored_account_list.dart';
import 'stored_card_list.dart';

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
                color: context.palette.studies,
                trailing: const TabHeaderActions(),
              ),
              SizedBox(height: AppSpacing.md),
              Expanded(
                child: AsyncSwitcher(
                    child: statusAsync.when(
                  loading: () => const LoadingState(),
                  error: (error, stackTrace) => ErrorState(
                      error: error,
                      onRetry: () => ref.invalidate(vaultStatusProvider)),
                  data: (status) {
                    if (!status.isConfigured) return const _VaultSetupForm();
                    if (!status.isUnlocked) return const _VaultUnlockForm();
                    return const _VaultTabs();
                  },
                )),
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
                const CapsLockWarning(),
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
            const CapsLockWarning(),
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

/// Unlocked-vault content: three tabs over the vault's credential types
/// (senhas / cartões / contas), mirroring the web vault's section switcher.
class _VaultTabs extends StatelessWidget {
  const _VaultTabs();

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: TabBar(
                  tabs: [
                    Tab(text: 'Senhas'),
                    Tab(text: 'Cartões'),
                    Tab(text: 'Contas'),
                  ],
                ),
              ),
              Builder(
                builder: (context) => IconButton(
                  tooltip: 'Buscar no cofre',
                  icon: const Icon(Icons.manage_search_rounded),
                  onPressed: () => _showVaultSearch(context),
                ),
              ),
              IconButton(
                tooltip: 'Atividade recente',
                icon: const Icon(Icons.history_rounded),
                onPressed: () => _showActivity(context),
              ),
            ],
          ),
          const Expanded(
            child: TabBarView(
              children: [
                _PasswordsList(),
                StoredCardList(),
                StoredAccountList(),
              ],
            ),
          ),
        ],
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
        child: AsyncSwitcher(
            child: passwordsAsync.when(
          loading: () => const LoadingState(variant: LoadingVariant.list),
          error: (error, stackTrace) => ErrorState(
              error: error, onRetry: () => ref.invalidate(passwordsProvider)),
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
                      tooltip: _favoritesOnly
                          ? 'Mostrar todos'
                          : 'Mostrar apenas favoritos',
                      icon: Icon(
                        _favoritesOnly
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        color: _favoritesOnly ? context.palette.star : null,
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
        )),
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
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.smd),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
            child: Text(
              entry.title.isNotEmpty ? entry.title[0].toUpperCase() : '?',
              style: TextStyle(color: theme.colorScheme.primary),
            ),
          ),
          SizedBox(width: AppSpacing.smd),
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
          _StrengthBadge(score: entry.strengthScore),
          if (entry.isFavorite) ...[
            SizedBox(width: AppSpacing.xs),
            Icon(Icons.star_rounded, color: context.palette.star, size: 18),
          ],
        ],
      ),
    );
  }
}

/// Web password-strength label/colour for `strength_score` (0–4).
class _StrengthBadge extends StatelessWidget {
  final int score;

  const _StrengthBadge({required this.score});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final semantic = context.semanticColors;
    final (label, color) = switch (score) {
      >= 4 => ('Forte', semantic.success),
      3 => ('Boa', scheme.primary),
      2 => ('Razoável', semantic.warning),
      1 => ('Fraca', scheme.error),
      _ => ('Muito fraca', scheme.error),
    };
    return AppBadge(label: label, color: color, icon: Icons.shield_outlined);
  }
}

/// Global vault search over senhas, cartões e contas (web security hub).
void _showVaultSearch(BuildContext context) {
  final tabs = DefaultTabController.of(context);
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _VaultSearchSheet(
      onOpenTab: (i) => tabs.animateTo(i),
      onOpenPassword: (p) => showPasswordDetailSheet(context, p),
    ),
  );
}

class _VaultSearchSheet extends ConsumerStatefulWidget {
  final ValueChanged<int> onOpenTab;
  final ValueChanged<PasswordEntry> onOpenPassword;

  const _VaultSearchSheet({
    required this.onOpenTab,
    required this.onOpenPassword,
  });

  @override
  ConsumerState<_VaultSearchSheet> createState() => _VaultSearchSheetState();
}

class _VaultSearchSheetState extends ConsumerState<_VaultSearchSheet> {
  String _query = '';

  bool _hit(String? v) => v?.toLowerCase().contains(_query) ?? false;

  @override
  Widget build(BuildContext context) {
    final passwords = ref.watch(passwordsProvider).valueOrNull ?? const [];
    final cards = ref.watch(storedCardsProvider).valueOrNull ?? const [];
    final accounts = ref.watch(storedAccountsProvider).valueOrNull ?? const [];
    final q = _query;
    final results = q.isEmpty
        ? const <Widget>[]
        : [
            for (final p in passwords)
              if (_hit(p.title) || _hit(p.site) || _hit(p.username))
                ListTile(
                  leading: const Icon(Icons.key_outlined),
                  title: Text(p.title),
                  subtitle: Text(p.username ?? p.site ?? 'Senha'),
                  onTap: () {
                    Navigator.of(context).pop();
                    widget.onOpenPassword(p);
                  },
                ),
            for (final c in cards)
              if (_hit(c.name) || _hit(c.cardholderName))
                ListTile(
                  leading: const Icon(Icons.credit_card_outlined),
                  title: Text(c.name),
                  subtitle: Text(c.cardNumberMasked ?? 'Cartão'),
                  onTap: () {
                    Navigator.of(context).pop();
                    widget.onOpenTab(1);
                  },
                ),
            for (final a in accounts)
              if (_hit(a.name) || _hit(a.institutionName))
                ListTile(
                  leading: const Icon(Icons.account_balance_outlined),
                  title: Text(a.name),
                  subtitle: Text(a.institutionName),
                  onTap: () {
                    Navigator.of(context).pop();
                    widget.onOpenTab(2);
                  },
                ),
          ];
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                autofocus: true,
                onChanged: (v) =>
                    setState(() => _query = v.trim().toLowerCase()),
                decoration: const InputDecoration(
                  hintText: 'Buscar senhas, cartões e contas...',
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                ),
              ),
              SizedBox(height: AppSpacing.sm),
              Flexible(
                child: q.isNotEmpty && results.isEmpty
                    ? const EmptyState(
                        icon: Icons.search_off_rounded,
                        title: 'Nada encontrado',
                      )
                    : ListView(shrinkWrap: true, children: results),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Web security hub "Atividade recente".
void _showActivity(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => Consumer(
      builder: (context, ref, _) {
        final async = ref.watch(activityLogsProvider);
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.7,
            ),
            child: AsyncSwitcher(
                child: async.when(
              loading: () => const LoadingState(variant: LoadingVariant.list),
              error: (e, _) => ErrorState(
                error: e,
                onRetry: () => ref.invalidate(activityLogsProvider),
              ),
              data: (logs) => logs.isEmpty
                  ? const EmptyState(
                      icon: Icons.history_rounded,
                      title: 'Nenhuma atividade registrada',
                    )
                  : ListView(
                      shrinkWrap: true,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md),
                          child: Text('Atividade recente',
                              style: Theme.of(context).textTheme.titleMedium),
                        ),
                        for (final l in logs)
                          ListTile(
                            dense: true,
                            leading: const Icon(Icons.history_rounded),
                            title: Text(l.description.isEmpty
                                ? l.action
                                : l.description),
                            subtitle: Text([
                              l.action,
                              if (l.at != null) AppFormatters.dateTime(l.at!),
                            ].join(' · ')),
                          ),
                      ],
                    ),
            )),
          ),
        );
      },
    ),
  );
}
