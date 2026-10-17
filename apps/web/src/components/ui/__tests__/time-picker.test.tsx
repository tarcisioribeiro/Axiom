import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { parseTime, pointToValue } from '@/components/ui/clock-dial';
import { TimePicker } from '@/components/ui/time-picker';

describe('clock dial geometry', () => {
  it('maps outer ring to 0–11 and inner ring to 12–23', () => {
    expect(pointToValue(128, 28, 'hour')).toBe(0); // topo, anel externo
    expect(pointToValue(228, 128, 'hour')).toBe(3); // direita, externo
    expect(pointToValue(128, 64, 'hour')).toBe(12); // topo, interno
    expect(pointToValue(128, 192, 'hour')).toBe(18); // baixo, interno
  });

  it('maps minutes with 1-minute resolution', () => {
    expect(pointToValue(128, 28, 'minute')).toBe(0);
    expect(pointToValue(28, 128, 'minute')).toBe(45);
    expect(pointToValue(128 + 100 * Math.sin(Math.PI / 30), 28, 'minute')).toBe(1);
  });

  it('parses typed times', () => {
    expect(parseTime('9:05')).toEqual({ h: 9, m: 5 });
    expect(parseTime('1430')).toEqual({ h: 14, m: 30 });
    expect(parseTime('24:00')).toBeUndefined();
  });
});

describe('TimePicker', () => {
  it('commits a typed value on blur', () => {
    const onChange = vi.fn();
    const { container } = render(<TimePicker value="08:00" onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1430' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('14:30');
  });

  it('confirms the dial selection only on OK', () => {
    const onChange = vi.fn();
    const { container } = render(<TimePicker value="08:15" onChange={onChange} />);
    fireEvent.click(container.querySelector('input') as HTMLInputElement);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onChange).toHaveBeenCalledWith('08:15');
  });
});
