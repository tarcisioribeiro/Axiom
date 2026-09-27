import { act, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import ptBR from '@/i18n/locales/pt-BR.json';
import { formatLocalDate } from '@/lib/utils';

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderForm() {
  const onSubmit = vi.fn(async () => {});
  const utils = render(
    <WorkoutSessionForm
      workoutDays={[]}
      ownerId={1}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />
  );
  const input = utils.container.querySelector(
    'input.flatpickr-input'
  ) as HTMLInputElement;
  fireEvent.click(input);
  return { onSubmit };
}

describe('WorkoutSessionForm date', () => {
  it('submits a retroactive date picked in the calendar', async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(document.querySelector('.flatpickr-prev-month') as HTMLElement);
    fireEvent.click(
      document.querySelector(
        '.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)'
      ) as HTMLElement
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });
    const [data] = onSubmit.mock.calls[0] as unknown as [{ date: string }];
    const prevMonth = new Date();
    prevMonth.setDate(1);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    expect(data.date).toBe(formatLocalDate(prevMonth));
  });

  it('disables future days in the calendar', () => {
    renderForm();
    const today = formatLocalDate(new Date());
    const days = [...document.querySelectorAll('.flatpickr-day')] as (HTMLElement & {
      dateObj: Date;
    })[];
    for (const d of days) {
      const isFuture = formatLocalDate(d.dateObj) > today;
      expect(d.classList.contains('flatpickr-disabled')).toBe(isFuture);
    }
  });
});
