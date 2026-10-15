/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TooltipBubble } from '@/components/ui/tooltip-bubble';
import { TASK_CATEGORY_ICONS } from '@/config/icons';
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
function buildGrid(data: HeatmapDay[], startDate: Date) {
  // In JS getDay(): 0=Sun..6=Sat. We want Mon=0..Sun=6.
  const jan1Weekday = (startDate.getDay() + 6) % 7;

  // Total slots: pad start so the first day lands on the correct weekday row.
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
  /** Mostra só os últimos N dias, sem navegação de ano nem filtro de categoria. */
  recentDays?: number;
}

interface TooltipState {
  text: string;
  anchor: HTMLElement;
}

const EMPTY_DAYS: HeatmapDay[] = [];

export function HabitHeatmap({ taskId, taskName, recentDays }: HabitHeatmapProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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
  // ponytail: o backend só retorna dados do ano corrente (Jan1..hoje), então nos
  // primeiros `recentDays` dias do ano a janela fica menor que o pedido; expandir
  // para cruzar o ano anterior se isso passar a importar.
  const displayData = recentDays ? data.slice(-recentDays) : data;

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    t(`pages.planningDashboard.weekdayShort.${i}`)
  );

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    t(`pages.planningDashboard.monthShort.${i}`)
  );

  // Start scrolled to the end so the most recent days are visible.
  // Stable ref: runs only when the grid mounts (after each load), not on re-renders.
  const scrollToEnd = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

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

  const gridStartDate = displayData[0]
    ? new Date(`${displayData[0].date}T00:00:00`)
    : new Date(year, 0, 1);
  const { grid, jan1Weekday, numCols } = buildGrid(displayData, gridStartDate);
  const mLabels = monthLabels(displayData, jan1Weekday, monthNames);

  // Summary stats
  const scheduledDays = displayData.filter((d) => d.is_scheduled).length;
  const completedDays = displayData.filter(
    (d) => d.is_scheduled && d.completed >= d.expected && d.expected > 0
  ).length;
  const totalCompleted = displayData.reduce((s, d) => s + d.completed, 0);

  const CELL = 13; // px per cell
  const GAP = 2; // px gap

  return (
    <div className="space-y-sm">
      {/* Header: year selector + filters */}
      <div className="gap-sm flex flex-wrap items-center justify-between">
        {recentDays ? (
          <span className="text-muted-foreground text-sm font-semibold">
            {t('pages.planningDashboard.recentDaysLabel', { days: recentDays })}
          </span>
        ) : (
          <div className="gap-xs flex items-center">
            <Button
              aria-label={t('common.actions.previous')}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[3rem] text-center text-sm font-semibold">
              {year}
            </span>
            <Button
              aria-label={t('common.actions.next')}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= currentYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {!taskId && !recentDays && (
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
              {TASK_CATEGORIES.map((cat) => {
                const CatIcon = TASK_CATEGORY_ICONS[cat.value];
                return (
                  <SelectItem
                    key={cat.value}
                    value={cat.value}
                    icon={CatIcon ? <CatIcon className="h-4 w-4" /> : undefined}
                  >
                    {cat.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {taskName && <span className="text-muted-foreground text-xs">{taskName}</span>}

        <div className="gap-sm flex items-center">
          <div className="text-muted-foreground gap-sm flex items-center text-xs">
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
      </div>

      {/* Heatmap grid */}
      {isLoading ? (
        <div className="bg-muted h-[110px] animate-pulse rounded-md" />
      ) : (
        <div ref={scrollToEnd} className="pb-xs relative overflow-x-auto">
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
                          setTooltip({
                            text: getCellLabel(day),
                            anchor: e.currentTarget,
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

      {tooltip && (
        <TooltipBubble anchor={tooltip.anchor} className="font-normal">
          {tooltip.text}
        </TooltipBubble>
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
}
