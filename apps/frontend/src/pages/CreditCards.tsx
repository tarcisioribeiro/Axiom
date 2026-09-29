/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard as CreditCardIcon,
  Calendar,
  Wallet,
  TrendingDown,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { CreditCardDeleteDialog } from '@/components/credit-cards/CreditCardDeleteDialog';
import { CreditCardDetailSheet } from '@/components/credit-cards/CreditCardDetailSheet';
import { CreditCardForm } from '@/components/credit-cards/CreditCardForm';
import { CreditLimitAdjustDialog } from '@/components/credit-cards/CreditLimitAdjustDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { DURATION } from '@/lib/animations';
import { formatCurrency } from '@/lib/formatters';
import { getCurrentCreditCardBill, sumByProperty } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';
import type { CreditCard, CreditCardFormData, Account, CreditCardBill } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const CARD_BRAND_GRADIENTS: Record<string, string> = {
  visa: 'from-blue-600/30 via-blue-500/15 to-indigo-500/10',
  mastercard: 'from-red-600/30 via-orange-500/15 to-yellow-500/10',
  elo: 'from-yellow-500/30 via-blue-500/15 to-blue-700/10',
  amex: 'from-green-600/30 via-teal-500/15 to-emerald-500/10',
  hipercard: 'from-red-700/30 via-red-500/15 to-pink-500/10',
};

