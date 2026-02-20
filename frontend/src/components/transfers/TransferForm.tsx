import { useEffect } from 'react';
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
import type { Transfer, TransferFormData, Account } from '@/types';


interface TransferFormProps {
  transfer?: Transfer;
  accounts: Account[];
  onSubmit: (data: TransferFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TransferForm: React.FC<TransferFormProps> = ({
  transfer,
  accounts,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { register, handleSubmit, setValue, watch } = useForm<TransferFormData>({
    defaultValues: transfer
      ? {
          description: transfer.description,
          value: parseFloat(transfer.value),
          date: transfer.date,
          horary: transfer.horary,
          category: transfer.category,
          transfered: transfer.transfered,
          origin_account: transfer.origin_account,
          destiny_account: transfer.destiny_account,
        }
      : {
          date: formatLocalDate(new Date()),
          horary: new Date().toTimeString().split(' ')[0].substring(0, 5),
          category: 'pix',
          transfered: false,
          origin_account: undefined,
          destiny_account: undefined,
        },
  });

  const watchedOriginAccount = watch('origin_account');

  // Auto-selecionar contas ao abrir o formulário (modo criação)
  useEffect(() => {
    if (!transfer && accounts.length > 0) {
      const currentOrigin = watch('origin_account');
      const currentDestiny = watch('destiny_account');

      // Auto-selecionar conta de origem (primeira conta)
      if (!currentOrigin && accounts.length > 0) {
        setValue('origin_account', accounts[0].id);
      }

      // Auto-selecionar conta de destino (segunda conta diferente da origem)
      if (!currentDestiny && accounts.length > 1) {
        const originId = currentOrigin || accounts[0].id;
        const destinyAccount = accounts.find((a) => a.id !== originId);
        if (destinyAccount) {
          setValue('destiny_account', destinyAccount.id);
        }
      }
    }
  }, [transfer, accounts.length]);

  // Atualizar conta de destino quando conta de origem muda
  useEffect(() => {
    if (!transfer && watchedOriginAccount && accounts.length > 1) {
      const currentDestiny = watch('destiny_account');

      // Se a conta de destino atual é igual à nova origem, trocar
      if (currentDestiny === watchedOriginAccount) {
        const newDestiny = accounts.find((a) => a.id !== watchedOriginAccount);
        if (newDestiny) {
          setValue('destiny_account', newDestiny.id);
        }
      }
    }
  }, [watchedOriginAccount]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Descrição *</Label>
          <Input
            {...register('description', { required: true })}
            placeholder="Ex: Transferência para poupança"
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
          <Label>Tipo *</Label>
          <Select
            value={watch('category')}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRANSLATIONS.transferTypes).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label>Conta de Origem *</Label>
          <Select
            value={watch('origin_account')?.toString() || ''}
            onValueChange={(v) => setValue('origin_account', parseInt(v))}
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
          <Label>Conta de Destino *</Label>
          <Select
            value={watch('destiny_account')?.toString() || ''}
            onValueChange={(v) => setValue('destiny_account', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((a) => a.id !== watch('origin_account'))
                .map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.account_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 space-y-2">
          <input
            type="checkbox"
            {...register('transfered')}
            id="transfered"
            disabled={isLoading}
            className="h-4 w-4"
          />
          <Label htmlFor="transfered" className="cursor-pointer">
            Transferência realizada?
          </Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : transfer ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
