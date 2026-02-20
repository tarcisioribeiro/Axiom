import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { translate, TRANSLATIONS } from '@/config/constants';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type {
  CreditCardInstallment,
  CreditCardInstallmentUpdateData,
  CreditCardBill,
} from '@/types';

interface CreditCardInstallmentFormProps {
  installment: CreditCardInstallment;
  bills: CreditCardBill[];
  onSubmit: (data: CreditCardInstallmentUpdateData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardInstallmentForm: React.FC<CreditCardInstallmentFormProps> = ({
  installment,
  bills,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { register, handleSubmit, setValue, watch } =
    useForm<CreditCardInstallmentUpdateData>({
      defaultValues: {
        value: installment.value,
        payed: installment.payed,
        bill: installment.bill,
      },
    });

  useEffect(() => {
    setValue('value', installment.value);
    setValue('payed', installment.payed);
    setValue('bill', installment.bill);
  }, [installment, setValue]);

  // Filtrar faturas do mesmo cartão
  const availableBills = bills.filter((b) => b.credit_card === installment.card_id);

  const handleFormSubmit = (data: CreditCardInstallmentUpdateData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Informações da parcela (somente leitura) */}
      <div className="space-y-2 rounded-lg bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Compra</span>
          <span className="font-semibold">{installment.description}</span>
        </div>
        {installment.merchant && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Estabelecimento</span>
            <span className="text-sm">{installment.merchant}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Categoria</span>
          <Badge variant="secondary">
            {translate('expenseCategories', installment.category || '')}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Parcela</span>
          <span className="font-semibold">
            {installment.installment_number}/{installment.total_installments}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Vencimento</span>
          <span className="text-sm">
            {formatDate(installment.due_date, 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Data da Compra</span>
          <span className="text-sm">
            {formatDate(installment.purchase_date || '', 'dd/MM/yyyy')}
          </span>
        </div>
      </div>

      {/* Campos editáveis */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="value">Valor da Parcela *</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            {...register('value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Valor original: {formatCurrency(installment.value)}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Status de Pagamento</Label>
          <Select
            value={watch('payed') ? 'true' : 'false'}
            onValueChange={(v) => setValue('payed', v === 'true')}
            disabled={isLoading}
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
          <Label>Fatura</Label>
          <Select
            value={watch('bill')?.toString() || 'none'}
            onValueChange={(v) => setValue('bill', v === 'none' ? null : parseInt(v))}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {availableBills.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {TRANSLATIONS.months[b.month as keyof typeof TRANSLATIONS.months]}/
                  {b.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};
