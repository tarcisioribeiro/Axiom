import * as React from 'react';
import { createPortal } from 'react-dom';

import { bubbleClasses, type TooltipSide } from '@/components/ui/button-tooltip';
import { cn } from '@/lib/utils';

const GAP = 8; // distância do elemento
const PAD = 8; // margem mínima das bordas da tela
const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

function place(a: DOMRect, w: number, h: number, side: TooltipSide) {
  if (side === 'top' || side === 'bottom')
    return {
      left: a.left + a.width / 2 - w / 2,
      top: side === 'top' ? a.top - h - GAP : a.bottom + GAP,
    };
  return {
    left: side === 'left' ? a.left - w - GAP : a.right + GAP,
    top: a.top + a.height / 2 - h / 2,
  };
}

const clamp = (v: number, max: number) => Math.max(PAD, Math.min(v, max - PAD));

/**
 * Balão de tooltip renderizado no <body> com posição fixa: não é cortado por
 * `overflow` de containers, inverte o lado se não couber e fica dentro da tela.
 */
export function TooltipBubble({
  anchor,
  side = 'top',
  className,
  children,
}: {
  anchor: HTMLElement;
  side?: TooltipSide;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const { width: w, height: h } = ref.current.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fits = (s: TooltipSide) => {
      const p = place(a, w, h, s);
      return s === 'top' || s === 'bottom'
        ? p.top >= PAD && p.top + h <= vh - PAD
        : p.left >= PAD && p.left + w <= vw - PAD;
    };
    const p = place(
      a,
      w,
      h,
      fits(side) || !fits(OPPOSITE[side]) ? side : OPPOSITE[side]
    );
    setPos({ left: clamp(p.left, vw - w), top: clamp(p.top, vh - h) });
  }, [anchor, side, children]);

  return createPortal(
    <span
      ref={ref}
      role="tooltip"
      aria-hidden="true"
      className={cn(bubbleClasses, className)}
      style={pos ?? { left: 0, top: 0, visibility: 'hidden' }}
    >
      {children}
    </span>,
    document.body
  );
}
