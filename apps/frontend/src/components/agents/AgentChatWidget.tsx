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
          // Offset above the bottom-right corner (StudyTimer, page FABs like
          // Books' quick-capture button all anchor at bottom-6/right-6) so
          // this global widget doesn't sit on top of and block them.
          'right-lg fixed bottom-[6.5rem] z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors',
          open
            ? 'bg-muted text-muted-foreground ring-border ring-2'
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
            className="right-lg bg-background fixed bottom-[10.5rem] z-50 flex w-80 flex-col overflow-hidden rounded-2xl border shadow-2xl sm:w-96"
            style={{ maxHeight: 'min(520px, calc(100vh - 12rem))' }}
          >
            {/* Header */}
            <div className="bg-primary/5 px-md py-sm flex items-center justify-between border-b">
              <div className="gap-sm flex items-center">
                <BotMessageSquare className="text-primary h-4 w-4" />
                <span className="text-sm font-semibold">{t('agentWidget.title')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenFullAgent}
                className="px-sm text-muted-foreground hover:text-foreground h-7 text-xs"
              >
                {t('agentWidget.openFull')}
              </Button>
            </div>

            {/* Messages */}
            <div className="custom-scrollbar p-md flex-1 overflow-y-auto">
              {isEmpty ? (
                <div className="space-y-md">
                  <p className="text-muted-foreground text-center text-sm">
                    {t('agentWidget.emptyHint')}
                  </p>
                  <div className="space-y-xs">
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => void handleSend(q)}
                        className="bg-muted/40 px-md py-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground w-full rounded-lg border text-left text-xs transition-colors"
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
                        'px-md py-sm max-w-[85%] rounded-lg text-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isStreaming && accumulatedText && (
                    <div className="bg-muted px-md py-sm text-foreground max-w-[85%] rounded-lg text-sm">
                      {accumulatedText}
                      <span className="ml-xs bg-foreground/60 inline-block h-3 w-0.5 animate-pulse" />
                    </div>
                  )}
                  {isStreaming && !accumulatedText && (
                    <div className="gap-xs px-md py-sm text-muted-foreground flex items-center text-xs">
                      <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                      <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                      <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-sm border-t">
              <div className="gap-xs bg-muted/30 px-sm py-xs focus-within:ring-ring flex items-center rounded-lg border focus-within:ring-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('agentWidget.inputPlaceholder')}
                  disabled={isStreaming}
                  className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
                />
                {isStreaming ? (
                  <button
                    onClick={cancel}
                    aria-label={t('agentWidget.cancelLabel')}
                    className="p-xs text-muted-foreground hover:text-destructive shrink-0 rounded-lg transition-colors"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => void handleSend(input)}
                    disabled={!input.trim()}
                    aria-label={t('agentWidget.sendLabel')}
                    className="p-xs text-primary hover:text-primary/80 shrink-0 rounded-lg transition-colors disabled:opacity-40"
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
