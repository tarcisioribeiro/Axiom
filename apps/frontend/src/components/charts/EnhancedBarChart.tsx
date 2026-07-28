import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts';

import { useChartDimensions } from '@/hooks/use-chart-dimensions';
import { useChartGradientId } from '@/lib/chart-colors';
import { axisFormatNumber, truncateLabel } from '@/lib/chart-formatters';
import type { ChartDataPoint, BarLayout } from '@/lib/chart-types';

import { EnhancedTooltip } from './EnhancedTooltip';

interface EnhancedBarChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  nameKey: string;
  formatter?: (value: number | string) => string;
  colors: string[];
  customColors?: (entry: ChartDataPoint) => string;
  layout?: BarLayout;
  height?: number;
  nameFormatter?: (name: string) => string | null;
  /** Mostra o valor formatado acima de cada barra. Default false. */
  showValueLabels?: boolean;
  /** Mostra os ticks de texto do eixo de categoria. Default true. */
  showCategoryAxisLabels?: boolean;
}

/**
 * Gráfico de barras aprimorado
 *
 * Recursos:
 * - Gradientes verticais para profundidade visual
 * - Layout horizontal ou vertical
 * - Bordas arredondadas elegantes
 * - Grid sutil
 * - Animações suaves
 * - Tooltip customizado
 * - Cores customizáveis por item
 * - IDs únicos para gradientes
 * - Formatação de eixos pt-BR
 */
export const EnhancedBarChart = ({
  data,
  dataKey,
  nameKey,
  formatter,
  colors,
  customColors,
  layout = 'vertical',
  height = 300,
  nameFormatter,
  showValueLabels = false,
  showCategoryAxisLabels = true,
}: EnhancedBarChartProps) => {
  const dims = useChartDimensions();

  // Gera IDs únicos para gradientes
  const getGradientId = useChartGradientId('bar');

  // Definições de gradientes memoizadas
  const gradientDefs = useMemo(
    () =>
      colors.map((color, idx) => (
        <linearGradient
          key={getGradientId(idx)}
          id={getGradientId(idx)}
          x1="0"
          y1="0"
          x2={layout === 'vertical' ? '1' : '0'}
          y2={layout === 'vertical' ? '0' : '1'}
        >
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
        </linearGradient>
      )),
    [colors, getGradientId, layout]
  );

  // Configuração de raio das bordas baseado no layout
  const barRadius: [number, number, number, number] =
    layout === 'vertical' ? [0, 6, 6, 0] : [6, 6, 0, 0];

  // Largura do eixo Y para layout vertical (categorias) — responsiva
  const yAxisWidth = layout === 'vertical' ? dims.yAxisWidthWide : dims.yAxisWidth;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{
          top: 5,
          right: 10,
          left: layout === 'vertical' ? 0 : -10,
          bottom: 5,
        }}
      >
        <defs>{gradientDefs}</defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          opacity={0.4}
          horizontal={layout === 'vertical'}
          vertical={layout === 'horizontal'}
        />

        {layout === 'vertical' ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={axisFormatNumber}
            />
            <YAxis
              dataKey={nameKey}
              type="category"
              width={showCategoryAxisLabels ? yAxisWidth : 0}
              tick={
                showCategoryAxisLabels
                  ? { fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }
                  : false
              }
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                truncateLabel(String(value), dims.truncateYAxisLabel)
              }
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={nameKey}
              type="category"
              tick={
                showCategoryAxisLabels
                  ? { fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }
                  : false
              }
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) =>
                truncateLabel(String(value), dims.truncateXAxisLabel)
              }
              interval={0}
              angle={data.length > 5 ? -35 : 0}
              textAnchor={data.length > 5 ? 'end' : 'middle'}
              height={
                showCategoryAxisLabels
                  ? data.length > 5
                    ? dims.xAxisHeightRotated
                    : 30
                  : 8
              }
            />
            <YAxis
              type="number"
              tick={{ fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={axisFormatNumber}
              width={dims.yAxisWidth}
            />
          </>
        )}

        <Tooltip
          content={
            <EnhancedTooltip formatter={formatter} nameFormatter={nameFormatter} />
          }
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
        />

        <Bar
          dataKey={dataKey}
          radius={barRadius}
          animationDuration={600}
          animationEasing="ease-out"
          maxBarSize={50}
        >
          {showValueLabels && (
            <LabelList
              dataKey={dataKey}
              position={layout === 'vertical' ? 'right' : 'top'}
              formatter={(value: string | number | boolean | null | undefined) =>
                typeof value === 'string' || typeof value === 'number'
                  ? (formatter?.(value) ?? value)
                  : ''
              }
              className="fill-foreground text-xs font-semibold"
            />
          )}
          {data.map((entry, index) => {
            const fillColor = customColors
              ? customColors(entry)
              : `url(#${getGradientId(index % colors.length)})`;

            return (
              <Cell
                key={`cell-${index}`}
                fill={fillColor}
                className="transition-opacity duration-200 hover:opacity-80"
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
