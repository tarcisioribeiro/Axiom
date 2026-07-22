import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { EmptyState } from '@/components/common/EmptyState';

describe('EmptyState', () => {
  it('renders the required message', () => {
    render(<EmptyState message="Nenhum item encontrado" />);
    expect(screen.getByText('Nenhum item encontrado')).toBeInTheDocument();
  });

  it('has an aria-label for accessibility', () => {
    const { container } = render(<EmptyState message="Nenhum item" />);
    expect(container.firstChild).toHaveAttribute('aria-label');
  });

  it('uses message as aria-label when no title is provided', () => {
    const { container } = render(<EmptyState message="Nenhum item" />);
    expect(container.firstChild).toHaveAttribute('aria-label', 'Nenhum item');
  });

  it('uses title as aria-label when title is provided', () => {
    const { container } = render(
      <EmptyState title="Sem dados" message="Nenhum item" />
    );
    expect(container.firstChild).toHaveAttribute('aria-label', 'Sem dados');
  });

  it('renders title when provided', () => {
    render(<EmptyState title="Lista vazia" message="Nenhum item" />);
    expect(screen.getByText('Lista vazia')).toBeInTheDocument();
  });

  it('does not render a heading when title is not provided', () => {
    render(<EmptyState message="Nenhum item" />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState icon={<svg data-testid="test-icon" />} message="Nenhum item" />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByTestId('icon-container')).toBeInTheDocument();
  });

  it('does not render icon container when icon is not provided', () => {
    render(<EmptyState message="Nenhum item" />);
    expect(screen.queryByTestId('icon-container')).not.toBeInTheDocument();
  });

  it('renders an action button when action prop is provided', () => {
    const onClick = vi.fn();
    render(
      <EmptyState message="Nenhum item" action={{ label: 'Adicionar', onClick }} />
    );
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
  });

  it('calls action.onClick when the action button is clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState message="Nenhum item" action={{ label: 'Adicionar', onClick }} />
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not render a button when action is not provided', () => {
    render(<EmptyState message="Nenhum item" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
