import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, BellRing, Save, Zap } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { notificationPreferencesService } from '@/services/notification-preferences-service';
import type {
  NotificationChannel,
  NotificationPreference,
  NotificationType,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

// ─── Static data ─────────────────────────────────────────────────────────────

const NOTIFICATION_TYPE_KEYS: NotificationType[] = [
  'task_today',
  'task_overdue',
  'payable_due_soon',
  'payable_overdue',
  'loan_due_soon',
  'loan_overdue',
  'bill_due_soon',
  'bill_overdue',
  'budget_warning',
  'budget_exceeded',
  'financial_goal_reached',
  'financial_goal_approaching',
  'agent_insight',
];

const CHANNEL_OPTION_KEYS: { value: NotificationChannel; icon: React.ReactNode }[] = [
  { value: 'in_app', icon: <Bell className="h-3.5 w-3.5" /> },
  { value: 'email', icon: <Mail className="h-3.5 w-3.5" /> },
  { value: 'both', icon: <BellRing className="h-3.5 w-3.5" /> },
];

// ─── Channel badge ─────────────────────────────────────────────────────────

const CHANNEL_KEY_MAP: Record<NotificationChannel, string> = {
  in_app: 'channelInApp',
  email: 'channelEmail',
  both: 'channelBoth',
};

function ChannelBadge({ channel }: { channel: NotificationChannel }) {
  const { t } = useTranslation();
  const option = CHANNEL_OPTION_KEYS.find((o) => o.value === channel);
  if (!option) return null;
  return (
    <Badge variant="outline" className="gap-xs text-xs">
      {option.icon}
      {t(`pages.notificationPreferences.${CHANNEL_KEY_MAP[channel]}`)}
    </Badge>
  );
}

// ─── Content ───────────────────────────────────────────────────────────────

const EMPTY_PREFERENCES: NotificationPreference[] = [];

/** Renderiza a lista e o rodapé de ações como irmãos, para o modal fixar o rodapé. */
export function NotificationPreferencesContent({
  bodyClassName,
}: {
  bodyClassName?: string;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<
    Record<NotificationType, NotificationChannel>
  >({} as Record<NotificationType, NotificationChannel>);

  const { data: preferences = EMPTY_PREFERENCES, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      try {
        return await notificationPreferencesService.getAll();
      } catch (err) {
        toast({
          title: t('pages.notificationPreferences.loadError'),
          description: getErrorMessage(err),
          variant: 'destructive',
        });
        return EMPTY_PREFERENCES;
      }
    },
  });

  function getChannel(notificationType: NotificationType): NotificationChannel {
    if (notificationType in pendingChanges) return pendingChanges[notificationType];
    return (
      preferences.find((p) => p.notification_type === notificationType)?.channel ??
      'in_app'
    );
  }

  function handleChannelChange(
    notificationType: NotificationType,
    channel: NotificationChannel
  ) {
    setPendingChanges((prev) => ({ ...prev, [notificationType]: channel }));
  }

  async function handleSave() {
    if (Object.keys(pendingChanges).length === 0) {
      toast({
        title: t('pages.notificationPreferences.noChanges'),
        description: t('pages.notificationPreferences.noChangesDesc'),
      });
      return;
    }
    setIsSaving(true);
    try {
      for (const [notificationType, channel] of Object.entries(pendingChanges)) {
        const existing = preferences.find(
          (p) => p.notification_type === notificationType
        );
        if (existing) {
          const updated = await notificationPreferencesService.update(existing.id, {
            channel,
          });
          queryClient.setQueryData<NotificationPreference[]>(
            ['notification-preferences'],
            (prev = EMPTY_PREFERENCES) =>
              prev.map((p) => (p.id === existing.id ? updated : p))
          );
        } else {
          const created = await notificationPreferencesService.create({
            notification_type: notificationType as NotificationType,
            channel,
          });
          queryClient.setQueryData<NotificationPreference[]>(
            ['notification-preferences'],
            (prev = EMPTY_PREFERENCES) => [...prev, created]
          );
        }
      }
      setPendingChanges({} as Record<NotificationType, NotificationChannel>);
      toast({
        title: t('pages.notificationPreferences.savedSuccess'),
        description: t('pages.notificationPreferences.savedSuccessDesc'),
      });
    } catch (err) {
      toast({
        title: t('pages.notificationPreferences.saveError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleTest() {
    toast({
      title: t('pages.notificationPreferences.testSuccess'),
      description: t('pages.notificationPreferences.testSuccessDesc'),
    });
  }

  if (isLoading) return <LoadingState />;

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <>
      <div className={cn('gap-md grid sm:grid-cols-2', bodyClassName)}>
        {NOTIFICATION_TYPE_KEYS.map((key) => {
          const currentChannel = getChannel(key);
          const label = t(`pages.notificationPreferences.types.${key}_label`);
          const isPending = key in pendingChanges;

          return (
            <Card
              key={key}
              className={`flex flex-col ${isPending ? 'ring-primary/40 ring-1' : ''}`}
            >
              <CardHeader className="pb-sm">
                <div className="gap-sm flex items-start justify-between">
                  <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                  <ChannelBadge channel={currentChannel} />
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Select
                  value={currentChannel}
                  onValueChange={(val) =>
                    handleChannelChange(key, val as NotificationChannel)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTION_KEYS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="gap-sm flex items-center">
                          {opt.icon}
                          {t(
                            `pages.notificationPreferences.${CHANNEL_KEY_MAP[opt.value]}`
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleTest} disabled={isSaving}>
          <Zap />
          {t('pages.notificationPreferences.testBtn')}
        </Button>
        <Button onClick={() => void handleSave()} loading={isSaving}>
          {!isSaving && <Save />}
          {t('pages.notificationPreferences.saveBtn')}
          {hasChanges && (
            <Badge variant="secondary" className="ml-xs text-xs">
              {Object.keys(pendingChanges).length}
            </Badge>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
