import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TRANSLATIONS, translate } from '@/config/constants';
import { formatLocalDate } from '@/lib/utils';
import type { Receivable, ReceivableFormData } from '@/types';

const RECEIVABLE_STATUSES = ['active', 'received', 'overdue', 'cancelled'];

interface ReceivableFormProps {
  receivable: Receivable | undefined;
  onSubmit: (data: ReceivableFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <div className="space-y-xs md:col-span-2">
          <Label>{t('pages.receivables.form.description')}</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t('pages.receivables.form.descriptionPlaceholder')}
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-xs">
          <Label>{t('pages.receivables.form.value')}</Label>
          <Input
            type="number"
            step="0.01"
            value={form.value}
            onChange={(e) =>
              setForm((f) => ({ ...f, value: parseFloat(e.target.value) || 0 }))
            }
            placeholder="0,00"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-xs">
          <Label>{t('pages.receivables.form.category')}</Label>
          <Select
            value={form.category}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TRANSLATIONS.revenueCategories).map((key) => (
                <SelectItem key={key} value={key}>
                  {translate('revenueCategories', key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-xs">
          <Label>{t('pages.receivables.form.date')}</Label>
          <DatePicker
            value={form.date}
            onChange={(date) =>
              setForm((f) => ({ ...f, date: date ? formatLocalDate(date) : '' }))
            }
            placeholder={t('common.fields.selectDate')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-xs">
          <Label>{t('pages.receivables.form.dueDate')}</Label>
          <DatePicker
            value={form.due_date ?? ''}
            onChange={(date) =>
              setForm((f) => ({ ...f, due_date: date ? formatLocalDate(date) : '' }))
            }
            placeholder={t('common.fields.selectDate')}
            clearable
            disabled={isLoading}
          />
        </div>
        {receivable && (
          <div className="space-y-xs">
            <Label>{t('pages.receivables.form.status')}</Label>
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
        <div className="space-y-xs md:col-span-2">
          <Label>{t('pages.receivables.form.notes')}</Label>
          <Textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t('common.fields.notes')}
            rows={3}
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="flex justify-end gap-sm pt-md">
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
