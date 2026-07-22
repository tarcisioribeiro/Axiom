import { SlidersHorizontal, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterBarProps {
  children: React.ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  activeFilters?: ActiveFilterChip[];
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  hasActiveFilters,
  onClear,
  activeFilters,
  className,
}) => {
  const { t } = useTranslation();
  const chips = activeFilters?.filter(Boolean) ?? [];
  return (
    <div className={cn('space-y-xs', className)}>
      <div className="flex flex-wrap items-center gap-sm rounded-lg border bg-muted/40 px-3 py-sm">
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
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-xs px-xs">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-xs rounded-full border border-primary/30 bg-primary/10 px-sm py-0.5 text-xs text-primary"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full hover:text-primary/60"
                aria-label={t('common.actions.remove')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
