import { APP_VERSION } from '@/lib/app-info';
import { cn } from '@/lib/utils';

interface AppVersionBadgeProps {
  className?: string;
}

export function AppVersionBadge({ className }: AppVersionBadgeProps) {
  return (
    <span
      className={cn(
        'select-none font-mono text-[11px] text-muted-foreground/50',
        className
      )}
      aria-label={`Versão ${APP_VERSION}`}
    >
      v{APP_VERSION}
    </span>
  );
}
