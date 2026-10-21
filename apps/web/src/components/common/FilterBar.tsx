import { SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterFieldProps {
  label: string;
  /** Ícone à esquerda do rótulo (todo rótulo tem ícone). */
  icon: LucideIcon;
  children: React.ReactElement;
}

/** Campo do FilterBar com rótulo acima do controle. */
export const FilterField: React.FC<FilterFieldProps> = ({
  label,
  icon: Icon,
  children,
}) => {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="gap-xs flex flex-col">
      <span
        id={id}
        className="gap-xs text-muted-foreground flex items-center justify-center text-xs font-medium"
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="flex [&>*]:min-w-0 [&>*]:flex-1">{children}</div>
    </div>
  );
};

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
        'gap-sm bg-muted/40 py-sm flex flex-wrap items-end rounded-lg border px-3',
        className
      )}
    >
      <div className="gap-sm text-muted-foreground flex h-9 shrink-0 items-center">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{t('common.actions.filter')}</span>
        <div className="bg-border h-4 w-px" />
      </div>
      <div className="gap-sm flex flex-1 flex-wrap items-end">
        {React.Children.map(children, (child) => {
          // Botões de ação (ex: "Favoritos") mantêm o tamanho natural;
          // os demais campos (busca, selects, date range) esticam para
          // ocupar o espaço horizontal disponível em vez de ficarem
          // espremidos à esquerda. A regra `[&>*]` aplica flex-1 no
          // elemento renderizado de fato, o que sobrepõe qualquer largura
          // fixa (w-40, w-52...) que a página tenha passado, já que
          // flex-basis tem prioridade sobre width no eixo principal.
          // Cada campo vai dentro de <FilterField label=... icon=...> (rótulo acima).
          if (!React.isValidElement(child) || child.type === Button) {
            return child;
          }
          return (
            <div className="flex min-w-[9rem] flex-1 [&>*]:min-w-0 [&>*]:flex-1">
              {child}
            </div>
          );
        })}
      </div>
      {onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          tabIndex={hasActiveFilters ? 0 : -1}
          aria-hidden={!hasActiveFilters}
          className={cn(
            'gap-xs px-sm text-muted-foreground hover:text-foreground h-9 shrink-0 text-xs',
            hasActiveFilters ? 'animate-pop-in' : 'animate-pop-out pointer-events-none'
          )}
        >
          <X className="h-3 w-3" />
          {t('common.actions.clearFilters')}
        </Button>
      )}
    </div>
  );
};
