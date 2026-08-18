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
import '../../widgets/logout_button.dart';
import '../../widgets/page_header.dart';

const _sessionsPrefsKey = 'axiom_agent_sessions_by_agent';

class _AgentOption {
  final String key;
  final String label;
  final String description;
  final IconData icon;
  final Color Function(ColorScheme) color;

  const _AgentOption({
    required this.key,
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
  });
}

const _agentOptions = [
  _AgentOption(
    key: 'personal',
    label: 'Pessoal',
    description: 'Rotinas, metas, treino e nutrição',
    icon: Icons.self_improvement_rounded,
    color: _colorInfo,
  ),
  _AgentOption(
    key: 'financial',
    label: 'Financeiro',
    description: 'Gastos, orçamento e previsões',
    icon: Icons.account_balance_wallet_outlined,
    color: _colorSuccess,
  ),
  _AgentOption(
    key: 'security',
    label: 'Segurança',
    description: 'Senhas e boas práticas de segurança',
    icon: Icons.shield_outlined,
    color: _colorPrimary,
  ),
  _AgentOption(
    key: 'intellect',
    label: 'Intelecto',
    description: 'Leituras, cursos e conhecimento',
    icon: Icons.lightbulb_outline_rounded,
    color: _colorTertiary,
  ),
];

Color _colorInfo(ColorScheme s) => s.secondary;
Color _colorSuccess(ColorScheme s) => s.primary;
Color _colorPrimary(ColorScheme s) => s.primary;
Color _colorTertiary(ColorScheme s) => s.tertiary;

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
                  color: Theme.of(context).colorScheme.tertiary,
                  trailing: const LogoutButton(),
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
                    childAspectRatio: 1.1,
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
    final color = option.color(Theme.of(context).colorScheme);
    return InkWell(
      borderRadius: AppRadius.lgRadius,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: AppRadius.lgRadius,
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(option.icon, color: color, size: 28),
            SizedBox(height: AppSpacing.sm),
            Text(option.label, style: Theme.of(context).textTheme.titleSmall),
            SizedBox(height: AppSpacing.xs),
            Text(
              option.description,
              style: Theme.of(context).textTheme.bodySmall,
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
    await ref.read(agentsServiceProvider).clearHistory(sessionId);
    setState(() => _messages.clear());
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

  Future<void> _send() async {
    final query = _inputController.text.trim();
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
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: widget.onBack,
        ),
        title: Text(widget.option.label),
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
            Expanded(
              child: _isLoadingHistory
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        ..._messages.map((m) => _MessageBubble(message: m)),
                        if (_isStreaming)
                          _MessageBubble(
                            message: ChatMessage(
                              role: 'assistant',
                              content:
                                  _streamingText.isEmpty ? '…' : _streamingText,
                              agentName: widget.option.key,
                            ),
                          ),
                      ],
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
                      icon: Icon(_isStreaming
                          ? Icons.stop_rounded
                          : Icons.send_rounded),
                      style: _isStreaming
                          ? IconButton.styleFrom(
                              backgroundColor: theme.colorScheme.error)
                          : null,
                      onPressed: _isStreaming ? _cancelStreaming : _send,
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
