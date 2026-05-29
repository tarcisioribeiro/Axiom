import { SlidersHorizontal, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: React.ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  hasActiveFilters,
  onClear,
  className,
}) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-sm rounded-lg border bg-muted/40 px-3 py-sm',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-xs text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{t('common.actions.filter')}</span>
      </div>
      <div className="h-4 w-px shrink-0 bg-border" />
      <div className="flex flex-1 flex-wrap items-center gap-sm">{children}</div>
      {hasActiveFilters && onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 shrink-0 gap-xs px-sm text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          {t('common.actions.clearFilters')}
        </Button>
      )}
    </div>
  );
};
