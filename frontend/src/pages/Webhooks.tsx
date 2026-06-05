/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_CONFIG } from '@/config/api-config';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api-client';
import type { Webhook, WebhookDelivery, WebhookEvent, WebhookFormData } from '@/types';

const EMPTY_FORM: WebhookFormData = {
  name: '',
  url: '',
  secret: '',
  events: [],
  is_active: true,
  timeout_seconds: 10,
  max_retries: 3,
};

function statusBadge(
  status: Webhook['last_delivery_status'],
  t: (key: string) => string
) {
  if (!status) return null;
  const map: Record<
    string,
    { labelKey: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }
  > = {
    success: { labelKey: 'webhooks.status.success', variant: 'default' },
    failed: { labelKey: 'webhooks.status.failed', variant: 'destructive' },
    retrying: { labelKey: 'webhooks.status.retrying', variant: 'secondary' },
    pending: { labelKey: 'webhooks.status.pending', variant: 'outline' },
  };
  const m = map[status] ?? { labelKey: status, variant: 'outline' as const };
  return <Badge variant={m.variant}>{t(m.labelKey)}</Badge>;
}

export default function Webhooks() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { showDelete } = useAlertDialog();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [form, setForm] = useState<WebhookFormData>(EMPTY_FORM);
  const [deliveriesWebhookId, setDeliveriesWebhookId] = useState<number | null>(null);

  const { data: webhooks, isLoading } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: () =>
      apiClient
        .get<{ results?: Webhook[] } | Webhook[]>(API_CONFIG.ENDPOINTS.WEBHOOKS)
        .then((d) => (Array.isArray(d) ? d : (d.results ?? []))),
  });

  const { data: events } = useQuery<WebhookEvent[]>({
    queryKey: ['webhook-events'],
    queryFn: () => apiClient.get<WebhookEvent[]>(API_CONFIG.ENDPOINTS.WEBHOOK_EVENTS),
  });

  const { data: deliveries, isLoading: loadingDeliveries } = useQuery<
    WebhookDelivery[]
  >({
    queryKey: ['webhook-deliveries', deliveriesWebhookId],
    queryFn: () =>
      apiClient.get<WebhookDelivery[]>(
        API_CONFIG.ENDPOINTS.WEBHOOK_DELIVERIES(deliveriesWebhookId!)
      ),
    enabled: !!deliveriesWebhookId,
  });

  const createMutation = useMutation({
    mutationFn: (data: WebhookFormData) =>
      apiClient.post(API_CONFIG.ENDPOINTS.WEBHOOKS, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: t('webhooks.created') });
      setDialogOpen(false);
    },
    onError: () => toast({ title: t('webhooks.createError'), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WebhookFormData> }) =>
      apiClient.patch(API_CONFIG.ENDPOINTS.WEBHOOK_DETAIL(id), data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: t('webhooks.updated') });
      setDialogOpen(false);
    },
    onError: () => toast({ title: t('webhooks.updateError'), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(API_CONFIG.ENDPOINTS.WEBHOOK_DETAIL(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: t('webhooks.deleted') });
    },
    onError: () => toast({ title: t('webhooks.deleteError'), variant: 'destructive' }),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.post(API_CONFIG.ENDPOINTS.WEBHOOK_TEST(id), {}),
    onSuccess: () => toast({ title: t('webhooks.testSuccess') }),
    onError: () => toast({ title: t('webhooks.testError'), variant: 'destructive' }),
  });

  function openCreate() {
    setEditingWebhook(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(w: Webhook) {
    setEditingWebhook(w);
    setForm({
      name: w.name,
      url: w.url,
      secret: '',
      events: w.events,
      is_active: w.is_active,
      timeout_seconds: w.timeout_seconds,
      max_retries: w.max_retries,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name || !form.url) return;
    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data: form });
    } else {
      if (!form.secret) return;
      createMutation.mutate(form);
    }
  }

  function handleDelete(w: Webhook) {
    void showDelete(`o webhook "${w.name}"`).then((ok) => {
      if (ok) deleteMutation.mutate(w.id);
    });
  }

  function toggleEvent(eventValue: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter((e) => e !== eventValue)
        : [...prev.events, eventValue],
    }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <PageContainer>
      <PageHeader
        title={t('webhooks.title')}
        description={t('webhooks.description')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-sm h-md w-md" />
            {t('webhooks.newBtn')}
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : !webhooks?.length ? (
        <EmptyState
          icon={<Zap className="h-10 w-10" />}
          title={t('webhooks.empty')}
          description={t('webhooks.emptyDesc')}
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-sm h-md w-md" />
              {t('webhooks.createBtn')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-md">
          {webhooks.map((w) => (
            <div
              key={w.id}
              className="flex items-start justify-between gap-md rounded-lg border bg-card p-md"
            >
              <div className="flex min-w-0 items-start gap-sm">
                <div className="mt-xs rounded-md bg-primary/10 p-sm">
                  <Globe className="h-md w-md text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-sm">
                    <span className="font-medium">{w.name}</span>
                    {!w.is_active && (
                      <Badge variant="secondary">{t('webhooks.inactive')}</Badge>
                    )}
                    {statusBadge(w.last_delivery_status, t)}
                  </div>
                  <p className="max-w-xs truncate text-sm text-muted-foreground">
                    {w.url}
                  </p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {w.events.slice(0, 4).map((ev) => (
                      <Badge key={ev} variant="outline" className="text-xs">
                        {ev}
                      </Badge>
                    ))}
                    {w.events.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{w.events.length - 4}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-xs text-xs text-muted-foreground">
                    {t('webhooks.deliveries', { count: w.delivery_count })}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-xs">
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('webhooks.viewDeliveries')}
                  onClick={() =>
                    setDeliveriesWebhookId(w.id === deliveriesWebhookId ? null : w.id)
                  }
                >
                  <Activity className="h-md w-md" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('webhooks.testBtn')}
                  onClick={() => testMutation.mutate(w.id)}
                  disabled={testMutation.isPending}
                >
                  <Send className="h-md w-md" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(w)}>
                  <Pencil className="h-md w-md" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleDelete(w)}
                >
                  <Trash2 className="h-md w-md" />
                </Button>
              </div>
            </div>
          ))}

          {deliveriesWebhookId && (
            <div className="rounded-lg border bg-card p-md">
              <h3 className="mb-sm font-medium">{t('webhooks.deliveryHistory')}</h3>
              {loadingDeliveries ? (
                <div className="flex justify-center py-md">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !deliveries?.length ? (
                <p className="text-sm text-muted-foreground">
                  {t('webhooks.noDeliveries')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {deliveries.map((d) => (
                    <div key={d.id} className="flex items-center gap-sm text-sm">
                      {d.status === 'success' ? (
                        <CheckCircle2 className="h-md w-md shrink-0 text-green-500" />
                      ) : d.status === 'failed' ? (
                        <XCircle className="h-md w-md shrink-0 text-destructive" />
                      ) : (
                        <Clock className="h-md w-md shrink-0 text-muted-foreground" />
                      )}
                      <span className="rounded bg-muted px-xs font-mono text-xs">
                        {d.event}
                      </span>
                      {d.response_status_code && (
                        <span className="text-muted-foreground">
                          HTTP {d.response_status_code}
                        </span>
                      )}
                      {d.duration_ms && (
                        <span className="text-muted-foreground">{d.duration_ms}ms</span>
                      )}
                      <span className="ml-auto text-muted-foreground">
                        {new Date(d.created_at).toLocaleString('pt-BR')}
                      </span>
                      {d.error_message && (
                        <span
                          className="max-w-xs truncate text-xs text-destructive"
                          title={d.error_message}
                        >
                          {d.error_message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook
                ? t('webhooks.form.editTitle')
                : t('webhooks.form.newTitle')}
            </DialogTitle>
            <DialogDescription>{t('webhooks.form.dialogDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-md py-sm">
            <div className="space-y-xs">
              <Label>{t('webhooks.form.nameLabel')}</Label>
              <Input
                placeholder={t('webhooks.form.namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-xs">
              <Label>{t('webhooks.form.urlLabel')}</Label>
              <Input
                placeholder="https://hooks.zapier.com/..."
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              />
            </div>
            <div className="space-y-xs">
              <Label>
                {editingWebhook
                  ? t('webhooks.form.secretEditLabel')
                  : t('webhooks.form.secretLabel')}
              </Label>
              <Input
                type="password"
                placeholder={t('webhooks.form.secretPlaceholder')}
                value={form.secret}
                onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div className="space-y-xs">
                <Label>{t('webhooks.form.timeoutLabel')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={form.timeout_seconds}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, timeout_seconds: +e.target.value }))
                  }
                />
              </div>
              <div className="space-y-xs">
                <Label>{t('webhooks.form.maxRetriesLabel')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={form.max_retries}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, max_retries: +e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-sm">
              <Checkbox
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: !!v }))}
              />
              <Label htmlFor="is_active">{t('webhooks.form.isActiveLabel')}</Label>
            </div>

            <div className="space-y-sm">
              <Label>{t('webhooks.form.eventsLabel')}</Label>
              <div className="grid max-h-48 grid-cols-1 gap-xs overflow-y-auto rounded-md border p-sm">
                {(events ?? []).map((ev) => (
                  <div key={ev.value} className="flex items-center gap-sm">
                    <Checkbox
                      id={`ev-${ev.value}`}
                      checked={form.events.includes(ev.value)}
                      onCheckedChange={() => toggleEvent(ev.value)}
                    />
                    <Label
                      htmlFor={`ev-${ev.value}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {ev.value}
                      </span>
                      {' — '}
                      {ev.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-sm h-md w-md animate-spin" />}
              {editingWebhook
                ? t('webhooks.form.saveBtn')
                : t('webhooks.form.createBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
