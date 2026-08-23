import { cn } from '@/lib/utils';
import type { IconComponent } from '@/types/icon';

interface FormSectionProps {
  title: string;
  icon?: IconComponent;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  icon: Icon,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn('space-y-md', className)}>
      <div className="gap-xs flex items-center">
        {Icon && <Icon className="text-muted-foreground h-3.5 w-3.5" />}
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {title}
        </span>
        <div className="bg-border/50 h-px flex-1" />
      </div>
      <div className="space-y-md">{children}</div>
    </div>
  );
}
