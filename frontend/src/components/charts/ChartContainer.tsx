import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useChartType } from '@/hooks/use-chart-type';
import type {
  ChartType,
  LineConfig,
  DualYAxisConfig,
  ChartDataPoint,
  BarLayout,
} from '@/lib/chart-types';
import { cn } from '@/lib/utils';

import { EnhancedBarChart } from './EnhancedBarChart';
import { EnhancedLineChart } from './EnhancedLineChart';
import { EnhancedPieChart } from './EnhancedPieChart';

interface ChartContainerProps {
  chartId: string;
  data: ChartDataPoint[];
  dataKey: string;
  nameKey: string;
  formatter?: (value: number | string) => string;
  colors: string[];
  enabledTypes?: ChartType[];
  emptyMessage?: string;
  customColors?: (entry: ChartDataPoint) => string;
  dualYAxis?: DualYAxisConfig;
  lines?: LineConfig[];
  height?: number;
  layout?: BarLayout;
  withArea?: boolean;
  defaultType?: ChartType;
  lockChartType?: ChartType;
  xAxisTickFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (label: string | number) => string;
  tooltipNameFormatter?: (name: string) => string | null;
}

/**
 * Container de gráficos com sistema de alternância entre tipos
 *
 * Recursos:
 * - Botão de alternância entre tipos (pie, bar, line)
 * - Persistência de preferência no localStorage
 * - Animações suaves entre transições
 * - Empty state elegante
 * - Responsivo
 * - Suporte a travamento de tipo
 */
export const ChartContainer = ({
  chartId,
  data,
  dataKey,
  nameKey,
  formatter,
  colors,
  enabledTypes = ['pie', 'bar', 'line'],
  emptyMessage,
  customColors,
  dualYAxis,
  lines,
  height = 300,
  layout = 'vertical',
  withArea = true,
  defaultType = 'pie',
  lockChartType,
  xAxisTickFormatter,
  tooltipLabelFormatter,
  tooltipNameFormatter,
}: ChartContainerProps) => {
  const { t } = useTranslation();
  const resolvedEmptyMessage =
    emptyMessage ?? t('components.chartContainer.noDataMessage');
  const { chartType: storedChartType, cycleChartType } = useChartType(
    chartId,
    defaultType
  );
  const [isAnimating, setIsAnimating] = useState(false);

  // Se lockChartType estiver definido, use-o; caso contrário, use o tipo armazenado
  // Garante que o tipo usado esteja nos tipos habilitados
  const getValidChartType = (): ChartType => {
    if (lockChartType) return lockChartType;
    if (enabledTypes.includes(storedChartType)) return storedChartType;
    // Se o tipo armazenado não está habilitado, use o defaultType ou o primeiro habilitado
    if (enabledTypes.includes(defaultType)) return defaultType;
    return enabledTypes[0] || 'pie';
  };

  const chartType = getValidChartType();

  const handleToggle = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    cycleChartType();
    setTimeout(() => setIsAnimating(false), 400);
  };

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-sm text-muted-foreground"
        style={{ height }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50">
          <BarChart2 className="h-6 w-6 opacity-40" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {resolvedEmptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Botão de alternância - Oculto quando lockChartType está definido */}
      {!lockChartType && enabledTypes.length > 1 && (
        <div className="group absolute right-0 top-0 z-10">
          <motion.button
            onClick={handleToggle}
            disabled={isAnimating}
            className="rounded-lg border border-border bg-background/80 p-sm shadow-sm backdrop-blur-sm transition-colors hover:bg-accent/10 disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={t('components.chartContainer.toggleChartType')}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 transition-transform',
                isAnimating && 'animate-spin'
              )}
            />
          </motion.button>

          {/* Tooltip no hover */}
          <div className="pointer-events-none absolute right-0 top-full z-20 mt-xs whitespace-nowrap rounded-md border border-border bg-popover/95 px-sm py-xs text-xs opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover:opacity-100">
            {t('components.chartContainer.toggleView')}
          </div>
        </div>
      )}

      {/* Renderização do gráfico com animação */}
      <AnimatePresence mode="wait">
        <motion.div
          key={chartType}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {chartType === 'pie' && enabledTypes.includes('pie') && (
            <EnhancedPieChart
              data={data}
              dataKey={dataKey}
              nameKey={nameKey}
              formatter={formatter}
              colors={colors}
              customColors={customColors}
              height={height}
            />
          )}

          {chartType === 'bar' && enabledTypes.includes('bar') && (
            <EnhancedBarChart
              data={data}
              dataKey={dataKey}
              nameKey={nameKey}
              formatter={formatter}
              colors={colors}
              customColors={customColors}
              layout={layout}
              height={height}
              nameFormatter={tooltipNameFormatter}
            />
          )}

          {chartType === 'line' && enabledTypes.includes('line') && (
            <EnhancedLineChart
              data={data}
              dataKey={lines ? undefined : dataKey}
              nameKey={nameKey}
              formatter={formatter}
              colors={colors}
              lines={lines}
              dualYAxis={dualYAxis}
              height={height}
              withArea={withArea}
              xAxisTickFormatter={xAxisTickFormatter}
              tooltipLabelFormatter={tooltipLabelFormatter}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
