import {
  Plus,
  Pencil,
  Trash2,
  CreditCard as CreditCardIcon,
  Calendar,
  Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { CreditCardForm } from '@/components/credit-cards/CreditCardForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { accountsService } from '@/services/accounts-service';
import { creditCardsService } from '@/services/credit-cards-service';
import type { CreditCard, CreditCardFormData, Account } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function CreditCards() {
  const { t } = useTranslation();
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CreditCard | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cardsData, accountsData] = await Promise.all([
        creditCardsService.getAll(),
        accountsService.getAll(),
      ]);
      setCreditCards(cardsData);
      setAccounts(accountsData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: CreditCardFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedCard) {
        await creditCardsService.update(selectedCard.id, data);
        toast({
          title: t('pages.creditCards.updated'),
          description: t('pages.creditCards.updatedDesc'),
        });
      } else {
        await creditCardsService.create(data);
        toast({
          title: t('pages.creditCards.created'),
          description: t('pages.creditCards.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
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

  const handleCreate = () => {
    if (accounts.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.creditCards.noAccountMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedCard(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.creditCards.deleteTitle'),
      description: t('pages.creditCards.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await creditCardsService.delete(id);
      toast({
        title: t('pages.creditCards.deleted'),
        description: t('pages.creditCards.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const totalLimit = sumByProperty(
    creditCards.map((c) => ({ value: parseFloat(c.credit_limit) })),
    'value'
  );

  const totalAvailable = sumByProperty(
    creditCards.map((c) => ({ value: c.available_credit || 0 })),
    'value'
  );

  const handleEdit = (card: CreditCard) => {
    setSelectedCard(card);
    setIsDialogOpen(true);
  };

  const getCardNumber = (card: CreditCard) => {
    const masked = card.card_number_masked || '****';
    if (masked === '****' || masked.replace(/\*/g, '') === '') {
      return null;
    }
    const digitsOnly = masked.replace(/[^\d]/g, '');
    if (!digitsOnly || digitsOnly.length < 4) {
      return null;
    }
    return `**** ${digitsOnly.slice(-4)}`;
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.creditCards.title')}
        icon={<CreditCardIcon />}
        action={{
          label: t('pages.creditCards.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <span className="text-sm">
          {t('pages.creditCards.cardCount', { count: creditCards.length })}
        </span>
        <span className="text-lg font-bold">
          {t('pages.creditCards.totalLimit')} {formatCurrency(totalAvailable)} /{' '}
          {formatCurrency(totalLimit)}
        </span>
      </div>

      {creditCards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="h-12 w-12 text-muted-foreground" />}
          title={t('pages.creditCards.emptyTitle')}
          message={t('pages.creditCards.emptyState')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {creditCards.map((card) => {
            const cardNumber = getCardNumber(card);
            return (
              <Card key={card.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <CardTitle className="text-lg">{card.name}</CardTitle>
                        <Badge variant="secondary">
                          {translate('cardBrands', card.flag)}
                        </Badge>
                      </div>
                      {cardNumber && <p className="font-mono text-sm">{cardNumber}</p>}
                      {card.on_card_name && (
                        <p className="text-sm">{card.on_card_name}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(card)}
                        aria-label={t('common.actions.edit')}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(card.id)}
                        aria-label={t('common.actions.delete')}
                      >
                        <Trash2
                          className="h-4 w-4 text-destructive"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Wallet className="h-4 w-4" />
                      <span>{t('pages.creditCards.limit')}</span>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(card.available_credit || 0)} /{' '}
                      {formatCurrency(card.credit_limit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>{t('pages.creditCards.dueDay')}</span>
                    </div>
                    <span className="text-sm">
                      {t('pages.creditCards.dueDayValue', { day: card.due_day })}
                    </span>
                  </div>
                  {card.associated_account_name && (
                    <div className="border-t pt-2">
                      <p className="text-xs">
                        {t('pages.creditCards.associatedAccount')}{' '}
                        {card.associated_account_name}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCard
                ? t('pages.creditCards.editTitle')
                : t('pages.creditCards.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedCard
                ? t('pages.creditCards.editDesc')
                : t('pages.creditCards.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <CreditCardForm
            creditCard={selectedCard}
            accounts={accounts}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
