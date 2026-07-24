import { AnimatePresence, motion } from 'framer-motion';
import { BotMessageSquare, Send, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAgentStream } from '@/hooks/use-agent-stream';
import { cn } from '@/lib/utils';
import { agentService } from '@/services/agent-service';

const WIDGET_SESSION_KEY = 'agent-widget-session';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS_PT = [
  'Quanto gastei este mês?',
  'Vou estourar o orçamento?',
  'Qual minha previsão de saldo?',
];

const SUGGESTED_QUESTIONS_EN = [
  'How much did I spend this month?',
  'Will I exceed my budget?',
  'What is my balance forecast?',
];

export function AgentChatWidget() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem(WIDGET_SESSION_KEY) ?? '';
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isStreaming, accumulatedText, send, cancel, reset } = useAgentStream();

  const suggestedQuestions = i18n.language.startsWith('pt')
    ? SUGGESTED_QUESTIONS_PT
    : SUGGESTED_QUESTIONS_EN;

  useEffect(() => {
    if (!sessionId) {
      agentService
        .newSession()
        .then((res) => {
          const id = res.session_id;
          setSessionId(id);
          localStorage.setItem(WIDGET_SESSION_KEY, id);
        })
        .catch(() => undefined);
    }
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, accumulatedText]);

  const handleSend = useCallback(
    async (query: string) => {
      if (!query.trim() || isStreaming || !sessionId) return;

      const userMsg: Message = { role: 'user', content: query };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      reset();

      const answer = await send(query, sessionId);
      if (answer !== null) {
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
        reset();
      }
    },
    [isStreaming, sessionId, send, reset]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  };

  const handleOpenFullAgent = () => {
    setOpen(false);
    void navigate('/agents');
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <>
      {/* Floating button */}
      <motion.button
        aria-label={t('agentWidget.openLabel')}
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'fixed bottom-lg right-lg z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors',
          open
            ? 'bg-muted text-muted-foreground ring-2 ring-border'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <BotMessageSquare className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-[5.5rem] right-lg z-50 flex w-80 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:w-96"
            style={{ maxHeight: 'min(520px, calc(100vh - 7rem))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-primary/5 px-md py-sm">
              <div className="flex items-center gap-sm">
                <BotMessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t('agentWidget.title')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenFullAgent}
                className="h-7 px-sm text-xs text-muted-foreground hover:text-foreground"
              >
                {t('agentWidget.openFull')}
              </Button>
            </div>

            {/* Messages */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-md">
              {isEmpty ? (
                <div className="space-y-md">
                  <p className="text-center text-sm text-muted-foreground">
                    {t('agentWidget.emptyHint')}
                  </p>
                  <div className="space-y-xs">
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => void handleSend(q)}
                        className="w-full rounded-lg border bg-muted/40 px-md py-sm text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-sm">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'max-w-[85%] rounded-lg px-md py-sm text-sm',
                        msg.role === 'user'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isStreaming && accumulatedText && (
                    <div className="max-w-[85%] rounded-lg bg-muted px-md py-sm text-sm text-foreground">
                      {accumulatedText}
                      <span className="ml-xs inline-block h-3 w-0.5 animate-pulse bg-foreground/60" />
                    </div>
                  )}
                  {isStreaming && !accumulatedText && (
                    <div className="flex items-center gap-xs px-md py-sm text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-sm">
              <div className="flex items-center gap-xs rounded-lg border bg-muted/30 px-sm py-xs focus-within:ring-2 focus-within:ring-ring">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('agentWidget.inputPlaceholder')}
                  disabled={isStreaming}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
                />
                {isStreaming ? (
                  <button
                    onClick={cancel}
                    aria-label={t('agentWidget.cancelLabel')}
                    className="shrink-0 rounded-lg p-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => void handleSend(input)}
                    disabled={!input.trim()}
                    aria-label={t('agentWidget.sendLabel')}
                    className="shrink-0 rounded-lg p-xs text-primary transition-colors hover:text-primary/80 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
