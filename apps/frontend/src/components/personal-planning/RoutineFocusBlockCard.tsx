import { Edit, Trash2 } from 'lucide-react';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { getIconByName } from '@/components/ui/icon-picker';
import type { FocusBlock } from '@/types';
import { WEEKDAY_CHOICES } from '@/types';

export function BlockIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const icon = getIconByName(name);
  if (!icon) return null;
  return createElement(icon, { className });
}

interface RoutineFocusBlockCardProps {
  block: FocusBlock;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RoutineFocusBlockCard({
  block,
  onOpen,
  onEdit,
  onDelete,
}: RoutineFocusBlockCardProps) {
  const { t } = useTranslation();
  return (
    <div
      role="button"
      tabIndex={0}
      // Cliques/teclas vindos dos botões de ação não abrem as tarefas.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onOpen();
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      className="gap-sm px-md py-sm bg-card focus-visible:ring-ring flex cursor-pointer items-center rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
    >
      <BlockIcon name={block.icon} className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="flex-1">
        <span className="block text-sm font-semibold">{block.name}</span>
        <span className="text-muted-foreground text-2xs">
          {WEEKDAY_CHOICES.filter((d) => block.weekdays.includes(d.value))
            .map((d) => d.label.substring(0, 3))
            .join(' · ')}
        </span>
      </div>
      <span className="bg-muted text-muted-foreground px-xs rounded-full py-0.5 text-xs font-medium tabular-nums">
        {block.block_tasks.length}
      </span>
      <Button
        aria-label={t('common.actions.edit')}
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onEdit}
      >
        <Edit className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button
        aria-label={t('common.actions.delete')}
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onDelete}
      >
        <Trash2 className="text-destructive h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
