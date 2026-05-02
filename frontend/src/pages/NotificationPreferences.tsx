import { Bell, Mail, BellOff, BellRing } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

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

const NOTIFICATION_TYPES: {
  key: NotificationType;
  label: string;
  description: string;
}[] = [
  {
    key: 'task_today',
    label: 'Tarefa do Dia',
    description: 'Tarefas agendadas para hoje ainda não concluídas.',
  },
  {
    key: 'task_overdue',
    label: 'Tarefa Atrasada',
    description: 'Tarefas com data passada ainda pendentes.',
  },
  {
    key: 'payable_due_soon',
    label: 'Vencimento Próximo',
    description: 'Valores a pagar vencendo nos próximos 3 dias.',
  },
  {
    key: 'payable_overdue',
    label: 'Pagamento Atrasado',
    description: 'Valores a pagar com data já vencida.',
  },
  {
    key: 'loan_due_soon',
    label: 'Empréstimo Vencendo',
    description: 'Empréstimos com vencimento nos próximos 3 dias.',
  },
  {
    key: 'loan_overdue',
    label: 'Empréstimo Atrasado',
    description: 'Empréstimos com vencimento já passado.',
  },
  {
    key: 'bill_due_soon',
    label: 'Fatura Vencendo',
    description: 'Faturas de cartão vencendo nos próximos 3 dias.',
  },
  {
    key: 'bill_overdue',
    label: 'Fatura Atrasada',
    description: 'Faturas de cartão com vencimento já passado.',
  },
  {
    key: 'budget_warning',
    label: 'Alerta de Orçamento',
    description: 'Orçamento mensal atingiu 80% ou mais do limite definido.',
  },
  {
    key: 'budget_exceeded',
    label: 'Orçamento Estourado',
    description: 'Gastos ultrapassaram o limite do orçamento mensal.',
  },
  {
    key: 'financial_goal_reached',
    label: 'Meta Financeira Atingida',
    description: 'Meta financeira concluída: valor atual atingiu o valor alvo.',
  },
  {
    key: 'financial_goal_approaching',
    label: 'Meta Financeira Próxima do Prazo',
    description: 'Meta financeira com prazo vencendo nos próximos 30 dias.',
  },
];

const CHANNEL_OPTIONS: {
  value: NotificationChannel;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'in_app',
    label: 'Somente no App',
    icon: <Bell className="h-3.5 w-3.5" />,
  },
  {
    value: 'email',
    label: 'Somente E-mail',
    icon: <Mail className="h-3.5 w-3.5" />,
  },
  {
    value: 'both',
    label: 'App e E-mail',
    icon: <BellRing className="h-3.5 w-3.5" />,
  },
];

// ─── Channel badge ─────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: NotificationChannel }) {
  const option = CHANNEL_OPTIONS.find((o) => o.value === channel);
  if (!option) return null;
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      {option.icon}
      {option.label}
    </Badge>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NotificationPreferences() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationPreferencesService.getAll();
      setPreferences(data);
    } catch (err) {
      toast({
        title: 'Erro ao carregar preferências',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
      toast({ title: 'Preferência salva com sucesso.' });
    } catch (err) {
      toast({
        title: 'Erro ao salvar preferência',
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
        title="Preferências de Notificação"
        icon={<Bell className="h-6 w-6" />}
      />
      <p className="text-muted-foreground">
        Escolha como deseja receber cada tipo de alerta: somente no app, por e-mail ou
        ambos.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {NOTIFICATION_TYPES.map(({ key, label, description }) => {
          const currentChannel = getChannel(key);
          const isSaving = savingType === key;

          return (
            <Card key={key} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
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
                    {CHANNEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          {opt.icon}
                          {opt.label}
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

      <div className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <BellOff className="h-4 w-4 shrink-0" />
          <span>
            Para receber e-mails, certifique-se de que um endereço de e-mail válido
            esteja cadastrado na sua conta.
          </span>
        </p>
      </div>
    </PageContainer>
  );
}
