import { AlertCircle, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translate } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import type { CreditCardBill, RenegotiateBillFormData } from '@/types';

interface RenegotiateBillDialogProps {
  bill: CreditCardBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RenegotiateBillFormData) => void;
  isLoading?: boolean;
}

export const RenegotiateBillDialog: React.FC<RenegotiateBillDialogProps> = ({
  bill,
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const remaining = parseFloat(bill.total_amount) - parseFloat(bill.paid_amount);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RenegotiateBillFormData>({
    defaultValues: {
      total_with_interest: undefined,
      installments: undefined,
    },
  });

  const watchedTotal = watch('total_with_interest');
  const watchedInstallments = watch('installments');

  const installmentValue = useMemo(() => {
    const total = parseFloat(String(watchedTotal));
    const n = parseInt(String(watchedInstallments));
    if (!total || !n || n <= 0 || total <= 0) return null;
    return total / n;
  }, [watchedTotal, watchedInstallments]);

  const handleFormSubmit = (data: RenegotiateBillFormData) => {
    onSubmit(data);
  };

  const period = `${translate('months', bill.month)}/${bill.year}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.creditCardBills.renegotiateTitle')}</DialogTitle>
          <DialogDescription>
            {t('pages.creditCardBills.renegotiateDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
          {/* Resumo */}
          <div className="space-y-3 rounded-lg bg-muted/50 p-md">
            <h4 className="text-sm font-semibold text-muted-foreground">
              {t('pages.creditCardBills.payForm.billSummary')}
            </h4>
            <div className="grid grid-cols-2 gap-md text-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('pages.creditCardBills.payForm.periodLabel')}
                </p>
                <p className="font-medium">{period}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('pages.creditCardBills.payForm.totalAmountLabel')}
                </p>
                <p className="font-medium">{formatCurrency(bill.total_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('pages.creditCardBills.payForm.alreadyPaidLabel')}
                </p>
                <p className="font-medium text-success">
                  {formatCurrency(bill.paid_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('pages.creditCardBills.renegotiateForm.remainingLabel')}
                </p>
                <p className="font-bold text-primary">
                  {formatCurrency(remaining.toFixed(2))}
                </p>
              </div>
            </div>
          </div>

          {/* Aviso informativo */}
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-sm text-sm text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('pages.creditCardBills.renegotiateForm.interestWarning')}</p>
          </div>

          {/* Campos */}
          <div className="space-y-md">
            <div className="space-y-sm">
              <Label htmlFor="total_with_interest">
                {t('pages.creditCardBills.renegotiateForm.totalWithInterestLabel')}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="total_with_interest"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="pl-10"
                  {...register('total_with_interest', {
                    valueAsNumber: true,
                    required: t('pages.creditCardBills.renegotiateForm.totalRequired'),
                    min: {
                      value: 0.01,
                      message: t('pages.creditCardBills.renegotiateForm.totalRequired'),
                    },
                  })}
                  disabled={isLoading}
                />
              </div>
              {errors.total_with_interest && (
                <p className="text-xs text-destructive">
                  {errors.total_with_interest.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('pages.creditCardBills.renegotiateForm.totalWithInterestHint')}
              </p>
            </div>

            <div className="space-y-sm">
              <Label htmlFor="installments">
                {t('pages.creditCardBills.renegotiateForm.installmentsLabel')}
              </Label>
              <Input
                id="installments"
                type="number"
                min="1"
                max="48"
                placeholder={t(
                  'pages.creditCardBills.renegotiateForm.installmentsPlaceholder'
                )}
                {...register('installments', {
                  valueAsNumber: true,
                  required: t(
                    'pages.creditCardBills.renegotiateForm.installmentsRequired'
                  ),
                  min: { value: 1, message: '' },
                  max: { value: 48, message: '' },
                })}
                disabled={isLoading}
              />
              {errors.installments && (
                <p className="text-xs text-destructive">
                  {errors.installments.message}
                </p>
              )}
            </div>
          </div>

          {/* Preview do valor de cada parcela */}
          {installmentValue !== null && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('pages.creditCardBills.renegotiateForm.installmentValuePreview')}
                </p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(installmentValue.toFixed(2))}
                </p>
              </div>
              <p className="mt-xs text-xs text-muted-foreground">
                {watchedInstallments}x {t('pages.creditCardBills.renegotiateForm.of')}{' '}
                {formatCurrency(installmentValue.toFixed(2))}
              </p>
            </div>
          )}

          {/* Aviso de que a fatura será marcada como paga */}
          <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 p-sm text-sm text-info">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('pages.creditCardBills.renegotiateForm.billWillBePaid')}</p>
          </div>

          <div className="flex justify-end gap-sm border-t pt-md">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-sm">
              <RefreshCw className="h-4 w-4" />
              {isLoading
                ? t('pages.creditCardBills.renegotiateForm.processing')
                : t('pages.creditCardBills.renegotiateBtn')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
