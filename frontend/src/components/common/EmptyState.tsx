import { motion } from 'framer-motion';
import React from 'react';

import { Button } from '@/components/ui/button';
import { emptyStateVariants } from '@/lib/animations';

interface EmptyStateActionObject {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  description?: string;
  action?: EmptyStateActionObject | React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  description,
  action,
}) => {
  const text = message ?? description ?? '';
  return (
    <motion.div
      variants={emptyStateVariants}
      initial="initial"
      animate="animate"
      aria-label={title ?? text}
      className="flex flex-col items-center justify-center gap-md rounded-lg border border-dashed bg-card/50 px-xl py-16 text-center"
    >
      {icon && (
        <div
          data-testid="icon-container"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 [&>svg]:h-7 [&>svg]:w-7"
        >
          {icon}
        </div>
      )}
      <div className="space-y-xs">
        {title && <h3 className="text-base font-semibold">{title}</h3>}
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
      {action &&
        (React.isValidElement(action) ? (
          action
        ) : (
          <Button
            onClick={(action as EmptyStateActionObject).onClick}
            variant="outline"
            size="sm"
            className="mt-xs"
          >
            {(action as EmptyStateActionObject).icon}
            {(action as EmptyStateActionObject).label}
          </Button>
        ))}
    </motion.div>
  );
};
