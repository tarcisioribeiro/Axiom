/**
 * StatCard Component
 *
 * Componente reutilizável para cards de estatísticas.
 * Usado principalmente no Dashboard para exibir métricas financeiras.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cardVariants, useCounter } from '@/lib/animations';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const extractNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;

  const stringVal = String(val);

  // For percentages, remove % and parse as decimal number
  if (stringVal.includes('%')) {
    const cleaned = stringVal.replace('%', '').trim();
    return parseFloat(cleaned);
  }

  // For currency (R$ 1.234,56), convert pt-BR format to standard
  // Remove currency symbol and convert pt-BR format (1.234,56) to standard (1234.56)
  const cleaned = stringVal
    .replace(/[^\d.,-]/g, '') // Remove non-numeric chars except . , -
    .replace(/\./g, '') // Remove thousands separator (dot in pt-BR)
    .replace(',', '.'); // Convert decimal separator (comma to dot)
  return parseFloat(cleaned);
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  variant = 'default',
}) => {
  const variantClasses = {
    default: '',
    success: 'border-success/50 bg-success/5',
    warning: 'border-warning/50 bg-warning/5',
    danger: 'border-destructive/50 bg-destructive/5',
  };

  // Parse numeric value for counter animation.
  // Skip animation for ratio/fraction values (e.g., "8 / 18").
  const isRatio = typeof value === 'string' && value.includes('/');
  const isPercentage = typeof value === 'string' && value.includes('%');
  const isCurrency = typeof value === 'string' && value.includes('R$');

  const numericValue = isRatio ? NaN : extractNumber(value);
  const isNumeric = !isNaN(numericValue);

  // useCounter returns a float — callers format as needed.
  const animatedCount = useCounter(isNumeric ? numericValue : 0);

  const displayValue = isRatio
    ? value
    : isPercentage
      ? `${animatedCount.toFixed(1)}%`
      : isCurrency
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            animatedCount
          )
        : isNumeric
          ? Math.round(animatedCount).toLocaleString('pt-BR')
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon && (
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              {icon}
            </motion.div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayValue}</div>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
                )}
              </motion.div>
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? 'text-success' : 'text-destructive'
                }`}
              >
                {trend.value > 0 ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
