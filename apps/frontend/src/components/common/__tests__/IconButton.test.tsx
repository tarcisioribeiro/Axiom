import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { IconButton } from '@/components/common/IconButton';

describe('IconButton', () => {
  it('renders a button element', () => {
    render(<IconButton aria-label="Fechar">✕</IconButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is accessible via aria-label', () => {
    render(<IconButton aria-label="Excluir item">✕</IconButton>);
    expect(screen.getByRole('button', { name: 'Excluir item' })).toBeInTheDocument();
  });

  it('renders children inside the button', () => {
    render(
      <IconButton aria-label="Edit">
        <svg data-testid="edit-icon" />
      </IconButton>
    );
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <IconButton aria-label="Delete" onClick={onClick}>
        ✕
      </IconButton>
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is passed', () => {
    render(
      <IconButton aria-label="Disabled" disabled>
        ✕
      </IconButton>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies additional className via variant', () => {
    render(
      <IconButton aria-label="Danger" variant="destructive">
        ✕
      </IconButton>
    );
    // Just verifies it renders without errors when a variant is given
    expect(screen.getByRole('button', { name: 'Danger' })).toBeInTheDocument();
  });
});
