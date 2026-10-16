/**
 * Utilitários de formatação para gráficos
 * Formatadores localizados para pt-BR
 */

import { formatCurrency } from './formatters';

const LOCALE = 'pt-BR';

/**
 * Formata números no padrão brasileiro
 * Ex: 1234.56 -> "1.234,56"
 */
const formatNumber = (value: number, decimals = 0): string => {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Formata valores monetários em BRL
 * Ex: 1234.56 -> "R$ 1.234,56"
 */
export const formatCurrencyBR = (value: number): string => formatCurrency(value);

/**
 * Formatador para eixos de gráficos - valores monetários
 * Mesmo padrão do restante da UI ("R$ 1.234,56"); use `width="auto"` no eixo.
 */
export const axisFormatCurrency = (value: number): string => formatCurrency(value);

/**
 * Formatador para eixos de gráficos - números genéricos
 */
export const axisFormatNumber = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace('.', ',')} mil`;
  }
  return formatNumber(value);
};

/**
 * Trunca texto longo para legendas
 */
export const truncateLabel = (label: string, maxLength = 15): string => {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
};
