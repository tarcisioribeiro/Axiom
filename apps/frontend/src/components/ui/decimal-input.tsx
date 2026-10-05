import { Minus, Plus } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PlainButton } from '@/components/ui/plain-button';
import { cn } from '@/lib/utils';

interface DecimalInputProps {
  /** Número, string numérica ("72.5") ou vazio (`null`/`undefined`/`''`). */
  value: number | string | null | undefined;
  /** `null` quando o campo fica vazio. */
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Casas decimais aceitas (arredonda ao sair do campo). */
  decimals?: number;
  /** Com `step`, mostra − / + e ativa as setas ↑/↓. */
  step?: number;
  /** Unidade exibida à direita (kg, cm, %, …). */
  unit?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

const toNumber = (v: DecimalInputProps['value']): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const format = (n: number | null, decimals: number) =>
  n === null
    ? ''
    : n.toLocaleString('pt-BR', {
        maximumFractionDigits: decimals,
        useGrouping: false,
      });

/**
 * Número decimal no formato pt-BR (vírgula). Aceita "72,5" ou "72.5" na
 * digitação; valida, arredonda e prende entre `min`/`max` ao sair do campo.
 */
export function DecimalInput({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  decimals = 2,
  step,
  unit,
  id,
  name,
  placeholder,
  disabled = false,
  required,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  className,
}: DecimalInputProps) {
  const { t } = useTranslation();
  // Texto em edição; `null` = não está editando (mostra `value` formatado).
  const [draft, setDraft] = useState<string | null>(null);
  const current = toNumber(value);
  const factor = 10 ** decimals;
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, Math.round(n * factor) / factor));
  const stepBy = (delta: number) => onChange(clamp((current ?? min) + delta));

  const commit = () => {
    if (draft === null) return;
    const parsed = toNumber(draft.trim());
    setDraft(null);
    onChange(parsed === null ? null : clamp(parsed));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (step && e.key === 'ArrowUp') stepBy(step);
    else if (step && e.key === 'ArrowDown') stepBy(-step);
    else if (e.key === 'Enter') commit();
    else return;
    e.preventDefault();
  };

  const buttonClass =
    'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex h-full w-9 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      className={cn(
        'border-border/70 bg-background focus-within:border-ring/50 focus-within:ring-ring focus-within:ring-offset-background flex h-9 w-full items-stretch overflow-hidden rounded-md border shadow-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2',
        ariaInvalid && 'border-destructive',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {step && (
        <PlainButton
          type="button"
          tabIndex={-1}
          aria-label={t('common.actions.decrease')}
          onClick={() => stepBy(-step)}
          disabled={disabled || (current !== null && current <= min)}
          className={cn(buttonClass, 'border-border/70 border-r')}
        >
          <Minus className="h-3.5 w-3.5" />
        </PlainButton>
      )}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        value={draft ?? format(current, decimals)}
        onFocus={(e) => {
          setDraft(e.currentTarget.value);
          e.currentTarget.select();
        }}
        onChange={(e) =>
          setDraft(e.target.value.replace(min < 0 ? /[^\d,.-]/g : /[^\d,.]/g, ''))
        }
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          'placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums focus-visible:outline-none disabled:cursor-not-allowed',
          step && 'text-center font-semibold'
        )}
      />
      {unit && (
        <span className="text-muted-foreground flex items-center pr-3 text-xs font-medium select-none">
          {unit}
        </span>
      )}
      {step && (
        <PlainButton
          type="button"
          tabIndex={-1}
          aria-label={t('common.actions.increase')}
          onClick={() => stepBy(step)}
          disabled={disabled || (current !== null && current >= max)}
          className={cn(buttonClass, 'border-border/70 border-l')}
        >
          <Plus className="h-3.5 w-3.5" />
        </PlainButton>
      )}
    </div>
  );
}
