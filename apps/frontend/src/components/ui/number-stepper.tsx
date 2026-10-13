import { Minus, Plus } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PlainButton } from '@/components/ui/plain-button';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  /** `null`/`undefined` = vazio (só faz sentido com `optional`). */
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Permite apagar o valor (emite `null`). Sem isso, apagar restaura o anterior. */
  optional?: boolean;
  disabled?: boolean;
  id?: string;
  /** Nome acessível do valor, quando não há <label htmlFor={id}>. */
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Inteiro com botões − / +, setas ↑/↓ e digitação livre. O valor digitado é
 * validado ao sair do campo (ou Enter) e preso entre `min` e `max`.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  optional = false,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  placeholder,
  className,
}: NumberStepperProps) {
  const { t } = useTranslation();
  // Texto em edição; `null` = não está editando (mostra `value`).
  const [draft, setDraft] = useState<string | null>(null);
  const current = value ?? null;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const set = (next: number) => onChange(clamp(next));
  const stepBy = (delta: number) => set(current === null ? min : current + delta);

  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === '' || text === '-') {
      if (optional) onChange(null);
      return;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) set(parsed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') stepBy(step);
    else if (e.key === 'ArrowDown') stepBy(-step);
    else if (e.key === 'Enter') commit();
    else return;
    e.preventDefault();
  };

  const buttonClass =
    'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex h-full w-9 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      data-stepper=""
      className={cn(
        'border-border/70 bg-background flex h-9 w-fit items-stretch overflow-hidden rounded-md border shadow-sm',
        ariaInvalid && 'border-destructive',
        disabled && 'opacity-50',
        className
      )}
    >
      <PlainButton
        type="button"
        aria-label={t('common.actions.decrease')}
        onClick={() => stepBy(-step)}
        disabled={disabled || (current !== null && current <= min)}
        className={cn(buttonClass, 'border-border/70 border-r')}
      >
        <Minus className="h-3.5 w-3.5" />
      </PlainButton>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-valuenow={current ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
        disabled={disabled}
        placeholder={placeholder}
        value={draft ?? (current === null ? '' : String(current))}
        onFocus={(e) => {
          setDraft(e.currentTarget.value);
          e.currentTarget.select();
        }}
        onChange={(e) =>
          setDraft(e.target.value.replace(min < 0 ? /[^\d-]/g : /\D/g, ''))
        }
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="text-foreground placeholder:text-muted-foreground w-16 min-w-0 flex-1 border-0 bg-transparent py-0 text-center text-sm font-semibold tabular-nums focus:ring-0 focus-visible:outline-none"
      />
      <PlainButton
        type="button"
        aria-label={t('common.actions.increase')}
        onClick={() => stepBy(step)}
        disabled={disabled || (current !== null && current >= max)}
        className={cn(buttonClass, 'border-border/70 border-l')}
      >
        <Plus className="h-3.5 w-3.5" />
      </PlainButton>
    </div>
  );
}
