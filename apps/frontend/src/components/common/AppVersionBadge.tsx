import { APP_VERSION } from '@/lib/app-info';
import { cn } from '@/lib/utils';

interface AppVersionBadgeProps {
  className?: string;
}

export function AppVersionBadge({ className }: AppVersionBadgeProps) {
  return (
    <span
      className={cn(
        'text-muted-foreground/50 text-2xs font-mono select-none',
        className
      )}
      aria-label={`Versão ${APP_VERSION}`}
    >
      v{APP_VERSION}
    </span>
  );
}
