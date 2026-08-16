import type { ChartTooltipProps } from '@/lib/chart-types';

export const EnhancedTooltip = ({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  nameFormatter,
}: ChartTooltipProps & { nameFormatter?: (name: string) => string | null }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="animate-in fade-in-0 zoom-in-95 border-border/60 bg-popover max-w-[300px] min-w-[160px] rounded-lg border shadow-xl duration-150">
      {/* Label/Título */}
      {label && (
        <div className="border-border/40 py-sm border-b px-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {labelFormatter ? labelFormatter(label) : label}
          </p>
        </div>
      )}

      {/* Lista de valores */}
      <div className="space-y-xs py-sm px-3">
        {payload.map((entry, index) => (
          <div
            key={`tooltip-item-${index}`}
            className="gap-md flex items-center justify-between"
          >
            {/* Indicador de cor + Nome */}
            <div className="gap-sm flex min-w-0 items-center">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              {(() => {
                const displayName = nameFormatter
                  ? nameFormatter(String(entry.name))
                  : String(entry.name);
                return displayName ? (
                  <span className="text-foreground/75 truncate text-xs">
                    {displayName}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Valor */}
            <span className="text-foreground text-sm font-bold tabular-nums">
              {formatter ? formatter(entry.value, entry) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
