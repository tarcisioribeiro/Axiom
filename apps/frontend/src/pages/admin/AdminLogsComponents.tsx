import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import { cn } from '@/lib/utils';
import type { AdminLog } from '@/types';

import { ACTION_COLORS, ACTION_KEYS } from './AdminLogsConstants';

export function ActionBadge({ action, display }: { action: string; display: string }) {
  const { t } = useTranslation();
  const key = ACTION_KEYS[action];
  return (
    <span
      className={cn(
        'px-sm rounded-full py-0.5 text-xs font-medium',
        ACTION_COLORS[action] ?? 'bg-secondary text-muted-foreground'
      )}
    >
      {display || (key ? t(`pages.adminLogs.actions.${key}`) : action)}
    </span>
  );
}

export function LogRow({ log }: { log: AdminLog }) {
  const date = new Date(log.created_at);
  return (
    <tr className="border-border hover:bg-accent/30 border-b transition-colors">
      <td className="px-md text-muted-foreground py-3 text-xs whitespace-nowrap">
        <div>{date.toLocaleDateString(i18n.language)}</div>
        <div className="font-mono">{date.toLocaleTimeString(i18n.language)}</div>
      </td>
      <td className="px-md py-3">
        <span className="text-foreground font-medium">{log.username ?? '—'}</span>
      </td>
      <td className="px-md py-3">
        <ActionBadge action={log.action} display={log.action_display} />
      </td>
      <td className="px-md text-muted-foreground py-3 text-sm">
        {log.model_name ?? '—'}
      </td>
      <td className="px-md text-foreground max-w-xs py-3 text-sm">
        <span className="line-clamp-2">{log.description}</span>
      </td>
      <td className="px-md text-muted-foreground py-3 font-mono text-xs whitespace-nowrap">
        {log.ip_address ?? '—'}
      </td>
    </tr>
  );
}
