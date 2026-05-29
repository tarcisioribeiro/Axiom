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
 * Formata valores monetários em Real Brasileiro (BRL) respeitando o locale ativo.
 *
 * @param value - Valor a ser formatado (string ou number)
 * @returns String formatada como moeda (ex: "R$ 1.234,56" em pt-BR, "R$1,234.56" em en-US)
 */
export const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return new Intl.NumberFormat(i18next.language || 'pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(0);
  }

  return new Intl.NumberFormat(i18next.language || 'pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
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

    if (time) {
      const [hours, minutes] = time.split(':');
      dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    }

    const locale = i18next.language || 'pt-BR';
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
