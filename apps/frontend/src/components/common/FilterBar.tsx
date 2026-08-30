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
      <div className="gap-sm bg-muted/40 py-sm flex flex-wrap items-center rounded-lg border px-3">
        <div className="gap-xs text-muted-foreground flex shrink-0 items-center">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{t('common.actions.filter')}</span>
        </div>
        <div className="bg-border h-4 w-px shrink-0" />
        <div className="gap-sm flex flex-1 flex-wrap items-center">{children}</div>
        {hasActiveFilters && onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-xs px-sm text-muted-foreground hover:text-foreground h-7 shrink-0 text-xs"
          >
            <X className="h-3 w-3" />
            {t('common.actions.clearFilters')}
          </Button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="gap-xs px-xs flex flex-wrap">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="gap-xs border-primary/30 bg-primary/10 px-sm text-primary inline-flex items-center rounded-full border py-0.5 text-xs"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:text-primary/60 ml-0.5 rounded-full"
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
