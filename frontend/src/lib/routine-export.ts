import { Workbook } from 'exceljs';

import type { RoutineTask } from '@/types';

export interface DayScheduleEntry {
  time: string | null;
  task: RoutineTask;
}

export interface DaySchedule {
  dayName: string;
  pythonWeekday: number;
  entries: DayScheduleEntry[];
}

// Hex values derived from light-theme CSS variables (matches StatementDocument palette)
export const PRIORITY_PDF_COLORS: Record<string, string> = {
  low: '#6C664B', // --muted-foreground
  medium: '#036A96', // --info
  high: '#A34D14', // --warning
  critical: '#CB3A2A', // --destructive
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  health: '💊',
  intellect: '📚',
  spiritual: '🙏',
  exercise: '🏋️',
  nutrition: '🍽️',
  work: '💼',
  social: '🤝',
  finance: '💰',
  household: '🏠',
  personal_care: '✨',
  other: '📌',
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
  if (task.default_time) {
    // API returns "HH:MM:SS" — truncate to "HH:MM"
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
      { width: 28 },
      { width: 45 },
      { width: 12 },
      { width: 18 },
    ];

    ws.addRow(['Horário', 'Nome da Tarefa', 'Descrição', 'Criticidade', 'Categoria']);

    for (const entry of day.entries) {
      ws.addRow([
        entry.time ?? 'Sem horário definido',
        entry.task.name,
        entry.task.description ?? '',
        entry.task.priority_display,
        entry.task.category_display,
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
