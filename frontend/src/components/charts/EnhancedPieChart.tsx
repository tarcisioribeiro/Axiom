import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EnhancedTooltip } from './EnhancedTooltip';
import { truncateLabel } from '@/lib/chart-formatters';
import { useChartDimensions } from '@/hooks/use-chart-dimensions';
import type { ChartDataPoint } from '@/lib/chart-types';

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
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2">
        {payload.map((entry, index) => {
          const value = Number(entry.payload[dataKey] || 0);
          const percent = total > 0 ? ((value / total) * 100).toFixed(0) : 0;

          return (
            <li key={`legend-${index}`} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={`truncate text-foreground/80 ${dims.isMobile ? 'max-w-[70px]' : 'max-w-[100px]'}`}
                title={entry.value}
              >
                {truncateLabel(entry.value, dims.truncateXAxisLabel)}
              </span>
              <span className="font-medium">{percent}%</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="0%"
          outerRadius={dims.pieOuterRadius}
          paddingAngle={2}
          dataKey={dataKey}
          nameKey={nameKey}
          animationBegin={0}
          animationDuration={600}
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
                strokeWidth={2}
                className="transition-opacity duration-200 hover:opacity-80"
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </Pie>

        <Tooltip content={<EnhancedTooltip formatter={formatter} />} />

        <Legend content={renderLegend} verticalAlign="bottom" align="center" />
      </PieChart>
    </ResponsiveContainer>
  );
};
