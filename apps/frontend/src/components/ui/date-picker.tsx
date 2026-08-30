import flatpickr from 'flatpickr';
import { Portuguese } from 'flatpickr/dist/l10n/pt';
import type { Options as FlatpickrOptions } from 'flatpickr/dist/types/options';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn, toLocalDate, formatLocalDate } from '@/lib/utils';

// Importa estilos customizados (sem usar os padrões do Flatpickr)
import '@/styles/flatpickr-custom.css';

interface DatePickerProps {
  value?: Date | string;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  minDate?: Date | string;
  maxDate?: Date | string;
}

// Parser customizado para formato DD/MM/YYYY
function parseDateBR(dateStr: string): Date | undefined {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);

  const date = new Date(year, month, day);

  // Valida se a data é válida
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

/**
 * DatePicker component using Flatpickr
 * - Formato DD/MM/YYYY
 * - Localização pt-BR
 * - Permite digitação manual com validação
 * - Estilização customizada para temas Dracula/Alucard
 */
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  clearable = true,
  minDate,
  maxDate,
}: DatePickerProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('common.fields.selectDate');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flatpickrRef = useRef<flatpickr.Instance | null>(null);
  // Ref para armazenar o callback atual de onChange
  // Isso evita que o Flatpickr seja recriado quando onChange muda
  const onChangeRef = useRef(onChange);

  // Atualiza a ref quando onChange muda
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Converte value para Date
  const dateValue = toLocalDate(value);

  // Inicializa Flatpickr apenas uma vez (ou quando disabled muda)
  useEffect(() => {
    if (!inputRef.current) return;

    const options: Partial<FlatpickrOptions> = {
      locale: Portuguese,
      dateFormat: 'd/m/Y',
      allowInput: true,
      clickOpens: !disabled,
      disableMobile: true,
      static: true,
      minDate: minDate ?? undefined,
      maxDate: maxDate ?? undefined,
      // Usa a ref para chamar o onChange atual
      // Não propagamos selectedDates vazio para evitar que o Flatpickr limpe o
      // valor do formulário durante a inicialização ou transições internas.
      // A limpeza explícita é feita pelo botão de clear (handleClear).
      onChange: (selectedDates: Date[]) => {
        if (selectedDates.length > 0) {
          onChangeRef.current?.(selectedDates[0]);
        }
      },
      wrap: false,
      // Parser customizado para aceitar DD/MM/YYYY digitado manualmente
      parseDate: (dateStr: string) => {
        const parsed = parseDateBR(dateStr);
        // Retorna data válida ou data inválida (que será ignorada pelo Flatpickr)
        return parsed ?? new Date(NaN);
      },
      onReady: (_selectedDates, _dateStr, instance) => {
        instance.calendarContainer.classList.add('flatpickr-calendar-custom');
      },
      // Validação ao fechar - se o usuário digitou uma data válida mas não pressionou
      // Enter/Tab, confirma a data ao fechar (ex: clicou em outro campo)
      onClose: (selectedDates, dateStr, instance) => {
        if (dateStr) {
          const parsed = parseDateBR(dateStr);
          if (!parsed) {
            instance.input.classList.add('flatpickr-invalid');
            setTimeout(() => {
              instance.input.classList.remove('flatpickr-invalid');
            }, 1500);
          } else if (selectedDates.length === 0) {
            instance.setDate(parsed, true);
          }
        }
      },
    };

    flatpickrRef.current = flatpickr(inputRef.current, options);

    return () => {
      flatpickrRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  // Atualiza data quando value muda externamente
  useEffect(() => {
    if (flatpickrRef.current) {
      const currentDate = flatpickrRef.current.selectedDates[0];
      const newDate = dateValue;

      // Só atualiza se a data realmente mudou
      if (
        newDate &&
        (!currentDate || formatLocalDate(currentDate) !== formatLocalDate(newDate))
      ) {
        flatpickrRef.current.setDate(newDate, false);
      } else if (!newDate && currentDate) {
        flatpickrRef.current.clear(false);
      }
    }
  }, [dateValue]);

  // Handler para limpar a data
  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flatpickrRef.current?.clear();
    onChange?.(undefined);
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Ícone do calendário */}
      <CalendarIcon className="text-primary/70 pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />

      {/* Input do Flatpickr */}
      <input
        ref={inputRef}
        type="text"
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        className={cn(
          'flatpickr-input',
          'py-sm h-10 w-full pr-10 pl-10',
          'border-input bg-background rounded-md border',
          'text-foreground placeholder:text-foreground text-sm',
          'focus-visible:border-primary focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'transition-all duration-200',
          'hover:border-primary/40',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />

      {/* Botão para limpar */}
      {clearable && dateValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpar data"
          className={cn(
            'absolute top-1/2 right-3 z-10 -translate-y-1/2',
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
