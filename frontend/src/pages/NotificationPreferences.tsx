import { Bell, Mail, BellOff, BellRing } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NotificationPreferences() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationPreferencesService.getAll();
      setPreferences(data);
    } catch (err) {
      toast({
        title: t('pages.notificationPreferences.loadError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function getChannel(notificationType: NotificationType): NotificationChannel {
    return (
      preferences.find((p) => p.notification_type === notificationType)?.channel ??
      'in_app'
    );
  }

  async function handleChannelChange(
    notificationType: NotificationType,
    channel: NotificationChannel
  ) {
    setSavingType(notificationType);
    try {
      const existing = preferences.find(
        (p) => p.notification_type === notificationType
      );
      if (existing) {
        const updated = await notificationPreferencesService.update(existing.id, {
          channel,
        });
        setPreferences((prev) => prev.map((p) => (p.id === existing.id ? updated : p)));
      } else {
        const created = await notificationPreferencesService.create({
          notification_type: notificationType,
          channel,
        });
        setPreferences((prev) => [...prev, created]);
      }
      toast({ title: t('pages.notificationPreferences.savedSuccess') });
    } catch (err) {
      toast({
        title: t('pages.notificationPreferences.saveError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setSavingType(null);
    }
  }

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.notificationPreferences.title')}
        icon={<Bell className="h-6 w-6" />}
      />
      <p className="text-muted-foreground">
        {t('pages.notificationPreferences.subtitle')}
      </p>

      <div className="grid gap-md sm:grid-cols-2">
        {NOTIFICATION_TYPE_KEYS.map((key) => {
          const currentChannel = getChannel(key);
          const isSaving = savingType === key;
          const label = t(`pages.notificationPreferences.types.${key}_label`);
          const description = t(`pages.notificationPreferences.types.${key}_desc`);

          return (
            <Card key={key} className="flex flex-col">
              <CardHeader className="pb-sm">
                <div className="flex items-start justify-between gap-sm">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
                  </div>
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
                        <span className="flex items-center gap-sm">
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

      <div className="mt-lg rounded-lg border border-dashed p-md text-sm text-muted-foreground">
        <p className="flex items-center gap-sm">
          <BellOff className="h-4 w-4 shrink-0" />
          <span>{t('pages.notificationPreferences.emailNote')}</span>
        </p>
      </div>
    </PageContainer>
  );
}
