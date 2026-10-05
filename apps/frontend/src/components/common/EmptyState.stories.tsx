import type { Meta, StoryObj } from '@storybook/react';
import { FolderOpen } from 'lucide-react';

import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Common/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    title: 'Nenhum item encontrado',
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    icon: <FolderOpen />,
    title: 'Pasta vazia',
  },
};
