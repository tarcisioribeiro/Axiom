/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  ShoppingCart,
  Calendar,
  DollarSign,
  Link2,
  Tag,
  CircleDot,
} from 'lucide-react';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { CreditCardInstallmentForm } from '@/components/credit-cards/CreditCardInstallmentForm';
import { CreditCardPurchaseForm } from '@/components/credit-cards/CreditCardPurchaseForm';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  translate,
  TRANSLATIONS,
  EXPENSE_CATEGORIES_CANONICAL,
} from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { pageVariants } from '@/lib/animations';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
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

const PURCHASES_PAGE_SIZE = 20;

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
  const [billFilter, setBillFilter] = useState<string>('all');
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
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
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
    setBillFilter(sortedBills[0] ? sortedBills[0].id.toString() : 'all');
  }

  // Reseta o filtro de fatura para a primeira fatura em aberto sempre que o
  // cartão selecionado MUDA (derivado durante o render, comparando apenas
  // `cardFilter`) — nunca em reação a um re-fetch de `bills` (ex.: após
  // vincular uma parcela sem fatura ou lançar uma nova compra), pois nesses
  // casos o usuário normalmente está com 'Todas as Faturas' selecionado de
  // propósito para conseguir vincular parcelas.
  const [lastCardFilter, setLastCardFilter] = useState(cardFilter);
  if (lastCardFilter !== cardFilter) {
    setLastCardFilter(cardFilter);
    if (cardFilter !== 'all') {
      const currentBillValid = availableBills.some(
        (b) => b.id.toString() === billFilter
      );
      if (!currentBillValid) {
        setBillFilter(availableBills[0] ? availableBills[0].id.toString() : 'all');
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

  // Filtrar parcelas
  const filteredInstallments = useMemo(() => {
    let filtered = [...installments];
    if (cardFilter !== 'all') {
      filtered = filtered.filter((i) => i.card_id?.toString() === cardFilter);
    }
    if (billFilter !== 'all') {
      filtered = filtered.filter((i) => i.bill?.toString() === billFilter);
    }
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
    return filtered.sort(
      (a, b) =>
        new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
    );
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
          description: t('pages.creditCardExpenses.updatedDesc'),
        });
      } else {
        await creditCardPurchasesService.create(data);
        toast({
          title: t('pages.creditCardExpenses.created'),
          description:
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
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = () => {
    if (creditCards.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.creditCardExpenses.noCardMsg'),
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
        title: t('pages.creditCardExpenses.deleted'),
        description: t('pages.creditCardExpenses.deletedDesc'),
      });
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
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
        description: t('pages.creditCardExpenses.installmentStatusDesc'),
      });
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.updateError'),
        description: getErrorMessage(error),
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
        description: t('pages.creditCardExpenses.installmentUpdatedDesc'),
      });
      setIsInstallmentDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
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
        description: t('pages.creditCardExpenses.installmentLinkedDesc'),
      });
      setIsAssignBillDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-expenses'] });
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

  const totalInstallments = filteredInstallments.reduce((sum, i) => sum + i.value, 0);
  const totalPaid = filteredInstallments
    .filter((i) => i.payed)
    .reduce((sum, i) => sum + i.value, 0);
  const totalPending = filteredInstallments
    .filter((i) => !i.payed)
    .reduce((sum, i) => sum + i.value, 0);

  const categoryBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const i of filteredInstallments) {
      const cat = i.category ?? 'others';
      groups[cat] = (groups[cat] ?? 0) + i.value;
    }
    return Object.entries(groups)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([cat, amount]) => ({
        cat,
        pct: totalInstallments > 0 ? (amount / totalInstallments) * 100 : 0,
      }));
  }, [filteredInstallments, totalInstallments]);

  const totalPurchasesValue = filteredPurchases.reduce(
    (sum, p) => sum + p.total_value,
    0
  );
  const totalPurchasesPaid = filteredPurchases
    .filter((p) => p.installments.every((i) => i.payed))
    .reduce((sum, p) => sum + p.total_value, 0);
  const totalPurchasesPending = totalPurchasesValue - totalPurchasesPaid;

  const purchasesCategoryBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const p of filteredPurchases) {
      const cat = p.category ?? 'others';
      groups[cat] = (groups[cat] ?? 0) + p.total_value;
    }
    return Object.entries(groups)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([cat, amount]) => ({
        cat,
        pct: totalPurchasesValue > 0 ? (amount / totalPurchasesValue) * 100 : 0,
      }));
  }, [filteredPurchases, totalPurchasesValue]);

  // Estatísticas exibidas (StatCards, breakdown por categoria e resumo do
  // filtro) seguem o dataset da visualização ativa, para não mostrarem
  // totais de parcelas enquanto o usuário navega pelas compras (e vice-versa).
  const isPurchasesView = viewMode === 'purchases';
  const displayTotal = isPurchasesView ? totalPurchasesValue : totalInstallments;
  const displayPaid = isPurchasesView ? totalPurchasesPaid : totalPaid;
  const displayPending = isPurchasesView ? totalPurchasesPending : totalPending;
  const displayCategoryBreakdown = isPurchasesView
    ? purchasesCategoryBreakdown
    : categoryBreakdown;
  const displayCount = isPurchasesView
    ? filteredPurchases.length
    : filteredInstallments.length;

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
        return (
          <Badge variant={paid ? 'success' : 'destructive'}>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title={t('pages.creditCardExpenses.totalPaid')}
          value={formatCurrency(displayPaid)}
          accentColor="green"
        />
        <StatCard
          title={t('pages.creditCardExpenses.totalPending')}
          value={formatCurrency(displayPending)}
          accentColor="orange"
        />
        <StatCard
          title={t('pages.creditCardExpenses.totalAmount')}
          value={formatCurrency(displayTotal)}
          accentColor="red"
        />
      </div>

      {displayCategoryBreakdown.length > 1 && (
        <div className="bg-card p-md rounded-lg border">
          <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('pages.creditCardExpenses.byCategory')}
          </p>
          <div className="bg-muted flex h-2 overflow-hidden rounded-full">
            {displayCategoryBreakdown.map(({ cat, pct }, i) => (
              <div
                key={cat}
                className={`h-full transition-[width] ${['bg-primary', 'bg-success', 'bg-warning', 'bg-info', 'bg-accent', 'bg-destructive'][i % 6]}`}
                style={{ width: `${pct}%` }}
                title={`${translateCategory(cat, 'expense')}: ${pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="mt-sm gap-md flex flex-wrap">
            {displayCategoryBreakdown.map(({ cat, pct }, i) => (
              <div key={cat} className="gap-xs flex items-center">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${['bg-primary', 'bg-success', 'bg-warning', 'bg-info', 'bg-accent', 'bg-destructive'][i % 6]}`}
                />
                <span className="text-muted-foreground text-xs">
                  {translateCategory(cat, 'expense')} · {Math.round(pct)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-md bg-card p-md rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="gap-sm flex items-center">
            <Filter className="h-4 w-4" />
            <span className="font-semibold">{t('common.actions.filter')}</span>
          </div>
          <div className="gap-sm flex items-center">
            <span className="text-sm">{t('pages.creditCardExpenses.viewMode')}</span>
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'bills' | 'purchases')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bills">
                  {t('pages.creditCardExpenses.byBill')}
                </SelectItem>
                <SelectItem value="purchases">
                  {t('pages.creditCardExpenses.list')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-xs">
            <span className="text-muted-foreground text-sm">
              {t('pages.creditCardExpenses.columns.card')}
            </span>
            <Select value={cardFilter} onValueChange={setCardFilter}>
              <SelectTrigger>
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
          </div>
          {viewMode === 'bills' ? (
            <div className="space-y-xs">
              <span className="text-muted-foreground text-sm">
                {t('pages.creditCardExpenses.columns.bill')}
              </span>
              <Select
                value={billFilter}
                onValueChange={setBillFilter}
                disabled={availableBills.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableBills.length === 0
                        ? t('pages.creditCardExpenses.noBills')
                        : t('pages.creditCardExpenses.allBills')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('pages.creditCardExpenses.allBills')}
                  </SelectItem>
                  {availableBills.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {translate('months', b.month)}/{b.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="gap-sm grid grid-cols-2">
              <div className="space-y-xs">
                <span className="text-muted-foreground text-sm">
                  {t('pages.creditCardExpenses.dateFrom')}
                </span>
                <DatePicker
                  value={purchaseDateFrom}
                  onChange={setPurchaseDateFrom}
                  placeholder={t('common.actions.filters.fromDate')}
                  clearable
                  maxDate={purchaseDateTo}
                />
              </div>
              <div className="space-y-xs">
                <span className="text-muted-foreground text-sm">
                  {t('pages.creditCardExpenses.dateTo')}
                </span>
                <DatePicker
                  value={purchaseDateTo}
                  onChange={setPurchaseDateTo}
                  placeholder={t('common.actions.filters.toDate')}
                  clearable
                  minDate={purchaseDateFrom}
                />
              </div>
            </div>
          )}
          <div className="space-y-xs">
            <span className="text-muted-foreground text-sm">
              {t('pages.creditCardExpenses.columns.category')}
            </span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger startIcon={<Tag className="h-3.5 w-3.5" />}>
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
          </div>
          <div className="space-y-xs">
            <span className="text-muted-foreground text-sm">
              {t('pages.creditCardExpenses.columns.status')}
            </span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger startIcon={<CircleDot className="h-3.5 w-3.5" />}>
                <SelectValue placeholder={t('pages.creditCardExpenses.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.creditCardExpenses.allStatus')}
                </SelectItem>
                <SelectItem value="paid">{t('common.status.paid')}</SelectItem>
                <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {purchaseDateRangeInvalid && (
          <p className="text-destructive text-sm">
            {t('pages.creditCardExpenses.dateRangeWarning')}
          </p>
        )}
        <div className="pt-sm flex items-center justify-between border-t">
          <span className="text-sm">
            {t(
              isPurchasesView
                ? 'pages.creditCardExpenses.foundPurchases'
                : 'pages.creditCardExpenses.foundInstallments',
              { count: displayCount }
            )}
          </span>
          <div className="gap-md flex items-center">
            <span className="text-sm">
              <span className="text-muted-foreground">
                {t('pages.creditCardExpenses.totalPaid')}
              </span>{' '}
              <span className="text-success font-semibold">
                {formatCurrency(displayPaid)}
              </span>
            </span>
            <span className="text-sm">
              <span className="text-muted-foreground">
                {t('pages.creditCardExpenses.totalPending')}
              </span>{' '}
              <span className="text-warning font-semibold">
                {formatCurrency(displayPending)}
              </span>
            </span>
            <span className="text-destructive text-lg font-bold">
              {t('pages.creditCardExpenses.totalAmount')} {formatCurrency(displayTotal)}
            </span>
          </div>
        </div>
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
              <EmptyState message={t('pages.creditCardExpenses.emptyState')} />
            ) : (
              installmentsByBill.map(
                ({
                  key,
                  bill,
                  label,
                  period,
                  cardName,
                  installments: billInstallments,
                  total,
                  paid,
                  pending,
                }) => (
                  <Card key={key}>
                    <CardHeader className="pb-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="gap-sm flex items-center text-lg">
                            <Calendar className="text-primary h-5 w-5" />
                            {key === 'sem-fatura'
                              ? label
                              : t('pages.creditCardExpenses.billLabel', { label })}
                            {bill && (
                              <Badge
                                variant={
                                  bill.status === 'paid'
                                    ? 'success'
                                    : bill.status === 'overdue'
                                      ? 'destructive'
                                      : bill.status === 'closed'
                                        ? 'secondary'
                                        : 'outline'
                                }
                                className="text-xs"
                              >
                                {bill.status === 'paid'
                                  ? t('pages.creditCardExpenses.status.paid')
                                  : bill.status === 'overdue'
                                    ? t('pages.creditCardExpenses.status.overdue')
                                    : bill.status === 'closed'
                                      ? t('pages.creditCardExpenses.status.closed')
                                      : t('pages.creditCardExpenses.status.open')}
                              </Badge>
                            )}
                          </CardTitle>
                          {period && (
                            <p className="mt-xs text-sm">
                              {cardName && (
                                <span className="font-medium">{cardName}</span>
                              )}
                              {cardName && period && ' • '}
                              {period}
                            </p>
                          )}
                          {bill && (
                            <div className="mt-sm space-y-xs">
                              <div className="text-muted-foreground flex items-center justify-between text-xs">
                                <span>
                                  {t('pages.creditCardExpenses.billPaidProgress')}
                                </span>
                                <span>
                                  {total > 0 ? Math.round((paid / total) * 100) : 0}%
                                </span>
                              </div>
                              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                <div
                                  className="bg-success h-full rounded-full"
                                  style={{
                                    width: `${total > 0 ? (paid / total) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="gap-md flex items-center">
                          <span className="text-sm">
                            <span className="text-muted-foreground">
                              {t('pages.creditCardExpenses.totalPaid')}
                            </span>{' '}
                            <span className="text-success font-semibold">
                              {formatCurrency(paid)}
                            </span>
                          </span>
                          <span className="text-sm">
                            <span className="text-muted-foreground">
                              {t('pages.creditCardExpenses.totalPending')}
                            </span>{' '}
                            <span className="text-warning font-semibold">
                              {formatCurrency(pending)}
                            </span>
                          </span>
                          <span className="text-destructive text-lg font-bold">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <DataTable
                        data={billInstallments}
                        columns={groupedColumns}
                        keyExtractor={(installment) => installment.id}
                        isLoading={false}
                        emptyState={{
                          icon: (
                            <ShoppingCart className="text-muted-foreground h-12 w-12" />
                          ),
                          message: t('pages.creditCardExpenses.noInstallments'),
                        }}
                        actions={(installment) => {
                          const purchase = purchases.find(
                            (p) => p.id === installment.purchase
                          );
                          const isOrphan = !installment.bill;
                          return (
                            <div className="gap-sm flex items-center justify-end">
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
                                  aria-label={t(
                                    'pages.creditCardExpenses.assignBillBtn'
                                  )}
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
                                title={t(
                                  'pages.creditCardExpenses.editInstallmentLabel'
                                )}
                              >
                                <DollarSign
                                  className="text-primary h-4 w-4"
                                  aria-hidden="true"
                                />
                              </Button>
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDeletePurchase(installment.purchase)
                                }
                                aria-label={t(
                                  'pages.creditCardExpenses.deletePurchaseLabel'
                                )}
                                title={t(
                                  'pages.creditCardExpenses.deletePurchaseLabel'
                                )}
                              >
                                <Trash2
                                  className="text-destructive h-4 w-4"
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                          );
                        }}
                      />
                    </CardContent>
                  </Card>
                )
              )
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
                message: t('pages.creditCardExpenses.emptyPurchasesState'),
              }}
              pagination={{
                page: purchasesCurrentPage,
                pageSize: PURCHASES_PAGE_SIZE,
                total: filteredPurchases.length,
                onPageChange: setPurchasesPage,
              }}
              actions={(purchase) => (
                <div className="gap-sm flex items-center justify-end">
                  <ReceiptButton
                    source={{ type: 'credit_card_purchase', data: purchase }}
                    memberName={getMemberDisplayName(purchase.member_name, user)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditPurchase(purchase.id)}
                    aria-label={t('pages.creditCardExpenses.editPurchaseLabel')}
                    title={t('pages.creditCardExpenses.editPurchaseLabel')}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePurchase(purchase.id)}
                    aria-label={t('pages.creditCardExpenses.deletePurchaseLabel')}
                    title={t('pages.creditCardExpenses.deletePurchaseLabel')}
                  >
                    <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPurchase
                ? t('pages.creditCardExpenses.editPurchaseTitle')
                : t('pages.creditCardExpenses.newPurchaseTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedPurchase
                ? t('pages.creditCardExpenses.editPurchaseDesc')
                : t('pages.creditCardExpenses.newPurchaseDesc')}
            </DialogDescription>
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
        <DialogContent className="custom-scrollbar max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('pages.creditCardExpenses.editInstallmentTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.creditCardExpenses.editInstallmentDesc')}
            </DialogDescription>
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
            <DialogTitle>{t('pages.creditCardExpenses.assignBillTitle')}</DialogTitle>
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
                  <div className="gap-sm flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsAssignBillDialogOpen(false)}
                      disabled={isSubmitting}
                    >
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
