import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect } from 'vitest';

import { CurrencyInput } from '@/components/ui/currency-input';

const Harness = ({ initial }: { initial: string }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CurrencyInput value={value} onChange={(e) => setValue(e.target.value)} />
      <output>{value}</output>
    </>
  );
};

describe('CurrencyInput', () => {
  it('displays value as 0,00 and emits dot-decimal', () => {
    render(<Harness initial="1234.5" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1.234,50');

    fireEvent.change(input, { target: { value: '1.234,507' } });
    expect(screen.getByRole('status').textContent).toBe('12345.07');
    expect(input.value).toBe('12.345,07');

    fireEvent.change(input, { target: { value: '-12.345,07' } });
    expect(screen.getByRole('status').textContent).toBe('-12345.07');

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('status').textContent).toBe('');
    expect(input.value).toBe('');
  });
});
