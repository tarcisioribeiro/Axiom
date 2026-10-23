import { describe, expect, it } from 'vitest';

import { HIGHLIGHT_DOT, HIGHLIGHT_TYPE_KEY, highlightBg } from '@/lib/highlight-colors';

describe('highlightBg', () => {
  it('returns the background class for a known color', () => {
    expect(highlightBg('green')).toBe('bg-highlight-green/15');
    expect(highlightBg('pink')).toBe('bg-highlight-pink/15');
  });

  it('falls back to yellow for an unknown color', () => {
    expect(highlightBg('unknown')).toBe('bg-highlight-yellow/15');
    expect(highlightBg('')).toBe('bg-highlight-yellow/15');
  });
});

describe('HIGHLIGHT_TYPE_KEY', () => {
  it('maps every known highlight type to an i18n key', () => {
    expect(HIGHLIGHT_TYPE_KEY.quote).toBe('pages.highlights.form.typeQuote');
    expect(HIGHLIGHT_TYPE_KEY.note).toBe('pages.highlights.form.typeNote');
    expect(HIGHLIGHT_TYPE_KEY.idea).toBe('pages.highlights.form.typeIdea');
  });
});

describe('HIGHLIGHT_DOT', () => {
  it('maps every known color to its dot class', () => {
    expect(HIGHLIGHT_DOT.yellow).toBe('bg-highlight-yellow');
    expect(HIGHLIGHT_DOT.orange).toBe('bg-highlight-orange');
  });
});
