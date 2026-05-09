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
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { formatLocalDate } from '@/lib/utils';
import type { Payable, PayableFormData } from '@/types';

const PAYABLE_STATUSES = ['active', 'paid', 'overdue', 'cancelled'];

interface PayableFormProps {
  payable: Payable | undefined;
  onSubmit: (data: PayableFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-md">
      <div className="grid grid-cols-2 gap-md">
        <div className="col-span-2">
          <Label htmlFor="description">
            {t('pages.payables.form.descriptionLabel')}
          </Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => set({ description: e.target.value })}
            required
            placeholder={t('pages.payables.form.descriptionPlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="value">{t('pages.payables.form.valueTotalLabel')}</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            value={formData.value}
            onChange={(e) => set({ value: parseFloat(e.target.value) })}
            required
          />
        </div>

        <div>
          <Label htmlFor="paid_value">{t('pages.payables.form.paidValueLabel')}</Label>
          <Input
            id="paid_value"
            type="number"
            step="0.01"
            value={formData.paid_value ?? 0}
            onChange={(e) => set({ paid_value: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="date">{t('pages.payables.form.dateLabel')}</Label>
          <DatePicker
            value={formData.date ?? undefined}
            onChange={(date) => set({ date: date ? formatLocalDate(date) : '' })}
            placeholder={t('common.actions.select')}
          />
        </div>

        <div>
          <Label htmlFor="due_date">{t('pages.payables.form.dueDateLabel')}</Label>
          <DatePicker
            value={formData.due_date ?? undefined}
            onChange={(date) =>
              set({ due_date: date ? formatLocalDate(date) : undefined })
            }
            placeholder={t('pages.payables.form.dueDatePlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="category">{t('pages.payables.form.categoryLabel')}</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => set({ category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key }) => (
                <SelectItem key={key} value={key}>
                  {translate('expenseCategories', key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status">{t('pages.payables.form.statusLabel')}</Label>
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

        <div className="col-span-2">
          <Label htmlFor="notes">{t('pages.payables.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            value={formData.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            placeholder={t('pages.payables.form.notesPlaceholder')}
          />
        </div>
      </div>

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
