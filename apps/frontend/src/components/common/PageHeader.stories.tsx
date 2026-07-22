import type { Meta, StoryObj } from '@storybook/react';
import { DollarSign, Plus, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Common/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  args: {
    title: 'Despesas',
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {};

export const WithIcon: Story = {
  args: {
    title: 'Despesas',
    icon: <DollarSign />,
  },
};

export const WithAction: Story = {
  args: {
    title: 'Despesas',
    icon: <DollarSign />,
    action: {
      label: 'Nova despesa',
      icon: <Plus className="h-4 w-4" />,
      onClick: () => alert('Abrir formulário'),
    },
  },
};

export const WithChildren: Story = {
  args: {
    title: 'Despesas',
    icon: <DollarSign />,
  },
  render: (args) => (
    <PageHeader {...args}>
      <div className="flex gap-sm">
        <Button variant="outline" size="sm">
          <Filter className="mr-sm h-4 w-4" />
          Filtros
        </Button>
        <Button size="sm">
          <Plus className="mr-sm h-4 w-4" />
          Nova despesa
        </Button>
      </div>
    </PageHeader>
  ),
};
