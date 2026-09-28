import * as React from 'react';

import { TooltipBubble } from '@/components/ui/tooltip-bubble';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export const bubbleClasses =
  'border-border/60 bg-popover px-sm py-xs text-popover-foreground pointer-events-none fixed z-[9999] max-w-[calc(100vw-1rem)] rounded-md border text-xs font-medium shadow-md';

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

/**
 * Texto do tooltip de um botão: só botões sem texto visível (ícone) têm tooltip,
 * usando aria-label/title. `tooltip` explícito sempre vale; `false` desliga.
 */
export function buttonTooltipText(
  tooltip: string | false | undefined,
  fallback: string | undefined,
  children: React.ReactNode
): string | undefined {
  if (tooltip === false) return undefined;
  if (tooltip) return tooltip;
  return textOf(children).trim() ? undefined : fallback || undefined;
}

interface HoverHandlers {
  onMouseEnter?: React.MouseEventHandler<never>;
  onMouseLeave?: React.MouseEventHandler<never>;
}

/**
 * Tooltip de hover para botões: mesmo visual do <Tooltip>, renderizado só
 * enquanto o mouse está sobre o botão.
 * Conteúdo vazio, ou botão já dentro de um <Tooltip>, não mostra nada.
 */
export function useButtonTooltip(
  content: string | undefined,
  side: TooltipSide,
  handlers: HoverHandlers
) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const inside = React.useContext(InsideTooltipContext);
  if (!content || inside) return { tip: null, tipProps: handlers };

  return {
    tipProps: {
      onMouseEnter: (e: React.MouseEvent<never>) => {
        handlers.onMouseEnter?.(e);
        setAnchor(e.currentTarget);
      },
      onMouseLeave: (e: React.MouseEvent<never>) => {
        handlers.onMouseLeave?.(e);
        setAnchor(null);
      },
    },
    tip: anchor ? (
      <TooltipBubble anchor={anchor} side={side} className="font-normal">
        {content}
      </TooltipBubble>
    ) : null,
  };
}
