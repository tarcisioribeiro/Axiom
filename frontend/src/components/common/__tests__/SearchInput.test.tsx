vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { SearchInput } from '@/components/common/SearchInput';

describe('SearchInput', () => {
  it('renders a text input', () => {
    render(<SearchInput value="" onValueChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SearchInput value="receitas" onValueChange={vi.fn()} />);
    expect(screen.getByDisplayValue('receitas')).toBeInTheDocument();
  });

  it('uses custom placeholder when provided', () => {
    render(
      <SearchInput value="" onValueChange={vi.fn()} placeholder="Buscar despesas" />
    );
    expect(screen.getByPlaceholderText('Buscar despesas')).toBeInTheDocument();
  });

  it('falls back to i18n key when no placeholder is provided', () => {
    render(<SearchInput value="" onValueChange={vi.fn()} />);
    // t('common.actions.search') returns the key itself in our mock
    expect(screen.getByPlaceholderText('common.actions.search')).toBeInTheDocument();
  });

  it('calls onValueChange with the new value when typing', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput value="" onValueChange={onValueChange} />);
    await user.type(screen.getByRole('textbox'), 'abc');
    expect(onValueChange).toHaveBeenCalled();
    // The last call should have the last character typed
    expect(onValueChange).toHaveBeenLastCalledWith('c');
  });

  it('applies additional className to the wrapper', () => {
    const { container } = render(
      <SearchInput value="" onValueChange={vi.fn()} className="w-64" />
    );
    expect(container.firstChild).toHaveClass('w-64');
  });

  it('renders the search icon', () => {
    const { container } = render(<SearchInput value="" onValueChange={vi.fn()} />);
    // lucide-react Search renders an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('passes extra HTML input attributes', () => {
    render(
      <SearchInput
        value=""
        onValueChange={vi.fn()}
        aria-label="Buscar transações"
        disabled
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Buscar transações');
    expect(input).toBeDisabled();
  });
});
