/* eslint-disable max-lines */
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Tag,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { REVENUE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { REVENUE_CATEGORY_ICONS } from '@/config/icons';
import { formatLocalDate } from '@/lib/utils';
import type { Receivable, ReceivableFormData } from '@/types';

const RECEIVABLE_STATUSES = ['active', 'received', 'overdue', 'cancelled'];

interface ReceivableFormProps {
  receivable: Receivable | undefined;
  onSubmit: (data: ReceivableFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function getDueDateInfo(
  dueDate: string | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: t('pages.payables.form.overdueLabel', { days: Math.abs(diffDays) }),
      color: 'text-destructive',
      bg: 'bg-destructive/10 border-destructive/30',
      icon: AlertTriangle,
    };
  }
  if (diffDays === 0) {
    return {
      label: t('pages.payables.form.dueTodayLabel'),
      color: 'text-warning',
      bg: 'bg-warning/10 border-warning/30',
      icon: Clock,
    };
  }
  return {
    label: t('pages.payables.form.dueDaysLabel', { days: diffDays }),
    color: diffDays <= 7 ? 'text-warning' : 'text-muted-foreground',
    bg:
      diffDays <= 7
        ? 'bg-warning/10 border-warning/30'
        : 'bg-muted/30 border-border/50',
    icon: CheckCircle2,
  };
}

export function ReceivableForm({
  receivable,
  onSubmit,
  onCancel,
  isLoading,
}: ReceivableFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ReceivableFormData>({
    description: receivable?.description ?? '',
    value: receivable ? parseFloat(receivable.value) : 0,
    received_value: receivable ? parseFloat(receivable.received_value) : 0,
    date: receivable?.date ?? formatLocalDate(new Date()),
    due_date: receivable?.due_date ?? '',
    category: receivable?.category ?? 'deposit',
    notes: receivable?.notes ?? '',
    status: receivable?.status ?? 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const dueDateInfo = useMemo(
    () => getDueDateInfo(form.due_date, t),
    [form.due_date, t]
  );

  const receivedPercent =
    form.value > 0 ? Math.min(100, ((form.received_value ?? 0) / form.value) * 100) : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-lg">
      {/* Seção: Informações Básicas */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={FileText}>
        <div className="space-y-sm">
          <Label className="flex items-center gap-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.receivables.form.description')}
          </Label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            required
            placeholder={t('pages.receivables.form.descriptionPlaceholder')}
            disabled={isLoading}
            className="flex h-9 w-full rounded-md border border-border/70 bg-background px-3 py-xs text-sm shadow-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </FormSection>

      {/* Seção: Valores */}
      <FormSection title={t('common.form.sections.values')} icon={Wallet}>
        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.receivables.form.value')}
            </Label>
            <CurrencyInput
              accentColor="success"
              value={form.value}
              onChange={(e) =>
                setForm((f) => ({ ...f, value: parseFloat(e.target.value) || 0 }))
              }
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.receivables.form.receivedValue')}
            </Label>
            <CurrencyInput
              value={form.received_value ?? 0}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  received_value: parseFloat(e.target.value) || 0,
                }))
              }
              disabled={isLoading}
            />
          </div>

          {form.value > 0 && (
            <div className="col-span-2 space-y-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('pages.payables.form.paymentProgress')}</span>
                <span
                  className={receivedPercent >= 100 ? 'font-semibold text-success' : ''}
                >
                  {receivedPercent.toFixed(0)}%
                </span>
              </div>
              <Progress value={receivedPercent} className="h-1.5 [&>div]:bg-success" />
              <p className="text-xs text-muted-foreground">
                {(form.received_value ?? 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}{' '}
                {t('pages.payables.form.progressLabel', {
                  paid: '',
                  total: form.value.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }),
                }).replace(' de ', ' / ')}
              </p>
            </div>
          )}
        </div>
      </FormSection>

      {/* Seção: Datas */}
      <FormSection title={t('common.form.sections.schedule')} icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.receivables.form.date')}
            </Label>
            <DatePicker
              value={form.date}
              onChange={(date) =>
                setForm((f) => ({ ...f, date: date ? formatLocalDate(date) : '' }))
              }
              placeholder={t('common.fields.selectDate')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.receivables.form.dueDate')}
            </Label>
            <DatePicker
              value={form.due_date ?? ''}
              onChange={(date) =>
                setForm((f) => ({
                  ...f,
                  due_date: date ? formatLocalDate(date) : '',
                }))
              }
              placeholder={t('common.fields.selectDate')}
              clearable
              disabled={isLoading}
            />
            {dueDateInfo && (
              <div
                className={`flex items-center gap-xs rounded-md border px-sm py-xs text-xs ${dueDateInfo.bg}`}
              >
                <dueDateInfo.icon className={`h-3.5 w-3.5 ${dueDateInfo.color}`} />
                <span className={dueDateInfo.color}>{dueDateInfo.label}</span>
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {/* Seção: Classificação */}
      <FormSection title={t('common.form.sections.classification')} icon={Tag}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.receivables.form.category')}
            </Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_CATEGORIES_CANONICAL.map(({ key }) => {
                  const Icon = REVENUE_CATEGORY_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {Icon && (
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {translate('revenueCategories', key)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {receivable && (
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.receivables.form.status')}
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as ReceivableFormData['status'] }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIVABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`pages.receivables.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className={`space-y-sm ${receivable ? '' : 'md:col-span-2'}`}>
            <Label className="flex items-center gap-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.receivables.form.notes')}
            </Label>
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t('common.fields.notes')}
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-xs h-4 w-4 animate-spin" />}
          {receivable ? t('common.actions.update') : t('common.actions.create')}
        </Button>
      </div>
    </form>
  );
}
