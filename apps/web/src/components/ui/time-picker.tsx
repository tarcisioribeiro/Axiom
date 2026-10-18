import { Check, Clock, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  ClockDial,
  formatTime,
  now,
  parseTime,
  type Time,
} from '@/components/ui/clock-dial';
import { PlainButton } from '@/components/ui/plain-button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value?: string;
  onChange?: (time: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  'aria-invalid'?: boolean;
}

export function TimePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  clearable = true,
  'aria-invalid': ariaInvalid,
}: TimePickerProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('common.placeholders.time');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [draft, setDraft] = useState<Time>(now);

  // Ressincroniza o texto quando o valor muda por fora (ex.: reset do formulário).
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    const parsed = value ? parseTime(value) : undefined;
    setText(parsed ? formatTime(parsed) : (value ?? ''));
  }

  const openDial = () => {
    if (disabled || open) return;
    setDraft(parseTime(text) ?? now());
    setMode('hour');
    setOpen(true);
  };

  // Valor digitado no campo: aplica se válido, limpa se vazio, senão volta ao anterior.
  const commitText = () => {
    if (!text.trim()) {
      if (clearable) onChange?.(undefined);
      else setText(value ?? '');
      return;
    }
    const parsed = parseTime(text);
    if (parsed) {
      setText(formatTime(parsed));
      if (formatTime(parsed) !== value) onChange?.(formatTime(parsed));
    } else {
      setText(value ?? '');
    }
  };

  const confirm = () => {
    const str = formatTime(draft);
    setText(str);
    onChange?.(str);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setText('');
    onChange?.(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className={cn('relative isolate w-full', className)}>
          <Clock className="text-primary/70 pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />

          <input
            type="text"
            inputMode="numeric"
            value={text}
            onClick={openDial}
            onChange={(e) => {
              setText(e.target.value);
              const parsed = parseTime(e.target.value);
              if (parsed) setDraft(parsed);
            }}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              commitText();
              setOpen(false);
            }}
            aria-invalid={ariaInvalid}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            className={cn(
              'py-sm h-10 w-full pr-10 pl-10',
              'border-input bg-background rounded-md border',
              'text-foreground placeholder:text-foreground text-sm',
              'focus-visible:border-primary focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              'duration-normal transition',
              'hover:border-primary/40',
              'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/50 aria-[invalid=true]:ring-2',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          />

          {clearable && value && !disabled && (
            <PlainButton
              type="button"
              onClick={handleClear}
              aria-label={t('common.actions.clearTime')}
              className={cn(
                'absolute top-1/2 right-3 z-10 -translate-y-1/2',
                'h-5 w-5 rounded-full',
                'flex items-center justify-center',
                'hover:text-destructive',
                'hover:bg-destructive/10',
                'duration-fast transition-colors'
              )}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </PlainButton>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        className="w-auto"
        // Mantém o foco no campo para continuar digitável com o mostrador aberto.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (wrapperRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          confirm();
        }}
      >
        <div className="mb-md flex items-center justify-center text-5xl font-light tabular-nums">
          {(['hour', 'minute'] as const).map((m, i) => (
            <span key={m} className="flex items-center">
              {i === 1 && <span className="text-muted-foreground px-1">:</span>}
              <PlainButton
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                aria-label={t(`common.timePicker.${m}s`)}
                className={cn(
                  'px-sm rounded-md transition-colors',
                  mode === m ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
              >
                {String(m === 'hour' ? draft.h : draft.m).padStart(2, '0')}
              </PlainButton>
            </span>
          ))}
        </div>

        <ClockDial
          mode={mode}
          time={draft}
          label={t(`common.timePicker.${mode}s`)}
          onSelect={(v) =>
            setDraft((d) => (mode === 'hour' ? { ...d, h: v } : { ...d, m: v }))
          }
          onRelease={() => mode === 'hour' && setMode('minute')}
        />

        <div className="mt-md gap-sm flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={confirm}>
            <Check className="h-4 w-4" />
            {t('common.actions.ok')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
