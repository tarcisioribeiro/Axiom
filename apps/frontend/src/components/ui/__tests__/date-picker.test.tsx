import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatePicker } from '@/components/ui/date-picker';
import { formatLocalDate } from '@/lib/utils';

function isDisabled(date: string): boolean {
  const days = [...document.querySelectorAll('.flatpickr-day')] as (HTMLElement & {
    dateObj: Date;
  })[];
  const day = days.find((d) => formatLocalDate(d.dateObj) === date);
  if (!day) throw new Error(`day ${date} not rendered`);
  return day.classList.contains('flatpickr-disabled');
}

describe('DatePicker bounds', () => {
  it('honors a YYYY-MM-DD string maxDate and updates it on change', () => {
    const { container, rerender } = render(
      <DatePicker value="2026-06-10" maxDate="2026-06-15" placeholder="x" />
    );
    fireEvent.click(container.querySelector('input') as HTMLInputElement);
    expect(isDisabled('2026-06-15')).toBe(false);
    expect(isDisabled('2026-06-16')).toBe(true);

    rerender(<DatePicker value="2026-06-10" maxDate="2026-06-20" placeholder="x" />);
    expect(isDisabled('2026-06-16')).toBe(false);
    expect(isDisabled('2026-06-21')).toBe(true);
  });
});
