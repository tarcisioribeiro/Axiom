import type { AxiosError } from 'axios';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestData = Record<string, any> | FormData | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryParams = Record<string, any>;

interface DRFErrorResponse {
  detail?: string;
  [field: string]: string | string[] | undefined;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export function formatErrorMessage(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data && typeof data === 'object') {
    const errorData = data as DRFErrorResponse;

    if (errorData.detail) {
      return errorData.detail;
    }

    const errorMessages: string[] = [];

    for (const [field, errors] of Object.entries(errorData)) {
      if (Array.isArray(errors)) {
        errorMessages.push(`${field}: ${errors.join(', ')}`);
      } else if (typeof errors === 'string') {
        errorMessages.push(`${field}: ${errors}`);
      }
    }

    if (errorMessages.length > 0) {
      return errorMessages.join('\n');
    }
  }

  return 'Ocorreu um erro desconhecido';
}

export function handleAxiosError(error: AxiosError): Error {
  const response = error.response;

  if (!response) {
    return new Error('Erro de rede. Por favor, verifique sua conexão.');
  }

  const data = response.data;

  switch (response.status) {
    case 400: {
      const errorData = data as Record<string, string[]> | undefined;
      return new ValidationError(
        formatErrorMessage(data) || 'Erro de validação',
        errorData && typeof errorData === 'object' && !('detail' in errorData)
          ? errorData
          : {}
      );
    }
    case 401:
      return new AuthenticationError(
        formatErrorMessage(data) || 'Falha na autenticação'
      );
    case 403:
      return new PermissionError(
        formatErrorMessage(data) || 'Você não tem permissão para realizar esta ação'
      );
    case 404:
      return new NotFoundError(formatErrorMessage(data) || 'Recurso não encontrado');
    case 500:
      return new Error(
        formatErrorMessage(data) ||
          'Erro interno do servidor. Por favor, tente novamente mais tarde.'
      );
    default:
      return new Error(
        formatErrorMessage(data) || `Ocorreu um erro (${response.status})`
      );
  }
}
