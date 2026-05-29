import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { useChartDimensions } from '@/hooks/use-chart-dimensions';
import { truncateLabel } from '@/lib/chart-formatters';
import type { ChartDataPoint } from '@/lib/chart-types';

import { EnhancedTooltip } from './EnhancedTooltip';

interface EnhancedPieChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  nameKey: string;
  formatter?: (value: number | string) => string;
  colors: string[];
  customColors?: (entry: ChartDataPoint) => string;
  height?: number;
}

/**
 * Gráfico de pizza aprimorado
 *
 * Recursos:
 * - Gráfico de pizza completo (100% preenchido)
 * - Cores sólidas sem sombras ou gradientes
 * - Legenda personalizada e limpa
 * - Animações suaves
 * - Tooltip customizado
 * - Sem labels sobrepostos (usa legenda)
 */
export const EnhancedPieChart = ({
  data,
  dataKey,
  nameKey,
  formatter,
  colors,
  customColors,
  height = 300,
}: EnhancedPieChartProps) => {
  const dims = useChartDimensions();

  // Calcula o total para percentuais na legenda
  const total = useMemo(
    () => data.reduce((sum, item) => sum + Number(item[dataKey] || 0), 0),
    [data, dataKey]
  );

  // Renderizador customizado da legenda
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLegend = (props: any) => {
    const { payload } = props as {
      payload?: Array<{ value: string; color: string; payload: ChartDataPoint }>;
    };
    if (!payload) return null;

    return (
      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 px-sm">
        {payload.map((entry, index) => {
          const value = Number(entry.payload[dataKey] || 0);
          const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

          return (
            <li key={`legend-${index}`} className="flex items-center gap-sm text-xs">
              <span
                className="h-3 w-3 flex-shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={`truncate text-foreground/70 ${dims.isMobile ? 'max-w-[70px]' : 'max-w-[110px]'}`}
                title={entry.value}
              >
                {truncateLabel(entry.value, dims.truncateXAxisLabel)}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="52%"
          outerRadius={dims.pieOuterRadius}
          paddingAngle={3}
          dataKey={dataKey}
          nameKey={nameKey}
          animationBegin={0}
          animationDuration={700}
          animationEasing="ease-out"
        >
          {data.map((entry, index) => {
            const fillColor = customColors
              ? customColors(entry)
              : colors[index % colors.length];

            return (
              <Cell
                key={`cell-${index}`}
                fill={fillColor}
                stroke="hsl(var(--background))"
                strokeWidth={3}
                className="transition-opacity duration-200 hover:opacity-75"
                style={{
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                }}
              />
            );
          })}
        </Pie>

        <Tooltip
          content={<EnhancedTooltip formatter={formatter} />}
          wrapperStyle={{ outline: 'none' }}
        />

        <Legend content={renderLegend} verticalAlign="bottom" align="center" />
      </PieChart>
    </ResponsiveContainer>
  );
};
