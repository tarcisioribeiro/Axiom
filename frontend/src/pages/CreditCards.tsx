/* eslint-disable max-lines */
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard as CreditCardIcon,
  Calendar,
  Wallet,
  Receipt,
  Filter,
  RotateCcw,
  TrendingDown,
} from 'lucide-react';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { BillPaymentForm } from '@/components/credit-cards/BillPaymentForm';
import { CreditCardBillForm } from '@/components/credit-cards/CreditCardBillForm';
import { CreditCardForm } from '@/components/credit-cards/CreditCardForm';
import { ReceiptButton } from '@/components/receipts';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translate, TRANSLATIONS } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  CreditCard,
  CreditCardFormData,
  Account,
  CreditCardBill,
  CreditCardBillFormData,
  BillPaymentFormData,
} from '@/types';
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

// Mapeamento de abreviações de mês para número
const MONTH_TO_NUMBER: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function sortBills(bills: CreditCardBill[]): CreditCardBill[] {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  return [...bills].sort((a, b) => {
    const aMonth = MONTH_TO_NUMBER[a.month] || 1;
    const bMonth = MONTH_TO_NUMBER[b.month] || 1;
    const aIsCurrent =
      aMonth === currentMonth &&
      parseInt(a.year) === currentYear &&
      a.status !== 'paid';
    const bIsCurrent =
      bMonth === currentMonth &&
      parseInt(b.year) === currentYear &&
      b.status !== 'paid';
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;
    const aIsOpen = a.status === 'open' || a.status === 'overdue';
    const bIsOpen = b.status === 'open' || b.status === 'overdue';
    if (aIsOpen && !bIsOpen) return -1;
    if (!aIsOpen && bIsOpen) return 1;
    return (
      new Date(parseInt(a.year), aMonth - 1).getTime() -
      new Date(parseInt(b.year), bMonth - 1).getTime()
    );
  });
}

