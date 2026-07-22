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
export interface YAxisConfig {
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

// Props base compartilhadas por todos os gráficos
export interface BaseChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  nameKey: string;
  formatter?: (value: number | string) => string;
  colors: string[];
  height?: number;
}

// Props específicas para gráficos com cores customizadas
export interface CustomColorProps {
  customColors?: (entry: ChartDataPoint) => string;
}

// Props específicas para gráficos de barras
export interface BarChartSpecificProps {
  layout?: BarLayout;
}

// Props específicas para gráficos de linha
export interface LineChartSpecificProps {
  lines?: LineConfig[];
  dualYAxis?: DualYAxisConfig;
  withArea?: boolean;
}

// Ponto de dados genérico para gráficos
export interface ChartDataPoint {
  [key: string]: string | number | boolean | undefined;
}

// Payload do tooltip do Recharts
export interface TooltipPayloadItem {
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
  formatter?: (value: number | string) => string;
  labelFormatter?: (label: string | number) => string;
}

// Props do container de gráficos
export interface ChartContainerProps extends Omit<BaseChartProps, 'dataKey'> {
  chartId: string;
  dataKey: string;
  enabledTypes?: ChartType[];
  emptyMessage?: string;
  customColors?: (entry: ChartDataPoint) => string;
  dualYAxis?: DualYAxisConfig;
  lines?: LineConfig[];
  layout?: BarLayout;
  withArea?: boolean;
  defaultType?: ChartType;
  lockChartType?: ChartType;
}

// Configurações de formatação para eixos
export interface AxisFormatterConfig {
  type: 'number' | 'currency' | 'percent' | 'compact';
  locale?: string;
  currency?: string;
  decimals?: number;
}
