import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata uma data para string YYYY-MM-DD sem conversão de timezone
 * Evita o bug de selecionar dia anterior ao usar toISOString()
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse uma string de data, suportando múltiplos formatos:
 * - YYYY-MM-DD (ex: 2025-01-20)
 * - YYYY-MM-DDTHH:mm:ss (ISO timestamp, ex: 2025-01-20T14:30:00Z)
 * - Anos negativos (ex: -0384-MM-DD)
 * Retorna undefined se a data for inválida
 */
export function parseLocalDate(dateStr: string): Date | undefined {
  if (!dateStr || dateStr.trim() === '') return undefined;

  // Remove timezone info and time portion for ISO timestamps
  // Examples: "2025-01-20T14:30:00Z" -> "2025-01-20"
  //           "2025-01-20T14:30:00.000Z" -> "2025-01-20"
  //           "2025-01-20T14:30:00-03:00" -> "2025-01-20"
  let normalizedDate = dateStr;
  if (dateStr.includes('T')) {
    normalizedDate = dateStr.split('T')[0];
  }

  // Suporta formato YYYY-MM-DD com anos negativos (ex: -0384-MM-DD)
  const match = normalizedDate.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(match[3], 10);

  const date = new Date(year, month, day);

  // Validar se a data é válida
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

/**
 * Copia texto para a área de transferência.
 * Usa navigator.clipboard se disponível (contexto seguro/HTTPS),
 * com fallback via document.execCommand para HTTP/desenvolvimento.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback para contextos não-seguros (HTTP)
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!success) {
    throw new Error('Falha ao copiar para a área de transferência');
  }
}

/**
 * Converte uma string ou Date para Date object, evitando problemas de timezone
 * Se receber uma string YYYY-MM-DD, usa parseLocalDate para evitar conversão UTC
 */
export function toLocalDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  return parseLocalDate(value);
}

/**
 * Extrai mensagem de erro de forma segura de qualquer tipo de erro.
 * Util para usar em catch blocks onde o erro e do tipo unknown.
 *
 * @example
 * ```ts
 * try {
 *   await api.get('/users');
 * } catch (error: unknown) {
 *   toast({ title: 'Erro', description: getErrorMessage(error) });
 * }
 * ```
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado'
): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return fallback;
}
