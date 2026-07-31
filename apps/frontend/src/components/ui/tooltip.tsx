import * as React from 'react';

import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-sm',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-sm',
  left: 'right-full top-1/2 -translate-y-1/2 mr-sm',
  right: 'left-full top-1/2 -translate-y-1/2 ml-sm',
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
          'border-border/60 bg-popover px-sm py-xs text-popover-foreground pointer-events-none absolute z-50 rounded-md border text-xs font-medium whitespace-nowrap shadow-md',
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
