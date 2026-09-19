import * as React from 'react';

import { textOf, useButtonTooltip } from '@/components/ui/button-tooltip';
import { cn } from '@/lib/utils';

export interface PlainButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto do tooltip. Padrão: aria-label, title ou texto do botão. `false` desliga. */
  tooltip?: string | false;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

/** `<button>` sem estilo próprio, com o tooltip padrão do app. */
const PlainButton = React.forwardRef<HTMLButtonElement, PlainButtonProps>(
  (
    {
      tooltip,
      tooltipSide = 'top',
      className,
      children,
      title,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const content =
      tooltip === false
        ? undefined
        : (tooltip ?? (props['aria-label'] || title || textOf(children).trim()));
    const { tip, tipProps } = useButtonTooltip(content || undefined, tooltipSide, {
      onMouseEnter,
      onMouseLeave,
    });

    return (
      <button
        ref={ref}
        // title nativo duplicaria o tooltip; sem tooltip próprio, mantém o title.
        title={content ? undefined : title}
        className={cn('relative', className)}
        {...props}
        {...tipProps}
      >
        {children}
        {tip}
      </button>
    );
  }
);
PlainButton.displayName = 'PlainButton';

export { PlainButton };
