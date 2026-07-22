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
            'flex w-full rounded-md border border-input bg-background px-3 py-2',
            'text-sm ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            'resize-none',
            className
          )}
        />
        {isLoading && (
          <div className="absolute bottom-2 right-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
          </div>
        )}
      </div>

      {suggestion && (
        <div className="flex items-start gap-sm rounded-lg border border-primary/20 bg-primary/5 p-sm">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
          <div className="min-w-0 flex-1">
            <p className="text-xs italic leading-relaxed text-muted-foreground">
              {suggestion}
            </p>
            <div className="mt-xs flex items-center gap-sm">
              <button
                type="button"
                onClick={acceptSuggestion}
                className="rounded border border-primary/30 bg-primary/10 px-xs py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                Tab — Aceitar
              </button>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
              >
                Esc — Ignorar
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissSuggestion}
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
