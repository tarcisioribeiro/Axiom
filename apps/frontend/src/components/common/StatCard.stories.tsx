import {
  CurrencyDollarIcon as DollarSign,
  ArrowTrendingUpIcon as TrendingUp,
  CreditCardIcon as CreditCard,
  ExclamationCircleIcon as AlertCircle,
} from '@heroicons/react/24/solid';
import type { Meta, StoryObj } from '@storybook/react';

import { StatCard } from './StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'Common/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  args: {
    title: 'Saldo total',
    value: 'R$ 12.540,00',
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    title: 'Receitas do mês',
    value: 'R$ 8.200,00',
    icon: <DollarSign className="text-success h-5 w-5" />,
  },
};

export const WithPositiveTrend: Story = {
  args: {
    title: 'Receitas do mês',
    value: 'R$ 8.200,00',
    icon: <TrendingUp className="text-success h-5 w-5" />,
    trend: { value: 12.5, isPositive: true },
    variant: 'success',
  },
};

export const WithNegativeTrend: Story = {
  args: {
    title: 'Despesas do mês',
    value: 'R$ 3.450,00',
    icon: <CreditCard className="text-destructive h-5 w-5" />,
    trend: { value: -8.3, isPositive: false },
    variant: 'danger',
  },
};

export const WarningVariant: Story = {
  args: {
    title: 'Contas a pagar',
    value: 'R$ 1.800,00',
    icon: <AlertCircle className="text-warning h-5 w-5" />,
    trend: { value: 5.0, isPositive: false },
    variant: 'warning',
  },
};

export const AsPercentage: Story = {
  args: {
    title: 'Orçamento utilizado',
    value: '73%',
    trend: { value: 3.2, isPositive: false },
    variant: 'warning',
  },
};

export const AsRatio: Story = {
  args: {
    title: 'Tarefas concluídas',
    value: '8 / 18',
  },
};

export const Grid: Story = {
  render: () => (
    <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Saldo total"
        value="R$ 12.540,00"
        icon={<DollarSign className="text-primary h-5 w-5" />}
        variant="default"
      />
      <StatCard
        title="Receitas"
        value="R$ 8.200,00"
        icon={<TrendingUp className="text-success h-5 w-5" />}
        trend={{ value: 12.5, isPositive: true }}
        variant="success"
      />
      <StatCard
        title="Despesas"
        value="R$ 3.450,00"
        icon={<CreditCard className="text-destructive h-5 w-5" />}
        trend={{ value: 8.3, isPositive: false }}
        variant="danger"
      />
      <StatCard
        title="A pagar"
        value="R$ 1.800,00"
        icon={<AlertCircle className="text-warning h-5 w-5" />}
        variant="warning"
      />
    </div>
  ),
};
