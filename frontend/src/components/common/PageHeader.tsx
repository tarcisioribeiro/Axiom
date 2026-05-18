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
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  icon,
  action,
  actions,
  children,
}) => {
  const subtitleText = subtitle ?? description;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 md:h-11 md:w-11 [&>*]:h-5 [&>*]:w-5 md:[&>*]:h-5 md:[&>*]:w-5">
            {icon}
          </div>
        )}
        <div>
          <h1 className="heading-1">{title}</h1>
          {subtitleText && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitleText}</p>
          )}
        </div>
      </div>
      {children}
      {!children && actions}
      {!children && !actions && action && (
        <Button onClick={action.onClick} className="gap-sm">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
};
