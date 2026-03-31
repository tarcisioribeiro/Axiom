import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  ShoppingCart,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { CreditCardInstallmentForm } from '@/components/credit-cards/CreditCardInstallmentForm';
import { CreditCardPurchaseForm } from '@/components/credit-cards/CreditCardPurchaseForm';
import { ReceiptButton } from '@/components/receipts';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardInstallmentsService } from '@/services/credit-card-installments-service';
import { creditCardPurchasesService } from '@/services/credit-card-purchases-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  CreditCardPurchase,
  CreditCardPurchaseFormData,
  CreditCardInstallment,
  CreditCardInstallmentUpdateData,
  CreditCard,
  CreditCardBill,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function CreditCardExpenses() {
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<CreditCardPurchase[]>([]);
  const [installments, setInstallments] = useState<CreditCardInstallment[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInstallmentDialogOpen, setIsInstallmentDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<
    CreditCardPurchase | undefined
  >();
  const [selectedInstallment, setSelectedInstallment] = useState<
    CreditCardInstallment | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [billFilter, setBillFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  useEffect(() => {
    void loadData();
  }, []);

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

  // Faturas filtradas pelo cartão selecionado e ordenadas (abertas primeiro em ordem crescente, depois fechadas/pagas em ordem crescente)
  const availableBills = useMemo(() => {
    const filtered =
      cardFilter === 'all'
        ? [...bills]
        : bills.filter((b) => b.credit_card.toString() === cardFilter);

    // Sort: open bills first (ascending by date), then closed/paid bills (ascending by date)
    return filtered.sort((a, b) => {
      const aMonth = MONTH_TO_NUMBER[a.month] || 1;
      const bMonth = MONTH_TO_NUMBER[b.month] || 1;

      // Check if bill is open (not paid and not closed)
      const aIsOpen = a.status !== 'paid' && a.status !== 'closed';
      const bIsOpen = b.status !== 'paid' && b.status !== 'closed';

      // Open bills before closed/paid ones
      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;

      // Within same group, sort by date ascending (oldest to newest)
      const aDate = new Date(parseInt(a.year), aMonth - 1);
      const bDate = new Date(parseInt(b.year), bMonth - 1);
      return aDate.getTime() - bDate.getTime();
    });
  }, [cardFilter, bills]);

  // Reset bill filter when card changes
  useEffect(() => {
    if (cardFilter !== 'all') {
      const currentBillValid = availableBills.some(
        (b) => b.id.toString() === billFilter
      );
      if (!currentBillValid) {
        setBillFilter('all');
      }
    }
  }, [cardFilter, availableBills, billFilter]);

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

  const loadData = async (preserveFilters = false) => {
    try {
      setIsLoading(true);
      // Salvar filtros atuais se necessário
      const currentCardFilter = cardFilter;
      const currentBillFilter = billFilter;

      const [purchasesData, installmentsData, cardsData, billsData] = await Promise.all(
        [
          creditCardPurchasesService.getAll(),
          creditCardInstallmentsService.getAll(),
          creditCardsService.getAll(),
          creditCardBillsService.getAll(),
        ]
      );
      setPurchases(purchasesData);
      setInstallments(installmentsData);
      setCreditCards(cardsData);
      setBills(billsData);

      // Se deve preservar filtros e eles são válidos, restaurá-los
      if (preserveFilters) {
        // Verificar se o cartão selecionado ainda existe
        const cardStillExists =
          currentCardFilter === 'all' ||
          cardsData.some((c) => c.id.toString() === currentCardFilter);
        if (cardStillExists) {
          setCardFilter(currentCardFilter);
          // Verificar se a fatura selecionada ainda existe e pertence ao cartão
          const billStillValid =
            currentBillFilter === 'all' ||
            billsData.some(
              (b) =>
                b.id.toString() === currentBillFilter &&
                (currentCardFilter === 'all' ||
                  b.credit_card.toString() === currentCardFilter)
            );
          if (billStillValid) {
            setBillFilter(currentBillFilter);
          }
        }
        return;
      }

      // Selecionar automaticamente o primeiro cartão e sua primeira fatura ABERTA
      if (cardsData.length > 0) {
        const firstCardId = cardsData[0].id.toString();
        setCardFilter(firstCardId);

        // Encontrar a primeira fatura ABERTA do primeiro cartão (não paga e não fechada)
        const firstCardBills = billsData.filter(
          (b) => b.credit_card.toString() === firstCardId
        );
        // Ordenar: abertas primeiro (por data crescente), depois fechadas/pagas
        const sortedBills = [...firstCardBills].sort((a, b) => {
          const aMonth = MONTH_TO_NUMBER[a.month] || 1;
          const bMonth = MONTH_TO_NUMBER[b.month] || 1;
          const aIsOpen = a.status !== 'paid' && a.status !== 'closed';
          const bIsOpen = b.status !== 'paid' && b.status !== 'closed';
          if (aIsOpen && !bIsOpen) return -1;
          if (!aIsOpen && bIsOpen) return 1;
          const aDate = new Date(parseInt(a.year), aMonth - 1);
          const bDate = new Date(parseInt(b.year), bMonth - 1);
          return aDate.getTime() - bDate.getTime();
        });
        // Selecionar a primeira fatura aberta, ou a primeira se todas estiverem fechadas
        const firstOpenBill = sortedBills.find(
          (b) => b.status !== 'paid' && b.status !== 'closed'
        );
        if (firstOpenBill) {
          setBillFilter(firstOpenBill.id.toString());
        } else if (sortedBills.length > 0) {
          setBillFilter(sortedBills[0].id.toString());
        }
      }
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
              ? `${TRANSLATIONS.months[bill.month as keyof typeof TRANSLATIONS.months]}/${bill.year}`
              : 'Sem Fatura',
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
        // Ordenar: abertas primeiro (por data crescente), depois fechadas/pagas (por data crescente)
        .sort((a, b) => {
          if (!a.bill) return 1;
          if (!b.bill) return -1;
          // Check if bill is open
          const aIsOpen = a.bill.status !== 'paid' && a.bill.status !== 'closed';
          const bIsOpen = b.bill.status !== 'paid' && b.bill.status !== 'closed';
          // Open bills first
          if (aIsOpen && !bIsOpen) return -1;
          if (!aIsOpen && bIsOpen) return 1;
          // Within same group, sort by date ascending (oldest to newest)
          return (
            new Date(a.bill.invoice_beginning_date).getTime() -
            new Date(b.bill.invoice_beginning_date).getTime()
          );
        })
    );
  }, [filteredInstallments, bills, creditCards]);

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
      void loadData(true);
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
      void loadData(true);
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
      void loadData(true);
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
      void loadData(true);
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
        <span className="font-semibold text-destructive">
          {formatCurrency(installment.value)}
        </span>
      ),
    },
    {
      key: 'category',
      label: t('pages.creditCardExpenses.columns.category'),
      render: (installment) => (
        <Badge variant="secondary">
          {translate('expenseCategories', installment.category || '')}
        </Badge>
      ),
    },
    {
      key: 'installment',
      label: t('pages.creditCardExpenses.columns.installment'),
      align: 'center',
      render: (installment) => (
        <span className="text-sm">
          {installment.installment_number}/{installment.total_installments}
        </span>
      ),
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
          {installment.payed ? 'Paga' : 'Pendente'}
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

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.creditCardExpenses.title')}
        icon={<ShoppingCart />}
        action={{
          label: t('pages.creditCardExpenses.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-semibold">{t('common.actions.filter')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{t('pages.creditCardExpenses.viewMode')}</span>
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'list' | 'grouped')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grouped">
                  {t('pages.creditCardExpenses.byBill')}
                </SelectItem>
                <SelectItem value="list">
                  {t('pages.creditCardExpenses.list')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  {TRANSLATIONS.months[b.month as keyof typeof TRANSLATIONS.months]}/
                  {b.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.creditCardExpenses.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.creditCardExpenses.allCategories')}
              </SelectItem>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.creditCardExpenses.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.creditCardExpenses.allStatus')}
              </SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm">
            {t('pages.creditCardExpenses.foundInstallments', {
              count: filteredInstallments.length,
            })}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              <span className="text-muted-foreground">
                {t('pages.creditCardExpenses.totalPaid')}
              </span>{' '}
              <span className="font-semibold text-success">
                {formatCurrency(totalPaid)}
              </span>
            </span>
            <span className="text-sm">
              <span className="text-muted-foreground">
                {t('pages.creditCardExpenses.totalPending')}
              </span>{' '}
              <span className="font-semibold text-warning">
                {formatCurrency(totalPending)}
              </span>
            </span>
            <span className="text-lg font-bold text-destructive">
              {t('pages.creditCardExpenses.totalAmount')}{' '}
              {formatCurrency(totalInstallments)}
            </span>
          </div>
        </div>
      </div>

      {viewMode === 'grouped' ? (
        <div className="space-y-6">
          {installmentsByBill.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                {t('pages.creditCardExpenses.emptyState')}
              </CardContent>
            </Card>
          ) : (
            installmentsByBill.map(
              ({
                key,
                label,
                period,
                cardName,
                installments: billInstallments,
                total,
                paid,
                pending,
              }) => (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Calendar className="h-5 w-5 text-primary" />
                          {t('pages.creditCardExpenses.billLabel', { label })}
                        </CardTitle>
                        {period && (
                          <p className="mt-1 text-sm">
                            {cardName && (
                              <span className="font-medium">{cardName}</span>
                            )}
                            {cardName && period && ' • '}
                            {period}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.creditCardExpenses.totalPaid')}
                          </span>{' '}
                          <span className="font-semibold text-success">
                            {formatCurrency(paid)}
                          </span>
                        </span>
                        <span className="text-sm">
                          <span className="text-muted-foreground">
                            {t('pages.creditCardExpenses.totalPending')}
                          </span>{' '}
                          <span className="font-semibold text-warning">
                            {formatCurrency(pending)}
                          </span>
                        </span>
                        <span className="text-lg font-bold text-destructive">
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
                          <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                        ),
                        message: t('pages.creditCardExpenses.noInstallments'),
                      }}
                      actions={(installment) => {
                        const purchase = purchases.find(
                          (p) => p.id === installment.purchase
                        );
                        return (
                          <div className="flex items-center justify-end gap-2">
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
                                className="h-4 w-4 text-primary"
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
                              onClick={() => handleDeletePurchase(installment.purchase)}
                              aria-label={t(
                                'pages.creditCardExpenses.deletePurchaseLabel'
                              )}
                              title={t('pages.creditCardExpenses.deletePurchaseLabel')}
                            >
                              <Trash2
                                className="h-4 w-4 text-destructive"
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
        </div>
      ) : (
        <DataTable
          data={filteredInstallments}
          columns={columns}
          keyExtractor={(installment) => installment.id}
          isLoading={isLoading}
          emptyState={{
            icon: <ShoppingCart className="h-12 w-12 text-muted-foreground" />,
            message: t('pages.creditCardExpenses.emptyState'),
          }}
          actions={(installment) => {
            const purchase = purchases.find((p) => p.id === installment.purchase);
            return (
              <div className="flex items-center justify-end gap-2">
                {purchase && (
                  <ReceiptButton
                    source={{ type: 'credit_card_purchase', data: purchase }}
                    memberName={getMemberDisplayName(installment.member_name, user)}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditInstallment(installment)}
                  aria-label={t('pages.creditCardExpenses.editInstallmentLabel')}
                  title={t('pages.creditCardExpenses.editInstallmentLabel')}
                >
                  <DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditPurchase(installment.purchase)}
                  aria-label={t('pages.creditCardExpenses.editPurchaseLabel')}
                  title={t('pages.creditCardExpenses.editPurchaseLabel')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeletePurchase(installment.purchase)}
                  aria-label={t('pages.creditCardExpenses.deletePurchaseLabel')}
                  title={t('pages.creditCardExpenses.deletePurchaseLabel')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            );
          }}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
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
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-lg overflow-y-auto">
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
    </PageContainer>
  );
}
