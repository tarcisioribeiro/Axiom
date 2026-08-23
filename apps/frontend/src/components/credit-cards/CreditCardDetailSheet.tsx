/* eslint-disable max-lines */
import {
  CreditCardIcon,
  ReceiptRefundIcon as Receipt,
  ShoppingCartIcon as ShoppingCart,
  Cog6ToothIcon as Settings,
  WalletIcon as Wallet,
  ArrowTrendingDownIcon as TrendingDown,
  CalendarDaysIcon as CalendarDays,
  PencilIcon as Pencil,
  TrashIcon as Trash2,
  CurrencyDollarIcon as DollarSign,
  CheckCircleIcon as CheckCircle2,
  ExclamationTriangleIcon as AlertTriangle,
  ViewfinderCircleIcon as CircleDot,
  ArrowUturnLeftIcon as RotateCcw,
  PlusIcon as Plus,
} from '@heroicons/react/24/solid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { BillPaymentForm } from '@/components/credit-cards/BillPaymentForm';
import { CreditCardBillForm } from '@/components/credit-cards/CreditCardBillForm';
import { CreditCardForm } from '@/components/credit-cards/CreditCardForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  getBillTimestamp,
  getCurrentCreditCardBill,
  sortCreditCardBills,
} from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardPurchasesService } from '@/services/credit-card-purchases-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';
import type {
  Account,
  CreditCard,
  CreditCardBill,
  CreditCardBillFormData,
  CreditCardFormData,
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

function UsageArc({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
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
        strokeWidth={5}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BillStatusBadge({ status }: { status: CreditCardBill['status'] }) {
  const { t } = useTranslation();
  const map: Record<
    string,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      label: string;
      icon: React.ReactNode;
    }
  > = {
    open: {
      variant: 'secondary',
      label: t('pages.creditCardExpenses.status.open'),
      icon: <CircleDot className="h-3 w-3" />,
    },
    paid: {
      variant: 'default',
      label: t('pages.creditCardExpenses.status.paid'),
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    overdue: {
      variant: 'destructive',
      label: t('pages.creditCardExpenses.status.overdue'),
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    closed: {
      variant: 'outline',
      label: t('pages.creditCardExpenses.status.closed'),
      icon: <RotateCcw className="h-3 w-3" />,
    },
  };
  const entry = map[status] ?? map.open;
  return (
    <Badge variant={entry.variant} className="flex items-center gap-1 text-xs">
      {entry.icon}
      {entry.label}
    </Badge>
  );
}

interface Props {
  card: CreditCard | null;
  accounts: Account[];
  onClose: () => void;
  onCardUpdated: () => void;
  onCardDeleted: () => void;
}

export function CreditCardDetailSheet({
  card,
  accounts,
  onClose,
  onCardUpdated,
  onCardDeleted,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('summary');
  const [isBillFormOpen, setIsBillFormOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditCardBill | undefined>();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [billToPay, setBillToPay] = useState<CreditCardBill | undefined>();
  const setExtraSubLabel = useBreadcrumbExtraStore((s) => s.setExtraSubLabel);

  useEffect(() => {
    if (!card) {
      setExtraSubLabel(null);
      return () => setExtraSubLabel(null);
    }
    const TAB_LABELS: Record<string, string> = {
      summary: t('pages.creditCardHub.tabs.summary'),
      bills: t('pages.creditCardHub.tabs.bills'),
      purchases: t('pages.creditCardHub.tabs.purchases'),
      settings: t('pages.creditCardHub.tabs.settings'),
    };
    setExtraSubLabel(TAB_LABELS[activeTab] ?? null);
    return () => setExtraSubLabel(null);
  }, [activeTab, card, setExtraSubLabel, t]);

  const cardId = card?.id;

  const billsQuery = useQuery({
    queryKey: ['creditCards', cardId, 'bills'],
    queryFn: () => creditCardBillsService.getAll({ credit_card: cardId }),
    enabled: !!cardId && activeTab === 'bills',
  });

  const purchasesQuery = useQuery({
    queryKey: ['creditCards', cardId, 'purchases'],
    queryFn: () => creditCardPurchasesService.getAll({ card: cardId }),
    enabled: !!cardId && activeTab === 'purchases',
  });

  const recentBillsQuery = useQuery({
    queryKey: ['creditCards', cardId, 'recentBills'],
    queryFn: () => creditCardBillsService.getAll({ credit_card: cardId }),
    enabled: !!cardId && activeTab === 'summary',
  });

  const saveMutation = useMutation({
    mutationFn: (data: CreditCardFormData) => creditCardsService.update(cardId!, data),
    onSuccess: () => {
      toast({
        title: t('pages.creditCards.updated'),
        description: t('pages.creditCards.updatedDesc'),
      });
      onCardUpdated();
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => creditCardsService.delete(cardId!),
    onSuccess: () => {
      toast({
        title: t('pages.creditCards.deleted'),
        description: t('pages.creditCards.deletedDesc'),
      });
      onCardDeleted();
      onClose();
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const billSaveMutation = useMutation({
    mutationFn: (data: CreditCardBillFormData) =>
      selectedBill
        ? creditCardBillsService.update(selectedBill.id, data)
        : creditCardBillsService.create(data),
    onSuccess: () => {
      toast({
        title: selectedBill
          ? t('pages.creditCardBills.updated')
          : t('pages.creditCardBills.created'),
        description: selectedBill
          ? t('pages.creditCardBills.updatedDesc')
          : t('pages.creditCardBills.createdDesc'),
      });
      setIsBillFormOpen(false);
      setSelectedBill(undefined);
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'bills'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'recentBills'],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const billDeleteMutation = useMutation({
    mutationFn: (id: number) => creditCardBillsService.delete(id),
    onSuccess: () => {
      toast({
        title: t('pages.creditCardBills.deleted'),
        description: t('pages.creditCardBills.deletedDesc'),
      });
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'bills'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'recentBills'],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const payMutation = useMutation({
    mutationFn: (data: BillPaymentFormData) =>
      creditCardBillsService.payBill(billToPay!.id, data),
    onSuccess: () => {
      toast({ title: t('pages.creditCardBills.paySuccess') });
      setIsPaymentOpen(false);
      setBillToPay(undefined);
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'bills'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'recentBills'],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('pages.creditCardBills.payError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: number) => creditCardBillsService.reopenBill(id),
    onSuccess: () => {
      toast({
        title: t('pages.creditCardBills.reopened'),
        description: t('pages.creditCardBills.reopenedDesc'),
      });
      void queryClient.invalidateQueries({
        queryKey: ['creditCards', cardId, 'bills'],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  if (!card) return null;

  const limit = parseFloat(card.credit_limit);
  const available = card.available_credit ?? 0;
  const used = Math.max(0, limit - available);
  const usagePct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const brandGradient =
    CARD_BRAND_GRADIENTS[card.flag.toLowerCase()] ??
    'from-primary/20 via-primary/10 to-transparent';

  const recentBillsData = recentBillsQuery.data ?? [];
  const openBill = getCurrentCreditCardBill(recentBillsData);
  const recentBills = [...recentBillsData]
    .sort((a, b) => getBillTimestamp(b) - getBillTimestamp(a))
    .slice(0, 5);
  const purchases = purchasesQuery.data ?? [];
  const allBills = sortCreditCardBills(billsQuery.data ?? []);

  const handleDeleteCard = async () => {
    const confirmed = await showConfirm({
      title: t('pages.creditCards.deleteTitle'),
      description: t('pages.creditCards.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (confirmed) deleteMutation.mutate();
  };

  const handleDeleteBill = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.creditCardBills.deleteTitle'),
      description: t('pages.creditCardBills.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (confirmed) billDeleteMutation.mutate(id);
  };

  const handleReopenBill = async (bill: CreditCardBill) => {
    const confirmed = await showConfirm({
      title: t('pages.creditCardBills.reopenTitle'),
      description: `${t('pages.creditCardHub.reopenConfirm')} ${translate('months', bill.month)}/${bill.year}?`,
      confirmText: t('pages.creditCardBills.reopenBtn'),
      cancelText: t('common.actions.cancel'),
    });
    if (confirmed) reopenMutation.mutate(bill.id);
  };

  const billAssociatedAccount = accounts.find((a) => a.id === card.associated_account);

  return (
    <>
      <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
          {/* Card hero header */}
          <div
            className={cn(
              'px-lg pb-xl pt-lg relative bg-gradient-to-br',
              brandGradient
            )}
          >
            <DialogHeader className="mb-md">
              <DialogTitle className="gap-sm flex items-center text-lg">
                <CreditCardIcon className="h-5 w-5" />
                {card.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-between">
              <div className="gap-lg flex items-center">
                <div className="relative">
                  <UsageArc pct={usagePct} size={64} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {Math.round(usagePct)}%
                  </span>
                </div>
                <div className="space-y-xs">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('pages.creditCards.limit')}
                    </p>
                    <p className="text-success text-2xl font-bold">
                      {formatCurrency(available)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('pages.creditCards.ofLimit', { value: formatCurrency(limit) })}
                    </p>
                  </div>
                </div>
                <div className="space-y-xs">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t('pages.creditCardHub.usedCredit')}
                    </p>
                    <p className="text-destructive text-xl font-semibold">
                      {formatCurrency(used)}
                    </p>
                  </div>
                  {openBill && (
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {t('pages.creditCardHub.currentBill')}
                      </p>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          openBill.status === 'overdue'
                            ? 'text-destructive'
                            : 'text-foreground'
                        )}
                      >
                        {formatCurrency(parseFloat(openBill.total_amount))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="gap-xs flex flex-col items-end">
                <Badge variant="secondary" className="text-sm">
                  {translate('cardBrands', card.flag)}
                </Badge>
                {card.card_number_masked && (
                  <p className="text-muted-foreground font-mono text-xs">
                    {card.card_number_masked}
                  </p>
                )}
                <div className="gap-xs text-muted-foreground flex items-center text-xs">
                  <CalendarDays className="h-3 w-3" />
                  <span>
                    {t('pages.creditCards.dueDay')} {card.due_day}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="mx-lg mt-md w-auto self-start">
              <TabsTrigger value="summary" className="gap-xs text-xs">
                <Wallet className="h-3.5 w-3.5" />
                {t('pages.creditCardHub.tabs.summary')}
              </TabsTrigger>
              <TabsTrigger value="bills" className="gap-xs text-xs">
                <Receipt className="h-3.5 w-3.5" />
                {t('pages.creditCardHub.tabs.bills')}
              </TabsTrigger>
              <TabsTrigger value="purchases" className="gap-xs text-xs">
                <ShoppingCart className="h-3.5 w-3.5" />
                {t('pages.creditCardHub.tabs.purchases')}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-xs text-xs">
                <Settings className="h-3.5 w-3.5" />
                {t('pages.creditCardHub.tabs.settings')}
              </TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent
              value="summary"
              className="mt-md px-lg pb-lg flex-1 overflow-y-auto"
            >
              <div className="gap-md grid sm:grid-cols-2">
                <div className="bg-card p-md rounded-lg border">
                  <div className="gap-sm text-success flex items-center">
                    <Wallet className="h-4 w-4" />
                    <p className="text-sm font-medium">
                      {t('pages.creditCards.stats.availableCredit')}
                    </p>
                  </div>
                  <p className="mt-xs text-success text-2xl font-bold">
                    {formatCurrency(available)}
                  </p>
                  <div className="mt-sm bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full w-full origin-left rounded-full transition-transform',
                        usagePct >= 90
                          ? 'bg-destructive'
                          : usagePct >= 70
                            ? 'bg-warning'
                            : 'bg-success'
                      )}
                      style={{ transform: `scaleX(${(100 - usagePct) / 100})` }}
                    />
                  </div>
                </div>
                <div className="bg-card p-md rounded-lg border">
                  <div className="gap-sm text-destructive flex items-center">
                    <TrendingDown className="h-4 w-4" />
                    <p className="text-sm font-medium">
                      {t('pages.creditCardHub.usedCredit')}
                    </p>
                  </div>
                  <p className="mt-xs text-destructive text-2xl font-bold">
                    {formatCurrency(used)}
                  </p>
                  <p className="mt-xs text-muted-foreground text-xs">
                    {t('pages.creditCards.usedPercent', {
                      percent: Math.round(usagePct),
                    })}
                  </p>
                </div>
              </div>

              {openBill && (
                <div className="mt-md border-warning/40 bg-warning/5 p-md rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="gap-sm flex items-center">
                      <DollarSign className="text-warning h-4 w-4" />
                      <p className="font-medium">
                        {t('pages.creditCardHub.currentBill')}
                      </p>
                    </div>
                    <BillStatusBadge status={openBill.status} />
                  </div>
                  <p className="mt-xs text-2xl font-bold">
                    {formatCurrency(parseFloat(openBill.total_amount))}
                  </p>
                  {openBill.due_date && (
                    <p className="mt-xs text-muted-foreground text-sm">
                      {t('pages.creditCardHub.dueOn')} {formatDate(openBill.due_date)}
                    </p>
                  )}
                  {openBill.status !== 'paid' && (
                    <Button
                      size="sm"
                      className="mt-sm"
                      onClick={() => {
                        setBillToPay(openBill);
                        setIsPaymentOpen(true);
                      }}
                    >
                      {t('pages.creditCardBills.payForm.payBtn')}
                    </Button>
                  )}
                </div>
              )}

              {recentBills.length > 0 && (
                <div className="mt-md">
                  <p className="mb-sm text-muted-foreground text-sm font-medium">
                    {t('pages.creditCardHub.recentBills')}
                  </p>
                  <div className="space-y-xs">
                    {recentBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="bg-card px-md py-sm flex items-center justify-between rounded-md border"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {translate('months', bill.month)}/{bill.year}
                          </p>
                          {bill.due_date && (
                            <p className="text-muted-foreground text-xs">
                              {formatDate(bill.due_date)}
                            </p>
                          )}
                        </div>
                        <div className="gap-sm flex items-center">
                          <p className="text-sm font-semibold">
                            {formatCurrency(parseFloat(bill.total_amount))}
                          </p>
                          <BillStatusBadge status={bill.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Bills Tab */}
            <TabsContent
              value="bills"
              className="mt-md px-lg pb-lg flex-1 overflow-y-auto"
            >
              <div className="mb-md flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">
                  {allBills.length} {t('pages.creditCardHub.billsFound')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedBill(undefined);
                    setIsBillFormOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('pages.creditCardBills.newBtn')}
                </Button>
              </div>
              {billsQuery.isLoading ? (
                <div className="text-muted-foreground flex h-32 items-center justify-center">
                  {t('common.actions.loading')}
                </div>
              ) : allBills.length === 0 ? (
                <div className="gap-sm text-muted-foreground flex h-32 flex-col items-center justify-center">
                  <Receipt className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('pages.creditCardHub.noBills')}</p>
                </div>
              ) : (
                <div className="space-y-xs">
                  {allBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-card px-md py-sm flex items-center justify-between rounded-md border"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {translate('months', bill.month)}/{bill.year}
                        </p>
                        {bill.due_date && (
                          <p className="text-muted-foreground text-xs">
                            {formatDate(bill.due_date)}
                          </p>
                        )}
                      </div>
                      <div className="gap-sm flex items-center">
                        <p className="text-sm font-semibold">
                          {formatCurrency(parseFloat(bill.total_amount))}
                        </p>
                        <BillStatusBadge status={bill.status} />
                        <div className="flex items-center gap-1">
                          {bill.status !== 'paid' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title={t('pages.creditCardBills.payForm.payBtn')}
                              onClick={() => {
                                setBillToPay(bill);
                                setIsPaymentOpen(true);
                              }}
                            >
                              <DollarSign className="text-success h-3.5 w-3.5" />
                            </Button>
                          )}
                          {bill.status === 'paid' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title={t('pages.creditCardBills.reopenBtn')}
                              onClick={() => void handleReopenBill(bill)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={t('common.actions.edit')}
                            onClick={() => {
                              setSelectedBill(bill);
                              setIsBillFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={t('common.actions.delete')}
                            onClick={() => void handleDeleteBill(bill.id)}
                          >
                            <Trash2 className="text-destructive h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Purchases Tab */}
            <TabsContent
              value="purchases"
              className="mt-md px-lg pb-lg flex-1 overflow-y-auto"
            >
              {purchasesQuery.isLoading ? (
                <div className="text-muted-foreground flex h-32 items-center justify-center">
                  {t('common.actions.loading')}
                </div>
              ) : purchases.length === 0 ? (
                <div className="gap-sm text-muted-foreground flex h-32 flex-col items-center justify-center">
                  <ShoppingCart className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t('pages.creditCardHub.noPurchases')}</p>
                </div>
              ) : (
                <div className="space-y-xs">
                  <p className="mb-sm text-muted-foreground text-sm font-medium">
                    {purchases.length} {t('pages.creditCardHub.purchasesFound')}
                  </p>
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="bg-card px-md py-sm flex items-start justify-between rounded-md border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {purchase.description}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {purchase.merchant && `${purchase.merchant} · `}
                          {formatDate(purchase.purchase_date)}
                          {purchase.total_installments > 1 && (
                            <span className="ml-xs">
                              {purchase.total_installments}x
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="ml-sm text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(purchase.total_value)}
                        </p>
                        {purchase.total_installments > 1 && (
                          <p className="text-muted-foreground text-xs">
                            {formatCurrency(purchase.installment_value)}/
                            {t('pages.creditCardHub.installment')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent
              value="settings"
              className="mt-md px-lg pb-lg flex-1 overflow-y-auto"
            >
              <CreditCardForm
                creditCard={card}
                accounts={accounts}
                onSubmit={(data) => saveMutation.mutate(data)}
                onCancel={onClose}
                isLoading={saveMutation.isPending}
              />
              <div className="mt-lg pt-lg border-t">
                <p className="mb-sm text-destructive text-sm font-medium">
                  {t('pages.creditCardHub.dangerZone')}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDeleteCard()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('pages.creditCards.deleteTitle')}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Bill form dialog */}
      <Dialog
        open={isBillFormOpen}
        onOpenChange={(open) => !open && setIsBillFormOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedBill
                ? t('pages.creditCardBills.editTitle')
                : t('pages.creditCardBills.newBtn')}
            </DialogTitle>
          </DialogHeader>
          <CreditCardBillForm
            creditCards={[card]}
            bill={selectedBill}
            onSubmit={(data) => billSaveMutation.mutate(data)}
            isLoading={billSaveMutation.isPending}
            onCancel={() => setIsBillFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Payment form dialog */}
      <Dialog
        open={isPaymentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPaymentOpen(false);
            setBillToPay(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.creditCardBills.payForm.payBtn')}</DialogTitle>
          </DialogHeader>
          {billToPay && (
            <BillPaymentForm
              bill={billToPay}
              associatedAccount={billAssociatedAccount}
              onSubmit={(data) => payMutation.mutate(data)}
              isLoading={payMutation.isPending}
              onCancel={() => setIsPaymentOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
