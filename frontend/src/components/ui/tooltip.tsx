import * as React from 'react';

import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

/**
 * Tooltip customizado para substituir o tooltip nativo do browser (atributo title).
 * Exibe um texto estilizado ao passar o mouse sobre o elemento filho.
 *
 * @example
 * <Tooltip content="Editar">
 *   <Button variant="ghost" size="icon"><Edit /></Button>
 * </Tooltip>
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border/60 bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md',
          'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
          sideClasses[side],
          className
        )}
      >
        {content}
      </span>
    </div>
  );
}
