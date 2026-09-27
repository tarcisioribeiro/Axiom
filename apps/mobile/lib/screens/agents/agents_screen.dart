import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/chat_message.dart';
import '../../providers/agents_providers.dart';
import '../../services/agents_service.dart';
import '../../services/base_service.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme_variant.dart';
import '../../widgets/feedback.dart';
import '../../widgets/header_actions.dart';
import '../../widgets/motion.dart';
import '../../widgets/page_header.dart';

const _sessionsPrefsKey = 'axiom_agent_sessions_by_agent';

class _AgentOption {
  final String key;
  final String label;
  final String description;
  final IconData icon;
  final Color Function(AppPaletteTokens) color;
  final List<String> suggestions;

  const _AgentOption({
    required this.key,
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
    required this.suggestions,
  });
}

const _agentOptions = [
  _AgentOption(
    key: 'personal',
    label: 'Pessoal',
    description: 'Rotinas, metas, treino e nutrição',
    icon: Icons.self_improvement_rounded,
    color: _colorHealth,
    suggestions: [
      'Como estão minhas rotinas?',
      'Treinei esta semana?',
      'Qual meu progresso nas metas?',
      'Como está minha alimentação?',
    ],
  ),
  _AgentOption(
    key: 'financial',
    label: 'Financeiro',
    description: 'Gastos, orçamento e previsões',
    icon: Icons.account_balance_wallet_outlined,
    color: _colorFinance,
    suggestions: [
      'Quanto gastei este mês?',
      'Vou estourar o orçamento?',
      'Qual minha previsão de saldo?',
      'Quais foram minhas maiores despesas?',
    ],
  ),
  _AgentOption(
    key: 'security',
    label: 'Segurança',
    description: 'Senhas e boas práticas de segurança',
    icon: Icons.shield_outlined,
    color: _colorStudies,
    suggestions: [
      'Tenho senhas desatualizadas?',
      'Qual foi minha atividade recente no cofre?',
      'Existe algum risco de segurança?',
      'Quantas senhas estão armazenadas?',
    ],
  ),
  _AgentOption(
    key: 'intellect',
    label: 'Intelecto',
    description: 'Leituras, cursos e conhecimento',
    icon: Icons.lightbulb_outline_rounded,
    color: _colorIntellect,
    suggestions: [
      'O que aprendi no último livro?',
      'Qual meu progresso nos cursos?',
      'Quais são minhas habilidades dominadas?',
      'Quanto li este mês?',
    ],
  ),
];

// Same `--category-*` per agent as the web `.agent-card-*` classes.
Color _colorHealth(AppPaletteTokens p) => p.health;
Color _colorFinance(AppPaletteTokens p) => p.finance;
Color _colorStudies(AppPaletteTokens p) => p.studies;
Color _colorIntellect(AppPaletteTokens p) => p.intellect;

class AgentsScreen extends ConsumerStatefulWidget {
  const AgentsScreen({super.key});

  @override
  ConsumerState<AgentsScreen> createState() => _AgentsScreenState();
}

class _AgentsScreenState extends ConsumerState<AgentsScreen> {
  _AgentOption? _selected;

