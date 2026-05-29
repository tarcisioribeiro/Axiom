import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { PageHeader } from '@/components/common/PageHeader';

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Despesas" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Despesas' })
    ).toBeInTheDocument();
  });

  it('renders without an action button when action prop is absent', () => {
    render(<PageHeader title="Despesas" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button with the given label', () => {
    render(
      <PageHeader
        title="Despesas"
        action={{ label: 'Nova Despesa', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Nova Despesa' })).toBeInTheDocument();
  });

  it('calls action.onClick when the button is clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PageHeader title="Despesas" action={{ label: 'Adicionar', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders an icon when provided', () => {
    render(<PageHeader title="Despesas" icon={<svg data-testid="page-icon" />} />);
    expect(screen.getByTestId('page-icon')).toBeInTheDocument();
  });

  it('does not render the icon container when icon is absent', () => {
    const { container } = render(<PageHeader title="Despesas" />);
    // The icon wrapper div only appears when icon is provided
    expect(container.querySelector('.rounded-lg')).not.toBeInTheDocument();
  });

  it('renders children instead of the action button when children are provided', () => {
    render(
      <PageHeader title="Despesas" action={{ label: 'Hidden', onClick: vi.fn() }}>
        <span data-testid="custom-child">custom</span>
      </PageHeader>
    );
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument();
  });

  it('renders an action icon inside the button when action.icon is provided', () => {
    render(
      <PageHeader
        title="Receitas"
        action={{
          label: 'Adicionar',
          icon: <svg data-testid="btn-icon" />,
          onClick: vi.fn(),
        }}
      />
    );
    expect(screen.getByTestId('btn-icon')).toBeInTheDocument();
  });
});
