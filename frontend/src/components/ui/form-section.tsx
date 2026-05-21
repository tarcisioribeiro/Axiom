import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  icon?: LucideIcon;
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
      <div className="flex items-center gap-xs">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
      <div className="space-y-md">{children}</div>
    </div>
  );
}
