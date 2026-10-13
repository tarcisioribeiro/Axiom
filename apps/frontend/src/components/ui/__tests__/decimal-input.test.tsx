import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { DecimalInput } from '@/components/ui/decimal-input';
import { Slider } from '@/components/ui/slider';

type Props = Partial<Parameters<typeof DecimalInput>[0]>;

const Harness = ({ initial, ...props }: { initial: number | null } & Props) => {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <DecimalInput value={value} onChange={setValue} aria-label="Peso" {...props} />
      <output data-testid="raw">{String(value)}</output>
    </>
  );
};

const field = () => screen.getByRole('textbox', { name: 'Peso' });
const raw = () => screen.getByTestId('raw').textContent;
const type = (text: string) => {
  fireEvent.focus(field());
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.blur(field());
};

describe('DecimalInput', () => {
  it('aceita vírgula, exibe em pt-BR e entrega número', () => {
    render(<Harness initial={null} />);
    type('72,5');
    expect(raw()).toBe('72.5');
    expect(field()).toHaveValue('72,5');
  });

  it('arredonda nas casas decimais e prende entre min e max', () => {
    render(<Harness initial={null} decimals={1} max={300} />);
    type('80,46');
    expect(raw()).toBe('80.5');
    type('999');
    expect(raw()).toBe('300');
  });

  it('vazio vira null; com step, − / + e setas somam o passo', () => {
    render(<Harness initial={10} step={0.5} />);
    fireEvent.click(screen.getByRole('button', { name: /increase|aumentar/i }));
    expect(raw()).toBe('10.5');
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(raw()).toBe('9.5');
    type('');
    expect(raw()).toBe('null');
  });
});

describe('Slider', () => {
  it('não deixa o valor descer abaixo do floor', () => {
    const Wrap = () => {
      const [v, setV] = useState(500);
      return (
        <Slider value={v} onChange={setV} max={1000} floor={300} aria-label="Limite" />
      );
    };
    render(<Wrap />);
    const slider = screen.getByRole('slider', { name: 'Limite' });
    fireEvent.change(slider, { target: { value: '100' } });
    expect(slider).toHaveValue('300');
  });
});
