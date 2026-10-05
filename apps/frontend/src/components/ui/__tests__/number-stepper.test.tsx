import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { NumberStepper } from '@/components/ui/number-stepper';

const Harness = ({
  initial,
  ...props
}: { initial: number | null } & Partial<Parameters<typeof NumberStepper>[0]>) => {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper value={value} onChange={setValue} aria-label="Ordem" {...props} />
  );
};

const valueOf = () => screen.getByRole('spinbutton', { name: 'Ordem' });

describe('NumberStepper', () => {
  it('aumenta e diminui de 1 em 1 pelos botões', () => {
    render(<Harness initial={1} />);
    const [decrease, increase] = screen.getAllByRole('button');
    fireEvent.click(increase);
    expect(valueOf()).toHaveValue('2');
    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(valueOf()).toHaveValue('0');
  });

  it('não passa do mínimo 0 e desabilita o −', () => {
    render(<Harness initial={0} />);
    const [decrease] = screen.getAllByRole('button');
    expect(decrease).toBeDisabled();
    fireEvent.keyDown(valueOf(), { key: 'ArrowDown' });
    expect(valueOf()).toHaveValue('0');
  });

  it('responde às setas do teclado', () => {
    render(<Harness initial={3} />);
    fireEvent.keyDown(valueOf(), { key: 'ArrowUp' });
    expect(valueOf()).toHaveValue('4');
    fireEvent.keyDown(valueOf(), { key: 'ArrowDown' });
    fireEvent.keyDown(valueOf(), { key: 'ArrowDown' });
    expect(valueOf()).toHaveValue('2');
  });

  it('aceita digitação e prende entre min e max ao sair do campo', () => {
    render(<Harness initial={5} min={1} max={31} />);
    fireEvent.focus(valueOf());
    fireEvent.change(valueOf(), { target: { value: '120' } });
    fireEvent.blur(valueOf());
    expect(valueOf()).toHaveValue('31');
    fireEvent.focus(valueOf());
    fireEvent.change(valueOf(), { target: { value: '12' } });
    fireEvent.keyDown(valueOf(), { key: 'Enter' });
    expect(valueOf()).toHaveValue('12');
  });

  it('descarta letras na digitação', () => {
    render(<Harness initial={5} />);
    fireEvent.focus(valueOf());
    fireEvent.change(valueOf(), { target: { value: '4a2' } });
    fireEvent.blur(valueOf());
    expect(valueOf()).toHaveValue('42');
  });

  it('apagar restaura o valor anterior, a menos que seja opcional', () => {
    const { unmount } = render(<Harness initial={7} />);
    fireEvent.focus(valueOf());
    fireEvent.change(valueOf(), { target: { value: '' } });
    fireEvent.blur(valueOf());
    expect(valueOf()).toHaveValue('7');
    unmount();

    render(<Harness initial={7} optional />);
    fireEvent.focus(valueOf());
    fireEvent.change(valueOf(), { target: { value: '' } });
    fireEvent.blur(valueOf());
    expect(valueOf()).toHaveValue('');
    // Vazio + "+" começa do mínimo
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(valueOf()).toHaveValue('0');
  });
});
