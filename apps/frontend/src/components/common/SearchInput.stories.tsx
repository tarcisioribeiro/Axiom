import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { SearchInput } from './SearchInput';

const meta: Meta<typeof SearchInput> = {
  title: 'Common/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
  args: {
    value: '',
    onValueChange: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof SearchInput>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: {
    value: 'conta corrente',
  },
};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Buscar por nome ou categoria...',
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="space-y-sm">
        <SearchInput value={value} onValueChange={setValue} />
        {value && (
          <p className="text-sm text-muted-foreground">
            Buscando por: <strong>{value}</strong>
          </p>
        )}
      </div>
    );
  },
};
