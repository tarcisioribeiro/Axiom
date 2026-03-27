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
import type { Loan, LoanFormData, Account, Member } from '@/types';

const PAYMENT_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
];

const LOAN_STATUSES = ['active', 'paid', 'defaulted', 'cancelled'];

interface LoanFormProps {
  loan: Loan | undefined;
  accounts: Account[];
  members: Member[];
  onSubmit: (data: LoanFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function LoanForm({
  loan,
  accounts,
  members,
  onSubmit,
  onCancel,
  isLoading,
}: LoanFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LoanFormData>(() =>
    loan
      ? {
          description: loan.description,
          value: parseFloat(loan.value),
          payed_value: parseFloat(loan.payed_value),
          date: loan.date,
          horary: loan.horary,
          category: loan.category,
          account: loan.account,
          benefited: loan.benefited,
          creditor: loan.creditor,
          payed: loan.payed,
          interest_rate: loan.interest_rate
            ? parseFloat(loan.interest_rate)
            : undefined,
          installments: loan.installments,
          due_date: loan.due_date,
          payment_frequency: loan.payment_frequency,
          late_fee: parseFloat(loan.late_fee),
          guarantor: loan.guarantor,
          notes: loan.notes,
          status: loan.status,
        }
      : {
          description: '',
          value: 0,
          payed_value: 0,
          date: formatLocalDate(new Date()),
          horary: new Date().toTimeString().slice(0, 5),
          category: 'loans',
          account: accounts[0]?.id ?? 0,
          benefited: members[0]?.id ?? 0,
          creditor: members[0]?.id ?? 0,
          payed: false,
          installments: 1,
          payment_frequency: 'monthly',
          late_fee: 0,
          status: 'active',
        }
  );

  const set = (patch: Partial<LoanFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
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
          />
        </div>

        <div>
          <Label htmlFor="value">Valor Total *</Label>
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
          <Label htmlFor="payed_value">Valor Pago {loan ? '(Calculado)' : '*'}</Label>
          <Input
            id="payed_value"
            type="number"
            step="0.01"
            value={formData.payed_value}
            onChange={(e) => set({ payed_value: parseFloat(e.target.value) })}
            required={!loan}
            disabled={!!loan}
            className={loan ? 'cursor-not-allowed bg-muted' : ''}
          />
          {loan && (
            <p className="mt-1 text-xs text-muted-foreground">
              Calculado automaticamente a partir das receitas/despesas vinculadas
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="date">Data *</Label>
          <DatePicker
            value={formData.date ?? undefined}
            onChange={(date) => set({ date: date ? formatLocalDate(date) : '' })}
            placeholder="Selecione a data"
          />
        </div>

        <div>
          <Label htmlFor="horary">Horário *</Label>
          <Input
            id="horary"
            type="time"
            value={formData.horary}
            onChange={(e) => set({ horary: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="category">Categoria *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => set({ category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="account">Conta *</Label>
          <Select
            value={formData.account.toString()}
            onValueChange={(value) => set({ account: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="benefited">Beneficiado *</Label>
          <Select
            value={formData.benefited.toString()}
            onValueChange={(value) => set({ benefited: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="creditor">Credor *</Label>
          <Select
            value={formData.creditor.toString()}
            onValueChange={(value) => set({ creditor: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="installments">Parcelas</Label>
          <Input
            id="installments"
            type="number"
            value={formData.installments}
            onChange={(e) => set({ installments: parseInt(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="interest_rate">Taxa de Juros (%)</Label>
          <Input
            id="interest_rate"
            type="number"
            step="0.01"
            value={formData.interest_rate ?? ''}
            onChange={(e) => set({ interest_rate: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="due_date">Data de Vencimento</Label>
          <DatePicker
            value={formData.due_date ?? undefined}
            onChange={(date) => set({ due_date: date ? formatLocalDate(date) : '' })}
            placeholder="Selecione a data de vencimento"
          />
        </div>

        <div>
          <Label htmlFor="payment_frequency">Frequência de Pagamento</Label>
          <Select
            value={formData.payment_frequency}
            onValueChange={(value) => set({ payment_frequency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_FREQUENCIES.map((freq) => (
                <SelectItem key={freq} value={freq}>
                  {translate('paymentFrequency', freq)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="late_fee">Multa por Atraso</Label>
          <Input
            id="late_fee"
            type="number"
            step="0.01"
            value={formData.late_fee}
            onChange={(e) => set({ late_fee: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => set({ status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {translate('loanStatus', status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="guarantor">Avalista</Label>
          <Select
            value={formData.guarantor?.toString() ?? 'none'}
            onValueChange={(value) =>
              set({ guarantor: value === 'none' ? null : parseInt(value) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {m.name}
                </SelectItem>
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
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="contract_document">Documento do Contrato</Label>
          <Input
            id="contract_document"
            type="file"
            onChange={(e) => set({ contract_document: e.target.files?.[0] ?? null })}
          />
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="payed"
            checked={formData.payed}
            onChange={(e) => set({ payed: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="payed" className="cursor-pointer">
            Empréstimo Pago
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
