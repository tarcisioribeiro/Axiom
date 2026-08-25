import { SEMANTIC_ACCENT_ACTIVE_CLASS } from '@/lib/semantic-accent';
import type { SemanticAccent } from '@/lib/semantic-accent';
import { cn } from '@/lib/utils';

interface StatusToggleOption {
  value: string;
  label: string;
  /** @default 'default' */
  accentColor?: SemanticAccent;
}

interface StatusToggleProps {
  value: string;
  options: [StatusToggleOption, StatusToggleOption];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function StatusToggle({
  value,
  options,
  onChange,
  disabled,
}: StatusToggleProps) {
  const [optionA, optionB] = options;
  return (
    <div className="border-border/70 bg-muted/30 flex rounded-md border p-0.5">
      {[optionA, optionB].map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-all duration-150',
              isActive
                ? SEMANTIC_ACCENT_ACTIVE_CLASS[opt.accentColor ?? 'default']
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
