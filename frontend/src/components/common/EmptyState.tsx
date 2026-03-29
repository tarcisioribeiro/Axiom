/**
 * EmptyState Component
 *
 * Componente reutilizável para estados vazios.
 * Exibe ícone, mensagem e ação opcional quando não há dados.
 */

import React from 'react';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
}) => {
  return (
    <div
      aria-label={title ?? message}
      className="space-y-md rounded-lg border bg-card p-12 text-center"
    >
      {icon && <div className="flex justify-center [&>svg]:text-primary">{icon}</div>}
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <p>{message}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline" className="mt-md">
          {action.label}
        </Button>
      )}
    </div>
  );
};
