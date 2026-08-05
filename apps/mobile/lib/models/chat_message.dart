/// A single turn in an agent conversation — either a user query or an
/// assistant reply. Mirrors the shape `agents/history/` returns and what
/// `agents/stream/` accumulates into once streaming completes.
class ChatMessage {
  final String role;
  final String content;
  final String? agentName;

  const ChatMessage(
      {required this.role, required this.content, this.agentName});

  bool get isUser => role == 'user';

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        role: json['role'] as String? ?? 'assistant',
        content: json['content'] as String? ?? '',
        agentName: json['agent_name'] as String?,
      );
}
