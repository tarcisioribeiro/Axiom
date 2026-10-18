import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaginatedSlide } from '@/components/common/PaginatedSlide';

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
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

function renderList(items: string[], growOnAdd?: boolean) {
  return render(
    <PaginatedSlide items={items} pageSize={5} growOnAdd={growOnAdd}>
      {(pageItems) => pageItems.map((item) => <div key={item}>{item}</div>)}
    </PaginatedSlide>
  );
}

describe('PaginatedSlide growOnAdd', () => {
  it('jumps to the new page when a page-overflowing item is added', () => {
    const { rerender } = renderList(['a', 'b', 'c', 'd', 'e'], true);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByText('f')).not.toBeInTheDocument();

    rerender(
      <PaginatedSlide items={['a', 'b', 'c', 'd', 'e', 'f']} pageSize={5} growOnAdd>
        {(pageItems) => pageItems.map((item) => <div key={item}>{item}</div>)}
      </PaginatedSlide>
    );

    expect(screen.getByText('f')).toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
  });

  it('stays on the current page when growOnAdd is not set', () => {
    const { rerender } = renderList(['a', 'b', 'c', 'd', 'e']);

    rerender(
      <PaginatedSlide items={['a', 'b', 'c', 'd', 'e', 'f']} pageSize={5}>
        {(pageItems) => pageItems.map((item) => <div key={item}>{item}</div>)}
      </PaginatedSlide>
    );

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByText('f')).not.toBeInTheDocument();
  });
});
