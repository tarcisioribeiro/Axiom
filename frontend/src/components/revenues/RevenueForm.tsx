import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

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
import { TRANSLATIONS } from '@/config/constants';
import { formatLocalDate } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import type { Revenue, RevenueFormData, Account, Member, Loan } from '@/types';

interface RevenueFormProps {
  revenue?: Revenue;
  accounts: Account[];
  loans?: Loan[];
  onSubmit: (data: RevenueFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RevenueForm: React.FC<RevenueFormProps> = ({
  revenue,
  accounts,
  loans,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [eligibleLoans, setEligibleLoans] = useState<Loan[]>([]);

  const { register, handleSubmit, setValue, watch } = useForm<RevenueFormData>({
    defaultValues: revenue
      ? {
          description: revenue.description,
          value: parseFloat(revenue.value),
          date: revenue.date,
          horary: revenue.horary,
          category: revenue.category,
          account: revenue.account,
          received: revenue.received,
          source: revenue.source,
          tax_amount: revenue.tax_amount ? parseFloat(revenue.tax_amount) : 0,
          member: revenue.member,
          recurring: revenue.recurring,
          frequency: revenue.frequency || undefined,
          notes: revenue.notes,
          related_loan: revenue.related_loan || null,
        }
      : {
          date: formatLocalDate(new Date()),
          horary: new Date().toTimeString().slice(0, 5),
          received: false,
          recurring: false,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        setCurrentUserMember(member);
        // Se não estamos editando, define o membro automaticamente
        if (!revenue) {
          setValue('member', member.id);
        }
      } catch (error) {
        console.error('Erro ao carregar membro do usuário:', error);
      }
    };

    void loadCurrentUserMember();
  }, [revenue, setValue]);

  useEffect(() => {
    if (loans && currentUserMember) {
      // Filtrar empréstimos onde o usuário atual é o creditor (emprestou dinheiro, está recebendo de volta)
      const filtered = loans.filter(
        (loan) =>
          loan.creditor === currentUserMember.id &&
          loan.status !== 'paid' &&
          loan.status !== 'cancelled'
      );
      setEligibleLoans(filtered);
    }
  }, [loans, currentUserMember]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Descrição *</Label>
          <Input
            {...register('description', { required: true })}
            placeholder="Ex: Salário mensal"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Valor *</Label>
          <Input
            type="number"
            step="0.01"
            {...register('value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Data *</Label>
          <DatePicker
            value={watch('date')}
            onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
            placeholder="Selecione a data"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Horário *</Label>
          <Input
            type="time"
            {...register('horary', { required: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select
            value={watch('category')}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.revenueCategories).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Conta *</Label>
          <Select
            value={watch('account')?.toString()}
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
          <Label>Fonte</Label>
          <Input
            {...register('source')}
            placeholder="Ex: Empresa XYZ"
            disabled={isLoading}
          />
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
            Vincule esta receita a um empréstimo que você está recebendo
          </p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('received')}
              className="rounded"
              disabled={isLoading}
            />
            Recebido
          </Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : revenue ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
