import type { Meta, StoryObj } from '@storybook/react';
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';

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
    icon: <DollarSign className="h-5 w-5 text-success" />,
  },
};

export const WithPositiveTrend: Story = {
  args: {
    title: 'Receitas do mês',
    value: 'R$ 8.200,00',
    icon: <TrendingUp className="h-5 w-5 text-success" />,
    trend: { value: 12.5, isPositive: true },
    variant: 'success',
  },
};

export const WithNegativeTrend: Story = {
  args: {
    title: 'Despesas do mês',
    value: 'R$ 3.450,00',
    icon: <CreditCard className="h-5 w-5 text-destructive" />,
    trend: { value: -8.3, isPositive: false },
    variant: 'danger',
  },
};

export const WarningVariant: Story = {
  args: {
    title: 'Contas a pagar',
    value: 'R$ 1.800,00',
    icon: <AlertCircle className="h-5 w-5 text-warning" />,
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
    <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
      <StatCard
        title="Saldo total"
        value="R$ 12.540,00"
        icon={<DollarSign className="h-5 w-5 text-primary" />}
        variant="default"
      />
      <StatCard
        title="Receitas"
        value="R$ 8.200,00"
        icon={<TrendingUp className="h-5 w-5 text-success" />}
        trend={{ value: 12.5, isPositive: true }}
        variant="success"
      />
      <StatCard
        title="Despesas"
        value="R$ 3.450,00"
        icon={<CreditCard className="h-5 w-5 text-destructive" />}
        trend={{ value: 8.3, isPositive: false }}
        variant="danger"
      />
      <StatCard
        title="A pagar"
        value="R$ 1.800,00"
        icon={<AlertCircle className="h-5 w-5 text-warning" />}
        variant="warning"
      />
    </div>
  ),
};
