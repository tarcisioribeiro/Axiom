import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

import { ACTION_KEYS, ACTION_VARIANTS } from './AdminLogsConstants';

export function ActionBadge({ action, display }: { action: string; display: string }) {
  const { t } = useTranslation();
  const key = ACTION_KEYS[action];
  return (
    <Badge variant={ACTION_VARIANTS[action] ?? 'secondary'}>
      {key
        ? t(`pages.adminLogs.actions.${key}`, { defaultValue: display })
        : display || action}
    </Badge>
  );
}
