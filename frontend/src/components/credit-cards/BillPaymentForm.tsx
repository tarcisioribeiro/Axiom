import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, Calendar, Wallet, Building2, AlertCircle } from 'lucide-react';
import { translate } from '@/config/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import type { CreditCardBill, BillPaymentFormData } from '@/types';

interface BillPaymentFormProps {
  bill: CreditCardBill;
  onSubmit: (data: BillPaymentFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const BillPaymentForm: React.FC<BillPaymentFormProps> = ({
  bill,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const remaining = parseFloat(bill.total_amount) - parseFloat(bill.paid_amount);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BillPaymentFormData>({
    defaultValues: {
      amount: remaining > 0 ? remaining : 0,
      payment_date: formatLocalDate(new Date()),
      notes: '',
    },
  });

  useEffect(() => {
    // Definir valor inicial como o saldo restante
    if (remaining > 0) {
      setValue('amount', remaining);
    }
  }, [remaining, setValue]);

  const watchedAmount = watch('amount');
  const isAmountValid = watchedAmount > 0 && watchedAmount <= remaining;

  const handleFormSubmit = (data: BillPaymentFormData) => {
    if (data.amount <= 0) {
      return;
    }
    if (data.amount > remaining) {
      return;
    }
    onSubmit(data);
  };

  // Helpers for card display
  const cardholderName = bill.credit_card_on_card_name || 'N/A';
  const last4 = bill.credit_card_number_masked || '****';
  const isValidNumber = last4 !== '****' && /^\d{4}$/.test(last4);
  const cardNumber = isValidNumber ? `**** ${last4}` : '';
  const flag = bill.credit_card_flag
    ? translate('cardBrands', bill.credit_card_flag)
    : '';
  const accountName = bill.credit_card_associated_account_name || 'N/A';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Bill Summary */}
      <div className="space-y-3 rounded-lg bg-muted/50 p-4">
        <h4 className="text-sm font-semibold text-muted-foreground">
          Resumo da Fatura
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cartão</p>
              <p className="text-sm font-medium">
                {cardholderName} {cardNumber}
              </p>
              <p className="text-xs text-muted-foreground">{flag}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Conta de Débito</p>
              <p className="text-sm font-medium">{accountName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Período</p>
              <p className="text-sm font-medium">
                {translate('months', bill.month)}/{bill.year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="text-sm font-medium">
                {bill.due_date ? formatDate(bill.due_date) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t pt-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold">{formatCurrency(bill.total_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Já Pago</p>
              <p className="text-lg font-bold text-success">
                {formatCurrency(bill.paid_amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Restante</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(remaining.toString())}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning if bill is already paid */}
      {remaining <= 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-amber-700">Esta fatura já foi totalmente paga.</p>
        </div>
      )}

      {/* Payment Form */}
      {remaining > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Valor do Pagamento *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                className="pl-10"
                {...register('amount', {
                  valueAsNumber: true,
                  required: 'Valor é obrigatório',
                  min: { value: 0.01, message: 'Valor deve ser maior que zero' },
                  max: {
                    value: remaining,
                    message: `Valor não pode exceder ${formatCurrency(remaining.toString())}`,
                  },
                })}
                disabled={isLoading}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Máximo: {formatCurrency(remaining.toString())}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_date">Data do Pagamento *</Label>
            <DatePicker
              value={watch('payment_date')}
              onChange={(date) =>
                setValue('payment_date', date ? formatLocalDate(date) : '')
              }
              placeholder="Selecione a data do pagamento"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações opcionais sobre o pagamento..."
              {...register('notes')}
              disabled={isLoading}
              rows={3}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        {remaining > 0 && (
          <Button
            type="submit"
            disabled={isLoading || !isAmountValid}
            className="gap-2"
          >
            <Wallet className="h-4 w-4" />
            {isLoading ? 'Processando...' : 'Pagar Fatura'}
          </Button>
        )}
      </div>
    </form>
  );
};
