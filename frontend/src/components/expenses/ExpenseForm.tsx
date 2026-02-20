import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/constants';
import { membersService } from '@/services/members-service';
import type { Expense, ExpenseFormData, Account, Member, Loan, Payable } from '@/types';

import { formatLocalDate } from '@/lib/utils';
interface ExpenseFormProps {
  expense?: Expense;
  accounts: Account[];
  loans?: Loan[];
  payables?: Payable[];
  onSubmit: (data: ExpenseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  expense,
  accounts,
  loans,
  payables,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [eligibleLoans, setEligibleLoans] = useState<Loan[]>([]);
  const [eligiblePayables, setEligiblePayables] = useState<Payable[]>([]);
  const { showAlert } = useAlertDialog();

  const { register, handleSubmit, setValue, watch } = useForm<ExpenseFormData>({
    defaultValues: {
      description: '',
      value: 0,
      date: formatLocalDate(new Date()),
      horary: new Date().toTimeString().split(' ')[0].substring(0, 5),
      payed: false,
      category: '',
      account: 0,
      member: null,
      related_loan: null,
      related_payable: null,
    },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        setCurrentUserMember(member);
        // Se não estamos editando, define o membro automaticamente
        if (!expense) {
          setValue('member', member.id);
        }
      } catch (error) {
        console.error('Erro ao carregar membro do usuário:', error);
      }
    };

    void loadCurrentUserMember();
  }, [expense, setValue]);

  useEffect(() => {
    if (loans && currentUserMember) {
      // Filtrar empréstimos onde o usuário atual é o benefited (pegou emprestado, está pagando)
      const filtered = loans.filter(
        (loan) =>
          loan.benefited === currentUserMember.id &&
          loan.status !== 'paid' &&
          loan.status !== 'cancelled'
      );
      setEligibleLoans(filtered);
    }
  }, [loans, currentUserMember]);

  useEffect(() => {
    if (payables) {
      // Filtrar payables ativos ou em atraso (que ainda podem receber pagamentos)
      const filtered = payables.filter(
        (payable) => payable.status === 'active' || payable.status === 'overdue'
      );
      setEligiblePayables(filtered);
    }
  }, [payables]);

  useEffect(() => {
    if (expense) {
      setValue('description', expense.description);
      setValue('value', parseFloat(expense.value));
      setValue('date', expense.date);
      setValue('horary', expense.horary);
      setValue('category', expense.category);
      setValue('payed', expense.payed);
      setValue('account', expense.account);
      setValue('member', expense.member);
      setValue('related_loan', expense.related_loan || null);
      setValue('related_payable', expense.related_payable || null);
    } else if (accounts.length > 0) {
      setValue('account', accounts[0].id);
    }
  }, [expense, accounts, setValue]);

  const handleFormSubmit = async (data: ExpenseFormData) => {
    console.log('Form data before submit:', data);

    // Validação adicional
    if (!data.account || data.account === 0) {
      await showAlert({
        title: 'Campo obrigatório',
        description: 'Por favor, selecione uma conta',
        confirmText: 'Ok',
      });
      return;
    }

    if (!data.category) {
      await showAlert({
        title: 'Campo obrigatório',
        description: 'Por favor, selecione uma categoria',
        confirmText: 'Ok',
      });
      return;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descrição *</Label>
          <Input
            id="description"
            {...register('description', { required: true })}
            placeholder="Ex: Compra no supermercado"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="value">Valor *</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            {...register('value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Data *</Label>
          <DatePicker
            value={watch('date')}
            onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
            placeholder="Selecione a data"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="horary">Horário *</Label>
          <Input
            id="horary"
            type="time"
            {...register('horary', { required: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select
            value={watch('category') || ''}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
        <div className="space-y-2">
          <Label>Status de Pagamento *</Label>
          <Select
            value={watch('payed') ? 'true' : 'false'}
            onValueChange={(v) => setValue('payed', v === 'true')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Pendente</SelectItem>
              <SelectItem value="true">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Conta *</Label>
          <Select
            value={watch('account')?.toString() || ''}
            onValueChange={(v) => setValue('account', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id.toString()}>
                  {a.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Empréstimo Relacionado (Opcional)</Label>
          <Select
            value={watch('related_loan')?.toString() || 'none'}
            onValueChange={(v) =>
              setValue('related_loan', v === 'none' ? null : parseInt(v))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {eligibleLoans.map((loan) => (
                <SelectItem key={loan.id} value={loan.id.toString()}>
                  {loan.description} - Saldo: R$ {loan.remaining_balance || '0.00'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs">
            Vincule esta despesa a um empréstimo que você está pagando
          </p>
        </div>
        <div className="space-y-2">
          <Label>Valor a Pagar Relacionado (Opcional)</Label>
          <Select
            value={watch('related_payable')?.toString() || 'none'}
            onValueChange={(v) =>
              setValue('related_payable', v === 'none' ? null : parseInt(v))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {eligiblePayables.map((payable) => (
                <SelectItem key={payable.id} value={payable.id.toString()}>
                  {payable.description} - Saldo: R$ {payable.remaining_value || '0.00'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs">
            Vincule esta despesa a um valor a pagar (ex: dentista, conserto)
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : expense ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
