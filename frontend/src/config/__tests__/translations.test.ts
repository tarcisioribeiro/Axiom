import { describe, it, expect } from 'vitest';

import {
  autoTranslate,
  translateText,
  reverseTranslate,
  TRANSLATIONS,
  REVERSE_TRANSLATIONS,
} from '@/config/translations';

describe('TRANSLATIONS', () => {
  it('exposes expense categories', () => {
    expect(TRANSLATIONS.expenseCategories['food']).toBe('Alimentação');
    expect(TRANSLATIONS.expenseCategories['entertainment']).toBe('Entretenimento');
  });

  it('exposes revenue categories', () => {
    expect(TRANSLATIONS.revenueCategories['salary']).toBe('Salário');
  });

  it('exposes account types', () => {
    expect(TRANSLATIONS.accountTypes['CC']).toBe('Conta Corrente');
  });

  it('exposes payment status', () => {
    expect(TRANSLATIONS.paymentStatus['paid']).toBe('Pago');
    expect(TRANSLATIONS.paymentStatus['pending']).toBe('Pendente');
  });
});

describe('REVERSE_TRANSLATIONS', () => {
  it('exists and is a non-empty object', () => {
    expect(REVERSE_TRANSLATIONS).toBeDefined();
    expect(typeof REVERSE_TRANSLATIONS).toBe('object');
  });
});

describe('reverseTranslate', () => {
  it('translates a Portuguese account type back to its English key', () => {
    expect(reverseTranslate('accountTypes', 'Conta Corrente')).toBe('CC');
  });

  it('returns the original value when no reverse mapping exists', () => {
    expect(reverseTranslate('accountTypes', 'Tipo Desconhecido')).toBe(
      'Tipo Desconhecido'
    );
  });
});

describe('autoTranslate', () => {
  it('translates a known expense category', () => {
    expect(autoTranslate('entertainment')).toBe('Entretenimento');
  });

  it('translates a known revenue category', () => {
    expect(autoTranslate('salary')).toBe('Salário');
  });

  it('translates with key normalization (uppercase input)', () => {
    expect(autoTranslate('FOOD')).toBe('Alimentação');
  });

  it('translates with underscore-to-space conversion', () => {
    expect(autoTranslate('food_and_drink')).toBe('Comida e Bebida');
  });

  it('returns key with capitalized first letter for unknown terms', () => {
    expect(autoTranslate('unknownterm')).toBe('Unknownterm');
  });

  it('converts underscores to spaces in unknown terms', () => {
    expect(autoTranslate('unknown_term')).toBe('Unknown term');
  });

  it('returns the key unchanged when empty string is passed', () => {
    expect(autoTranslate('')).toBe('');
  });

  it('translates a payment status key', () => {
    expect(autoTranslate('pending')).toBe('Pendente');
  });

  it('translates a transfer type key', () => {
    expect(autoTranslate('pix')).toBe('PIX');
  });
});

describe('translateText', () => {
  it('returns empty string for empty input', () => {
    expect(translateText('')).toBe('');
  });

  it('replaces known English terms with Portuguese', () => {
    const result = translateText('salary deposit');
    expect(result).toContain('Salário');
  });

  it('returns text unchanged when no translatable terms exist', () => {
    const result = translateText('xyz abc def');
    expect(result).toBe('xyz abc def');
  });

  it('handles text with multiple translatable terms', () => {
    const result = translateText('pending paid');
    expect(result).toContain('Pendente');
    expect(result).toContain('Pago');
  });
});
