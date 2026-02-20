import type { ChartTooltipProps } from '@/lib/chart-types';

/**
 * Tooltip customizado para gráficos Recharts
 * Design moderno com:
 * - Visual limpo e minimalista
 * - Indicadores de cor arredondados
 * - Formatação de valores
 * - Suporte a múltiplos itens
 * - Animação suave
 */
export const EnhancedTooltip = ({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="animate-in fade-in-0 zoom-in-95 min-w-[140px] max-w-[280px] rounded-lg border border-border bg-popover/95 p-3 shadow-lg backdrop-blur-md duration-150">
      {/* Label/Título */}
      {label && (
        <p className="mb-2 border-b border-border/50 pb-2 text-xs font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}

      {/* Lista de valores */}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div
            key={`tooltip-item-${index}`}
            className="flex items-center justify-between gap-3"
          >
            {/* Indicador de cor + Nome */}
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-white/20"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate text-sm text-foreground/80">{entry.name}</span>
            </div>

            {/* Valor */}
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
