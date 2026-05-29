export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'response' in error &&
    error.response !== null &&
    typeof error.response === 'object' &&
    'status' in error.response
  ) {
    const status = (error.response as { status: number }).status;
    if (status >= 500) {
      return 'Erro interno do servidor. Tente novamente mais tarde.';
    }
  }
  return 'Ocorreu um erro inesperado.';
}
