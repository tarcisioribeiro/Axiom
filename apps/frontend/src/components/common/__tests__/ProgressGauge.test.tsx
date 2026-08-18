vi.mock('framer-motion', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal();
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          React.forwardRef(
            ({ children, ...props }: React.ComponentPropsWithRef<'div'>, ref) =>
              React.createElement(tag, { ...props, ref }, children)
          ),
      }
    ),
  };
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ProgressGauge } from '@/components/common/ProgressGauge';

describe('ProgressGauge', () => {
  it('renders the label and sublabel', () => {
    render(<ProgressGauge value={72} label="72" sublabel="72/100" />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('72/100')).toBeInTheDocument();
  });

  it('renders an svg ring', () => {
    const { container } = render(<ProgressGauge value={50} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders without label/sublabel when omitted', () => {
    const { container } = render(<ProgressGauge value={30} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('accepts a custom size', () => {
    const { container } = render(<ProgressGauge value={40} size={120} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '120');
  });
});
