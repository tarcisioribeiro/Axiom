import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/constants';
import { membersService } from '@/services/members-service';
import type { FixedExpense, FixedExpenseFormData, Account, CreditCard } from '@/types';

interface Props {
  fixedExpense?: FixedExpense;
  accounts: Account[];
  creditCards: CreditCard[];
  onSubmit: (data: FixedExpenseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const FixedExpenseForm = ({
  fixedExpense,
  accounts,
  creditCards,
  onSubmit,
  onCancel,
  isLoading = false,
}: Props) => {
  const [paymentType, setPaymentType] = useState<'account' | 'credit_card'>('account');

  const { register, handleSubmit, setValue, watch } = useForm<FixedExpenseFormData>({
    defaultValues: {
      description: '',
      default_value: 0,
      due_day: 1,
      category: '',
      account: undefined,
      credit_card: undefined,
      is_active: true,
      allow_value_edit: true,
    },
  });

  useEffect(() => {
    const loadMember = async () => {
      try {
        const member = await membersService.getCurrentUserMember();
        if (!fixedExpense) {
          setValue('member', member.id);
        }
      } catch (error) {
        console.error('Erro ao carregar membro:', error);
      }
    };
    void loadMember();
  }, [fixedExpense, setValue]);

  useEffect(() => {
    if (fixedExpense) {
      setValue('description', fixedExpense.description);
      setValue('default_value', parseFloat(fixedExpense.default_value));
      setValue('due_day', fixedExpense.due_day);
      setValue('category', fixedExpense.category);
      setValue('merchant', fixedExpense.merchant);
      setValue('payment_method', fixedExpense.payment_method);
      setValue('notes', fixedExpense.notes);
      setValue('member', fixedExpense.member);
      setValue('is_active', fixedExpense.is_active);
      setValue('allow_value_edit', fixedExpense.allow_value_edit);

      // Detectar se é conta ou cartão
      if (fixedExpense.credit_card) {
        setPaymentType('credit_card');
        setValue('credit_card', fixedExpense.credit_card);
        setValue('account', undefined);
      } else if (fixedExpense.account) {
        setPaymentType('account');
        setValue('account', fixedExpense.account);
        setValue('credit_card', undefined);
      }
    } else if (accounts.length > 0) {
      setValue('account', accounts[0].id);
      setValue('credit_card', undefined);
    }
  }, [fixedExpense, accounts, setValue]);

  // Atualizar valores ao mudar o tipo de pagamento
  useEffect(() => {
    if (paymentType === 'account') {
      setValue('credit_card', undefined);
      if (accounts.length > 0 && !watch('account')) {
        setValue('account', accounts[0].id);
      }
    } else {
      setValue('account', undefined);
      if (creditCards.length > 0 && !watch('credit_card')) {
        setValue('credit_card', creditCards[0].id);
      }
    }
  }, [paymentType, accounts, creditCards, setValue, watch]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descrição *</Label>
          <Input
            id="description"
            {...register('description', { required: true })}
            placeholder="Ex: Aluguel"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_value">Valor Padrão *</Label>
          <Input
            id="default_value"
            type="number"
            step="0.01"
            {...register('default_value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_day">Dia do Vencimento *</Label>
          <Input
            id="due_day"
            type="number"
            min="1"
            max="31"
            {...register('due_day', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select
            value={watch('category') || ''}
            onValueChange={(v) => setValue('category', v)}
            disabled={isLoading}
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

        <div className="space-y-2 md:col-span-2">
          <Label>Tipo de Pagamento *</Label>
          <Select
            value={paymentType}
            onValueChange={(v: 'account' | 'credit_card') => setPaymentType(v)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="account">Conta Bancária</SelectItem>
              <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs">
            Escolha se a despesa será debitada de uma conta bancária ou lançada em um
            cartão de crédito
          </p>
        </div>

        {paymentType === 'account' ? (
          <div className="space-y-2">
            <Label>Conta Bancária *</Label>
            <Select
              value={watch('account')?.toString() || ''}
              onValueChange={(v) => setValue('account', parseInt(v))}
              disabled={isLoading}
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
        ) : (
          <div className="space-y-2">
            <Label>Cartão de Crédito *</Label>
            <Select
              value={watch('credit_card')?.toString() || ''}
              onValueChange={(v) => setValue('credit_card', parseInt(v))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {creditCards.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name} - {c.on_card_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs">
              A despesa será lançada automaticamente na fatura aberta do mês
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="merchant">Estabelecimento</Label>
          <Input
            id="merchant"
            {...register('merchant')}
            placeholder="Ex: Imobiliária XYZ"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Método de Pagamento</Label>
          <Select
            value={watch('payment_method') || ''}
            onValueChange={(v) => setValue('payment_method', v)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="debit_card">Cartão de Débito</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Informações adicionais"
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('is_active')}
              className="rounded"
              disabled={isLoading}
            />
            Despesa Ativa
          </Label>
          <p className="text-xs">Desative para não incluir nas próximas gerações</p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('allow_value_edit')}
              className="rounded"
              disabled={isLoading}
            />
            Permitir Editar Valor
          </Label>
          <p className="text-xs">
            Permite ajustar o valor ao lançar (ex: conta de luz)
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : fixedExpense ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
