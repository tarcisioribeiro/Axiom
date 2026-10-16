import type { RoutineTask } from '@/types';

export function appearsOnDay(task: RoutineTask, pythonWeekday: number): boolean {
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

// JS Date.getDay(): 0=Sun..6=Sat → Python date.weekday(): 0=Mon..6=Sun
export function getPythonWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function getTimesForTask(task: RoutineTask): (string | null)[] {
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
