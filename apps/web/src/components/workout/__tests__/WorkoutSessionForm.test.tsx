import { act, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import ptBR from '@/i18n/locales/pt-BR.json';
import { formatLocalDate } from '@/lib/utils';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

vi.mock('@/hooks/use-alert-dialog', () => ({
  useAlertDialog: () => ({ showConfirm: () => Promise.resolve(true) }),
}));

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
  // Sessão nova sem divisão não salva; usa uma sessão existente de hoje
  const session = {
    id: 1,
    workout_day: 1,
    date: formatLocalDate(new Date()),
    session_exercises: [],
  } as never;
  const utils = render(
    <WorkoutSessionForm
      workoutDays={[]}
      ownerId={1}
      session={session}
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

describe('WorkoutSessionForm load', () => {
  const set = (id: number, load: string | null) =>
    ({ id, set_number: id, load, load_unit: 'kg', completed: true }) as never;
  const session = {
    id: 1,
    date: '2026-01-10',
    started_at: '07:00',
    finished_at: '08:00',
    session_exercises: [
      {
        id: 1,
        exercise_name: 'Supino',
        sets_target: 2,
        reps_target_min: 8,
        reps_target_max: 12,
        load_target_unit: 'kg',
        order: 0,
        sets: [set(1, '62.50'), set(2, null)],
      },
    ],
  } as never;

  it('formats kg in pt-BR, labels bodyweight and normalizes on submit', async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <WorkoutSessionForm
        workoutDays={[]}
        ownerId={1}
        session={session}
        bodyWeightKg="80.25"
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    expect(screen.getByDisplayValue('62,5')).toBeTruthy();
    expect(screen.getAllByText('Peso corporal - 80,3 kg').length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });
    const [data] = onSubmit.mock.calls[0] as unknown as [
      { exercises: { sets: { load: string; load_unit: string }[] }[] },
    ];
    expect(data.exercises[0].sets.map((s) => [s.load, s.load_unit])).toEqual([
      ['62.5', 'kg'],
      ['', 'kg'],
    ]);
  });
});

describe('WorkoutSessionForm sequence', () => {
  const ex = (id: number, name: string) => ({
    id,
    exercise_name: name,
    sets_target: 1,
    reps_target_min: 8,
    reps_target_max: 12,
    load_target_unit: 'kg',
    order: id,
    sets: [{ id, set_number: 1, load: '10', load_unit: 'kg', completed: true }],
  });
  const session = {
    id: 1,
    workout_day: 1,
    date: '2026-01-10',
    session_exercises: [ex(1, 'Supino'), ex(2, 'Agachamento')],
  } as never;

  it('skips an exercise and reaches the end without extra exercises', async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <WorkoutSessionForm
        workoutDays={[]}
        ownerId={1}
        session={session}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Exercício 1 de 2')).toBeTruthy();
    expect(screen.getByText('Supino')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /pular/i }));
    });
    // Aguarda a animação de saída e a remoção do exercício pulado
    expect(await screen.findByText('Exercício 1 de 1')).toBeTruthy();
    expect(screen.getByText('Agachamento')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    expect(await screen.findByText('Sequência concluída')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /adicionar exercício/i })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });
    const [data] = onSubmit.mock.calls[0] as unknown as [
      { exercises: { exercise_name: string }[] },
    ];
    expect(data.exercises.map((e) => e.exercise_name)).toEqual(['Agachamento']);
  });

  it('blocks saving a new session without a split', async () => {
    const onSubmit = vi.fn();
    render(
      <WorkoutSessionForm
        workoutDays={[]}
        ownerId={1}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    // Salvar fica clicável; a validação vai para toast + borda vermelha
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Divisão: campo obrigatório' })
    );
    expect(document.getElementById('session-day')?.getAttribute('aria-invalid')).toBe(
      'true'
    );
  });
});
