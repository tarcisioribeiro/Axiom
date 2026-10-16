import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PlainButton } from '@/components/ui/plain-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Tokens de cor do tema (semânticos + categorias) — mesmos nomes das
 * variáveis CSS em `index.css`, então a cor acompanha claro/escuro e as
 * variantes de tema em vez de ficar congelada num hex.
 */
const COLOR_TOKENS = [
  'primary',
  'star',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
  'category-finance',
  'category-health',
  'category-studies',
  'category-spiritual',
  'category-exercise',
  'category-nutrition',
  'category-work',
  'category-leisure',
  'category-intellect',
] as const;

interface ColorPickerProps {
  /** Token de cor, ex.: `"primary"` ou `"category-finance"`. */
  value: string;
  onChange: (value: string) => void;
  tokens?: readonly string[];
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Bolinha + nome do token; abre a paleta de cores do tema ativo. */
export function ColorPicker({
  value,
  onChange,
  tokens = COLOR_TOKENS,
  id,
  disabled,
  'aria-label': ariaLabel,
  className,
}: ColorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = (token: string) => t(`common.colorTokens.${token}`, token);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PlainButton
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'border-border/70 bg-background focus-visible:border-ring/50 focus-visible:ring-ring gap-sm flex h-9 w-full items-center rounded-md border px-3 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span
            className="ring-border h-5 w-5 shrink-0 rounded-full ring-1"
            style={{ backgroundColor: `hsl(var(--${value}))` }}
          />
          <span className="text-foreground flex-1 text-left text-xs">
            {label(value)}
          </span>
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        </PlainButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        <div className="gap-xs grid grid-cols-5">
          {tokens.map((tk) => {
            const selected = tk === value;
            return (
              <PlainButton
                key={tk}
                type="button"
                aria-label={label(tk)}
                aria-pressed={selected}
                onClick={() => {
                  onChange(tk);
                  setOpen(false);
                }}
                className={cn(
                  'focus-visible:ring-ring focus-visible:ring-offset-popover hoverable:hover:scale-110 flex h-8 w-8 items-center justify-center rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96]',
                  selected && 'ring-ring ring-offset-popover ring-2 ring-offset-2'
                )}
                style={{ backgroundColor: `hsl(var(--${tk}))` }}
              >
                {selected && <Check className="h-4 w-4 text-white drop-shadow" />}
              </PlainButton>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
