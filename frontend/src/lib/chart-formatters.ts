/**
 * Utilitários de formatação para gráficos
 * Formatadores localizados para pt-BR
 */

const LOCALE = 'pt-BR';

/**
 * Formata números no padrão brasileiro
 * Ex: 1234.56 -> "1.234,56"
 */
export const formatNumber = (value: number, decimals = 0): string => {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Formata valores monetários em BRL
 * Ex: 1234.56 -> "R$ 1.234,56"
 */
export const formatCurrencyBR = (value: number): string => {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Formata valores monetários de forma compacta
 * Ex: 1234567 -> "R$ 1,2 mi"
 */
export const formatCurrencyCompact = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${formatNumber(value / 1_000_000, 1)} mi`;
  }
  if (Math.abs(value) >= 1_000) {
    return `R$ ${formatNumber(value / 1_000, 1)} mil`;
  }
  return formatCurrencyBR(value);
};

/**
 * Formata percentuais
 * Ex: 0.1234 -> "12,34%"
 */
export const formatPercent = (value: number, decimals = 1): string => {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

/**
 * Formata números de forma compacta
 * Ex: 1234567 -> "1,2 mi"
 */
export const formatCompact = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, 1)} mi`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${formatNumber(value / 1_000, 1)} mil`;
  }
  return formatNumber(value);
};

/**
 * Formatador para eixos de gráficos - valores monetários
 * Versão curta para caber nos eixos
 */
export const axisFormatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)} mil`;
  }
  return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

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
 * Formatador para eixos - percentuais
 */
export const axisFormatPercent = (value: number): string => {
  return `${formatNumber(value, 0)}%`;
};

/**
 * Cria um formatador customizado baseado no tipo
 */
export type FormatterType = 'number' | 'currency' | 'percent' | 'compact';

export const createAxisFormatter = (type: FormatterType) => {
  switch (type) {
    case 'currency':
      return axisFormatCurrency;
    case 'percent':
      return axisFormatPercent;
    case 'compact':
      return formatCompact;
    case 'number':
    default:
      return axisFormatNumber;
  }
};

/**
 * Formata label do eixo X para datas curtas (usado em timelines)
 * Já recebe string formatada, apenas garante consistência
 */
export const formatAxisDate = (value: string): string => {
  return value;
};

/**
 * Trunca texto longo para legendas
 */
export const truncateLabel = (label: string, maxLength = 15): string => {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
};
