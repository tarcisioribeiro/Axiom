import type { Meta, StoryObj } from '@storybook/react';
import { FolderOpen, Search, PlusCircle } from 'lucide-react';

import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Common/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    message: 'Nenhum item encontrado.',
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithTitle: Story = {
  args: {
    title: 'Nada por aqui',
    message: 'Comece adicionando seu primeiro item.',
  },
};

export const WithIcon: Story = {
  args: {
    icon: <FolderOpen size={48} />,
    title: 'Pasta vazia',
    message: 'Não há arquivos nesta pasta.',
  },
};

export const WithAction: Story = {
  args: {
    icon: <Search size={48} />,
    title: 'Sem resultados',
    message: 'Nenhum resultado foi encontrado para sua busca.',
    action: {
      label: 'Limpar filtros',
      onClick: () => alert('Filtros limpos'),
    },
  },
};

export const FullFeatured: Story = {
  args: {
    icon: <PlusCircle size={48} />,
    title: 'Nenhuma despesa',
    message: 'Você ainda não cadastrou nenhuma despesa. Comece agora!',
    action: {
      label: 'Adicionar despesa',
      onClick: () => alert('Abrir formulário'),
    },
  },
};
