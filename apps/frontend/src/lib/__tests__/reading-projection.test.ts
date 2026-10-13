import { describe, expect, it } from 'vitest';

import { projectReading } from '@/lib/reading-projection';

describe('projectReading', () => {
  const today = new Date(2026, 9, 1);

  it('soma a leitura atual e recalcula ritmo e previsão', () => {
    const p = projectReading({
      bookPages: 200,
      previousReadings: [
        { reading_date: '2026-09-29', pages_read: 20 },
        { reading_date: '2026-09-30', pages_read: 20 },
      ],
      pagesRead: 20,
      readingDate: '2026-10-01',
      today,
    });
    expect(p.previousProgress).toBe(20);
    expect(p.progress).toBe(30);
    expect(p.avgPagesPerDay).toBe(20);
    // 140 restantes ÷ 20 pág./dia = 7 dias
    expect(p.estimatedCompletion).toEqual(new Date(2026, 9, 8));
  });

  it('mesmo dia não conta como dia novo; conclusão encerra previsão', () => {
    const p = projectReading({
      bookPages: 50,
      previousReadings: [{ reading_date: '2026-10-01', pages_read: 30 }],
      pagesRead: 30,
      readingDate: '2026-10-01',
      today,
    });
    expect(p.avgPagesPerDay).toBe(60);
    expect(p.totalPages).toBe(50);
    expect(p.finished).toBe(true);
    expect(p.estimatedCompletion).toBeNull();
  });
});
