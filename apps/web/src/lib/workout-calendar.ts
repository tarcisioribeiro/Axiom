import type { WorkoutCategory, WorkoutPlan, WorkoutSession } from '@/types/workout';

export type WorkoutEventStatus = 'completed' | 'pending' | 'missed';

/** Ordem de exibição das divisões ativas hoje: mobilidade, força, cardio. */
export const DIVISION_CATEGORY_ORDER: Record<WorkoutCategory, number> = {
  mobility: 0,
  resistance: 1,
  cardio: 2,
};

/** Dia da semana de hoje no padrão do backend (0=Seg...6=Dom). */
export function getTodayWeekday(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Vazio = ativa todos os dias; senão precisa incluir o dia informado. */
export function isDivisionActiveOn(daysOfWeek: number[], weekday: number): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(weekday);
}

export interface WorkoutCalendarEvent {
  id: string;
  date: string;
  title: string | null;
  status: WorkoutEventStatus;
}

/**
 * Um evento por divisão (de plano ativo) agendada no dia — concluído se há
 * sessão dessa divisão; senão perdido no passado / pendente de hoje em
 * diante —, mais as sessões que não cobrem nenhum agendamento (concluídas).
 * Datas em yyyy-MM-dd; dias da semana no padrão do backend (0=Seg).
 * ponytail: usa os planos ativos de hoje também para meses passados — não há
 * histórico de ativação; o limite inferior é a criação do plano.
 */
export function buildWorkoutEvents(
  plans: WorkoutPlan[],
  sessions: WorkoutSession[],
  days: string[],
  today: string
): WorkoutCalendarEvent[] {
  const events: WorkoutCalendarEvent[] = [];
  const used = new Set<number>();
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7;
    for (const plan of plans) {
      if (!plan.is_active || plan.created_at.slice(0, 10) > key) continue;
      for (const division of plan.days) {
        if (!division.days_of_week.includes(weekday)) continue;
        const session = sessions.find(
          (s) => !used.has(s.id) && s.date === key && s.workout_day === division.id
        );
        if (session) used.add(session.id);
        events.push({
          id: `day-${division.id}-${key}`,
          date: key,
          title: `${plan.name} — ${division.name}`,
          status: session ? 'completed' : key < today ? 'missed' : 'pending',
        });
      }
    }
  }
  for (const s of sessions) {
    if (used.has(s.id) || !days.includes(s.date)) continue;
    events.push({
      id: `session-${s.id}`,
      date: s.date,
      title: s.workout_day_name ?? null,
      status: 'completed',
    });
  }
  return events;
}
