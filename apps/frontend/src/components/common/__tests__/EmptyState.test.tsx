import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EmptyState } from '@/components/common/EmptyState';

describe('EmptyState', () => {
  it('renders the title as a heading', () => {
    render(<EmptyState title="Nenhum item encontrado" />);
    expect(
      screen.getByRole('heading', { name: 'Nenhum item encontrado' })
    ).toBeInTheDocument();
  });

  it('uses the title as aria-label', () => {
    render(<EmptyState title="Sem dados" />);
    expect(screen.getByLabelText('Sem dados')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState icon={<svg data-testid="test-icon" />} title="Nenhum item" />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByTestId('icon-container')).toBeInTheDocument();
  });

  it('does not render icon container when icon is not provided', () => {
    render(<EmptyState title="Nenhum item" />);
    expect(screen.queryByTestId('icon-container')).not.toBeInTheDocument();
  });

  it('never renders a button', () => {
    render(<EmptyState title="Nenhum item" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
