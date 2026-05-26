import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cardVariants, useCounter } from '@/lib/animations';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    /** Optional period label, e.g. "vs. mês anterior" */
    period?: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const extractNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.includes('%')) return parseFloat(s.replace('%', '').trim());
  const cleaned = s.replace(/[^\d.,-]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastComma > lastDot) {
    // pt-BR style: dot is thousands separator, comma is decimal separator
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // en-US style: comma is thousands separator, dot is decimal separator
  return parseFloat(cleaned.replace(/,/g, ''));
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  variant = 'default',
}) => {
  const { i18n } = useTranslation();
  const variantClasses = {
    default: '',
    success: 'border-success/40 bg-success/[0.04]',
    warning: 'border-warning/40 bg-warning/[0.04]',
    danger: 'border-destructive/40 bg-destructive/[0.04]',
  };

  const iconBadgeClasses = {
    default: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
    success:
      'bg-success/12 text-[hsl(var(--success))] ring-1 ring-inset ring-success/25',
    warning:
      'bg-warning/12 text-[hsl(var(--warning))] ring-1 ring-inset ring-warning/25',
    danger: 'bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/25',
  };

  const { isRatio, isPercentage, isCurrency, numericValue, isNumeric } = useMemo(() => {
    const ratio = typeof value === 'string' && value.includes('/');
    const percentage = typeof value === 'string' && value.includes('%');
    const currency = typeof value === 'string' && value.includes('R$');
    const numeric = ratio ? NaN : extractNumber(value);
    return {
      isRatio: ratio,
      isPercentage: percentage,
      isCurrency: currency,
      numericValue: numeric,
      isNumeric: !isNaN(numeric),
    };
  }, [value]);

  const animatedCount = useCounter(isNumeric ? numericValue : 0);

  const displayValue = isRatio
    ? value
    : isPercentage
      ? `${animatedCount.toFixed(1)}%`
      : isCurrency
        ? formatCurrency(animatedCount)
        : isNumeric
          ? Math.round(animatedCount).toLocaleString(i18n.language)
          : value;

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
    >
      <Card className={`transition-shadow ${variantClasses[variant]}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
          <p className="text-sm font-medium tracking-tight">{title}</p>
          {icon && (
            <motion.div
              whileHover={{ scale: 1.05, rotate: 4 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4',
                iconBadgeClasses[variant]
              )}
            >
              {icon}
            </motion.div>
          )}
        </CardHeader>
        <CardContent>
          <div className="numeric text-2xl font-bold tracking-tight">
            {displayValue}
          </div>
          {description && (
            <p className="mt-xs text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="mt-sm flex items-center gap-xs">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
                ) : (
                  <TrendingDown
                    className="h-4 w-4 text-destructive"
                    aria-hidden="true"
                  />
                )}
              </motion.div>
              <span
                className={`text-xs font-medium ${trend.isPositive ? 'text-success' : 'text-destructive'}`}
              >
                {trend.value > 0 ? '+' : ''}
                {trend.value}%
              </span>
              {trend.period && (
                <span className="text-xs text-muted-foreground">{trend.period}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
