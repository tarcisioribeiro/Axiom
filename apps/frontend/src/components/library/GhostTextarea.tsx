import { Loader2, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';

interface GhostTextareaProps {
  value: string;
  onChange: (value: string) => void;
  bookId?: number | null;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const DEBOUNCE_MS = 2000;
const MIN_CHARS = 10;

export function GhostTextarea({
  value,
  onChange,
  bookId,
  placeholder,
  rows = 6,
  disabled,
  className,
  id,
}: GhostTextareaProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFetchedText = useRef<string>('');

  const fetchSuggestion = useCallback(
    async (text: string) => {
      if (text.length < MIN_CHARS || text === lastFetchedText.current) return;
      lastFetchedText.current = text;
      setIsLoading(true);
      try {
        const res = await apiClient.post<{ suggestion: string }>(
          '/api/v1/agents/suggest-continuation/',
          { text, book_id: bookId ?? undefined }
        );
        if (res.suggestion) setSuggestion(res.suggestion);
      } catch {
        // silently swallow — not critical
      } finally {
        setIsLoading(false);
      }
    },
    [bookId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSuggestion(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (newValue.length >= MIN_CHARS) {
      timerRef.current = setTimeout(() => {
        void fetchSuggestion(newValue);
      }, DEBOUNCE_MS);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    const appended = value.trimEnd() + ' ' + suggestion;
    onChange(appended);
    setSuggestion(null);
    lastFetchedText.current = '';
    textareaRef.current?.focus();
  };

  const dismissSuggestion = () => {
    setSuggestion(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      acceptSuggestion();
    } else if (e.key === 'Escape' && suggestion) {
      dismissSuggestion();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="space-y-xs">
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            'border-input bg-background flex w-full rounded-md border px-3 py-2',
            'ring-offset-background placeholder:text-muted-foreground text-sm',
            'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            'resize-none',
            className
          )}
        />
        {isLoading && (
          <div className="absolute right-2 bottom-2">
            <Loader2 className="text-muted-foreground/50 h-3.5 w-3.5 animate-spin" />
          </div>
        )}
      </div>

      {suggestion && (
        <div className="gap-sm border-primary/20 bg-primary/5 p-sm flex items-start rounded-lg border">
          <Sparkles className="text-primary/60 mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs leading-relaxed italic">
              {suggestion}
            </p>
            <div className="mt-xs gap-sm flex items-center">
              <button
                type="button"
                onClick={acceptSuggestion}
                className="border-primary/30 bg-primary/10 px-xs text-primary hover:bg-primary/20 rounded border py-0.5 text-xs font-medium transition-colors"
              >
                Tab — Aceitar
              </button>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="text-muted-foreground/60 hover:text-muted-foreground text-xs"
              >
                Esc — Ignorar
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissSuggestion}
            className="text-muted-foreground/40 hover:text-muted-foreground shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
