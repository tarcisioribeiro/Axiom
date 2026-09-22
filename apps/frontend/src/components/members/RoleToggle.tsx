import { Check, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface RoleToggleProps {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  tone: 'primary' | 'success';
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

const TONES = {
  primary: {
    card: 'border-primary/50 bg-primary/5 ring-primary/20 ring-1',
    icon: 'bg-primary/10 text-primary',
  },
  success: {
    card: 'border-success/50 bg-success/5 ring-success/20 ring-1',
    icon: 'bg-success/10 text-success',
  },
};

export function RoleToggle({
  checked,
  disabled,
  onToggle,
  tone,
  icon: Icon,
  title,
  subtitle,
}: RoleToggleProps) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) onToggle();
      }}
      className={cn(
        'gap-sm p-sm flex cursor-pointer items-start rounded-lg border text-left transition',
        checked ? TONES[tone].card : 'border-border/60 bg-muted/20 opacity-70',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <div
        className={cn(
          'mt-0.5 rounded-full p-1',
          checked ? TONES[tone].icon : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{title}</span>
          <div
            className={cn(
              'border-primary flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border shadow',
              checked ? 'bg-primary text-primary-foreground' : 'bg-background',
              disabled && 'opacity-50'
            )}
          >
            {checked && <Check className="h-3 w-3" />}
          </div>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
      </div>
    </div>
  );
}
