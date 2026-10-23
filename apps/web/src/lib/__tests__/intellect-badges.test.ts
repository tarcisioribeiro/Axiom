import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { MEDAL_CLASSES, badgeLabel } from '@/lib/intellect-badges';
import type { IntellectBadge } from '@/services/intellect-badges-service';

describe('MEDAL_CLASSES', () => {
  it('defines classes for every medal tier', () => {
    expect(MEDAL_CLASSES.bronze).toContain('medal-bronze');
    expect(MEDAL_CLASSES.silver).toContain('medal-silver');
    expect(MEDAL_CLASSES.gold).toContain('medal-gold');
  });
});

describe('badgeLabel', () => {
  const makeBadge = (overrides: Partial<IntellectBadge> = {}) =>
    ({
      code: 'first_book',
      code_display: 'Primeiro Livro',
      ...overrides,
    }) as IntellectBadge;

  it('translates the badge code through i18n', () => {
    const t = ((key: string) => `translated:${key}`) as unknown as TFunction;
    expect(badgeLabel(t, makeBadge())).toBe(
      'translated:pages.intellectBadges.codes.first_book'
    );
  });

  it('falls back to code_display when the translation is missing', () => {
    const t = ((key: string, opts: { defaultValue: string }) =>
      opts.defaultValue) as unknown as TFunction;
    expect(badgeLabel(t, makeBadge({ code_display: 'Primeiro Livro' }))).toBe(
      'Primeiro Livro'
    );
  });
});
