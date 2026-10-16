import type { AxiosError } from 'axios';
import { describe, it, expect } from 'vitest';

import { handleAxiosError, ValidationError } from '@/services/api-errors';

const axiosError = (status: number, data: unknown) =>
  ({ response: { status, data, headers: {} } }) as unknown as AxiosError;

describe('handleAxiosError', () => {
  it('shows the details of {error, details} responses', () => {
    const err = handleAxiosError(
      axiosError(400, { error: 'Dados invalidos', details: ['Username inválido'] })
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Username inválido');
  });

  it('falls back to error when details are missing', () => {
    expect(handleAxiosError(axiosError(400, { error: 'Falhou' })).message).toBe(
      'Falhou'
    );
  });

  it('formats DRF field errors', () => {
    expect(handleAxiosError(axiosError(400, { name: ['obrigatório'] })).message).toBe(
      'name: obrigatório'
    );
  });
});
