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
        'rounded-full px-sm py-0.5 text-xs font-medium',
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
    <tr className="border-b border-border transition-colors hover:bg-accent/30">
      <td className="whitespace-nowrap px-md py-3 text-xs text-muted-foreground">
        <div>{date.toLocaleDateString(i18n.language)}</div>
        <div className="font-mono">{date.toLocaleTimeString(i18n.language)}</div>
      </td>
      <td className="px-md py-3">
        <span className="font-medium text-foreground">{log.username ?? '—'}</span>
      </td>
      <td className="px-md py-3">
        <ActionBadge action={log.action} display={log.action_display} />
      </td>
      <td className="px-md py-3 text-sm text-muted-foreground">
        {log.model_name ?? '—'}
      </td>
      <td className="max-w-xs px-md py-3 text-sm text-foreground">
        <span className="line-clamp-2">{log.description}</span>
      </td>
      <td className="whitespace-nowrap px-md py-3 font-mono text-xs text-muted-foreground">
        {log.ip_address ?? '—'}
      </td>
    </tr>
  );
}
