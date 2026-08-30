import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { nextDueDateOnOrAfterToday } from '@/lib/debt-schedule';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { loanInstallmentsService } from '@/services/loan-installments-service';
import type { Loan } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface LoanPaymentPlanDialogProps {
  loan: Loan | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoanPaymentPlanDialog({
  loan,
  onClose,
  onSuccess,
}: LoanPaymentPlanDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [installments, setInstallments] = useState('2');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [lastLoanId, setLastLoanId] = useState<number | null>(null);
  if (loan && loan.id !== lastLoanId) {
    setLastLoanId(loan.id);
    setFirstDueDate(nextDueDateOnOrAfterToday(loan.due_date ?? loan.date));
  }

  if (!loan) return null;

  const remaining = parseFloat(loan.value) - parseFloat(loan.payed_value);
  const count = parseInt(installments) || 0;
  const perInstallment = count > 0 ? remaining / count : 0;

  const handleSubmit = async () => {
    if (count < 2) return;
    setIsSubmitting(true);
    try {
      await loanInstallmentsService.createPaymentPlan(
        loan.id,
        count,
        firstDueDate || undefined
      );
      toast({
        title: t('pages.loans.paymentPlan.created'),
        description: t('pages.loans.paymentPlan.createdDesc'),
      });
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!loan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.loans.paymentPlan.title')}</DialogTitle>
          <DialogDescription>
            {loan.description} — {t('pages.loans.paymentPlan.desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label>{t('pages.loans.paymentPlan.installmentsCountLabel')} *</Label>
            <Input
              type="number"
              min={2}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label>{t('pages.loans.paymentPlan.firstInstallmentLabel')}</Label>
            <DatePicker
              value={firstDueDate}
              clearable={false}
              onChange={(date) => setFirstDueDate(date ? formatLocalDate(date) : '')}
            />
            <p className="text-muted-foreground text-xs">
              {t('pages.loans.paymentPlan.firstInstallmentHint')}
            </p>
          </div>
          {count >= 2 && (
            <p className="text-muted-foreground text-sm">
              {t('pages.loans.paymentPlan.installmentValuePreview', {
                count,
                value: formatCurrency(perInstallment.toFixed(2)),
              })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || count < 2}
          >
            {isSubmitting ? t('common.actions.saving') : t('common.actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
