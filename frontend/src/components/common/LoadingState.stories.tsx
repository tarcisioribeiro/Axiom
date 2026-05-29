import type { Meta, StoryObj } from '@storybook/react';

import { LoadingState } from './LoadingState';

const meta: Meta<typeof LoadingState> = {
  title: 'Common/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LoadingState>;

export const SpinnerSmall: Story = {
  args: { size: 'sm' },
};

export const SpinnerMedium: Story = {
  args: { size: 'md' },
};

export const SpinnerLarge: Story = {
  args: { size: 'lg' },
};

export const SpinnerWithMessage: Story = {
  args: {
    size: 'md',
    message: 'Carregando dados...',
  },
};

export const SkeletonTable: Story = {
  args: {
    skeleton: 'table',
    skeletonConfig: { rows: 5, columns: 4 },
  },
};

export const SkeletonList: Story = {
  args: {
    skeleton: 'list',
    skeletonConfig: { items: 4 },
  },
};

export const SkeletonStats: Story = {
  args: {
    skeleton: 'stats',
    skeletonConfig: { items: 4 },
  },
};
