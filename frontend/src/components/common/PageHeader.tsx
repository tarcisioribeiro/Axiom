/**
 * PageHeader Component
 *
 * Componente reutilizável para cabeçalhos de páginas.
 * Padroniza o layout de título + botão de ação.
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon,
  action,
  children,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <div className="h-6 w-6">{icon}</div>
          </div>
        )}
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>
      {children}
      {!children && action && (
        <Button onClick={action.onClick} className="gap-2">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
};
