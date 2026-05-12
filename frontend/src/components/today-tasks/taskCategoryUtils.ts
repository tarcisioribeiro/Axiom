const CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-category-health text-white border-transparent',
  intellect: 'bg-category-studies text-white border-transparent',
  studies: 'bg-category-studies text-white border-transparent',
  spiritual: 'bg-category-spiritual text-white border-transparent',
  exercise: 'bg-category-exercise text-white border-transparent',
  nutrition: 'bg-category-nutrition text-white border-transparent',
  meditation: 'bg-category-spiritual text-white border-transparent',
  reading: 'bg-category-studies text-white border-transparent',
  writing: 'bg-category-work text-white border-transparent',
  work: 'bg-category-work text-white border-transparent',
  leisure: 'bg-category-leisure text-white border-transparent',
  family: 'bg-accent text-accent-foreground border-transparent',
  social: 'bg-category-leisure text-white border-transparent',
  finance: 'bg-category-finance text-white border-transparent',
  household: 'bg-category-nutrition text-white border-transparent',
  personal_care: 'bg-category-health text-white border-transparent',
};

export function getCategoryColor(category: string): string {
  return (
    CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground border-transparent'
  );
}

export function getStatusBadge(status: string, t: (key: string) => string) {
  switch (status) {
    case 'completed':
      return {
        variant: 'success' as const,
        label: t('pages.todayTasks.status.completed'),
      };
    case 'in_progress':
      return {
        variant: 'warning' as const,
        label: t('pages.todayTasks.status.in_progress'),
      };
    case 'skipped':
      return {
        variant: 'secondary' as const,
        label: t('pages.todayTasks.status.skipped'),
      };
    default:
      return { variant: 'info' as const, label: t('pages.todayTasks.status.pending') };
  }
}
