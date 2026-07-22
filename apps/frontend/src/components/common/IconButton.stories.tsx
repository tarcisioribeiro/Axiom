import type { Meta, StoryObj } from '@storybook/react';
import { Pencil, Trash2, Plus, Search, Settings, X } from 'lucide-react';

import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Common/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Ação',
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    'aria-label': 'Editar',
    children: <Pencil className="h-4 w-4" />,
  },
};

export const Destructive: Story = {
  args: {
    'aria-label': 'Excluir',
    variant: 'destructive',
    children: <Trash2 className="h-4 w-4" />,
  },
};

export const Outline: Story = {
  args: {
    'aria-label': 'Adicionar',
    variant: 'outline',
    children: <Plus className="h-4 w-4" />,
  },
};

export const Ghost: Story = {
  args: {
    'aria-label': 'Buscar',
    variant: 'ghost',
    children: <Search className="h-4 w-4" />,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton aria-label="Default">
        <Settings className="h-4 w-4" />
      </IconButton>
      <IconButton aria-label="Outline" variant="outline">
        <Pencil className="h-4 w-4" />
      </IconButton>
      <IconButton aria-label="Ghost" variant="ghost">
        <Search className="h-4 w-4" />
      </IconButton>
      <IconButton aria-label="Secondary" variant="secondary">
        <Plus className="h-4 w-4" />
      </IconButton>
      <IconButton aria-label="Destructive" variant="destructive">
        <Trash2 className="h-4 w-4" />
      </IconButton>
      <IconButton aria-label="Fechar" variant="ghost" disabled>
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  ),
};
