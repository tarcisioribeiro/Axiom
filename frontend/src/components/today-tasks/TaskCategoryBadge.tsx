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
      className={`flex shrink-0 items-center gap-sm rounded-md border px-sm py-xs text-xs font-semibold ${getCategoryColor(category)}`}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable Lucide reference, not a dynamic component */}
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}
