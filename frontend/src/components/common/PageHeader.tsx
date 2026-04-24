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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 md:h-11 md:w-11 [&>*]:h-5 [&>*]:w-5 md:[&>*]:h-5 md:[&>*]:w-5">
            {icon}
          </div>
        )}
        <h1 className="heading-1">{title}</h1>
      </div>
      {children}
      {!children && action && (
        <Button onClick={action.onClick} className="gap-sm">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
};
