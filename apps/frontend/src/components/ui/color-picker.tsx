import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { PlainButton } from '@/components/ui/plain-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Paleta padrão (Tailwind 500): contraste bom nos temas claro e escuro. */
const DEFAULT_COLOR_PRESETS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
];

const HEX = /^#[0-9a-f]{6}$/i;

interface ColorPickerProps {
  /** Hex `#rrggbb`. */
  value: string;
  onChange: (value: string) => void;
  presets?: string[];
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Bolinha + código da cor; abre a paleta e um campo hex. */
export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_COLOR_PRESETS,
  id,
  disabled,
  'aria-label': ariaLabel,
  className,
}: ColorPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Texto do campo hex em edição; `null` = mostra `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const hex = draft ?? value;
  const draftInvalid = draft !== null && !HEX.test(draft);

  const commitDraft = () => {
    if (draft !== null && HEX.test(draft)) onChange(draft.toLowerCase());
    setDraft(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) commitDraft();
        setOpen(o);
      }}
    >
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
            style={{ backgroundColor: value }}
          />
          <span className="text-foreground flex-1 text-left font-mono text-xs uppercase">
            {value}
          </span>
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        </PlainButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="space-y-sm w-60">
        <div className="gap-xs grid grid-cols-5">
          {presets.map((c) => {
            const selected = c.toLowerCase() === value.toLowerCase();
            return (
              <PlainButton
                key={c}
                type="button"
                aria-label={t('common.colorPicker.preset', { color: c })}
                aria-pressed={selected}
                onClick={() => {
                  onChange(c);
                  setDraft(null);
                }}
                className={cn(
                  'focus-visible:ring-ring focus-visible:ring-offset-popover hoverable:hover:scale-110 flex h-8 w-8 items-center justify-center rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96]',
                  selected && 'ring-ring ring-offset-popover ring-2 ring-offset-2'
                )}
                style={{ backgroundColor: c }}
              >
                {selected && <Check className="h-4 w-4 text-white drop-shadow" />}
              </PlainButton>
            );
          })}
        </div>
        <div className="gap-sm border-border/60 pt-sm flex items-center border-t">
          <span
            className="ring-border h-7 w-7 shrink-0 rounded-md ring-1"
            style={{ backgroundColor: HEX.test(hex) ? hex : value }}
          />
          <Input
            value={hex}
            maxLength={7}
            spellCheck={false}
            aria-label={t('common.colorPicker.hex')}
            aria-invalid={draftInvalid}
            onChange={(e) => {
              const v = e.target.value.trim();
              setDraft(v.startsWith('#') ? v : `#${v}`);
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              }
            }}
            className={cn(
              'h-8 font-mono text-xs uppercase',
              draftInvalid && 'border-destructive focus-visible:ring-destructive'
            )}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
