/**
 * Tipos compartilhados para componentes de gráficos
 * Centraliza interfaces para evitar duplicação e garantir tipagem forte
 */

// Configuração de linha para gráficos de linha/área
export interface LineConfig {
  dataKey: string;
  stroke: string;
  yAxisId?: 'left' | 'right';
  name?: string;
  strokeDasharray?: string;
}

// Configuração de eixo Y
interface YAxisConfig {
  dataKey: string;
  label?: string;
  color: string;
}

// Configuração de eixo Y duplo
export interface DualYAxisConfig {
  left: YAxisConfig;
  right: YAxisConfig;
}

// Tipos de gráficos disponíveis
export type ChartType = 'pie' | 'bar' | 'line';

// Layout de gráfico de barras
export type BarLayout = 'horizontal' | 'vertical';

// Ponto de dados genérico para gráficos
export interface ChartDataPoint {
  [key: string]: string | number | boolean | undefined;
}

// Payload do tooltip do Recharts
interface TooltipPayloadItem {
  name: string;
  value: number | string;
  color: string;
  dataKey: string;
  payload: ChartDataPoint;
}

// Props do tooltip customizado
export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: number | string, entry?: TooltipPayloadItem) => string;
  labelFormatter?: (label: string | number) => string;
}
