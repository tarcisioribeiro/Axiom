import * as React from 'react';

import { cn } from '@/lib/utils';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-sm',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-sm',
  left: 'right-full top-1/2 -translate-y-1/2 mr-sm',
  right: 'left-full top-1/2 -translate-y-1/2 ml-sm',
};

export const bubbleClasses =
  'border-border/60 bg-popover px-sm py-xs text-popover-foreground pointer-events-none absolute z-50 rounded-md border text-xs font-medium whitespace-nowrap shadow-md';

// Botões dentro de um <Tooltip> já têm tooltip próprio — evita duplicar.
export const InsideTooltipContext = React.createContext(false);

/** Texto visível de um nó React (para usar como tooltip de botões só com texto). */
export function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children);
  return '';
}

interface HoverHandlers {
  onMouseEnter?: React.MouseEventHandler<never>;
  onMouseLeave?: React.MouseEventHandler<never>;
}

/**
 * Tooltip de hover para botões: mesmo visual do <Tooltip>, mas renderizado só
 * enquanto o mouse está sobre o botão (o botão precisa ser `relative`).
 * Conteúdo vazio, ou botão já dentro de um <Tooltip>, não mostra nada.
 */
export function useButtonTooltip(
  content: string | undefined,
  side: TooltipSide,
  handlers: HoverHandlers
) {
  const [show, setShow] = React.useState(false);
  const inside = React.useContext(InsideTooltipContext);
  if (!content || inside) return { tip: null, tipProps: handlers };

  return {
    tipProps: {
      onMouseEnter: (e: React.MouseEvent<never>) => {
        handlers.onMouseEnter?.(e);
        setShow(true);
      },
      onMouseLeave: (e: React.MouseEvent<never>) => {
        handlers.onMouseLeave?.(e);
        setShow(false);
      },
    },
    tip: show ? (
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(bubbleClasses, 'font-normal', sideClasses[side])}
      >
        {content}
      </span>
    ) : null,
  };
}