function UsageArc({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color =
    pct >= 90
      ? 'hsl(var(--destructive))'
      : pct >= 70
        ? 'hsl(var(--warning))'
        : 'hsl(var(--success))';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

const EMPTY_CREDIT_CARDS: CreditCard[] = [];
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_BILLS: CreditCardBill[] = [];

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function CreditCards({
  embedded = false,
  onShowBills,
}: {
  embedded?: boolean;
  /** Leva à aba de faturas filtrada pelo cartão (usado quando há pendências). */
  onShowBills?: (cardId: number) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [hubCard, setHubCard] = useState<CreditCard | undefined>();
  const [limitCard, setLimitCard] = useState<CreditCard | undefined>();
  const [deleteState, setDeleteState] = useState<
    { card: CreditCard; pendingBills: CreditCardBill[] } | undefined
  >();
  const setExtraLabel = useBreadcrumbExtraStore((s) => s.setExtraLabel);

  useEffect(() => {
    setExtraLabel(hubCard?.name ?? null);
    return () => setExtraLabel(null);
  }, [hubCard, setExtraLabel]);

  const { data: cardsPageData, isLoading } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      try {
        const [cardsData, accountsData, billsData] = await Promise.all([
          creditCardsService.getAll(),
          accountsService.getAll(),
          creditCardBillsService.getAll(),
        ]);
        return { creditCards: cardsData, accounts: accountsData, allBills: billsData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return {
          creditCards: [] as CreditCard[],
          accounts: [] as Account[],
          allBills: [] as CreditCardBill[],
        };
      }
    },
  });
  const creditCards = cardsPageData?.creditCards ?? EMPTY_CREDIT_CARDS;
  const accounts = cardsPageData?.accounts ?? EMPTY_ACCOUNTS;
  const allBills = cardsPageData?.allBills ?? EMPTY_BILLS;

  const handleSubmit = async (data: CreditCardFormData) => {
    try {
      setIsSubmitting(true);
      await creditCardsService.create(data);
      toast({
        title: t('pages.creditCards.created'),
        description: t('pages.creditCards.createdDesc'),
      });
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
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
    setIsDialogOpen(true);
  };

  const handleDelete = async (card: CreditCard) => {
    // Busca fresca: o cache da página pode não refletir um pagamento recente.
    let bills: CreditCardBill[];
    try {
      bills = await creditCardBillsService.getAll({ credit_card: card.id });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return;
    }
    const pending = bills.filter((b) => b.status !== 'paid');
    if (pending.length === 0) {
      const confirmed = await showConfirm({
        title: t('pages.creditCards.deleteTitle'),
        description: t('pages.creditCards.deleteDesc'),
        confirmText: t('pages.creditCards.deleteFlow.continue'),
        cancelText: t('common.actions.cancel'),
        variant: 'destructive',
      });
      if (!confirmed) return;
    }
    setDeleteState({ card, pendingBills: pending });
  };

  const totalLimit = sumByProperty(
    creditCards.map((c) => ({ value: parseFloat(c.credit_limit) })),
    'value'
  );

  const totalAvailable = sumByProperty(
    creditCards.map((c) => ({ value: c.available_credit || 0 })),
    'value'
  );

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
    <Wrapper embedded={embedded}>
      <PageHeader
        title={t('pages.creditCards.title')}
        icon={<CreditCardIcon />}
        action={{
          label: t('pages.creditCards.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
        <Card className="border-t-primary/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">
              {t('pages.creditCards.cardCount', { count: creditCards.length })}
            </p>
            <div className="bg-primary/10 p-sm ring-primary/20 rounded-lg ring-1">
              <CreditCardIcon className="text-primary h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-primary text-2xl font-bold">{creditCards.length}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.creditCards.stats.registeredSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-success/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">
              {t('pages.creditCards.stats.availableCredit')}
            </p>
            <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
              <Wallet className="text-success h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">
              {formatCurrency(totalAvailable)}
            </div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.creditCards.stats.ofTotalLimit', {
                value: formatCurrency(totalLimit),
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-destructive/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">
              {t('pages.creditCards.stats.usedCredit')}
            </p>
            <div className="bg-destructive/10 p-sm ring-destructive/20 rounded-lg ring-1">
              <TrendingDown className="text-destructive h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">
              {formatCurrency(totalLimit - totalAvailable)}
            </div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.creditCards.usedPercent', {
                percent:
                  totalLimit > 0
                    ? Math.round(((totalLimit - totalAvailable) / totalLimit) * 100)
                    : 0,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {creditCards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="text-muted-foreground h-12 w-12" />}
          title={t('pages.creditCards.emptyTitle')}
          message={t('pages.creditCards.emptyState')}
        />
      ) : (
        <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
          {creditCards.map((card) => {
            const cardNumber = getCardNumber(card);
            const limit = parseFloat(card.credit_limit);
            const available = card.available_credit ?? 0;
            const used = Math.max(0, limit - available);
            const usagePct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
            const brandGradient =
              CARD_BRAND_GRADIENTS[card.flag.toLowerCase()] ??
              'from-primary/20 via-primary/10 to-transparent';

            const openBill = getCurrentCreditCardBill(
              allBills.filter((b) => b.credit_card === card.id)
            );
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysUntilDue = openBill?.due_date
              ? Math.ceil(
                  (new Date(openBill.due_date).getTime() - today.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : null;
            const urgencyBorder =
              openBill && daysUntilDue !== null
                ? daysUntilDue < 0
                  ? 'border-t-4 border-t-destructive'
                  : daysUntilDue <= 5
                    ? 'border-t-4 border-t-warning'
                    : ''
                : '';

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: DURATION.fast,
                  delay: creditCards.indexOf(card) * 0.05,
                }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
                onClick={() => setHubCard(card)}
                className="cursor-pointer"
                title={t('pages.creditCardHub.openHub')}
              >
                <Card className={cn('overflow-hidden', urgencyBorder)}>
                  {/* Card hero — gradient background simulating a bank card */}
                  <div
                    className={cn(
                      'px-md pb-lg pt-md relative bg-gradient-to-br',
                      brandGradient
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-muted-foreground text-xs">
                          {t('pages.creditCards.stats.availableCredit')}
                        </p>
                        <p className="text-xl font-bold">{formatCurrency(available)}</p>
                        <p className="text-muted-foreground text-xs">
                          {t('pages.creditCards.ofLimit', {
                            value: formatCurrency(limit),
                          })}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t('pages.creditCards.maxLimitValue', {
                            value: formatCurrency(card.max_limit),
                          })}
                        </p>
                      </div>
                      <div className="gap-xs flex items-center">
                        <UsageArc pct={usagePct} size={48} />
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLimitCard(card);
                            }}
                            title={t('pages.creditCards.adjustLimit.title')}
                            aria-label={t('pages.creditCards.adjustLimit.title')}
                          >
                            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHubCard(card);
                            }}
                            title={t('common.actions.edit')}
                            aria-label={t('common.actions.edit')}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(card);
                            }}
                            title={t('common.actions.delete')}
                            aria-label={t('common.actions.delete')}
                          >
                            <Trash2
                              className="text-destructive h-4 w-4"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {/* Card chip */}
                    <div className="left-md bg-warning/40 ring-warning/30 absolute bottom-3 h-5 w-7 rounded ring-1" />
                    {/* Bottom accent strip */}
                    <div className="via-primary/40 absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent to-transparent" />
                  </div>

                  <CardContent className="space-y-sm pt-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <button
                          className="cursor-pointer text-left font-semibold hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {card.name}
                        </button>
                        {cardNumber && (
                          <p className="text-muted-foreground font-mono text-xs">
                            {cardNumber}
                          </p>
                        )}
                        {openBill && (
                          <p
                            className={cn(
                              'mt-0.5 text-xs font-medium',
                              daysUntilDue !== null && daysUntilDue <= 5
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                            )}
                          >
                            {t('pages.creditCards.billAmount', {
                              amount: formatCurrency(openBill.total_amount),
                            })}
                            {openBill.due_date &&
                              ` • ${t('pages.creditCards.dueDayText', { day: new Date(openBill.due_date).getUTCDate() })}`}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {translate('cardBrands', card.flag)}
                      </Badge>
                    </div>

                    <div className="pt-sm flex items-center justify-between border-t text-sm">
                      <div className="gap-xs text-muted-foreground flex items-center">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{t('pages.creditCards.dueDay')}</span>
                      </div>
                      <span className="font-medium">
                        {t('pages.creditCards.dueDayValue', { day: card.due_day })}
                      </span>
                    </div>

                    {card.associated_account_name && (
                      <p className="text-muted-foreground text-xs">
                        {t('pages.creditCards.associatedAccount')}{' '}
                        {card.associated_account_name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <CreditLimitAdjustDialog
        key={limitCard?.id}
        card={limitCard}
        onOpenChange={(open) => !open && setLimitCard(undefined)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('pages.creditCards.newTitle')}</DialogTitle>
            <DialogDescription>{t('pages.creditCards.newDesc')}</DialogDescription>
          </DialogHeader>
          <CreditCardForm
            accounts={accounts}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <CreditCardDetailSheet
        card={hubCard ?? null}
        accounts={accounts}
        onClose={() => setHubCard(undefined)}
        onCardUpdated={() => {
          void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
          setHubCard(undefined);
        }}
      />

      <CreditCardDeleteDialog
        card={deleteState?.card}
        pendingBills={deleteState?.pendingBills ?? EMPTY_BILLS}
        onClose={() => setDeleteState(undefined)}
        onDeleted={() => {
          void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
        }}
        onShowBills={onShowBills}
      />
    </Wrapper>
  );
}