export default function CreditCards({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CreditCard | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  const [allBills, setAllBills] = useState<CreditCardBill[]>([]);

  // Bills dialog state
  const [billsCard, setBillsCard] = useState<CreditCard | undefined>();
  const [isBillsOpen, setIsBillsOpen] = useState(false);
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billStatusFilter, setBillStatusFilter] = useState<string>('all');
  const [billYearFilter, setBillYearFilter] = useState<string>('all');
  const [isBillFormOpen, setIsBillFormOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditCardBill | undefined>();
  const [isBillSubmitting, setIsBillSubmitting] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const billAssociatedAccount = useMemo(() => {
    if (!selectedBill) return undefined;
    const card = creditCards.find((c) => c.id === selectedBill.credit_card);
    if (!card) return undefined;
    return accounts.find((a) => a.id === card.associated_account);
  }, [selectedBill, creditCards, accounts]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cardsData, accountsData, billsData] = await Promise.all([
        creditCardsService.getAll(),
        accountsService.getAll(),
        creditCardBillsService.getAll(),
      ]);
      setCreditCards(cardsData);
      setAccounts(accountsData);
      setAllBills(billsData);
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

  const openBillsDialog = async (card: CreditCard) => {
    setBillsCard(card);
    setBillStatusFilter('all');
    setBillYearFilter('all');
    setIsBillsOpen(true);
    setBillsLoading(true);
    try {
      const all = await creditCardBillsService.getAll();
      setBills(all.filter((b) => b.credit_card === card.id));
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBillsLoading(false);
    }
  };

  const handleBillSubmit = async (data: CreditCardBillFormData) => {
    try {
      setIsBillSubmitting(true);
      if (selectedBill) {
        await creditCardBillsService.update(selectedBill.id, data);
        toast({
          title: t('pages.creditCardBills.updated'),
          description: t('pages.creditCardBills.updatedDesc'),
        });
      } else {
        await creditCardBillsService.create(data);
        toast({
          title: t('pages.creditCardBills.created'),
          description: t('pages.creditCardBills.createdDesc'),
        });
      }
      setIsBillFormOpen(false);
      if (billsCard) {
        const all = await creditCardBillsService.getAll();
        setBills(all.filter((b) => b.credit_card === billsCard.id));
      }
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsBillSubmitting(false);
    }
  };

  const handleBillDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.creditCardBills.deleteTitle'),
      description: t('pages.creditCardBills.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await creditCardBillsService.delete(id);
      toast({
        title: t('pages.creditCardBills.deleted'),
        description: t('pages.creditCardBills.deletedDesc'),
      });
      if (billsCard) {
        const all = await creditCardBillsService.getAll();
        setBills(all.filter((b) => b.credit_card === billsCard.id));
      }
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleBillPayment = async (data: BillPaymentFormData) => {
    if (!selectedBill) return;
    try {
      setIsPaymentSubmitting(true);
      await creditCardBillsService.payBill(selectedBill.id, data);
      toast({ title: t('pages.creditCardBills.paySuccess') });
      setIsPaymentOpen(false);
      if (billsCard) {
        const all = await creditCardBillsService.getAll();
        setBills(all.filter((b) => b.credit_card === billsCard.id));
      }
    } catch (error: unknown) {
      toast({
        title: t('pages.creditCardBills.payError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleReopenBill = async (bill: CreditCardBill) => {
    const confirmed = await showConfirm({
      title: t('pages.creditCardBills.reopenTitle'),
      description: `Deseja reabrir a fatura de ${translate('months', bill.month)}/${bill.year}?`,
      confirmText: t('pages.creditCardBills.reopenBtn'),
      cancelText: t('common.actions.cancel'),
    });
    if (!confirmed) return;
    try {
      await creditCardBillsService.reopenBill(bill.id);
      toast({
        title: t('pages.creditCardBills.reopened'),
        description: t('pages.creditCardBills.reopenedDesc'),
      });
      if (billsCard) {
        const all = await creditCardBillsService.getAll();
        setBills(all.filter((b) => b.credit_card === billsCard.id));
      }
    } catch (error: unknown) {
      toast({
        title: t('pages.creditCardBills.reopenError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const currentYear = new Date().getFullYear();
  const billYears = Array.from({ length: 5 }, (_, i) =>
    (currentYear - 2 + i).toString()
  );

  const filteredBills = sortBills(
    bills.filter((b) => {
      if (billStatusFilter !== 'all' && b.status !== billStatusFilter) return false;
      if (billYearFilter !== 'all' && b.year !== billYearFilter) return false;
      return true;
    })
  );

  const billColumns: Column<CreditCardBill>[] = [
    {
      key: 'period',
      label: t('pages.creditCardBills.columns.period'),
      render: (bill) => `${translate('months', bill.month)}/${bill.year}`,
    },
    {
      key: 'total_amount',
      label: t('pages.creditCardBills.columns.totalAmount'),
      align: 'right',
      render: (bill) => (
        <span className="font-semibold">{formatCurrency(bill.total_amount)}</span>
      ),
    },
    {
      key: 'paid_amount',
      label: t('pages.creditCardBills.columns.paid'),
      align: 'right',
      render: (bill) => (
        <span className="font-semibold text-success">
          {formatCurrency(bill.paid_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('pages.creditCardBills.columns.status'),
      render: (bill) => (
        <Badge
          variant={
            bill.status === 'paid'
              ? 'success'
              : bill.status === 'overdue'
                ? 'destructive'
                : bill.status === 'closed'
                  ? 'secondary'
                  : 'default'
          }
        >
          {translate('billStatus', bill.status)}
        </Badge>
      ),
    },
    {
      key: 'due_date',
      label: t('pages.creditCardBills.columns.dueDate'),
      render: (bill) => (
        <span className="text-sm">
          {bill.due_date ? formatDate(bill.due_date) : 'N/A'}
        </span>
      ),
    },
  ];

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

  const Wrapper = embedded
    ? ({ children }: { children: ReactNode }) => (
        <div className="space-y-lg">{children}</div>
      )
    : PageContainer;

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <Wrapper>
      <PageHeader
        title={t('pages.creditCards.title')}
        icon={<CreditCardIcon />}
        action={{
          label: t('pages.creditCards.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Card className="overflow-hidden border-t-2 border-t-primary/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.creditCards.cardCount', { count: creditCards.length })}
            </p>
            <div className="rounded-lg bg-primary/10 p-sm ring-1 ring-primary/20">
              <CreditCardIcon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{creditCards.length}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.creditCards.stats.registeredSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-success/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.creditCards.stats.availableCredit')}
            </p>
            <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
              <Wallet className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalAvailable)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.creditCards.stats.ofTotalLimit', {
                value: formatCurrency(totalLimit),
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-destructive/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.creditCards.stats.usedCredit')}
            </p>
            <div className="rounded-lg bg-destructive/10 p-sm ring-1 ring-destructive/20">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalLimit - totalAvailable)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
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
          icon={<CreditCardIcon className="h-12 w-12 text-muted-foreground" />}
          title={t('pages.creditCards.emptyTitle')}
          message={t('pages.creditCards.emptyState')}
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {creditCards.map((card) => {
            const cardNumber = getCardNumber(card);
            const limit = parseFloat(card.credit_limit);
            const available = card.available_credit ?? 0;
            const used = Math.max(0, limit - available);
            const usagePct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
            const brandGradient =
              CARD_BRAND_GRADIENTS[card.flag.toLowerCase()] ??
              'from-primary/20 via-primary/10 to-transparent';

            const openBill = allBills.find(
              (b) =>
                b.credit_card === card.id &&
                (b.status === 'open' || b.status === 'overdue')
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
              <Card key={card.id} className={cn('overflow-hidden', urgencyBorder)}>
                {/* Card hero — gradient background simulating a bank card */}
                <div
                  className={cn(
                    'relative bg-gradient-to-br px-md pb-lg pt-md',
                    brandGradient
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {t('pages.creditCards.limit')}
                      </p>
                      <p className="text-xl font-bold">{formatCurrency(available)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('pages.creditCards.ofLimit', {
                          value: formatCurrency(limit),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs">
                      <UsageArc pct={usagePct} size={48} />
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void openBillsDialog(card)}
                          title={t('pages.creditCards.viewBills')}
                          aria-label={t('pages.creditCards.viewBills')}
                        >
                          <Receipt className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(card)}
                          title={t('common.actions.edit')}
                          aria-label={t('common.actions.edit')}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(card.id)}
                          title={t('common.actions.delete')}
                          aria-label={t('common.actions.delete')}
                        >
                          <Trash2
                            className="h-4 w-4 text-destructive"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Card chip */}
                  <div className="absolute bottom-3 left-md h-5 w-7 rounded bg-warning/40 ring-1 ring-warning/30" />
                  {/* Bottom accent strip */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                </div>

                <CardContent className="space-y-sm pt-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{card.name}</p>
                      {cardNumber && (
                        <p className="font-mono text-xs text-muted-foreground">
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

                  <div className="flex items-center justify-between border-t pt-sm text-sm">
                    <div className="flex items-center gap-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{t('pages.creditCards.dueDay')}</span>
                    </div>
                    <span className="font-medium">
                      {t('pages.creditCards.dueDayValue', { day: card.due_day })}
                    </span>
                  </div>

                  {card.associated_account_name && (
                    <p className="text-xs text-muted-foreground">
                      {t('pages.creditCards.associatedAccount')}{' '}
                      {card.associated_account_name}
                    </p>
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

      {/* Bills dialog */}
      <Dialog open={isBillsOpen} onOpenChange={setIsBillsOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm">
              <Receipt className="h-5 w-5" />
              {t('pages.creditCardBills.title')} — {billsCard?.name}
            </DialogTitle>
            <DialogDescription>{t('pages.creditCardBills.editDesc')}</DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={billStatusFilter} onValueChange={setBillStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('pages.creditCardBills.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.creditCardBills.allStatus')}
                </SelectItem>
                {Object.entries(TRANSLATIONS.billStatus).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={billYearFilter} onValueChange={setBillYearFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t('pages.creditCardBills.allYears')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.creditCardBills.allYears')}
                </SelectItem>
                {billYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={() => {
                setSelectedBill(undefined);
                setIsBillFormOpen(true);
              }}
            >
              <Plus className="mr-sm h-4 w-4" />
              {t('pages.creditCardBills.newBtn')}
            </Button>
          </div>

          <DataTable
            data={filteredBills}
            columns={billColumns}
            keyExtractor={(b) => b.id}
            isLoading={billsLoading}
            emptyState={{
              icon: <Receipt className="h-12 w-12 text-muted-foreground" />,
              message: t('pages.creditCardBills.emptyState'),
            }}
            actions={(bill) => (
              <div className="flex items-center justify-end gap-xs">
                {bill.status === 'paid' && (
                  <ReceiptButton
                    source={{ type: 'credit_card_bill', data: bill }}
                    memberName={getMemberDisplayName(null, user)}
                  />
                )}
                {bill.status !== 'paid' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('pages.creditCardBills.payBillLabel')}
                    onClick={() => {
                      setSelectedBill(bill);
                      setIsPaymentOpen(true);
                    }}
                    aria-label={t('pages.creditCardBills.payBillLabel')}
                  >
                    <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
                  </Button>
                )}
                {(bill.closed ||
                  bill.status === 'paid' ||
                  bill.status === 'closed') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('pages.creditCardBills.reopenBillLabel')}
                    onClick={() => void handleReopenBill(bill)}
                    aria-label={t('pages.creditCardBills.reopenBillLabel')}
                  >
                    <RotateCcw className="h-4 w-4 text-warning" aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('common.actions.edit')}
                  onClick={() => {
                    setSelectedBill(bill);
                    setIsBillFormOpen(true);
                  }}
                  aria-label={t('common.actions.edit')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('common.actions.delete')}
                  onClick={() => void handleBillDelete(bill.id)}
                  aria-label={t('common.actions.delete')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            )}
          />
        </DialogContent>
      </Dialog>

      {/* Bill create/edit dialog */}
      <Dialog open={isBillFormOpen} onOpenChange={setIsBillFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedBill
                ? t('pages.creditCardBills.editTitle')
                : t('pages.creditCardBills.newTitle')}
            </DialogTitle>
            <DialogDescription>{t('pages.creditCardBills.editDesc')}</DialogDescription>
          </DialogHeader>
          <CreditCardBillForm
            bill={selectedBill}
            creditCards={creditCards}
            onSubmit={handleBillSubmit}
            onCancel={() => setIsBillFormOpen(false)}
            isLoading={isBillSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Bill payment dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.creditCardBills.payTitle')}</DialogTitle>
            <DialogDescription>{t('pages.creditCardBills.payDesc')}</DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <BillPaymentForm
              bill={selectedBill}
              associatedAccount={billAssociatedAccount}
              onSubmit={handleBillPayment}
              onCancel={() => setIsPaymentOpen(false)}
              isLoading={isPaymentSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
