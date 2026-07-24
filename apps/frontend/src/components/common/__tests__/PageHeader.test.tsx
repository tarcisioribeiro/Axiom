import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi } from 'vitest';

import { PageHeader } from '@/components/common/PageHeader';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    renderWithRouter(<PageHeader title="Despesas" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Despesas' })
    ).toBeInTheDocument();
  });

  it('renders without an action button when action prop is absent', () => {
    renderWithRouter(<PageHeader title="Despesas" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button with the given label', () => {
    renderWithRouter(
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
    renderWithRouter(
      <PageHeader title="Despesas" action={{ label: 'Adicionar', onClick }} />
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders an icon when provided', () => {
    renderWithRouter(
      <PageHeader title="Despesas" icon={<svg data-testid="page-icon" />} />
    );
    expect(screen.getByTestId('page-icon')).toBeInTheDocument();
  });

  it('does not render the icon container when icon is absent', () => {
    const { container } = renderWithRouter(<PageHeader title="Despesas" />);
    // The icon wrapper div only appears when icon is provided
    expect(container.querySelector('.rounded-lg')).not.toBeInTheDocument();
  });

  it('renders children instead of the action button when children are provided', () => {
    renderWithRouter(
      <PageHeader title="Despesas" action={{ label: 'Hidden', onClick: vi.fn() }}>
        <span data-testid="custom-child">custom</span>
      </PageHeader>
    );
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument();
  });

  it('renders an action icon inside the button when action.icon is provided', () => {
    renderWithRouter(
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
