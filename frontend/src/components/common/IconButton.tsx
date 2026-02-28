import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  'aria-label': string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ ...props }, ref) => {
    return <Button ref={ref} size="icon" {...props} />;
  }
);
IconButton.displayName = 'IconButton';

export { IconButton };
