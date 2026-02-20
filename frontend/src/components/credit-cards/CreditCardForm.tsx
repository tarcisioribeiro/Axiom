import { useForm } from 'react-hook-form';
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
import { TRANSLATIONS } from '@/config/constants';
import type { CreditCard, CreditCardFormData, Account } from '@/types';

import { formatLocalDate } from '@/lib/utils';
interface CreditCardFormProps {
  creditCard?: CreditCard;
  accounts: Account[];
  onSubmit: (data: CreditCardFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  creditCard,
  accounts,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { register, handleSubmit, setValue, watch } = useForm<CreditCardFormData>({
    defaultValues: creditCard
      ? {
          name: creditCard.name,
          on_card_name: creditCard.on_card_name,
          card_number: '',
          flag: creditCard.flag,
          security_code: '',
          validation_date: creditCard.validation_date,
          credit_limit: parseFloat(creditCard.credit_limit),
          max_limit: parseFloat(creditCard.max_limit),
          due_day: creditCard.due_day,
          closing_day: creditCard.closing_day,
          associated_account: creditCard.associated_account,
          is_active: creditCard.is_active,
          interest_rate: creditCard.interest_rate
            ? parseFloat(creditCard.interest_rate)
            : undefined,
          annual_fee: creditCard.annual_fee
            ? parseFloat(creditCard.annual_fee)
            : undefined,
          owner: creditCard.owner,
          notes: creditCard.notes,
        }
      : {
          credit_limit: 0,
          max_limit: 0,
          due_day: 10,
          closing_day: 5,
          is_active: true,
        },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome do Cartão *</Label>
          <Input
            {...register('name', { required: true })}
            placeholder="Ex: Nubank Gold"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Nome no Cartão *</Label>
          <Input
            {...register('on_card_name', { required: true })}
            placeholder="Ex: FULANO DE TAL"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Bandeira *</Label>
          <Select value={watch('flag')} onValueChange={(v) => setValue('flag', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.cardBrands).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Número do Cartão *</Label>
          <Input
            {...register('card_number', { required: true })}
            placeholder="1234567890123456"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>CVV *</Label>
          <Input
            {...register('security_code', { required: true })}
            placeholder="123"
            maxLength={4}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Data de Validade *</Label>
          <DatePicker
            value={watch('validation_date')}
            onChange={(date) =>
              setValue('validation_date', date ? formatLocalDate(date) : '')
            }
            placeholder="Selecione a data de validade"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Limite Atual *</Label>
          <Input
            type="number"
            step="0.01"
            {...register('credit_limit', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Limite Máximo *</Label>
          <Input
            type="number"
            step="0.01"
            {...register('max_limit', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Conta Associada *</Label>
          <Select
            value={watch('associated_account')?.toString()}
            onValueChange={(v) => setValue('associated_account', parseInt(v))}
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
          <Label>Dia de Vencimento *</Label>
          <Input
            type="number"
            min="1"
            max="31"
            {...register('due_day', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Dia de Fechamento *</Label>
          <Input
            type="number"
            min="1"
            max="31"
            {...register('closing_day', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Taxa de Juros (%) Anual</Label>
          <Input
            type="number"
            step="0.01"
            {...register('interest_rate', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Anuidade</Label>
          <Input
            type="number"
            step="0.01"
            {...register('annual_fee', { valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Observações</Label>
          <Input
            {...register('notes')}
            placeholder="Observações adicionais"
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : creditCard ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
