import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  cn,
  formatLocalDate,
  parseLocalDate,
  copyToClipboard,
  toLocalDate,
  getErrorMessage,
} from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const skip = false;
    expect(cn('base', skip && 'skipped', 'included')).toBe('base included');
  });
});

describe('formatLocalDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatLocalDate(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('zero-pads month and day', () => {
    expect(formatLocalDate(new Date(2024, 2, 9))).toBe('2024-03-09');
  });
});

describe('parseLocalDate', () => {
  it('parses a YYYY-MM-DD string', () => {
    const result = parseLocalDate('2025-06-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(5);
    expect(result?.getDate()).toBe(15);
  });

  it('parses ISO timestamp by stripping the time portion', () => {
    const result = parseLocalDate('2025-01-20T14:30:00Z');
    expect(result?.getDate()).toBe(20);
    expect(result?.getMonth()).toBe(0);
  });

  it('returns undefined for an empty string', () => {
    expect(parseLocalDate('')).toBeUndefined();
  });

  it('returns undefined for an unrecognised format', () => {
    expect(parseLocalDate('not-a-date')).toBeUndefined();
  });

  it('returns undefined for an impossible date like Feb 30', () => {
    expect(parseLocalDate('2025-02-30')).toBeUndefined();
  });
});

describe('toLocalDate', () => {
  it('returns undefined for undefined input', () => {
    expect(toLocalDate(undefined)).toBeUndefined();
  });

  it('returns the Date object unchanged when given a Date', () => {
    const d = new Date(2025, 0, 1);
    expect(toLocalDate(d)).toBe(d);
  });

  it('parses a string using parseLocalDate', () => {
    const result = toLocalDate('2025-03-10');
    expect(result?.getDate()).toBe(10);
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses execCommand fallback and succeeds when execCommand returns true', async () => {
    // Define execCommand if not present in happy-dom, then mock it
    if (!('execCommand' in document)) {
      Object.defineProperty(document, 'execCommand', {
        value: vi.fn(() => true),
        writable: true,
        configurable: true,
      });
    }
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    await expect(copyToClipboard('hello')).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('throws when execCommand returns false', async () => {
    if (!('execCommand' in document)) {
      Object.defineProperty(document, 'execCommand', {
        value: vi.fn(() => false),
        writable: true,
        configurable: true,
      });
    }
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    await expect(copyToClipboard('hello')).rejects.toThrow('Falha ao copiar');
  });
});

describe('getErrorMessage', () => {
  it('returns error.message for Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the string directly for string errors', () => {
    expect(getErrorMessage('something went wrong')).toBe('something went wrong');
  });

  it('returns message property for plain objects with message', () => {
    expect(getErrorMessage({ message: 'object error' })).toBe('object error');
  });

  it('returns the fallback for unknown types', () => {
    expect(getErrorMessage(42)).toBe('Ocorreu um erro inesperado');
  });

  it('accepts a custom fallback', () => {
    expect(getErrorMessage(null, 'custom fallback')).toBe('custom fallback');
  });
});
