import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { NumberStepper } from '@/components/ui/number-stepper';

const Harness = ({ initial }: { initial: number }) => {
  const [value, setValue] = useState(initial);
  return <NumberStepper value={value} onChange={setValue} aria-label="Ordem" />;
};

const valueOf = () => screen.getByRole('spinbutton', { name: 'Ordem' });

describe('NumberStepper', () => {
  it('aumenta e diminui de 1 em 1 pelos botões', () => {
    render(<Harness initial={1} />);
    const [decrease, increase] = screen.getAllByRole('button');
    fireEvent.click(increase);
    expect(valueOf()).toHaveTextContent('2');
    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(valueOf()).toHaveTextContent('0');
  });

  it('não passa do mínimo 0 e desabilita o −', () => {
    render(<Harness initial={0} />);
    const [decrease] = screen.getAllByRole('button');
    expect(decrease).toBeDisabled();
    fireEvent.keyDown(valueOf(), { key: 'ArrowDown' });
    expect(valueOf()).toHaveTextContent('0');
  });

  it('responde às setas do teclado', () => {
    render(<Harness initial={3} />);
    fireEvent.keyDown(valueOf(), { key: 'ArrowUp' });
    expect(valueOf()).toHaveTextContent('4');
    fireEvent.keyDown(valueOf(), { key: 'ArrowDown' });
    fireEvent.keyDown(valueOf(), { key: 'ArrowDown' });
    expect(valueOf()).toHaveTextContent('2');
  });
});
