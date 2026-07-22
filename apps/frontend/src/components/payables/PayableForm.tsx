/* eslint-disable max-lines */
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
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
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { formatLocalDate } from '@/lib/utils';
import type { Payable, PayableFormData } from '@/types';

const PAYABLE_STATUSES = ['active', 'paid', 'overdue', 'cancelled'];

interface PayableFormProps {
  payable: Payable | undefined;
  onSubmit: (data: PayableFormData) => Promise<void>;
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

export function PayableForm({
  payable,
  onSubmit,
  onCancel,
  isLoading,
}: PayableFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PayableFormData>(() =>
    payable
      ? {
          description: payable.description,
          value: parseFloat(payable.value),
          paid_value: parseFloat(payable.paid_value),
          date: payable.date,
          due_date: payable.due_date,
          category: payable.category,
          notes: payable.notes,
          status: payable.status,
        }
      : {
          description: '',
          value: 0,
          paid_value: 0,
          date: formatLocalDate(new Date()),
          category: 'others',
          status: 'active',
        }
  );

  const set = (patch: Partial<PayableFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const dueDateInfo = useMemo(
    () => getDueDateInfo(formData.due_date, t),
    [formData.due_date, t]
  );

  const paymentPercent =
    formData.value > 0
      ? Math.min(100, ((formData.paid_value ?? 0) / formData.value) * 100)
      : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-lg">
      {/* Seção: Informações Básicas */}
      <FormSection title={t('common.form.sections.basicInfo')} icon={Wallet}>
        <div className="space-y-sm">
          <Label htmlFor="description" className="flex items-center gap-xs">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.payables.form.descriptionLabel')}
          </Label>
          <input
            id="description"
            value={formData.description}
            onChange={(e) => set({ description: e.target.value })}
            required
            placeholder={t('pages.payables.form.descriptionPlaceholder')}
            className="flex h-9 w-full rounded-md border border-border/70 bg-background px-3 py-xs text-sm shadow-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </FormSection>

      {/* Seção: Valores */}
      <FormSection title={t('common.form.sections.values')} icon={Wallet}>
        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label htmlFor="value" className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.valueTotalLabel')}
            </Label>
            <CurrencyInput
              id="value"
              accentColor="destructive"
              value={formData.value}
              onChange={(e) => set({ value: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="paid_value" className="flex items-center gap-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.paidValueLabel')}
            </Label>
            <CurrencyInput
              id="paid_value"
              accentColor="success"
              value={formData.paid_value ?? 0}
              onChange={(e) => set({ paid_value: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Barra de progresso do pagamento */}
          {formData.value > 0 && (
            <div className="col-span-2 space-y-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('pages.payables.form.paymentProgress')}</span>
                <span
                  className={paymentPercent >= 100 ? 'font-semibold text-success' : ''}
                >
                  {paymentPercent.toFixed(0)}%
                </span>
              </div>
              <Progress value={paymentPercent} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {t('pages.payables.form.progressLabel', {
                  paid: (formData.paid_value ?? 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }),
                  total: formData.value.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }),
                })}
              </p>
            </div>
          )}
        </div>
      </FormSection>

      {/* Seção: Datas */}
      <FormSection title={t('common.form.sections.schedule')} icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label htmlFor="date" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.dateLabel')}
            </Label>
            <DatePicker
              value={formData.date ?? undefined}
              onChange={(date) => set({ date: date ? formatLocalDate(date) : '' })}
              placeholder={t('common.actions.select')}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="due_date" className="flex items-center gap-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.dueDateLabel')}
            </Label>
            <DatePicker
              value={formData.due_date ?? undefined}
              onChange={(date) =>
                set({ due_date: date ? formatLocalDate(date) : undefined })
              }
              placeholder={t('pages.payables.form.dueDatePlaceholder')}
            />
            {/* Badge de urgência */}
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
        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label htmlFor="category" className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.categoryLabel')}
            </Label>
            <Select
              value={formData.category}
              onValueChange={(value) => set({ category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES_CANONICAL.map(({ key }) => {
                  const Icon = EXPENSE_CATEGORY_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {Icon && (
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {translate('expenseCategories', key)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-sm">
            <Label htmlFor="status" className="flex items-center gap-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.statusLabel')}
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'active' | 'paid' | 'overdue' | 'cancelled') =>
                set({ status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {translate('payableStatus', status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-sm">
            <Label htmlFor="notes" className="flex items-center gap-xs">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.payables.form.notesLabel')}
            </Label>
            <Textarea
              id="notes"
              value={formData.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              rows={3}
              placeholder={t('pages.payables.form.notesPlaceholder')}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : (
            t('common.actions.save')
          )}
        </Button>
      </div>
    </form>
  );
}
