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
import { useAgentStream } from '@/hooks/use-agent-stream';
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
        'inline-flex items-center gap-sm rounded-full px-sm py-xs text-xs font-medium',
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

      <div className={cn('flex max-w-[75%] flex-col gap-xs', isUser && 'items-end')}>
        {!isUser && message.agent_name && (
          <span
            className={cn(
              'rounded-full px-sm py-0.5 text-xs font-medium',
              agentColorClass
            )}
          >
            {agentLabel}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-md py-sm text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert prose-p:my-xs prose-ul:my-xs prose-li:my-0.5 prose-headings:my-sm prose-code:rounded prose-code:bg-black/10 prose-code:px-xs prose-code:py-0.5 dark:prose-code:bg-white/10 max-w-none">
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

function StreamingBubble({
  text,
  isStreaming,
  agentName,
  sources,
  getAgentLabel,
}: {
  text: string;
  isStreaming: boolean;
  agentName: string | null;
  sources: string[];
  getAgentLabel: (name: string | null) => string;
}) {
  const { t } = useTranslation();
  const agentColorClass = agentName
    ? (AGENT_COLORS[agentName] ?? 'bg-secondary text-secondary-foreground')
    : 'bg-secondary text-secondary-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3"
    >
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {isStreaming && !text ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BotMessageSquare className="h-4 w-4" />
        )}
      </div>

      <div className="flex max-w-[75%] flex-col gap-xs">
        {agentName && (
          <span
            className={cn(
              'rounded-full px-sm py-0.5 text-xs font-medium',
              agentColorClass
            )}
          >
            {getAgentLabel(agentName)}
          </span>
        )}

        <div className="rounded-2xl rounded-tl-sm bg-muted px-md py-sm text-sm leading-relaxed text-foreground">
          {!text && isStreaming ? (
            <span className="text-muted-foreground">
              {t('agents.streaming.processing')}
            </span>
          ) : (
            <div className="prose prose-sm dark:prose-invert prose-p:my-xs prose-ul:my-xs prose-li:my-0.5 prose-headings:my-sm prose-code:rounded prose-code:bg-black/10 prose-code:px-xs prose-code:py-0.5 dark:prose-code:bg-white/10 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              {isStreaming && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[1px] animate-pulse bg-current align-middle"
                />
              )}
            </div>
          )}
        </div>

        {!isStreaming && sources.length > 0 && (
          <div className="flex flex-wrap gap-xs pt-0.5">
            <span className="text-[11px] text-muted-foreground/70">
              {t('agents.streaming.sources')}:
            </span>
            {sources.map((src) => (
              <span
                key={src}
                className="rounded-full bg-muted px-sm py-0.5 text-[11px] text-muted-foreground"
              >
                {src}
              </span>
            ))}
          </div>
        )}
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
      <div className="flex items-center gap-sm rounded-2xl rounded-tl-sm bg-muted px-md py-sm text-sm text-muted-foreground">
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

  const {
    isStreaming,
    accumulatedText,
    currentAgent,
    sources,
    error,
    send: sendStream,
    reset: resetStream,
  } = useAgentStream();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const { data: status } = useQuery({
    queryKey: ['agents', 'status'],
    queryFn: () => agentService.getStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['agents', 'history', sessionId],
    queryFn: () => agentService.getHistory(sessionId),
    staleTime: 0,
  });

  const messages = historyData?.results ?? [];

  // Scroll on new messages, streaming tokens, or while pending
  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, accumulatedText, scrollToBottom]);

  // Show error toast when streaming fails
  useEffect(() => {
    if (error) {
      toast({
        title: t('agents.streaming.error'),
        variant: 'destructive',
      });
    }
  }, [error, toast, t]);

  // After streaming ends, trigger history refetch then clear streaming state.
  // awaitingHistoryRefresh gates the reset so it only fires once per response.
  const prevIsStreaming = useRef(false);
  const awaitingHistoryRefresh = useRef(false);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    if (prevIsStreaming.current && !isStreaming && !error) {
      awaitingHistoryRefresh.current = true;
      void queryClient.invalidateQueries({
        queryKey: ['agents', 'history', sessionId],
      });
    }
    prevIsStreaming.current = isStreaming;
  }, [isStreaming, error, queryClient, sessionId]);

  // Clear the streaming bubble once new history messages have loaded.
  useEffect(() => {
    if (awaitingHistoryRefresh.current && messages.length > prevMessageCount.current) {
      awaitingHistoryRefresh.current = false;
      resetStream();
    }
    prevMessageCount.current = messages.length;
  }, [messages, resetStream]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = async () => {
    const trimmed = query.trim();
    if (!trimmed || isStreaming) return;

    setQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Optimistically add the user message to history by invalidating after send
    await sendStream(trimmed, sessionId);
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

  const isLlmUnavailable = status !== undefined && !status.available;
  const inputDisabled = isStreaming || isLlmUnavailable;

  // Determine whether to show the streaming bubble (active stream OR just finished)
  const showStreamingBubble = isStreaming || (accumulatedText.length > 0 && !error);

  return (
    <PageContainer>
      <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border px-md py-3">
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

          <div className="flex flex-shrink-0 items-center gap-sm">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-sm rounded-lg border border-border bg-background px-3 py-sm text-xs text-foreground hover:bg-accent">
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

            <button
              onClick={() => newSessionMutation.mutate()}
              disabled={newSessionMutation.isPending}
              title={t('pages.agents.newSession')}
              className="flex items-center gap-sm rounded-lg border border-border bg-background px-3 py-sm text-xs text-foreground hover:bg-accent disabled:opacity-50"
            >
              {newSessionMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t('pages.agents.newSession')}
            </button>

            {messages.length > 0 && (
              <button
                onClick={() => void handleClearHistory()}
                title={t('pages.agents.clearHistory')}
                className="rounded-lg border border-border bg-background p-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* LLM unavailable banner */}
        {status && !status.available && (
          <div className="flex items-center gap-sm border-b border-amber-500/20 bg-amber-500/10 px-md py-sm text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {t('pages.agents.unavailable')}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-md py-md">
          {historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !showStreamingBubble ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <BotMessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('pages.agents.noMessages')}
              </p>
            </div>
          ) : (
            <div className="space-y-md">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    agentLabel={getAgentLabel(msg.agent_name)}
                  />
                ))}
                {showStreamingBubble && (
                  <StreamingBubble
                    key="streaming"
                    text={accumulatedText}
                    isStreaming={isStreaming}
                    agentName={currentAgent}
                    sources={sources}
                    getAgentLabel={getAgentLabel}
                  />
                )}
                {isStreaming && !accumulatedText && <ThinkingBubble key="thinking" />}
              </AnimatePresence>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-border bg-card px-md py-3">
          <div className="flex items-end gap-sm rounded-lg border border-border bg-background px-3 py-sm focus-within:ring-2 focus-within:ring-primary/40">
            <textarea
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder={t('pages.agents.inputPlaceholder')}
              disabled={inputDisabled}
              aria-label={t('pages.agents.inputPlaceholder')}
              className="max-h-40 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!query.trim() || inputDisabled}
              className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
              aria-label={t('pages.agents.send')}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-sm text-center text-[11px] text-muted-foreground/60">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
