import { toast } from '@/hooks/use-toast';

/** Coleta recursivamente as mensagens de erro do react-hook-form. */
function collectMessages(errors: unknown): string[] {
  if (!errors || typeof errors !== 'object') return [];

  return Object.entries(errors).flatMap(([key, value]) => {
    if (key === 'ref') return [];
    const message = (value as { message?: unknown })?.message;
    if (typeof message === 'string' && message) return [message];
    return collectMessages(value);
  });
}

/**
 * Mostra em toast os erros de validação de um formulário.
 * Usar como segundo argumento de `handleSubmit(onSubmit, notifyFormErrors)`.
 * Os campos com erro são marcados com borda vermelha pelos componentes de input.
 */
export function notifyFormErrors(errors: unknown) {
  collectMessages(errors).forEach((message) => {
    toast({ title: message, variant: 'destructive' });
  });
}
