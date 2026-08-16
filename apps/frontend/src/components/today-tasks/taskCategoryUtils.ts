const CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-category-health/15 text-category-health border-transparent',
  intellect: 'bg-category-studies/15 text-category-studies border-transparent',
  studies: 'bg-category-studies/15 text-category-studies border-transparent',
  spiritual: 'bg-category-spiritual/15 text-category-spiritual border-transparent',
  exercise: 'bg-category-exercise/15 text-category-exercise border-transparent',
  nutrition: 'bg-category-nutrition/15 text-category-nutrition border-transparent',
  meditation: 'bg-category-spiritual/15 text-category-spiritual border-transparent',
  reading: 'bg-category-studies/15 text-category-studies border-transparent',
  writing: 'bg-category-work/15 text-category-work border-transparent',
  work: 'bg-category-work/15 text-category-work border-transparent',
  leisure: 'bg-category-leisure/15 text-category-leisure border-transparent',
  family: 'bg-accent text-accent-foreground border-transparent',
  social: 'bg-category-leisure/15 text-category-leisure border-transparent',
  finance: 'bg-category-finance/15 text-category-finance border-transparent',
  household: 'bg-category-nutrition/15 text-category-nutrition border-transparent',
  personal_care: 'bg-category-health/15 text-category-health border-transparent',
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
