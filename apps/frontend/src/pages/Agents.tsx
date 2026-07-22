/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  BotMessageSquare,
  Brain,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  History,
  Loader2,
  Send,
  Shield,
  Square,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { useSearchParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { PageContainer } from '@/components/common/PageContainer';
import { useAgentStream } from '@/hooks/use-agent-stream';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { agentService } from '@/services/agent-service';
import type { AgentMessage, AgentName, IndexedSource } from '@/types';

const SOURCE_PATTERN = /^\[Fonte: (.+)\]$/;

function CitationLink({
  href,
  title,
  children,
}: {
  href?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const text = typeof children === 'string' ? children : '';
  const match = SOURCE_PATTERN.exec(text);
  if (match) {
    const label = match[1];
    return (
      <a
        href={href ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-xs rounded-full bg-primary/10 px-sm py-0.5 text-[11px] font-medium text-primary no-underline hover:bg-primary/20"
      >
        <ExternalLink className="h-2.5 w-2.5" />
        {label}
      </a>
    );
  }
  // Numbered inline citation: [[1]](#cite-1 "Source Title")
  if (href?.startsWith('#cite-') && title) {
    const numMatch = /\[(\d+)\]/.exec(text);
    const num = numMatch?.[1] ?? text;
    return (
      <span
        title={title}
        aria-label={`Fonte ${num}: ${title}`}
        className="inline-flex cursor-help items-center rounded bg-primary/15 px-xs text-[10px] font-bold leading-5 text-primary"
      >
        {num}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function transformCitations(text: string, sources: IndexedSource[]): string {
  if (!sources.length) return text;
  return text.replace(/\[(\d+)\]/g, (match, n: string) => {
    const num = parseInt(n, 10);
    const source = sources.find((s) => s.index === num);
    if (!source) return match;
    return `[[${n}]](#cite-${n} "${source.title.replace(/"/g, "'")}")`;
  });
}

const markdownComponents: Components = {
  a: CitationLink as Components['a'],
};

// Mapeamento agente → CSS class (sem cores hardcoded — usa variáveis CSS)
const AGENT_BADGE_CLASS: Record<string, string> = {
  personal: 'agent-badge-personal',
  financial: 'agent-badge-financial',
  security: 'agent-badge-security',
  intellect: 'agent-badge-intellect',
};

function getAgentBadgeClass(name: string | null): string {
  if (!name) return 'agent-badge-legacy';
  return AGENT_BADGE_CLASS[name] ?? 'agent-badge-legacy';
}

const AGENT_KEYS: AgentName[] = ['personal', 'financial', 'security', 'intellect'];

const AGENT_ICONS: Record<AgentName, React.ElementType> = {
  personal: Brain,
  financial: DollarSign,
  security: Shield,
  intellect: BookOpen,
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

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
          ? 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]'
          : 'bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]'
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

// ── AgentSelectorCard ─────────────────────────────────────────────────────────

function AgentSelectorCard({
  agentKey,
  selected,
  onSelect,
}: {
  agentKey: AgentName;
  selected: boolean;
  onSelect: (key: AgentName) => void;
}) {
  const { t } = useTranslation();
  const Icon = AGENT_ICONS[agentKey];
  const name = t(`pages.agents.agentSelector.${agentKey}.name`);
  const description = t(`pages.agents.agentSelector.${agentKey}.description`);
  const examples = t(`pages.agents.agentSelector.${agentKey}.examples`, {
    returnObjects: true,
  }) as string[];

  const badgeClass = AGENT_BADGE_CLASS[agentKey] ?? 'agent-badge-legacy';
  const cardClass = `agent-card-${agentKey}`;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(agentKey)}
      className={cn(
        'flex w-full flex-col gap-3 rounded-lg border-2 bg-card p-md text-left transition-all duration-200',
        selected
          ? cn('border-2', cardClass, 'shadow-medium')
          : 'border-border hover:border-muted-foreground/40'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
            badgeClass
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {selected && (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[hsl(var(--success))]" />
        )}
      </div>
      <div className="flex flex-wrap gap-xs">
        {examples.slice(0, 3).map((ex) => (
          <span
            key={ex}
            className="rounded-full bg-muted px-sm py-0.5 text-[10px] text-muted-foreground"
          >
            {ex}
          </span>
        ))}
      </div>
    </motion.button>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  agentLabel,
}: {
  message: AgentMessage;
  agentLabel: string;
}) {
  const isUser = message.role === 'user';
  const badgeClass = getAgentBadgeClass(message.agent_name);

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
            className={cn('rounded-full px-sm py-0.5 text-xs font-medium', badgeClass)}
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
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

// ── StreamingBubble ───────────────────────────────────────────────────────────

function StreamingBubble({
  text,
  isStreaming,
  agentName,
  sources,
  indexedSources,
  getAgentLabel,
}: {
  text: string;
  isStreaming: boolean;
  agentName: string | null;
  sources: string[];
  indexedSources: IndexedSource[];
  getAgentLabel: (name: string | null) => string;
}) {
  const { t } = useTranslation();
  const badgeClass = getAgentBadgeClass(agentName);

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
            className={cn('rounded-full px-sm py-0.5 text-xs font-medium', badgeClass)}
          >
            {getAgentLabel(agentName)}
          </span>
        )}

        <div className="rounded-2xl rounded-tl-sm bg-muted px-md py-sm text-sm leading-relaxed text-foreground">
          {!text && isStreaming ? (
            <span className="text-muted-foreground">
              {t('pages.agents.streaming.processing')}
            </span>
          ) : (
            <div className="prose prose-sm dark:prose-invert prose-p:my-xs prose-ul:my-xs prose-li:my-0.5 prose-headings:my-sm prose-code:rounded prose-code:bg-black/10 prose-code:px-xs prose-code:py-0.5 dark:prose-code:bg-white/10 max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {transformCitations(text, indexedSources)}
              </ReactMarkdown>
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
              {t('pages.agents.streaming.sources')}:
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

// ── ThinkingBubble ────────────────────────────────────────────────────────────

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

// ── AgentSelector (tela inicial antes da primeira mensagem) ───────────────────

function AgentSelector({
  selected,
  onSelect,
}: {
  selected: AgentName | null;
  onSelect: (key: AgentName) => void;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col items-center justify-center gap-lg px-md py-lg"
    >
      <div className="text-center">
        <div className="mx-auto mb-md flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <BotMessageSquare className="h-7 w-7 text-primary" />
        </div>
        <h2 className="heading-2 text-foreground">{t('pages.agents.selectAgent')}</h2>
        <p className="mt-xs text-sm text-muted-foreground">
          {t('pages.agents.selectAgentDesc')}
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {AGENT_KEYS.map((key) => (
          <AgentSelectorCard
            key={key}
            agentKey={key}
            selected={selected === key}
            onSelect={onSelect}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Agents() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('axiom-agent-session-id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem('axiom-agent-session-id', id);
    return id;
  });
  const [query, setQuery] = useState(() => searchParams.get('context') ?? '');
  const [selectedAgent, setSelectedAgent] = useState<AgentName | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);

  const [showHistory, setShowHistory] = useState(false);

  const {
    isStreaming,
    accumulatedText,
    currentAgent,
    sources,
    indexedSources,
    error,
    send: sendStream,
    cancel: cancelStream,
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

  const messages = useMemo(() => historyData?.results ?? [], [historyData?.results]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, accumulatedText, scrollToBottom]);

  useEffect(() => {
    if (error) {
      toast({ title: t('pages.agents.streaming.error'), variant: 'destructive' });
    }
  }, [error, toast, t]);

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
    if (!trimmed || isStreaming || !selectedAgent) return;

    setConversationStarted(true);
    setQuery('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await sendStream(trimmed, sessionId, { agent_name: selectedAgent });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

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

  const handleSelectAgent = (key: AgentName) => {
    setSelectedAgent(key);
    setConversationStarted(true);
  };

  const handleChangeAgent = () => {
    setConversationStarted(false);
    setSelectedAgent(null);
  };

  const getAgentLabel = (agentName: string | null): string => {
    if (!agentName) return t('pages.agents.agentNames.insight_agent');
    const key = `pages.agents.agentNames.${agentName}`;
    const translated = t(key);
    return translated === key ? agentName : translated;
  };

  const activeAgentName = selectedAgent
    ? t(`pages.agents.agentSelector.${selectedAgent}.name`)
    : null;

  const inputPlaceholder = selectedAgent
    ? t(`pages.agents.inputPlaceholder.${selectedAgent}`, {
        defaultValue: t('pages.agents.inputPlaceholder.default'),
      })
    : t('pages.agents.inputPlaceholder.default');

  const isLlmUnavailable = status !== undefined && !status.available;
  const inputDisabled = isStreaming || isLlmUnavailable || !selectedAgent;
  const showStreamingBubble = isStreaming || (accumulatedText.length > 0 && !error);
  const showSelector =
    !conversationStarted && messages.length === 0 && !showStreamingBubble;

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
                {activeAgentName ?? t('pages.agents.title')}
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
            {conversationStarted && (
              <button
                onClick={handleChangeAgent}
                title={t('pages.agents.changeAgent')}
                className="rounded-lg border border-border bg-background px-sm py-xs text-xs text-muted-foreground hover:bg-muted"
              >
                {t('pages.agents.changeAgent')}
              </button>
            )}
            <button
              onClick={() => setShowHistory((v) => !v)}
              title={t('pages.agents.sessions')}
              className={cn(
                'rounded-lg border border-border bg-background p-sm text-muted-foreground hover:bg-muted',
                showHistory && 'bg-muted text-foreground'
              )}
            >
              <History className="h-3.5 w-3.5" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => void handleClearHistory()}
                title={t('pages.agents.clearHistory')}
                className="rounded-lg border border-border bg-background p-sm text-muted-foreground hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* LLM unavailable banner — usa --warning em vez de amber hardcoded */}
        {status && !status.available && (
          <div className="flex items-center gap-sm border-b border-[hsl(var(--warning)/0.2)] bg-[hsl(var(--warning)/0.1)] px-md py-sm text-xs text-[hsl(var(--warning))]">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {t('pages.agents.unavailable')}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-md py-md">
          <AnimatePresence mode="wait">
            {showSelector ? (
              <AgentSelector
                key="selector"
                selected={selectedAgent}
                onSelect={handleSelectAgent}
              />
            ) : historyLoading ? (
              <div key="loading" className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div key="messages" className="space-y-md">
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
                      indexedSources={indexedSources}
                      getAgentLabel={getAgentLabel}
                    />
                  )}
                  {isStreaming && !accumulatedText && <ThinkingBubble key="thinking" />}
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input area — visível após seleção de agente ou durante/após streaming */}
        {(conversationStarted ||
          selectedAgent ||
          showStreamingBubble ||
          messages.length > 0) && (
          <div className="flex-shrink-0 border-t border-border bg-card px-md py-3">
            {selectedAgent &&
              messages.length === 0 &&
              !showStreamingBubble &&
              !query && (
                <div className="mb-sm flex flex-wrap gap-xs">
                  {(
                    (t(`pages.agents.suggestedQuestions.${selectedAgent}`, {
                      returnObjects: true,
                    }) as string[]) ?? []
                  ).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuery(q)}
                      className="rounded-full border border-border bg-muted px-sm py-xs text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            <div className="flex items-end gap-sm rounded-lg border border-border bg-background px-3 py-sm focus-within:ring-2 focus-within:ring-primary/40">
              <textarea
                ref={textareaRef}
                rows={1}
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={inputDisabled}
                aria-label={inputPlaceholder}
                className="max-h-40 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
              {isStreaming ? (
                <button
                  onClick={cancelStream}
                  className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-opacity hover:bg-destructive/90"
                  aria-label={t('pages.agents.stop')}
                  title={t('pages.agents.stop')}
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => void handleSend()}
                  disabled={!query.trim() || inputDisabled}
                  className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40"
                  aria-label={t('pages.agents.send')}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-sm text-center text-[11px] text-muted-foreground/60">
              {t('pages.agents.keyboardHint')}
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
