import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BotMessageSquare,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Send,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { PageContainer } from '@/components/common/PageContainer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { agentService } from '@/services/agent-service';
import type { AgentMessage } from '@/types';

const AGENT_COLORS: Record<string, string> = {
  finance_agent: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  budget_agent: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  forecast_agent: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  planning_agent: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  library_agent: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  insight_agent: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
};

function StatusBadge({
  provider,
  available,
}: {
  provider: string;
  available: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        available
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-600 dark:text-red-400'
      )}
    >
      {available ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {t('pages.agents.provider')}: {provider}
    </span>
  );
}

function MessageBubble({
  message,
  agentLabel,
}: {
  message: AgentMessage;
  agentLabel: string;
}) {
  const isUser = message.role === 'user';
  const agentColorClass = message.agent_name
    ? (AGENT_COLORS[message.agent_name] ?? 'bg-secondary text-secondary-foreground')
    : 'bg-secondary text-secondary-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <BotMessageSquare className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex max-w-[75%] flex-col gap-1', isUser && 'items-end')}>
        {!isUser && message.agent_name && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              agentColorClass
            )}
          >
            {agentLabel}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 dark:prose-code:bg-white/10 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/70">
          {new Date(message.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  );
}

function ThinkingBubble() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3"
    >
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BotMessageSquare className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('pages.agents.thinking')}
      </div>
    </motion.div>
  );
}

export default function Agents() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState('default');
  const [sessions, setSessions] = useState<string[]>(['default']);
  const [query, setQuery] = useState('');
  const [isPending, setIsPending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Status query
  const { data: status } = useQuery({
    queryKey: ['agents', 'status'],
    queryFn: () => agentService.getStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // History query
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['agents', 'history', sessionId],
    queryFn: () => agentService.getHistory(sessionId),
    staleTime: 0,
  });

  const messages = historyData?.results ?? [];

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPending, scrollToBottom]);

  // Auto-resize textarea
  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = async () => {
    const trimmed = query.trim();
    if (!trimmed || isPending) return;

    setQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsPending(true);

    try {
      await agentService.ask({ query: trimmed, session_id: sessionId });
      await queryClient.invalidateQueries({
        queryKey: ['agents', 'history', sessionId],
      });
    } catch {
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Verifique se o LLM está disponível no painel admin.',
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const newSessionMutation = useMutation({
    mutationFn: () => agentService.newSession(),
    onSuccess: (data) => {
      const id = data.session_id;
      setSessions((prev) => [id, ...prev]);
      setSessionId(id);
    },
    onError: () => {
      toast({ title: 'Erro ao criar sessão', variant: 'destructive' });
    },
  });

  const handleClearHistory = async () => {
    const confirmed = await showConfirm({
      title: t('pages.agents.clearHistory'),
      description: t('pages.agents.clearConfirm'),
      confirmText: t('common.actions.delete'),
      variant: 'destructive',
    });
    if (confirmed) {
      await agentService.clearHistory(sessionId);
      await queryClient.invalidateQueries({
        queryKey: ['agents', 'history', sessionId],
      });
    }
  };

  const getAgentLabel = (agentName: string | null): string => {
    if (!agentName) return 'Agente';
    const key = `pages.agents.agentNames.${agentName}`;
    const translated = t(key);
    return translated === key ? agentName : translated;
  };

  const sessionLabel = (id: string) => (id === 'default' ? 'Padrão' : id.toUpperCase());

  return (
    <PageContainer>
      <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BotMessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight text-foreground">
                {t('pages.agents.title')}
              </h1>
              {status && (
                <div className="mt-0.5">
                  <StatusBadge
                    provider={status.provider}
                    available={status.available}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Session selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent">
                  <span className="max-w-[80px] truncate font-mono">
                    {sessionLabel(sessionId)}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setSessionId(s)}
                    className={cn(
                      'font-mono text-xs',
                      s === sessionId && 'font-semibold text-primary'
                    )}
                  >
                    {sessionLabel(s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* New session */}
            <button
              onClick={() => newSessionMutation.mutate()}
              disabled={newSessionMutation.isPending}
              title={t('pages.agents.newSession')}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
            >
              {newSessionMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t('pages.agents.newSession')}
            </button>

            {/* Clear history */}
            {messages.length > 0 && (
              <button
                onClick={() => void handleClearHistory()}
                title={t('pages.agents.clearHistory')}
                className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* LLM unavailable banner */}
        {status && !status.available && (
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {t('pages.agents.unavailable')}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !isPending ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <BotMessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('pages.agents.noMessages')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    agentLabel={getAgentLabel(msg.agent_name)}
                  />
                ))}
                {isPending && <ThinkingBubble key="thinking" />}
              </AnimatePresence>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/40">
            <textarea
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder={t('pages.agents.inputPlaceholder')}
              disabled={isPending || (status !== undefined && !status.available)}
              className="max-h-40 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => void handleSend()}
              disabled={
                !query.trim() ||
                isPending ||
                (status !== undefined && !status.available)
              }
              className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
              aria-label={t('pages.agents.send')}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
