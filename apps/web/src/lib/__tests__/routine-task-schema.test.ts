import { describe, expect, it } from 'vitest';

import { routineTaskSchema } from '@/lib/validations';

const base = {
  name: 'Ler',
  category: 'health',
  periodicity: 'daily',
  daily_occurrences: 1,
  is_active: true,
  priority: 'medium' as const,
  is_optional: false,
  allowed_skips_per_month: 0,
  target_quantity: 1,
  unit: 'vez' as const,
  owner: 1,
};

const ok = (v: object) => routineTaskSchema.safeParse({ ...base, ...v }).success;

describe('routineTaskSchema horário de encerramento', () => {
  it('rejeita fim antes do início em tarefa de uma ocorrência', () => {
    expect(ok({ default_time: '10:00', closing_time: '09:59' })).toBe(false);
    expect(ok({ default_time: '9:00', closing_time: '10:00' })).toBe(true);
    expect(ok({ default_time: '10:00', closing_time: '10:00' })).toBe(true);
  });
});
