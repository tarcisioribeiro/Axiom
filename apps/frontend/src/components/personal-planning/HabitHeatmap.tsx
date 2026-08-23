/* eslint-disable max-lines */
import {
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  ArrowsPointingOutIcon as Maximize2,
  ArrowsPointingInIcon as Minimize2,
  XMarkIcon as X,
} from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const TASK_CATEGORIES = [
  { value: 'health', label: 'Saúde' },
  { value: 'intellect', label: 'Intelecto' },
  { value: 'spiritual', label: 'Espiritual' },
  { value: 'exercise', label: 'Exercício Físico' },
  { value: 'nutrition', label: 'Nutrição' },
  { value: 'work', label: 'Trabalho' },
  { value: 'social', label: 'Social' },
  { value: 'finance', label: 'Finanças' },
  { value: 'household', label: 'Casa' },
  { value: 'personal_care', label: 'Cuidado Pessoal' },
  { value: 'other', label: 'Outros' },
];

interface HabitHeatmapProps {
  taskId?: string | number;
  taskName?: string;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

const EMPTY_DAYS: HeatmapDay[] = [];

export function HabitHeatmap({ taskId, taskName }: HabitHeatmapProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ['habit-heatmap', year, taskId, selectedCategory],
    queryFn: () =>
      habitHeatmapService.getHeatmap({
        year,
        ...(taskId !== undefined ? { task_id: taskId } : {}),
        ...(selectedCategory ? { category: selectedCategory } : {}),
      }),
  });
  const data = heatmapData?.data ?? EMPTY_DAYS;

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

  const heatmapContent = (
    <div className="space-y-3">
      {/* Header: year selector + filters + expand */}
      <div className="gap-sm flex flex-wrap items-center justify-between">
        <div className="gap-xs flex items-center">
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

        {!taskId && (
          <Select
            value={selectedCategory}
            onValueChange={(val) => setSelectedCategory(val === 'all' ? '' : val)}
          >
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue
                placeholder={t('pages.planningDashboard.allCategories', {
                  defaultValue: 'Todas as categorias',
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.planningDashboard.allCategories', {
                  defaultValue: 'Todas as categorias',
                })}
              </SelectItem>
              {TASK_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {taskName && <span className="text-muted-foreground text-xs">{taskName}</span>}

        <div className="gap-sm flex items-center">
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setIsExpanded((v) => !v)}
            title={
              isExpanded
                ? t('common.actions.hide')
                : t('pages.planningDashboard.expand', { defaultValue: 'Expandir' })
            }
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Heatmap grid */}
      {isLoading ? (
        <div className="bg-muted h-[110px] animate-pulse rounded-md" />
      ) : (
        <div className="pb-xs relative overflow-x-auto">
          {/* Wrapper with left padding for weekday labels */}
          <div className="gap-xs flex">
            {/* Weekday labels */}
            <div
              className="flex shrink-0 flex-col"
              style={{ gap: GAP, paddingTop: CELL + GAP /* skip month label row */ }}
            >
              {weekdayLabels.map((label, i) => (
                <div
                  key={label}
                  className="text-muted-foreground flex items-center justify-end text-xs"
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
                      className="text-muted-foreground shrink-0 overflow-hidden text-xs"
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

      {/* Tooltip — portaled to body so position:fixed resolves against the
          viewport instead of a transformed ancestor (e.g. Radix DialogContent) */}
      {tooltip &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className="bg-popover px-sm py-xs text-popover-foreground rounded-md border text-xs shadow-md"
          >
            {tooltip.text}
          </div>,
          document.body
        )}

      {/* Legend */}
      <div className="gap-xs text-muted-foreground flex items-center text-xs">
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

  if (isExpanded) {
    return createPortal(
      <div className="bg-background/95 p-lg fixed inset-0 z-50 flex items-start justify-center overflow-y-auto backdrop-blur-sm">
        <div className="border-border bg-card p-lg w-full max-w-5xl rounded-lg border shadow-2xl">
          <div className="mb-md flex items-center justify-between">
            <span className="text-foreground text-sm font-semibold">
              {t('pages.planningDashboard.habitHeatmapTitle', {
                defaultValue: 'Mapa de Hábitos',
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(false)}
              title={t('common.actions.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {heatmapContent}
        </div>
      </div>,
      document.body
    );
  }

  return heatmapContent;
}
