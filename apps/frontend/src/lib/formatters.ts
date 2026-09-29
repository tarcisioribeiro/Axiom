/**
 * Funções de Formatação
 *
 * Centralizando toda a lógica de formatação de moeda, datas, números e percentuais.
 * Elimina duplicação de código em múltiplas páginas.
 */

import { format } from 'date-fns';
import i18next from 'i18next';

import { parseLocalDate } from './utils';

/**
 * Formata valores monetários sempre no padrão brasileiro, independente do idioma da UI.
 *
 * @param value - Valor a ser formatado (string ou number)
 * @returns String formatada como moeda (ex: "R$ 1.234,56"); valores inválidos viram "R$ 0,00"
 */
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: string | number | null | undefined): string => {
  const num = typeof value === 'number' ? value : parseFloat(value ?? '');
  return currencyFormatter.format(isNaN(num) ? 0 : num);
};

/**
 * Formata datas respeitando o locale ativo.
 *
 * @param date - Data a ser formatada (string ou Date)
 * @param formatStr - Padrão de formatação (opcional; padrão depende do locale)
 * @returns String formatada
 */
export const formatDate = (date: string | Date, formatStr?: string): string => {
  try {
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    if (!dateObj)
      return i18next.language === 'en-US' ? 'Invalid date' : 'Data inválida';

    const locale = i18next.language || 'pt-BR';
    const defaultFormat = locale === 'en-US' ? 'MM/dd/yyyy' : 'dd/MM/yyyy';
    return format(dateObj, formatStr ?? defaultFormat);
  } catch {
    return i18next.language === 'en-US' ? 'Invalid date' : 'Data inválida';
  }
};

/**
 * Formata data e hora respeitando o locale ativo.
 *
 * @param date - Data a ser formatada
 * @param time - Hora opcional (formato: "HH:mm")
 * @returns String formatada com data e hora
 */
export const formatDateTime = (date: string, time?: string): string => {
  try {
    const dateObj = parseLocalDate(date);
    if (!dateObj)
      return i18next.language === 'en-US' ? 'Invalid date' : 'Data inválida';

    const locale = i18next.language || 'pt-BR';
    if (!time) return format(dateObj, locale === 'en-US' ? 'MM/dd/yyyy' : 'dd/MM/yyyy');

    const [hours, minutes] = time.split(':');
    dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    const fmt = locale === 'en-US' ? 'MM/dd/yyyy HH:mm' : 'dd/MM/yyyy HH:mm';
    return format(dateObj, fmt);
  } catch {
    return i18next.language === 'en-US' ? 'Invalid date' : 'Data inválida';
  }
};

/**
 * Formata números com casas decimais
 *
 * @param value - Número a ser formatado
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada
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
 */
export const formatPercentage = (value: number): string => {
  if (isNaN(value)) {
    return '0.00%';
  }

  return `${(value * 100).toFixed(2)}%`;
};
