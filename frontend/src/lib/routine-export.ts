import { Workbook } from 'exceljs';

import { translate } from '@/config/constants';
import type { RoutineTask } from '@/types';

// ── PDF palette ───────────────────────────────────────────────────────────────
// react-pdf/renderer generates static documents and cannot use CSS variables.
// All PDF components must reference this object instead of inlining hex values.
// Locked to the Alucard light theme (the only theme used for PDF output).
export const PDF_PALETTE = {
  background: '#FFFBEB',
  card: '#FFFAF2',
  primary: '#644AC9',
  primaryLight: '#EDE9F8',
  foreground: '#1F1F1F',
  mutedForeground: '#6C664B',
  success: '#14710A',
  successLight: '#E6F4E5',
  destructive: '#CB3A2A',
  destructiveLight: '#FAECEC',
  warning: '#A34D14',
  info: '#036A96',
  infoLight: '#E0F2FA',
  border: '#C8C8D8',
  borderSubtle: '#E8E8F0',
  white: '#FFFFFF',
  surface: '#F9F9FB',
  separator: '#D4D4D8',
  timeText: '#4A33A0',
  timeBg: '#EDE9F8',
} as const;

export interface DayScheduleEntry {
  time: string | null;
  task: RoutineTask;
}

export interface DaySchedule {
  dayName: string;
  pythonWeekday: number;
  entries: DayScheduleEntry[];
}

export const PRIORITY_PDF_COLORS: Record<string, string> = {
  low: PDF_PALETTE.mutedForeground,
  medium: PDF_PALETTE.info,
  high: PDF_PALETTE.warning,
  critical: PDF_PALETTE.destructive,
};

// Category dot colors for PDF — intentional fixed colors, not mapped to CSS vars
export const CATEGORY_COLORS: Record<string, string> = {
  health: '#CB3A2A',
  intellect: '#644AC9',
  spiritual: '#8B6914',
  exercise: '#1B6F2A',
  nutrition: '#C47B0A',
  work: '#036A96',
  social: '#7B3FA0',
  finance: '#1B4F72',
  household: '#5D4037',
  personal_care: '#AD1457',
  other: '#455A64',
};

// Display order: Sunday first, then Monday–Saturday
// Python/Django weekday(): 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
const WEEK_ORDER = [
  { dayName: 'Domingo', pythonWeekday: 6 },
  { dayName: 'Segunda-feira', pythonWeekday: 0 },
  { dayName: 'Terça-feira', pythonWeekday: 1 },
  { dayName: 'Quarta-feira', pythonWeekday: 2 },
  { dayName: 'Quinta-feira', pythonWeekday: 3 },
  { dayName: 'Sexta-feira', pythonWeekday: 4 },
  { dayName: 'Sábado', pythonWeekday: 5 },
];

function appearsOnDay(task: RoutineTask, pythonWeekday: number): boolean {
  if (!task.is_active) return false;

  switch (task.periodicity) {
    case 'daily':
      return true;
    case 'weekdays':
      // Monday(0) through Friday(4)
      return pythonWeekday >= 0 && pythonWeekday <= 4;
    case 'weekly':
      return task.weekday === pythonWeekday;
    case 'custom':
      if (task.custom_weekdays && task.custom_weekdays.length > 0) {
        return task.custom_weekdays.includes(pythonWeekday);
      }
      return false;
    default:
      return false;
  }
}

function getTimesForTask(task: RoutineTask): (string | null)[] {
  if (task.scheduled_times && task.scheduled_times.length > 0) {
    return task.scheduled_times;
  }
  if (task.daily_occurrences > 1 && task.interval_hours && task.default_time) {
    const [startH, startM] = task.default_time.substring(0, 5).split(':').map(Number);
    return Array.from({ length: task.daily_occurrences }, (_, i) => {
      const totalMin = startH * 60 + startM + i * task.interval_hours! * 60;
      const hh = Math.floor(totalMin / 60) % 24;
      const mm = totalMin % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    });
  }
  if (task.default_time) {
    return [task.default_time.substring(0, 5)];
  }
  return [null];
}

export function buildWeeklySchedule(tasks: RoutineTask[]): DaySchedule[] {
  return WEEK_ORDER.map(({ dayName, pythonWeekday }) => {
    const entries: DayScheduleEntry[] = [];

    for (const task of tasks) {
      if (!appearsOnDay(task, pythonWeekday)) continue;
      for (const time of getTimesForTask(task)) {
        entries.push({ time, task });
      }
    }

    entries.sort((a, b) => {
      if (a.time === null && b.time === null)
        return a.task.name.localeCompare(b.task.name);
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      const timeCmp = a.time.localeCompare(b.time);
      return timeCmp !== 0 ? timeCmp : a.task.name.localeCompare(b.task.name);
    });

    return { dayName, pythonWeekday, entries };
  });
}

export async function exportScheduleToExcel(schedule: DaySchedule[]): Promise<void> {
  const wb = new Workbook();

  for (const day of schedule) {
    const ws = wb.addWorksheet(day.dayName);

    ws.columns = [
      { width: 10 },
      { width: 10 },
      { width: 28 },
      { width: 45 },
      { width: 12 },
      { width: 18 },
    ];

    ws.addRow([
      'Horário',
      'Encerramento',
      'Nome da Tarefa',
      'Descrição',
      'Criticidade',
      'Categoria',
    ]);

    for (const entry of day.entries) {
      const closingTime =
        entry.task.daily_occurrences === 1 && entry.task.closing_time
          ? entry.task.closing_time.substring(0, 5)
          : '';
      ws.addRow([
        entry.time ?? 'Sem horário definido',
        closingTime,
        entry.task.name,
        entry.task.description ?? '',
        entry.task.priority_display,
        translate('taskCategories', entry.task.category),
      ]);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rotina-semanal.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
