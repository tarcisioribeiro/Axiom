import type { LucideIcon } from 'lucide-react';

import { PlainButton } from '@/components/ui/plain-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ViewModeOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

interface ViewModeToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ViewModeOption<T>[];
}

/**
 * Alternador de modo de visualização (lista / grade / kanban / radar...), só
 * ícones com tooltip. Mesmo visual em todas as telas (§4): ativo em `bg-primary`.
 */
export function ViewModeToggle<T extends string>({
  value,
  onChange,
  options,
}: ViewModeToggleProps<T>) {
  return (
    <div className="flex items-center rounded-md border p-0.5">
      {options.map(({ value: mode, label, icon: Icon }) => (
        <Tooltip key={mode} content={label} side="bottom">
          <PlainButton
            type="button"
            onClick={() => onChange(mode)}
            aria-label={label}
            aria-pressed={value === mode}
            className={cn(
              'px-sm py-xs rounded transition-colors',
              value === mode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </PlainButton>
        </Tooltip>
      ))}
    </div>
  );
}
