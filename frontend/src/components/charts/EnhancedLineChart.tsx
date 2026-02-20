import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ResponsiveContainer,
  AreaChart,
} from 'recharts';

import { useChartDimensions } from '@/hooks/use-chart-dimensions';
import { useChartGradientId } from '@/lib/chart-colors';
import { axisFormatNumber } from '@/lib/chart-formatters';
import type { LineConfig, DualYAxisConfig, ChartDataPoint } from '@/lib/chart-types';

import { EnhancedTooltip } from './EnhancedTooltip';

interface EnhancedLineChartProps {
  data: ChartDataPoint[];
  dataKey?: string;
  nameKey?: string;
  formatter?: (value: number | string) => string;
  colors: string[];
  lines?: LineConfig[];
  dualYAxis?: DualYAxisConfig;
  height?: number;
  withArea?: boolean;
  xAxisTickFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (label: string | number) => string;
}

/**
 * Gráfico de linhas/área aprimorado
 *
 * Recursos:
 * - Área preenchida com gradiente suave
 * - Suporte a dual Y-axis (esquerda/direita)
 * - Suporte a múltiplas linhas
 * - Dots com efeito de brilho no hover
 * - Grid sutil e elegante
 * - Animações suaves
 * - Tooltip customizado
 * - IDs únicos para gradientes (evita colisões)
 * - Formatação de eixos pt-BR
 */
export const EnhancedLineChart = ({
  data,
  dataKey,
  nameKey = 'name',
  formatter,
  colors,
  lines,
  dualYAxis,
  height = 300,
  withArea = true,
  xAxisTickFormatter,
  tooltipLabelFormatter,
}: EnhancedLineChartProps) => {
  const dims = useChartDimensions();

  // Gera IDs únicos para gradientes
  const getGradientId = useChartGradientId('line-area');

  // Modo single line (dataKey único)
  const isSingleLine = !lines && dataKey;

  // Configuração de linhas memoizada
  const lineConfigs: LineConfig[] = useMemo(() => {
    if (lines) return lines;
    if (isSingleLine) return [{ dataKey: dataKey, stroke: colors[0] }];
    return [];
  }, [lines, isSingleLine, dataKey, colors]);

  // Definições de gradientes memoizadas
  const gradientDefs = useMemo(
    () =>
      lineConfigs.map((line, idx) => (
        <linearGradient
          key={getGradientId(idx)}
          id={getGradientId(idx)}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="5%" stopColor={line.stroke} stopOpacity={0.35} />
          <stop offset="95%" stopColor={line.stroke} stopOpacity={0.02} />
        </linearGradient>
      )),
    [lineConfigs, getGradientId]
  );

  const ChartComponent = withArea ? AreaChart : LineChart;

  // Props comuns para Line e Area
  const getSeriesProps = (line: LineConfig) => ({
    type: 'monotone' as const,
    dataKey: line.dataKey,
    stroke: line.stroke,
    strokeWidth: 2.5,
    yAxisId: line.yAxisId,
    name: line.name || line.dataKey,
    dot: {
      r: 3,
      strokeWidth: 2,
      fill: 'hsl(var(--background))',
      stroke: line.stroke,
    },
    activeDot: {
      r: 6,
      strokeWidth: 2,
      fill: line.stroke,
      stroke: 'hsl(var(--background))',
      style: {
        filter: `drop-shadow(0 0 4px ${line.stroke})`,
        cursor: 'pointer',
      },
    },
    animationDuration: 600,
    animationEasing: 'ease-out' as const,
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent
        data={data}
        margin={{ top: 5, right: 5, left: dims.isMobile ? -20 : -10, bottom: 5 }}
      >
        <defs>{gradientDefs}</defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          opacity={0.4}
          vertical={false}
        />

        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          dy={8}
          tickFormatter={xAxisTickFormatter}
        />

        {dualYAxis ? (
          <>
            <YAxis
              yAxisId="left"
              tick={{ fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={axisFormatNumber}
              width={dims.yAxisWidth}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={axisFormatNumber}
              width={dims.yAxisWidth}
            />
          </>
        ) : (
          <YAxis
            tick={{ fontSize: dims.fontSize, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={axisFormatNumber}
            width={dims.yAxisWidth}
          />
        )}

        <Tooltip
          content={
            <EnhancedTooltip
              formatter={formatter}
              labelFormatter={tooltipLabelFormatter}
            />
          }
          cursor={{
            stroke: 'hsl(var(--muted-foreground))',
            strokeWidth: 1,
            strokeDasharray: '4 4',
          }}
        />

        {lineConfigs.length > 1 && (
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => {
              const lineConfig = lineConfigs.find((l) => l.dataKey === value);
              return (
                <span className="text-sm text-foreground/80">
                  {lineConfig?.name || value}
                </span>
              );
            }}
          />
        )}

        {withArea
          ? lineConfigs.map((line, idx) => (
              <Area
                key={`area-${idx}`}
                {...getSeriesProps(line)}
                fill={`url(#${getGradientId(idx)})`}
              />
            ))
          : lineConfigs.map((line, idx) => (
              <Line
                key={`line-${idx}`}
                {...getSeriesProps(line)}
              />
            ))}
      </ChartComponent>
    </ResponsiveContainer>
  );
};
