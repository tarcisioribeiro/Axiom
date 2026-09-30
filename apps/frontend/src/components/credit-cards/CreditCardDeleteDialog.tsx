import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { creditCardsService } from '@/services/credit-cards-service';
import type { CreditCard, CreditCardBill } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface Props {
  card: CreditCard | undefined;
  /** Faturas não pagas do cartão; se houver, a exclusão fica bloqueada. */
  pendingBills: CreditCardBill[];
  onClose: () => void;
  onDeleted: () => void;
  onShowBills?: (cardId: number) => void;
}

/**
 * Passos 2 e 3 da exclusão: pede número completo + CVV e reconfirma.
 * Com faturas pendentes, só informa e leva o usuário até elas.
 */
export function CreditCardDeleteDialog({
  card,
  pendingBills,
  onClose,
  onDeleted,
  onShowBills,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const [cardNumber, setCardNumber] = useState('');
  const [cvv, setCvv] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const close = () => {
    setCardNumber('');
    setCvv('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;
    const confirmed = await showConfirm({
      title: t('pages.creditCards.deleteFlow.finalTitle'),
      description: t('pages.creditCards.deleteFlow.finalDesc', { name: card.name }),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await creditCardsService.deleteWithCredentials(card.id, {
        card_number: cardNumber,
        security_code: cvv,
      });
      toast({
        title: t('pages.creditCards.deleted'),
        description: t('pages.creditCards.deletedDesc'),
      });
      close();
      onDeleted();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasPending = pendingBills.length > 0;

  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        {hasPending ? (
          <>
            <DialogHeader>
              <DialogTitle className="gap-sm flex items-center">
                <AlertTriangle className="text-warning h-5 w-5" />
                {t('pages.creditCards.deleteFlow.pendingTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('pages.creditCards.deleteFlow.pendingDesc')}
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-xs max-h-60 overflow-y-auto">
              {pendingBills.map((bill) => (
                <li
                  key={bill.id}
                  className="bg-card px-md py-sm flex items-center justify-between rounded-md border text-sm"
                >
                  <span className="font-medium">
                    {translate('months', bill.month)}/{bill.year}
                  </span>
                  <span className="gap-sm flex items-center">
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(bill.total_amount))}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t(`pages.creditCardExpenses.status.${bill.status}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="gap-sm flex justify-end">
              <Button variant="outline" onClick={close}>
                {t('common.actions.cancel')}
              </Button>
              {onShowBills && card && (
                <Button
                  onClick={() => {
                    close();
                    onShowBills(card.id);
                  }}
                >
                  {t('pages.creditCards.deleteFlow.viewBills')}
                </Button>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
            <DialogHeader>
              <DialogTitle>
                {t('pages.creditCards.deleteFlow.credentialsTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('pages.creditCards.deleteFlow.credentialsDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-xs">
              <Label htmlFor="delete-card-number">
                {t('pages.creditCards.form.cardNumberLabel')}
              </Label>
              <Input
                id="delete-card-number"
                inputMode="numeric"
                autoComplete="off"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder={t('pages.creditCards.form.cardNumberPlaceholder')}
                required
              />
            </div>
            <div className="space-y-xs">
              <Label htmlFor="delete-card-cvv">
                {t('pages.creditCards.form.cvvLabel')}
              </Label>
              <Input
                id="delete-card-cvv"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                placeholder={t('pages.creditCards.form.cvvPlaceholder')}
                required
              />
            </div>
            <div className="gap-sm flex justify-end">
              <Button type="button" variant="outline" onClick={close}>
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('pages.creditCards.deleteFlow.continue')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
