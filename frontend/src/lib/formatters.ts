/**
 * Funções de Formatação
 *
 * Centralizando toda a lógica de formatação de moeda, datas, números e percentuais.
 * Elimina duplicação de código em múltiplas páginas.
 */

import { format } from 'date-fns';

import { parseLocalDate } from './utils';

/**
 * Formata valores monetários em Real Brasileiro (BRL)
 *
 * @param value - Valor a ser formatado (string ou number)
 * @returns String formatada como moeda (ex: "R$ 1.234,56")
 *
 * @example
 * formatCurrency(1234.56) // "R$ 1.234,56"
 * formatCurrency("1234.56") // "R$ 1.234,56"
 */
export const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

/**
 * Formata datas no padrão brasileiro
 *
 * @param date - Data a ser formatada (string ou Date)
 * @param formatStr - Padrão de formatação (padrão: 'dd/MM/yyyy')
 * @returns String formatada
 *
 * @example
 * formatDate(new Date()) // "30/12/2025"
 * formatDate("2025-12-30") // "30/12/2025"
 * formatDate("2025-12-30", "dd/MM/yy") // "30/12/25"
 */
export const formatDate = (
  date: string | Date,
  formatStr: string = 'dd/MM/yyyy'
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    if (!dateObj) return 'Data inválida';
    return format(dateObj, formatStr);
  } catch {
    return 'Data inválida';
  }
};

/**
 * Formata data e hora
 *
 * @param date - Data a ser formatada
 * @param time - Hora opcional (formato: "HH:mm")
 * @returns String formatada com data e hora
 *
 * @example
 * formatDateTime("2025-12-30") // "30/12/2025 00:00"
 * formatDateTime("2025-12-30", "14:30") // "30/12/2025 14:30"
 */
export const formatDateTime = (date: string, time?: string): string => {
  try {
    const dateObj = parseLocalDate(date);
    if (!dateObj) return 'Data inválida';

    if (time) {
      const [hours, minutes] = time.split(':');
      dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    }

    return format(dateObj, 'dd/MM/yyyy HH:mm');
  } catch {
    return 'Data inválida';
  }
};

/**
 * Formata números com casas decimais
 *
 * @param value - Número a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada
 *
 * @example
 * formatNumber(1234.5678) // "1234.57"
 * formatNumber(1234.5678, 0) // "1235"
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  if (isNaN(value)) {
    return '0';
  }

  return value.toFixed(decimals);
};

/**
 * Formata percentuais
 *
 * @param value - Valor decimal (ex: 0.15 para 15%)
 * @returns String formatada como percentual
 *
 * @example
 * formatPercentage(0.15) // "15.00%"
 * formatPercentage(0.5) // "50.00%"
 */
export const formatPercentage = (value: number): string => {
  if (isNaN(value)) {
    return '0.00%';
  }

  return `${(value * 100).toFixed(2)}%`;
};
