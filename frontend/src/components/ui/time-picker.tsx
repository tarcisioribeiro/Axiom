import flatpickr from 'flatpickr';
import { Portuguese } from 'flatpickr/dist/l10n/pt';
import type { Options as FlatpickrOptions } from 'flatpickr/dist/types/options';
import { Clock, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import '@/styles/flatpickr-custom.css';

interface TimePickerProps {
  value?: string;
  onChange?: (time: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

function parseTimeStr(timeStr: string): Date | undefined {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return undefined;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Selecione um horário',
  disabled = false,
  className,
  clearable = true,
}: TimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const flatpickrRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return;

    const options: Partial<FlatpickrOptions> = {
      locale: Portuguese,
      enableTime: true,
      noCalendar: true,
      dateFormat: 'H:i',
      time_24hr: true,
      allowInput: true,
      clickOpens: !disabled,
      disableMobile: true,
      static: true,
      onChange: (selectedDates) => {
        if (selectedDates.length > 0) {
          onChangeRef.current?.(dateToTimeStr(selectedDates[0]));
        }
      },
      onReady: (_selectedDates, _dateStr, instance) => {
        instance.calendarContainer.classList.add('flatpickr-calendar-custom');
      },
    };

    flatpickrRef.current = flatpickr(inputRef.current, options);

    return () => {
      flatpickrRef.current?.destroy();
    };
  }, [disabled]);

  useEffect(() => {
    const fp = flatpickrRef.current;
    if (!fp) return;

    if (value) {
      const currentStr = fp.selectedDates[0] ? dateToTimeStr(fp.selectedDates[0]) : '';
      if (currentStr !== value) {
        const date = parseTimeStr(value);
        if (date) fp.setDate(date, false);
      }
    } else if (fp.selectedDates.length > 0) {
      fp.clear(false);
    }
  }, [value]);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flatpickrRef.current?.clear();
    onChange?.(undefined);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Clock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary/70" />

      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flatpickr-input',
          'h-10 w-full py-sm pl-10 pr-10',
          'rounded-md border border-input bg-background',
          'text-sm text-foreground placeholder:text-foreground',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring',
          'transition-all duration-200',
          'hover:border-primary/40',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />

      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpar horário"
          className={cn(
            'absolute right-3 top-1/2 z-10 -translate-y-1/2',
            'h-5 w-5 rounded-full',
            'flex items-center justify-center',
            'hover:text-destructive',
            'hover:bg-destructive/10',
            'transition-colors duration-150'
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
