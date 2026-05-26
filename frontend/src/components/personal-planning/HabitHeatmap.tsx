/* eslint-disable max-lines */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { habitHeatmapService } from '@/services/habit-heatmap-service';
import type { HeatmapDay } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns hex colour for a single cell. */
function cellColor(day: HeatmapDay): string {
  if (!day.is_scheduled) return 'var(--heatmap-empty)';
  if (day.expected === 0) return 'var(--heatmap-empty)';

  if (day.completed === 0) return 'var(--heatmap-missed)';

  const rate = day.completed / day.expected;
  if (rate <= 0.25) return 'var(--heatmap-low)';
  if (rate <= 0.5) return 'var(--heatmap-medium-low)';
  if (rate <= 0.75) return 'var(--heatmap-medium)';
  return 'var(--heatmap-high)';
}

/** Build a week-major 2-D grid (array of columns, each with 7 slots). */
function buildGrid(data: HeatmapDay[], year: number) {
  const jan1 = new Date(year, 0, 1);
  // In JS getDay(): 0=Sun..6=Sat. We want Mon=0..Sun=6.
  const jan1Weekday = (jan1.getDay() + 6) % 7;

  // Total slots: pad start so Jan 1 lands on the correct weekday row.
  const totalSlots = jan1Weekday + data.length;
  const numCols = Math.ceil(totalSlots / 7);

  // 2-D array [col][row] — null means empty padding.
  const grid: (HeatmapDay | null)[][] = Array.from(
    { length: numCols },
    (): (HeatmapDay | null)[] => Array(7).fill(null) as (HeatmapDay | null)[]
  );

  data.forEach((day, i) => {
    const slot = jan1Weekday + i;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    grid[col][row] = day;
  });

  return { grid, jan1Weekday, numCols };
}

/** Find which column each month label should start at. */
function monthLabels(data: HeatmapDay[], jan1Weekday: number, monthNames: string[]) {
  const labels: { month: string; col: number }[] = [];
  let lastMonth = -1;
  data.forEach((day, i) => {
    const m = parseInt(day.date.split('-')[1], 10) - 1;
    if (m !== lastMonth) {
      lastMonth = m;
      const col = Math.floor((jan1Weekday + i) / 7);
      labels.push({ month: monthNames[m], col });
    }
  });
  return labels;
}

// ─── component ──────────────────────────────────────────────────────────────

interface HabitHeatmapProps {
  taskId?: string | number;
  taskName?: string;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

export function HabitHeatmap({ taskId, taskName }: HabitHeatmapProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<HeatmapDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await habitHeatmapService.getHeatmap({
        year,
        ...(taskId !== undefined ? { task_id: taskId } : {}),
      });
      setData(result.data);
    } finally {
      setIsLoading(false);
    }
  }, [year, taskId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    t(`pages.planningDashboard.weekdayShort.${i}`)
  );

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    t(`pages.planningDashboard.monthShort.${i}`)
  );

  const getCellLabel = useCallback(
    (day: HeatmapDay): string => {
      const [year, month, d] = day.date.split('-');
      const dateStr = `${d}/${month}/${year}`;

      if (!day.is_scheduled || day.expected === 0) {
        return t('pages.planningDashboard.heatmapTooltipNotScheduled', {
          date: dateStr,
        });
      }

      return t('pages.planningDashboard.heatmapTooltipScheduled', {
        date: dateStr,
        completed: day.completed,
        expected: day.expected,
      });
    },
    [t]
  );

  const { grid, jan1Weekday, numCols } = buildGrid(data, year);
  const mLabels = monthLabels(data, jan1Weekday, monthNames);

  // Summary stats
  const scheduledDays = data.filter((d) => d.is_scheduled).length;
  const completedDays = data.filter(
    (d) => d.is_scheduled && d.completed >= d.expected && d.expected > 0
  ).length;
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);

  const CELL = 13; // px per cell
  const GAP = 2; // px gap

  return (
    <div className="space-y-3">
      {/* Header: year selector + task label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-xs">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-sm font-semibold">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {taskName && <span className="text-xs text-muted-foreground">{taskName}</span>}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {t('pages.planningDashboard.heatmapTotalCompletions', {
              count: totalCompleted,
            })}
          </span>
          {scheduledDays > 0 && (
            <span>
              {t('pages.planningDashboard.heatmapCompletedDays', {
                completed: completedDays,
                scheduled: scheduledDays,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Heatmap grid */}
      {isLoading ? (
        <div className="h-[110px] animate-pulse rounded-md bg-muted" />
      ) : (
        <div className="relative overflow-x-auto pb-xs">
          {/* Wrapper with left padding for weekday labels */}
          <div className="flex gap-xs">
            {/* Weekday labels */}
            <div
              className="flex shrink-0 flex-col"
              style={{ gap: GAP, paddingTop: CELL + GAP /* skip month label row */ }}
            >
              {weekdayLabels.map((label, i) => (
                <div
                  key={label}
                  className="flex items-center justify-end text-xs text-muted-foreground"
                  style={{ height: CELL, fontSize: 9, lineHeight: `${CELL}px` }}
                >
                  {/* Only render Mon, Wed, Fri, Sun to reduce clutter */}
                  {[0, 2, 4, 6].includes(i) ? label : ''}
                </div>
              ))}
            </div>

            {/* Grid columns */}
            <div style={{ position: 'relative' }}>
              {/* Month labels row */}
              <div
                className="flex"
                style={{ gap: GAP, height: CELL, marginBottom: GAP }}
              >
                {Array.from({ length: numCols }, (_, col) => {
                  const label = mLabels.find((l) => l.col === col);
                  return (
                    <div
                      key={col}
                      style={{ width: CELL, fontSize: 9, lineHeight: `${CELL}px` }}
                      className="shrink-0 overflow-hidden text-xs text-muted-foreground"
                    >
                      {label?.month ?? ''}
                    </div>
                  );
                })}
              </div>

              {/* Day cells */}
              <div className="flex" style={{ gap: GAP }}>
                {grid.map((col, colIdx) => (
                  <div key={colIdx} className="flex flex-col" style={{ gap: GAP }}>
                    {col.map((day, rowIdx) => (
                      <div
                        key={rowIdx}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          backgroundColor: day ? cellColor(day) : 'transparent',
                          cursor: day ? 'pointer' : 'default',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          if (!day) return;
                          const rect = (
                            e.target as HTMLElement
                          ).getBoundingClientRect();
                          setTooltip({
                            text: getCellLabel(day),
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip (portal-less, fixed position) */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="rounded-md border bg-popover px-sm py-xs text-xs text-popover-foreground shadow-md"
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-xs text-xs text-muted-foreground">
        <span>{t('pages.planningDashboard.heatmapLess')}</span>
        {[
          'var(--heatmap-empty)',
          'var(--heatmap-low)',
          'var(--heatmap-medium-low)',
          'var(--heatmap-medium)',
          'var(--heatmap-high)',
        ].map((color, i) => (
          <div
            key={i}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
        ))}
        <span>{t('pages.planningDashboard.heatmapMore')}</span>
      </div>
    </div>
  );
}
