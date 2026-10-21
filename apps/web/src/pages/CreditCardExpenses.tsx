/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  CircleDot,
  CreditCardIcon,
  DollarSign,
  LayoutGrid,
  Link2,
  Pencil,
  Plus,
  Receipt,
  CalendarDays,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { TransactionsTabsNav } from '@/components/common/TransactionsTabsNav';
import { CreditCardInstallmentForm } from '@/components/credit-cards/CreditCardInstallmentForm';
import { CreditCardPurchaseForm } from '@/components/credit-cards/CreditCardPurchaseForm';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  translate,
  TRANSLATIONS,
  EXPENSE_CATEGORIES_CANONICAL,
} from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS, PAYMENT_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { pageVariants } from '@/lib/animations';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { cn, toLocalDate } from '@/lib/utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardInstallmentsService } from '@/services/credit-card-installments-service';
import { creditCardPurchasesService } from '@/services/credit-card-purchases-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useAuthStore } from '@/stores/auth-store';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';
import type {
  CreditCardPurchase,
  CreditCardPurchaseFormData,
  CreditCardInstallment,
  CreditCardInstallmentUpdateData,
  CreditCard,
  CreditCardBill,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EMPTY_PURCHASES: CreditCardPurchase[] = [];
const EMPTY_INSTALLMENTS: CreditCardInstallment[] = [];
const EMPTY_CARDS: CreditCard[] = [];
const EMPTY_BILLS: CreditCardBill[] = [];

const PURCHASES_PAGE_SIZE = 5;

const isBillOpen = (bill: CreditCardBill) =>
  bill.status !== 'paid' && bill.status !== 'closed';

// Faturas abertas primeiro (da mais antiga para a mais recente, já que é a
// que vence primeiro), depois as fechadas/pagas (mais recente para a mais
// antiga).
const compareBillsOpenFirst = (a: CreditCardBill, b: CreditCardBill) => {
  const aOpen = isBillOpen(a);
  const bOpen = isBillOpen(b);
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  const diff =
    new Date(a.invoice_beginning_date).getTime() -
    new Date(b.invoice_beginning_date).getTime();
  return aOpen ? diff : -diff;
};

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function CreditCardExpenses({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInstallmentDialogOpen, setIsInstallmentDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<
    CreditCardPurchase | undefined
  >();
  const [selectedInstallment, setSelectedInstallment] = useState<
    CreditCardInstallment | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assigningInstallment, setAssigningInstallment] = useState<
    CreditCardInstallment | undefined
  >();
  const [selectedAssignBillId, setSelectedAssignBillId] = useState<string>('');
  const [isAssignBillDialogOpen, setIsAssignBillDialogOpen] = useState(false);
  const [cardFilter, setCardFilter] = useState<string>('all');
  // 'none' = parcelas sem fatura vinculada
  const [billFilter, setBillFilter] = useState<string>('none');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'bills' | 'purchases'>('bills');
  const [purchaseDateFrom, setPurchaseDateFrom] = useState<Date | undefined>();
  const [purchaseDateTo, setPurchaseDateTo] = useState<Date | undefined>();
  const [purchasesPage, setPurchasesPage] = useState(1);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();
  const setExtraSubLabel = useBreadcrumbExtraStore((s) => s.setExtraSubLabel);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['credit-card-expenses'],
    queryFn: async () => {
      try {
        const [purchasesData, installmentsData, cardsData, billsData] =
          await Promise.all([
            creditCardPurchasesService.getAll(),
            creditCardInstallmentsService.getAll(),
            creditCardsService.getAll(),
            creditCardBillsService.getAll(),
          ]);
        return {
          purchases: purchasesData,
          installments: installmentsData,
          creditCards: cardsData,
          bills: billsData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return {
          purchases: EMPTY_PURCHASES,
          installments: EMPTY_INSTALLMENTS,
          creditCards: EMPTY_CARDS,
          bills: EMPTY_BILLS,
        };
      }
    },
  });
  const purchases = pageData?.purchases ?? EMPTY_PURCHASES;
  const installments = pageData?.installments ?? EMPTY_INSTALLMENTS;
  const creditCards = pageData?.creditCards ?? EMPTY_CARDS;
  const bills = pageData?.bills ?? EMPTY_BILLS;

  useEffect(() => {
    if (cardFilter === 'all') {
      setExtraSubLabel(null);
    } else {
      const card = creditCards.find((c) => c.id.toString() === cardFilter);
      setExtraSubLabel(card?.name ?? null);
    }
    return () => setExtraSubLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardFilter, creditCards]);

  // Faturas filtradas pelo cartão selecionado e ordenadas (abertas primeiro,
  // da mais recente para a mais antiga, depois fechadas/pagas na mesma ordem)
  const availableBills = useMemo(() => {
    const filtered =
      cardFilter === 'all'
        ? [...bills]
        : bills.filter((b) => b.credit_card.toString() === cardFilter);
    return filtered.sort(compareBillsOpenFirst);
  }, [cardFilter, bills]);

  // Seleciona automaticamente o primeiro cartão e sua primeira fatura aberta
  // assim que os dados chegam pela primeira vez (derivado durante o render,
  // sem efeito — roda uma única vez por carregamento de `creditCards`).
  const [autoSelectedFor, setAutoSelectedFor] = useState<CreditCard[] | undefined>();
  if (!autoSelectedFor && creditCards.length > 0) {
    setAutoSelectedFor(creditCards);
    const firstCardId = creditCards[0].id.toString();
    setCardFilter(firstCardId);
    const firstCardBills = bills.filter(
      (b) => b.credit_card.toString() === firstCardId
    );
    const sortedBills = [...firstCardBills].sort(compareBillsOpenFirst);
    setBillFilter(sortedBills[0] ? sortedBills[0].id.toString() : 'none');
  }

  // Reseta o filtro de fatura para a primeira fatura em aberto sempre que o
  // cartão selecionado MUDA (derivado durante o render, comparando apenas
  // `cardFilter`) — nunca em reação a um re-fetch de `bills` (ex.: após
  // vincular uma parcela sem fatura ou lançar uma nova compra), pois nesses
  // casos o usuário normalmente está com 'Parcelas sem fatura' selecionado de
  // propósito para conseguir vincular parcelas.
  const [lastCardFilter, setLastCardFilter] = useState(cardFilter);
  if (lastCardFilter !== cardFilter) {
    setLastCardFilter(cardFilter);
    if (cardFilter !== 'all') {
      const currentBillValid = availableBills.some(
        (b) => b.id.toString() === billFilter
      );
      if (!currentBillValid) {
        setBillFilter(availableBills[0] ? availableBills[0].id.toString() : 'none');
      }
    }
  }

  const getCardDisplayName = (cardId: number) => {
    const card = creditCards.find((c) => c.id === cardId);
    if (card) {
      const digitsOnly = card.card_number_masked?.replace(/[^\d]/g, '') || '';
      const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '****';
      const brandName =
        TRANSLATIONS.cardBrands[card.flag as keyof typeof TRANSLATIONS.cardBrands] ||
        card.flag;
      return `${card.name} **** ${last4} - ${brandName}`;
    }
    return 'N/A';
  };

  const getCardName = (cardId: number) => {
    const card = creditCards.find((c) => c.id === cardId);
    if (card) {
      const digitsOnly = card.card_number_masked?.replace(/[^\d]/g, '') || '';
      const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '****';
      return `${card.name} **** ${last4}`;
    }
    return 'N/A';
  };

  const hasOrphanInstallments = installments.some(
    (i) => !i.bill && (cardFilter === 'all' || i.card_id?.toString() === cardFilter)
  );

  // Filtrar parcelas
  const filteredInstallments = useMemo(() => {
    let filtered = [...installments];
    if (cardFilter !== 'all') {
      filtered = filtered.filter((i) => i.card_id?.toString() === cardFilter);
    }
    filtered = filtered.filter((i) =>
      billFilter === 'none' ? !i.bill : i.bill?.toString() === billFilter
    );
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((i) => i.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => (statusFilter === 'paid' ? i.payed : !i.payed));
    }
    return filtered;
  }, [installments, cardFilter, billFilter, categoryFilter, statusFilter]);

  // Agrupar parcelas por fatura
  const installmentsByBill = useMemo(() => {
    const grouped: Record<string, CreditCardInstallment[]> = {};

    filteredInstallments.forEach((installment) => {
      const billKey = installment.bill?.toString() || 'sem-fatura';
      if (!grouped[billKey]) {
        grouped[billKey] = [];
      }
      grouped[billKey].push(installment);
    });

    // Mapear para estrutura com informações da fatura
    return (
      Object.entries(grouped)
        .map(([billKey, billInstallments]) => {
          const bill = bills.find((b) => b.id.toString() === billKey);
          const card = bill ? creditCards.find((c) => c.id === bill.credit_card) : null;

          return {
            key: billKey,
            bill,
            card,
            label: bill
              ? `${translate('months', bill.month)}/${bill.year}`
              : t('pages.creditCardExpenses.orphanBillLabel'),
            period: bill
              ? `${formatDate(bill.invoice_beginning_date, 'dd/MM')} a ${formatDate(bill.invoice_ending_date, 'dd/MM/yyyy')}`
              : '',
            cardName: card ? getCardName(card.id) : '',
            installments: billInstallments.sort(
              (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
            ),
            total: billInstallments.reduce((sum, i) => sum + i.value, 0),
            paid: billInstallments
              .filter((i) => i.payed)
              .reduce((sum, i) => sum + i.value, 0),
            pending: billInstallments
              .filter((i) => !i.payed)
              .reduce((sum, i) => sum + i.value, 0),
          };
        })
        // Ordenar: faturas em aberto primeiro (da mais recente para a mais
        // antiga), depois as parcelas sem fatura vinculada, depois faturas
        // fechadas/pagas (também da mais recente para a mais antiga)
        .sort((a, b) => {
          const groupOf = (bill?: CreditCardBill) =>
            !bill ? 1 : isBillOpen(bill) ? 0 : 2;
          const aGroup = groupOf(a.bill);
          const bGroup = groupOf(b.bill);
          if (aGroup !== bGroup) return aGroup - bGroup;
          if (!a.bill || !b.bill) return 0;
          return compareBillsOpenFirst(a.bill, b.bill);
        })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredInstallments, bills, creditCards]);

  // "Desde" depois de "Até" é uma combinação inválida (o usuário já não
  // consegue montá-la pelo calendário, que trava via minDate/maxDate, mas
  // digitação manual ainda pode escapar disso) — nesse caso ignoramos o
  // intervalo de datas em vez de mostrar uma lista vazia enganosa.
  const purchaseDateRangeInvalid = Boolean(
    purchaseDateFrom && purchaseDateTo && purchaseDateFrom > purchaseDateTo
  );

  // Filtrar compras (usado na visualização "Compras")
  const filteredPurchases = useMemo(() => {
    let filtered = [...purchases];
    if (cardFilter !== 'all') {
      filtered = filtered.filter((p) => p.card.toString() === cardFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) =>
        statusFilter === 'paid'
          ? p.installments.every((i) => i.payed)
          : p.installments.some((i) => !i.payed)
      );
    }
    if (!purchaseDateRangeInvalid) {
      if (purchaseDateFrom) {
        filtered = filtered.filter(
          (p) => (toLocalDate(p.purchase_date) ?? new Date(0)) >= purchaseDateFrom
        );
      }
      if (purchaseDateTo) {
        filtered = filtered.filter(
          (p) => (toLocalDate(p.purchase_date) ?? new Date(0)) <= purchaseDateTo
        );
      }
    }
    return filtered.sort((a, b) => {
      const dateDiff =
        new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.purchase_time ?? '').localeCompare(a.purchase_time ?? '');
    });
  }, [
    purchases,
    cardFilter,
    categoryFilter,
    statusFilter,
    purchaseDateFrom,
    purchaseDateTo,
    purchaseDateRangeInvalid,
  ]);

  const purchasesTotalPages = Math.max(
    1,
    Math.ceil(filteredPurchases.length / PURCHASES_PAGE_SIZE)
  );
  const purchasesCurrentPage = Math.min(purchasesPage, purchasesTotalPages);
  const paginatedPurchases = filteredPurchases.slice(
    (purchasesCurrentPage - 1) * PURCHASES_PAGE_SIZE,
    purchasesCurrentPage * PURCHASES_PAGE_SIZE
  );

  const handleSubmit = async (data: CreditCardPurchaseFormData) => {
    try {
      setIsSubmitting(true);

      if (selectedPurchase) {
        await creditCardPurchasesService.update(selectedPurchase.id, data);
        toast({
          title: t('pages.creditCardExpenses.updated'),
        });
      } else {
        await creditCardPurchasesService.create(data);
        toast({
          title:
            data.total_installments > 1
              ? t('pages.creditCardExpenses.createdWithInstallments', {
                  count: data.total_installments,
                })
              : t('pages.creditCardExpenses.createdDesc'),
        });
      }

      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = () => {
    if (creditCards.length === 0) {
      toast({
        title: t('pages.creditCardExpenses.noCardMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedPurchase(undefined);
    setIsDialogOpen(true);
  };

  const handleEditPurchase = (purchaseId: number) => {
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (purchase) {
      setSelectedPurchase(purchase);
      setIsDialogOpen(true);
    }
  };

  const handleDeletePurchase = async (purchaseId: number) => {
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) return;

    const confirmed = await showConfirm({
      title: t('pages.creditCardExpenses.deleteTitle'),
      description: t('pages.creditCardExpenses.deleteDesc', {
        name: purchase.description,
        count: purchase.total_installments,
      }),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await creditCardPurchasesService.delete(purchaseId);
      toast({
        title: t('pages.creditCardExpenses.deletedDesc'),
      });
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleTogglePaid = async (installment: CreditCardInstallment) => {
    try {
      await creditCardInstallmentsService.update(installment.id, {
        payed: !installment.payed,
      });
      toast({
        title: installment.payed
          ? t('pages.creditCardExpenses.installmentUnpaid')
          : t('pages.creditCardExpenses.installmentPaid'),
      });
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.updateError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleEditInstallment = (installment: CreditCardInstallment) => {
    setSelectedInstallment(installment);
    setIsInstallmentDialogOpen(true);
  };

  const handleInstallmentSubmit = async (data: CreditCardInstallmentUpdateData) => {
    if (!selectedInstallment) return;

    try {
      setIsSubmitting(true);
      await creditCardInstallmentsService.update(selectedInstallment.id, data);
      toast({
        title: t('pages.creditCardExpenses.installmentUpdated'),
      });
      setIsInstallmentDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEligibleBills = (installment: CreditCardInstallment): CreditCardBill[] => {
    const dueDate = new Date(installment.due_date);
    return bills.filter((bill) => {
      if (bill.credit_card !== installment.card_id) return false;
      const start = new Date(bill.invoice_beginning_date);
      const end = new Date(bill.invoice_ending_date);
      return dueDate >= start && dueDate <= end;
    });
  };

  const handleOpenAssignBill = (installment: CreditCardInstallment) => {
    setAssigningInstallment(installment);
    setSelectedAssignBillId('');
    setIsAssignBillDialogOpen(true);
  };

  const handleAssignBill = async () => {
    if (!assigningInstallment || !selectedAssignBillId) return;
    try {
      setIsSubmitting(true);
      await creditCardInstallmentsService.update(assigningInstallment.id, {
        bill: parseInt(selectedAssignBillId),
      });
      toast({
        title: t('pages.creditCardExpenses.installmentLinked'),
      });
      setIsAssignBillDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<CreditCardInstallment>[] = [
    {
      key: 'description',
      label: t('pages.creditCardExpenses.columns.description'),
      render: (installment) => (
        <div>
          <div className="font-medium">{installment.description}</div>
          {installment.merchant && (
            <div className="text-sm">{installment.merchant}</div>
          )}
        </div>
      ),
    },
    {
      key: 'card',
      label: t('pages.creditCardExpenses.columns.card'),
      render: (installment) => (
        <span className="text-sm">
          {installment.card_name || getCardName(installment.card_id || 0)}
        </span>
      ),
    },
    {
      key: 'value',
      label: t('pages.creditCardExpenses.columns.amount'),
      align: 'right',
      render: (installment) => (
        <span className="text-destructive font-semibold">
          {formatCurrency(installment.value)}
        </span>
      ),
    },
    {
      key: 'category',
      label: t('pages.creditCardExpenses.columns.category'),
      render: (installment) => {
        const CatIcon =
          EXPENSE_CATEGORY_ICONS[installment.category ?? ''] ??
          EXPENSE_CATEGORY_ICONS['others'];
        return (
          <Badge variant="secondary" className="gap-xs">
            {CatIcon && <CatIcon className="h-3.5 w-3.5" />}
            {translate('expenseCategories', installment.category ?? '')}
          </Badge>
        );
      },
    },
    {
      key: 'installment',
      label: t('pages.creditCardExpenses.columns.installment'),
      align: 'center',
      render: (installment) => {
        const current = installment.installment_number;
        const total = installment.total_installments ?? 1;
        return (
          <div className="gap-xs flex flex-col items-center">
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(total, 8) }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full',
                    i < current ? 'bg-success' : 'bg-muted'
                  )}
                />
              ))}
              {total > 8 && (
                <span className="text-muted-foreground text-xs">+{total - 8}</span>
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {current}/{total}
            </span>
          </div>
        );
      },
    },
    {
      key: 'payed',
      label: t('pages.creditCardExpenses.columns.status'),
      render: (installment) => (
        <Badge
          variant={installment.payed ? 'success' : 'destructive'}
          className="cursor-pointer"
          onClick={() => handleTogglePaid(installment)}
        >
          {installment.payed
            ? t('pages.creditCardExpenses.status.paid')
            : t('pages.creditCardExpenses.status.pending')}
        </Badge>
      ),
    },
    {
      key: 'due_date',
      label: t('pages.creditCardExpenses.columns.dueDate'),
      render: (installment) => (
        <span className="text-sm">
          {formatDate(installment.due_date, 'dd/MM/yyyy')}
        </span>
      ),
    },
  ];

  // Colunas simplificadas para visualização agrupada (sem coluna de vencimento)
  const groupedColumns: Column<CreditCardInstallment>[] = columns.filter(
    (c) => c.key !== 'due_date'
  );

  const purchaseColumns: Column<CreditCardPurchase>[] = [
    {
      key: 'description',
      label: t('pages.creditCardExpenses.columns.description'),
      render: (purchase) => (
        <div>
          <div className="font-medium">{purchase.description}</div>
          {purchase.merchant && <div className="text-sm">{purchase.merchant}</div>}
        </div>
      ),
    },
    {
      key: 'card',
      label: t('pages.creditCardExpenses.columns.card'),
      render: (purchase) => (
        <span className="text-sm">
          {purchase.card_name || getCardName(purchase.card)}
        </span>
      ),
    },
    {
      key: 'total_value',
      label: t('pages.creditCardExpenses.columns.amount'),
      align: 'right',
      render: (purchase) => (
        <span className="text-destructive font-semibold">
          {formatCurrency(purchase.total_value)}
        </span>
      ),
    },
    {
      key: 'category',
      label: t('pages.creditCardExpenses.columns.category'),
      render: (purchase) => {
        const CatIcon =
          EXPENSE_CATEGORY_ICONS[purchase.category ?? ''] ??
          EXPENSE_CATEGORY_ICONS['others'];
        return (
          <Badge variant="secondary" className="gap-xs">
            {CatIcon && <CatIcon className="h-3.5 w-3.5" />}
            {translate('expenseCategories', purchase.category ?? '')}
          </Badge>
        );
      },
    },
    {
      key: 'installments',
      label: t('pages.creditCardExpenses.columns.installment'),
      align: 'center',
      render: (purchase) => (
        <span className="text-muted-foreground text-sm">
          {purchase.total_installments}x {formatCurrency(purchase.installment_value)}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('pages.creditCardExpenses.columns.status'),
      render: (purchase) => {
        const paid = purchase.installments.every((i) => i.payed);
        const StatusIcon = PAYMENT_STATUS_ICONS[paid ? 'paid' : 'pending'];
        return (
          <Badge variant={paid ? 'success' : 'destructive'} className="gap-xs">
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {paid
              ? t('pages.creditCardExpenses.status.paid')
              : t('pages.creditCardExpenses.status.pending')}
          </Badge>
        );
      },
    },
    {
      key: 'purchase_date',
      label: t('pages.creditCardExpenses.columns.purchaseDate'),
      render: (purchase) => (
        <span className="text-sm">
          {formatDate(purchase.purchase_date, 'dd/MM/yyyy')}
        </span>
      ),
    },
  ];

  return (
    <Wrapper embedded={embedded}>
      <PageHeader
        title={t('pages.creditCardExpenses.title')}
        icon={<ShoppingCart />}
        action={{
          label: t('pages.creditCardExpenses.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {embedded && <TransactionsTabsNav />}

      <div className="space-y-sm">
        <FilterBar
          hasActiveFilters={
            categoryFilter !== 'all' ||
            statusFilter !== 'all' ||
            !!purchaseDateFrom ||
            !!purchaseDateTo
          }
          onClear={() => {
            setCategoryFilter('all');
            setStatusFilter('all');
            setPurchaseDateFrom(undefined);
            setPurchaseDateTo(undefined);
          }}
        >
          <FilterField label={t('pages.creditCardExpenses.viewMode')} icon={LayoutGrid}>
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'bills' | 'purchases')}
            >
              <SelectTrigger
                startIcon={
                  viewMode === 'bills' ? (
                    <Receipt className="h-3.5 w-3.5" />
                  ) : (
                    <ShoppingBag className="h-3.5 w-3.5" />
                  )
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bills" icon={<Receipt className="h-4 w-4" />}>
                  {t('pages.creditCardExpenses.byBill')}
                </SelectItem>
                <SelectItem
                  value="purchases"
                  icon={<ShoppingBag className="h-4 w-4" />}
                >
                  {t('pages.creditCardExpenses.list')}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.filterLabels.card')} icon={CreditCardIcon}>
            <Select value={cardFilter} onValueChange={setCardFilter}>
              <SelectTrigger aria-label={t('pages.creditCardExpenses.columns.card')}>
                <SelectValue placeholder={t('pages.creditCardExpenses.allCards')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.creditCardExpenses.allCards')}
                </SelectItem>
                {creditCards.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {getCardDisplayName(c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField
            label={
              viewMode === 'bills'
                ? t('common.filterLabels.bill')
                : t('common.filterLabels.period')
            }
            icon={viewMode === 'bills' ? Receipt : CalendarDays}
          >
            {viewMode === 'bills' ? (
              <Select
                value={billFilter}
                onValueChange={setBillFilter}
                disabled={availableBills.length === 0 && !hasOrphanInstallments}
              >
                <SelectTrigger aria-label={t('pages.creditCardExpenses.columns.bill')}>
                  <SelectValue
                    placeholder={
                      availableBills.length === 0 && !hasOrphanInstallments
                        ? t('pages.creditCardExpenses.noBills')
                        : t('pages.creditCardExpenses.orphanBillLabel')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(hasOrphanInstallments || billFilter === 'none') && (
                    <SelectItem value="none">
                      {t('pages.creditCardExpenses.orphanBillLabel')}
                    </SelectItem>
                  )}
                  {availableBills.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {translate('months', b.month)}/{b.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="gap-xs flex items-center">
                <DatePicker
                  value={purchaseDateFrom}
                  onChange={setPurchaseDateFrom}
                  placeholder={t('common.actions.filters.fromDate')}
                  maxDate={purchaseDateTo}
                />
                <DatePicker
                  value={purchaseDateTo}
                  onChange={setPurchaseDateTo}
                  placeholder={t('common.actions.filters.toDate')}
                  minDate={purchaseDateFrom}
                />
              </div>
            )}
          </FilterField>
          <FilterField label={t('common.fields.category')} icon={Tag}>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                aria-label={t('pages.creditCardExpenses.columns.category')}
                startIcon={<Tag className="h-3.5 w-3.5" />}
              >
                <SelectValue
                  placeholder={t('pages.creditCardExpenses.allCategories')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.creditCardExpenses.allCategories')}
                </SelectItem>
                {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => {
                  const Icon = EXPENSE_CATEGORY_ICONS[key];
                  return (
                    <SelectItem
                      key={key}
                      value={key}
                      icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                    >
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                aria-label={t('pages.creditCardExpenses.columns.status')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.creditCardExpenses.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.creditCardExpenses.allStatus')}
                </SelectItem>
                <SelectItem
                  value="paid"
                  icon={<PAYMENT_STATUS_ICONS.paid className="h-4 w-4" />}
                >
                  {t('common.status.paid')}
                </SelectItem>
                <SelectItem
                  value="pending"
                  icon={<PAYMENT_STATUS_ICONS.pending className="h-4 w-4" />}
                >
                  {t('common.status.pending')}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
        {purchaseDateRangeInvalid && (
          <p className="text-destructive text-sm">
            {t('pages.creditCardExpenses.dateRangeWarning')}
          </p>
        )}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'bills' ? (
          <motion.div
            key="bills"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-lg"
          >
            {installmentsByBill.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-6 w-6" />}
                title={t('pages.creditCardExpenses.emptyState')}
              />
            ) : (
              installmentsByBill.map(({ key, installments: billInstallments }) => (
                <div key={key}>
                  <DataTable
                    data={billInstallments}
                    columns={groupedColumns}
                    keyExtractor={(installment) => installment.id}
                    isLoading={false}
                    pageSize={LIST_PAGE_SIZE}
                    emptyState={{
                      icon: (
                        <ShoppingCart className="text-muted-foreground h-12 w-12" />
                      ),
                      title: t('pages.creditCardExpenses.noInstallments'),
                    }}
                    actions={(installment) => {
                      const purchase = purchases.find(
                        (p) => p.id === installment.purchase
                      );
                      const isOrphan = !installment.bill;
                      return (
                        <div className="gap-sm flex items-center justify-center">
                          {purchase && (
                            <ReceiptButton
                              source={{
                                type: 'credit_card_purchase',
                                data: purchase,
                              }}
                              memberName={getMemberDisplayName(
                                installment.member_name,
                                user
                              )}
                            />
                          )}
                          {isOrphan && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenAssignBill(installment)}
                              aria-label={t('pages.creditCardExpenses.assignBillBtn')}
                              title={t('pages.creditCardExpenses.assignBillBtn')}
                            >
                              <Link2
                                className="text-primary h-4 w-4"
                                aria-hidden="true"
                              />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditInstallment(installment)}
                            aria-label={t(
                              'pages.creditCardExpenses.editInstallmentLabel'
                            )}
                            title={t('pages.creditCardExpenses.editInstallmentLabel')}
                          >
                            <DollarSign
                              className="text-primary h-4 w-4"
                              aria-hidden="true"
                            />
                          </Button>
                          <Can action="change">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPurchase(installment.purchase)}
                              aria-label={t(
                                'pages.creditCardExpenses.editPurchaseLabel'
                              )}
                              title={t('pages.creditCardExpenses.editPurchaseLabel')}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </Can>
                          <Can action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePurchase(installment.purchase)}
                              aria-label={t(
                                'pages.creditCardExpenses.deletePurchaseLabel'
                              )}
                              title={t('pages.creditCardExpenses.deletePurchaseLabel')}
                            >
                              <Trash2
                                className="text-destructive h-4 w-4"
                                aria-hidden="true"
                              />
                            </Button>
                          </Can>
                        </div>
                      );
                    }}
                  />
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="purchases"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <DataTable
              data={paginatedPurchases}
              columns={purchaseColumns}
              keyExtractor={(purchase) => purchase.id}
              isLoading={isLoading}
              emptyState={{
                icon: <ShoppingCart className="text-muted-foreground h-12 w-12" />,
                title: t('pages.creditCardExpenses.emptyPurchasesState'),
              }}
              pagination={{
                page: purchasesCurrentPage,
                pageSize: PURCHASES_PAGE_SIZE,
                total: filteredPurchases.length,
                onPageChange: setPurchasesPage,
              }}
              actions={(purchase) => (
                <div className="gap-sm flex items-center justify-center">
                  <ReceiptButton
                    source={{ type: 'credit_card_purchase', data: purchase }}
                    memberName={getMemberDisplayName(purchase.member_name, user)}
                  />
                  <Can action="change">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditPurchase(purchase.id)}
                      aria-label={t('pages.creditCardExpenses.editPurchaseLabel')}
                      title={t('pages.creditCardExpenses.editPurchaseLabel')}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Can>
                  <Can action="delete">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePurchase(purchase.id)}
                      aria-label={t('pages.creditCardExpenses.deletePurchaseLabel')}
                      title={t('pages.creditCardExpenses.deletePurchaseLabel')}
                    >
                      <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Can>
                </div>
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle mode={selectedPurchase ? 'edit' : 'create'}>
              {selectedPurchase
                ? t('pages.creditCardExpenses.editPurchaseTitle')
                : t('pages.creditCardExpenses.newPurchaseTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedPurchase
                  ? t('pages.creditCardExpenses.editPurchaseDesc')
                  : t('pages.creditCardExpenses.newPurchaseDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <CreditCardPurchaseForm
            purchase={selectedPurchase}
            creditCards={creditCards}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isInstallmentDialogOpen} onOpenChange={setIsInstallmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle mode="edit">
              {t('pages.creditCardExpenses.editInstallmentTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.creditCardExpenses.editInstallmentDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {selectedInstallment && (
            <CreditCardInstallmentForm
              installment={selectedInstallment}
              bills={bills}
              onSubmit={handleInstallmentSubmit}
              onCancel={() => setIsInstallmentDialogOpen(false)}
              isLoading={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignBillDialogOpen} onOpenChange={setIsAssignBillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle icon={Receipt}>
              {t('pages.creditCardExpenses.assignBillTitle')}
            </DialogTitle>
            <DialogDescription>
              {assigningInstallment && (
                <>
                  {t('pages.creditCardExpenses.assignBillDesc')}{' '}
                  <span className="font-medium">
                    {formatDate(assigningInstallment.due_date, 'dd/MM/yyyy')}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {assigningInstallment &&
            (() => {
              const eligibleBills = getEligibleBills(assigningInstallment);
              return (
                <div className="space-y-md">
                  {eligibleBills.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {t('pages.creditCardExpenses.noEligibleBills')}
                    </p>
                  ) : (
                    <Select
                      value={selectedAssignBillId}
                      onValueChange={setSelectedAssignBillId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('pages.creditCardExpenses.allBills')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleBills.map((bill) => (
                          <SelectItem key={bill.id} value={bill.id.toString()}>
                            {translate('months', bill.month)}/{bill.year} (
                            {formatDate(bill.invoice_beginning_date, 'dd/MM')}
                            {' – '}
                            {formatDate(bill.invoice_ending_date, 'dd/MM/yyyy')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="dialog-footer gap-sm flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsAssignBillDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                      {t('common.actions.cancel')}
                    </Button>
                    <Button
                      onClick={() => void handleAssignBill()}
                      disabled={
                        !selectedAssignBillId ||
                        isSubmitting ||
                        eligibleBills.length === 0
                      }
                    >
                      <Link2 className="h-4 w-4" />
                      {t('pages.creditCardExpenses.assignBillBtn')}
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
