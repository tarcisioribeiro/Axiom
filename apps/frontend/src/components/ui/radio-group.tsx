import * as React from 'react';

import { cn } from '@/lib/utils';

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('gap-sm grid', className)}
        role="radiogroup"
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            const childElement = child as React.ReactElement<RadioGroupItemProps>;
            return React.cloneElement(childElement, {
              checked: childElement.props.value === value,
              onChange: () => onValueChange?.(childElement.props.value),
            });
          }
          return child;
        })}
      </div>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  checked?: boolean;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, checked, onChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        value={value}
        checked={checked}
        onChange={onChange}
        className={cn(
          'border-primary text-primary ring-offset-background focus-visible:ring-ring aspect-square h-4 w-4 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
