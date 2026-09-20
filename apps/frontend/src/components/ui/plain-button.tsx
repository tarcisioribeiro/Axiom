import * as React from 'react';

import { buttonTooltipText, useButtonTooltip } from '@/components/ui/button-tooltip';
import { cn } from '@/lib/utils';

export interface PlainButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto do tooltip. Padrão: aria-label/title, só em botões sem texto. `false` desliga. */
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
    const content = buttonTooltipText(tooltip, props['aria-label'] || title, children);
    const { tip, tipProps } = useButtonTooltip(content || undefined, tooltipSide, {
      onMouseEnter,
      onMouseLeave,
    });

    return (
      <button
        ref={ref}
        // title nativo duplicaria o tooltip; sem tooltip próprio, mantém o title.
        title={content ? undefined : title}
        className={cn(content && 'relative', className)}
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
