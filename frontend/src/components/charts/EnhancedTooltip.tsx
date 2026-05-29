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
    <div className="animate-in fade-in-0 zoom-in-95 min-w-[160px] max-w-[300px] rounded-lg border border-border/60 bg-popover shadow-xl duration-150">
      {/* Label/Título */}
      {label && (
        <div className="border-b border-border/40 px-3 py-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labelFormatter ? labelFormatter(label) : label}
          </p>
        </div>
      )}

      {/* Lista de valores */}
      <div className="space-y-xs px-3 py-sm">
        {payload.map((entry, index) => (
          <div
            key={`tooltip-item-${index}`}
            className="flex items-center justify-between gap-md"
          >
            {/* Indicador de cor + Nome */}
            <div className="flex min-w-0 items-center gap-sm">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate text-xs text-foreground/75">{entry.name}</span>
            </div>

            {/* Valor */}
            <span className="text-sm font-bold tabular-nums text-foreground">
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
