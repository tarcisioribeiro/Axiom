import { describe, expect, it } from 'vitest';

import { degradedReps } from '@/lib/workout-reps';

const series = (sets: number, min: number, max: number) =>
  Array.from({ length: sets }, (_, i) => degradedReps(i, sets, min, max));

describe('degradedReps', () => {
  it('desce do máximo ao mínimo', () => {
    expect(series(3, 8, 12)).toEqual([12, 10, 8]);
    expect(series(3, 8, 10)).toEqual([10, 9, 8]);
    expect(series(2, 8, 12)).toEqual([12, 8]);
  });

  it('arredonda quando a divisão não é exata', () => {
    expect(series(4, 8, 12)).toEqual([12, 11, 9, 8]);
  });

  it('série única usa o máximo; intervalo fixo repete o valor', () => {
    expect(series(1, 8, 12)).toEqual([12]);
    expect(series(3, 10, 10)).toEqual([10, 10, 10]);
  });
});
