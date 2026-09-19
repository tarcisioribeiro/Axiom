import * as React from 'react';

import {
  bubbleClasses,
  InsideTooltipContext,
  sideClasses,
  type TooltipSide,
} from '@/components/ui/button-tooltip';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: TooltipSide;
  className?: string;
}

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
    <InsideTooltipContext.Provider value={true}>
      <div className="group relative inline-flex">
        {children}
        <span
          role="tooltip"
          className={cn(
            bubbleClasses,
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
            sideClasses[side],
            className
          )}
        >
          {content}
        </span>
      </div>
    </InsideTooltipContext.Provider>
  );
}
