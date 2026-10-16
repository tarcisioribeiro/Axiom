import { getCategoryColor } from '@/components/today-tasks/taskCategoryUtils';
import { getIconByName } from '@/components/ui/icon-picker';

export function TaskCategoryBadge({
  icon,
  label,
  category,
}: {
  icon?: string | null;
  label: string;
  category: string;
}) {
  const Icon = getIconByName(icon);
  return (
    <div
      className={`gap-sm px-sm py-xs flex shrink-0 items-center rounded-md border text-xs font-semibold ${getCategoryColor(category)}`}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable icon-component reference, not a dynamic component */}
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}
