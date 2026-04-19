import { describe, it, expect } from 'vitest';

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercentage,
} from '@/lib/formatters';

describe('formatCurrency', () => {
  it('formats a valid number as BRL currency', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formats a numeric string', () => {
    const result = formatCurrency('500');
    expect(result).toContain('500');
  });

  it('formats NaN-producing strings as zero', () => {
    const result = formatCurrency('not-a-number');
    expect(result).toContain('0');
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string', () => {
    const result = formatDate('2025-06-15');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/06|6/);
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date(2025, 0, 5));
    expect(result).toMatch(/05|5/);
  });

  it('accepts a custom format string', () => {
    expect(formatDate('2025-12-25', 'yyyy')).toBe('2025');
  });

  it('returns an invalid date message for unparseable strings', () => {
    const result = formatDate('not-a-date');
    expect(result).toMatch(/inválida|invalid/i);
  });
});

describe('formatDateTime', () => {
  it('formats a date string without time', () => {
    const result = formatDateTime('2025-03-10');
    expect(result).toMatch(/10/);
    expect(result).toMatch(/03|3/);
  });

  it('formats a date string with a time component', () => {
    const result = formatDateTime('2025-03-10', '14:30');
    expect(result).toContain('14:30');
  });

  it('returns an invalid date message for unparseable strings', () => {
    const result = formatDateTime('bad-date');
    expect(result).toMatch(/inválida|invalid/i);
  });
});

describe('formatNumber', () => {
  it('formats a number with default 2 decimal places', () => {
    expect(formatNumber(3.14159)).toBe('3.14');
  });

  it('formats with custom decimal count', () => {
    expect(formatNumber(1.5, 0)).toBe('2');
  });

  it('returns "0" for NaN', () => {
    expect(formatNumber(NaN)).toBe('0');
  });
});

describe('formatPercentage', () => {
  it('formats a decimal as percentage', () => {
    expect(formatPercentage(0.15)).toBe('15.00%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });

  it('returns "0.00%" for NaN', () => {
    expect(formatPercentage(NaN)).toBe('0.00%');
  });
});
