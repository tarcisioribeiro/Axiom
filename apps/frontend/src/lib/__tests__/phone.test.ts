import { describe, expect, it } from 'vitest';

import { formatPhone } from '../phone';

describe('formatPhone', () => {
  it('formata número brasileiro com DDI', () => {
    expect(formatPhone('+5535999490239')).toBe('+55 (35) 99949-0239');
  });

  it('assume Brasil quando não há DDI', () => {
    expect(formatPhone('35999490239')).toBe('+55 (35) 99949-0239');
  });

  it('é idempotente sobre o valor já formatado', () => {
    expect(formatPhone('+55 (35) 99949-0239')).toBe('+55 (35) 99949-0239');
  });

  it('formata conforme o DDI digitado', () => {
    expect(formatPhone('+12133734253')).toBe('+1 (213) 373-4253');
    expect(formatPhone('+442079460958')).toBe('+44 20 7946 0958');
  });

  it('permite digitar e apagar sem travar', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('+')).toBe('+');
    expect(formatPhone('+55')).toBe('+55');
    expect(formatPhone('+55 (35) ', '+55 (35) 9')).toBe('+55 (35)');
    expect(formatPhone('+55 (35', '+55 (35)')).toBe('+55 3');
  });
});
