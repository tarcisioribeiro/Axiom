import { describe, expect, it } from 'vitest';

import { buildWorkoutEvents } from '@/lib/workout-calendar';
import type { WorkoutPlan, WorkoutSession } from '@/types/workout';

// 2026-09-28 é segunda-feira (0 no padrão do backend)
const plan = {
  id: 1,
  name: 'Força',
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
  days: [{ id: 10, name: 'A', days_of_week: [0, 2] }],
} as unknown as WorkoutPlan;

const session = (id: number, date: string, workoutDay: number | null) =>
  ({ id, date, workout_day: workoutDay, workout_day_name: 'A' }) as WorkoutSession;

describe('buildWorkoutEvents', () => {
  const days = ['2026-09-21', '2026-09-23', '2026-09-28', '2026-09-30'];

  it('marca concluída, perdida e pendente pelo agendamento do plano', () => {
    const events = buildWorkoutEvents(
      [plan],
      [session(1, '2026-09-21', 10)],
      days,
      '2026-09-28'
    );
    expect(events.map((e) => [e.date, e.status])).toEqual([
      ['2026-09-21', 'completed'],
      ['2026-09-23', 'missed'],
      ['2026-09-28', 'pending'],
      ['2026-09-30', 'pending'],
    ]);
  });

  it('gera um item por divisão agendada no mesmo dia', () => {
    const twoDivisions = {
      ...plan,
      days: [
        { id: 10, name: 'A', days_of_week: [0] },
        { id: 11, name: 'B', days_of_week: [0] },
      ],
    } as unknown as WorkoutPlan;
    const events = buildWorkoutEvents(
      [twoDivisions],
      [session(1, '2026-09-28', 10)],
      ['2026-09-28'],
      '2026-09-28'
    );
    expect(events.map((e) => [e.title, e.status])).toEqual([
      ['Força — A', 'completed'],
      ['Força — B', 'pending'],
    ]);
  });

  it('inclui sessão avulsa como concluída e ignora plano inativo', () => {
    const events = buildWorkoutEvents(
      [{ ...plan, is_active: false }],
      [session(2, '2026-09-23', null)],
      days,
      '2026-09-28'
    );
    expect(events).toEqual([
      { id: 'session-2', date: '2026-09-23', title: 'A', status: 'completed' },
    ]);
  });
});