  @override
  Widget build(BuildContext context) {
    final selected = _selected;
    if (selected == null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppPageHeader(
                  title: 'Agente IA',
                  icon: Icons.smart_toy_outlined,
                  color: Theme.of(context).colorScheme.primary,
                  trailing: const TabHeaderActions(),
                ),
                SizedBox(height: AppSpacing.md),
                Text(
                  'Escolha um assistente',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                SizedBox(height: AppSpacing.sm),
                Expanded(
                  child: GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.sm,
                    crossAxisSpacing: AppSpacing.sm,
                    childAspectRatio: 1.6,
                    children: _agentOptions
                        .map((option) => _AgentCard(
                              option: option,
                              onTap: () => setState(() => _selected = option),
                            ))
                        .toList(),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return _ChatScreen(
      option: selected,
      onBack: () => setState(() => _selected = null),
    );
  }
}

class _AgentCard extends StatelessWidget {
  final _AgentOption option;
  final VoidCallback onTap;

  const _AgentCard({required this.option, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = option.color(context.palette);
    return InkWell(
      borderRadius: AppRadius.lgRadius,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.smd),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: AppRadius.lgRadius,
          border: Border.all(color: color, width: 2),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(option.icon, color: color, size: 28),
            SizedBox(width: AppSpacing.sm),
            Flexible(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    option.label,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  SizedBox(height: AppSpacing.xs),
                  Text(
                    option.description,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatScreen extends ConsumerStatefulWidget {
  final _AgentOption option;
  final VoidCallback onBack;

  const _ChatScreen({required this.option, required this.onBack});

  @override
  ConsumerState<_ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<_ChatScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final _messages = <ChatMessage>[];

  String? _sessionId;
  bool _isLoadingHistory = true;
  bool _isStreaming = false;
  String _streamingText = '';
  StreamSubscription<AgentStreamEvent>? _subscription;

  @override
  void initState() {
    super.initState();
    _bootstrapSession();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _bootstrapSession() async {
    try {
      await _loadSession();
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoadingHistory = false);
      showErrorToast(context, e);
    }
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_sessionsPrefsKey);
    final map = raw == null
        ? <String, dynamic>{}
        : jsonDecode(raw) as Map<String, dynamic>;

    var sessionId = map[widget.option.key] as String?;
    final service = ref.read(agentsServiceProvider);
    if (sessionId == null) {
      sessionId = await service.createSession();
      map[widget.option.key] = sessionId;
      await prefs.setString(_sessionsPrefsKey, jsonEncode(map));
    }

    final history = await service.history(sessionId);
    if (!mounted) return;
    setState(() {
      _sessionId = sessionId;
      _messages.addAll(history);
      _isLoadingHistory = false;
    });
  }

  Future<void> _clearHistory() async {
    final sessionId = _sessionId;
    if (sessionId == null) return;
    try {
      await ref.read(agentsServiceProvider).clearHistory(sessionId);
      if (!mounted) return;
      setState(() => _messages.clear());
      showAppToast(context, 'Conversa limpa.');
    } catch (e) {
      if (mounted) showErrorToast(context, e);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send([String? text]) async {
    final query = (text ?? _inputController.text).trim();
    final sessionId = _sessionId;
    if (query.isEmpty || sessionId == null || _isStreaming) return;

    setState(() {
      _messages.add(ChatMessage(role: 'user', content: query));
      _inputController.clear();
      _isStreaming = true;
      _streamingText = '';
    });
    _scrollToBottom();

    final service = ref.read(agentsServiceProvider);
    try {
      _subscription = service
          .streamAsk(
        query: query,
        sessionId: sessionId,
        agentName: widget.option.key,
      )
          .listen(
        (event) {
          if (event.done) {
            setState(() {
              _messages.add(
                ChatMessage(
                  role: 'assistant',
                  content: _streamingText,
                  agentName: widget.option.key,
                ),
              );
              _isStreaming = false;
              _streamingText = '';
            });
            _scrollToBottom();
            return;
          }
          if (event.token != null) {
            setState(() => _streamingText += event.token!);
            _scrollToBottom();
          }
        },
        onError: (error) {
          setState(() {
            _isStreaming = false;
            _messages.add(
              ChatMessage(
                role: 'assistant',
                content: 'Não foi possível obter uma resposta agora.',
              ),
            );
          });
        },
      );
    } on ApiException catch (e) {
      setState(() {
        _isStreaming = false;
        _messages.add(ChatMessage(role: 'assistant', content: e.message));
      });
    }
  }

  void _cancelStreaming() {
    _subscription?.cancel();
    setState(() {
      _isStreaming = false;
      if (_streamingText.isNotEmpty) {
        _messages.add(
          ChatMessage(
              role: 'assistant',
              content: _streamingText,
              agentName: widget.option.key),
        );
      }
      _streamingText = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = widget.option.color(context.palette);
    final unavailable =
        ref.watch(agentStatusProvider).valueOrNull?['available'] == false;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: widget.onBack,
        ),
        title: Row(
          children: [
            Icon(widget.option.icon, color: color, size: 22),
            SizedBox(width: AppSpacing.sm),
            Text(widget.option.label),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Limpar conversa',
            icon: const Icon(Icons.delete_sweep_outlined),
            onPressed: _clearHistory,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (unavailable)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                color: context.semanticColors.warning.withValues(alpha: 0.1),
                child: Text(
                  'O assistente está indisponível no momento.',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: context.semanticColors.warning),
                ),
              ),
            Expanded(
              child: _isLoadingHistory
                  ? const Center(child: CircularProgressIndicator())
                  : _messages.isEmpty && !_isStreaming
                      ? _Suggestions(
                          option: widget.option,
                          color: color,
                          onPick: _send,
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(AppSpacing.md),
                          itemCount: _messages.length + (_isStreaming ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index < _messages.length) {
                              return _MessageBubble(message: _messages[index]);
                            }
                            if (_streamingText.isEmpty) {
                              return const _TypingIndicator();
                            }
                            return _MessageBubble(
                              message: ChatMessage(
                                role: 'assistant',
                                content: _streamingText,
                                agentName: widget.option.key,
                              ),
                            );
                          },
                        ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _inputController,
                        minLines: 1,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          hintText: 'Digite sua pergunta...',
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    IconButton.filled(
                      tooltip: _isStreaming ? 'Parar' : 'Enviar',
                      icon: Icon(_isStreaming
                          ? Icons.stop_rounded
                          : Icons.send_rounded),
                      style: _isStreaming
                          ? IconButton.styleFrom(
                              backgroundColor: theme.colorScheme.error)
                          : null,
                      onPressed:
                          _isStreaming ? _cancelStreaming : () => _send(),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.8,
        ),
        margin: EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isUser
              ? theme.colorScheme.primary
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(AppRadius.lg),
            topRight: const Radius.circular(AppRadius.lg),
            bottomLeft: Radius.circular(isUser ? AppRadius.lg : 2),
            bottomRight: Radius.circular(isUser ? 2 : AppRadius.lg),
          ),
        ),
        child: isUser
            ? Text(
                message.content,
                style: TextStyle(color: theme.colorScheme.onPrimary),
              )
            : MarkdownBody(
                data: message.content,
                selectable: true,
              ),
      ),
    );
  }
}

/// Empty-chat state with the web's per-agent suggested questions.
class _Suggestions extends StatelessWidget {
  final _AgentOption option;
  final Color color;
  final ValueChanged<String> onPick;

  const _Suggestions({
    required this.option,
    required this.color,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Icon(option.icon, size: 40, color: color),
        SizedBox(height: AppSpacing.sm),
        Text(
          'Como posso ajudar?',
          style: theme.textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        SizedBox(height: AppSpacing.md),
        for (final q in option.suggestions)
          Padding(
            padding: EdgeInsets.only(bottom: AppSpacing.sm),
            child: OutlinedButton(
              onPressed: () => onPick(q),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                foregroundColor: theme.colorScheme.onSurface,
                side: BorderSide(color: color.withValues(alpha: 0.4)),
              ),
              child: Text(q),
            ),
          ),
      ],
    );
  }
}

/// Three pulsing dots while the agent hasn't streamed its first token.
class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dot = theme.colorScheme.onSurfaceVariant;
    return Semantics(
      label: 'Assistente digitando',
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          margin: EdgeInsets.only(bottom: AppSpacing.sm),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.smd,
          ),
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(AppRadius.lg),
              topRight: Radius.circular(AppRadius.lg),
              bottomRight: Radius.circular(AppRadius.lg),
              bottomLeft: Radius.circular(2),
            ),
          ),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < 3; i++)
                  Container(
                    width: 7,
                    height: 7,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: dot.withValues(
                        alpha: AppMotion.reduced(context)
                            ? 0.6
                            : 0.3 +
                                0.7 *
                                    (1 -
                                        ((_controller.value * 3 - i) % 3)
                                            .clamp(0, 1)
                                            .toDouble()),
                      ),
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
