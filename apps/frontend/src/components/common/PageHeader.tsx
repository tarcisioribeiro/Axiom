import React from 'react';
import { useLocation } from 'react-router';

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

type Module = 'finance' | 'security' | 'library' | 'planning' | 'workout' | 'nutrition';

const moduleColors: Record<Module, { bg: string; color: string; ring: string }> = {
  finance: {
    bg: 'hsl(var(--category-finance) / 0.1)',
    color: 'hsl(var(--category-finance))',
    ring: 'hsl(var(--category-finance) / 0.2)',
  },
  security: {
    bg: 'hsl(var(--category-studies) / 0.1)',
    color: 'hsl(var(--category-studies))',
    ring: 'hsl(var(--category-studies) / 0.2)',
  },
  library: {
    bg: 'hsl(var(--category-intellect) / 0.1)',
    color: 'hsl(var(--category-intellect))',
    ring: 'hsl(var(--category-intellect) / 0.2)',
  },
  planning: {
    bg: 'hsl(var(--category-health) / 0.1)',
    color: 'hsl(var(--category-health))',
    ring: 'hsl(var(--category-health) / 0.2)',
  },
  workout: {
    bg: 'hsl(var(--category-exercise) / 0.1)',
    color: 'hsl(var(--category-exercise))',
    ring: 'hsl(var(--category-exercise) / 0.2)',
  },
  nutrition: {
    bg: 'hsl(var(--category-nutrition) / 0.1)',
    color: 'hsl(var(--category-nutrition))',
    ring: 'hsl(var(--category-nutrition) / 0.2)',
  },
};

function getModuleFromPath(pathname: string): Module | null {
  if (pathname.includes('nutrition')) return 'nutrition';
  if (pathname.includes('workout')) return 'workout';
  if (pathname.startsWith('/security')) return 'security';
  if (pathname.startsWith('/library')) return 'library';
  if (
    pathname.startsWith('/planning') ||
    pathname.startsWith('/daily') ||
    pathname.startsWith('/routine') ||
    pathname.startsWith('/today')
  )
    return 'planning';
  if (
    pathname === '/dashboard' ||
    /^\/(accounts|credit-cards|expenses|revenues|transfers|loans|budgets|bills|vaults|financial-goals|recurring|transactions|bank-reconciliation|categorization-rules|members|payables|receivables|webhooks)/.test(
      pathname
    )
  )
    return 'finance';
  return null;
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
  const { pathname } = useLocation();
  const subtitleText = subtitle ?? description;

  const module = getModuleFromPath(pathname);
  const colors = module ? moduleColors[module] : null;

  const iconStyle = colors
    ? {
        backgroundColor: colors.bg,
        color: colors.color,
        boxShadow: `inset 0 0 0 1px ${colors.ring}`,
      }
    : undefined;

  const iconBaseClass =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:h-11 md:w-11 [&>*]:h-5 [&>*]:w-5 md:[&>*]:h-5 md:[&>*]:w-5';

  const iconDefaultClass = colors
    ? iconBaseClass
    : `${iconBaseClass} bg-primary/10 text-primary ring-1 ring-inset ring-primary/15`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={iconDefaultClass} style={iconStyle}>
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
