import * as React from 'react';

import { InsideTooltipContext, type TooltipSide } from '@/components/ui/button-tooltip';
import { TooltipBubble } from '@/components/ui/tooltip-bubble';

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
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  return (
    <InsideTooltipContext.Provider value={true}>
      <div
        className="inline-flex"
        onMouseEnter={(e) => setAnchor(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
      >
        {children}
        {anchor && (
          <TooltipBubble anchor={anchor} side={side} className={className}>
            {content}
          </TooltipBubble>
        )}
      </div>
    </InsideTooltipContext.Provider>
  );
}
