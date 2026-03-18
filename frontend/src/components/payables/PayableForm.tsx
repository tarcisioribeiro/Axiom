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
import { translate } from '@/config/constants';
import { formatLocalDate } from '@/lib/utils';
import type { Payable, PayableFormData } from '@/types';

const EXPENSE_CATEGORIES = [
  'food and drink', 'bills and services', 'electronics', 'family and friends', 'pets',
  'digital signs', 'house', 'purchases', 'donate', 'education', 'loans', 'entertainment',
  'taxes', 'investments', 'others', 'vestuary', 'health and care', 'professional services',
  'supermarket', 'rates', 'transport', 'travels',
];

const PAYABLE_STATUSES = ['active', 'paid', 'overdue', 'cancelled'];

interface PayableFormProps {
  payable: Payable | undefined;
  onSubmit: (data: PayableFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function PayableForm({ payable, onSubmit, onCancel, isLoading }: PayableFormProps) {
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

  const set = (patch: Partial<PayableFormData>) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="description">Descrição *</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => set({ description: e.target.value })}
            required
            placeholder="Ex: Tratamento dentário, Conserto do carro"
          />
        </div>

        <div>
          <Label htmlFor="value">Valor Total *</Label>
          <Input id="value" type="number" step="0.01" value={formData.value} onChange={(e) => set({ value: parseFloat(e.target.value) })} required />
        </div>

        <div>
          <Label htmlFor="paid_value">Valor Já Pago</Label>
          <Input id="paid_value" type="number" step="0.01" value={formData.paid_value ?? 0} onChange={(e) => set({ paid_value: parseFloat(e.target.value) })} />
        </div>

        <div>
          <Label htmlFor="date">Data de Registro *</Label>
          <DatePicker value={formData.date ?? undefined} onChange={(date) => set({ date: date ? formatLocalDate(date) : '' })} placeholder="Selecione a data" />
        </div>

        <div>
          <Label htmlFor="due_date">Data de Vencimento</Label>
          <DatePicker value={formData.due_date ?? undefined} onChange={(date) => set({ due_date: date ? formatLocalDate(date) : undefined })} placeholder="Selecione a data de vencimento" />
        </div>

        <div>
          <Label htmlFor="category">Categoria *</Label>
          <Select value={formData.category} onValueChange={(value) => set({ category: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{translate('expenseCategories', cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value: 'active' | 'paid' | 'overdue' | 'cancelled') => set({ status: value })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYABLE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{translate('payableStatus', status)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={formData.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            placeholder="Informações adicionais sobre este valor a pagar"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>{t('common.actions.cancel')}</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.actions.saving')}</> : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
