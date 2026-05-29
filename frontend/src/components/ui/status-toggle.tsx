import { cn } from '@/lib/utils';

interface StatusToggleOption {
  value: string;
  label: string;
  activeClass?: string;
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
    <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
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
                ? (opt.activeClass ?? 'bg-background text-foreground shadow-sm')
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
