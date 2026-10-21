/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  CreditCard as CreditCardIcon,
  Pencil,
  Receipt,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState, useEffect, useMemo, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { DataTable, type Column } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { LIST_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { BillPaymentForm } from '@/components/credit-cards/BillPaymentForm';
import { BillPurchasesDialog } from '@/components/credit-cards/BillPurchasesDialog';
import { CreditCardBillForm } from '@/components/credit-cards/CreditCardBillForm';
import { RenegotiateBillDialog } from '@/components/credit-cards/RenegotiateBillDialog';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { translate, TRANSLATIONS } from '@/config/constants';
import { CREDIT_CARD_BILL_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { sortCreditCardBills } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useAuthStore } from '@/stores/auth-store';
import { useBreadcrumbExtraStore } from '@/stores/breadcrumb-extra-store';
import type {
  Account,
  CreditCardBill,
  CreditCardBillFormData,
  CreditCard,
  BillPaymentFormData,
  RenegotiateBillFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EMPTY_BILLS: CreditCardBill[] = [];
const EMPTY_CARDS: CreditCard[] = [];
const EMPTY_ACCOUNTS: Account[] = [];

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function CreditCardBills({
  embedded = false,
  initialCardFilter = 'all',
  createRef,
}: {
  embedded?: boolean;
  initialCardFilter?: string;
  /** Recebe a função de criar fatura, para o botão "Nova Fatura" do cabeçalho acima das abas. */
  createRef?: RefObject<(() => void) | undefined>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRenegotiateDialogOpen, setIsRenegotiateDialogOpen] = useState(false);
  const [isPurchasesDialogOpen, setIsPurchasesDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditCardBill | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [isRenegotiateSubmitting, setIsRenegotiateSubmitting] = useState(false);
  const [cardFilter, setCardFilter] = useState<string>(initialCardFilter);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [dueDateStart, setDueDateStart] = useState<Date | undefined>();
  const [dueDateEnd, setDueDateEnd] = useState<Date | undefined>();
  const { toast } = useToast();
  const { showConfirm, showAlert } = useAlertDialog();
  const { user } = useAuthStore();
  const setExtraSubLabel = useBreadcrumbExtraStore((s) => s.setExtraSubLabel);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['credit-card-bills'],
    queryFn: async () => {
      try {
        const [billsData, cardsData, accountsData] = await Promise.all([
          creditCardBillsService.getAll(),
          creditCardsService.getAll(),
          accountsService.getAll(),
        ]);
        return { bills: billsData, creditCards: cardsData, accounts: accountsData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return {
          bills: EMPTY_BILLS,
          creditCards: EMPTY_CARDS,
          accounts: EMPTY_ACCOUNTS,
        };
      }
    },
  });
  const bills = pageData?.bills ?? EMPTY_BILLS;
  const creditCards = pageData?.creditCards ?? EMPTY_CARDS;
  const accounts = pageData?.accounts ?? EMPTY_ACCOUNTS;

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

  const filteredBills = useMemo(() => {
    let filtered = [...bills];
    if (cardFilter !== 'all') {
      filtered = filtered.filter((b) => b.credit_card.toString() === cardFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }
    if (yearFilter !== 'all') {
      filtered = filtered.filter((b) => b.year === yearFilter);
    }
    if (dueDateStart) {
      filtered = filtered.filter(
        (b) => b.due_date && new Date(b.due_date) >= dueDateStart
      );
    }
    if (dueDateEnd) {
      filtered = filtered.filter(
        (b) => b.due_date && new Date(b.due_date) <= dueDateEnd
      );
    }

    return sortCreditCardBills(filtered);
  }, [bills, cardFilter, statusFilter, yearFilter, dueDateStart, dueDateEnd]);

  const handleSubmit = async (data: CreditCardBillFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedBill) {
        await creditCardBillsService.update(selectedBill.id, data);
        toast({
          title: t('pages.creditCardBills.updated'),
        });
      } else {
        await creditCardBillsService.create(data);
        toast({
          title: t('pages.creditCardBills.created'),
        });
      }
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-bills'] });
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
        title: t('pages.creditCardBills.noCardMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedBill(undefined);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (createRef) createRef.current = handleCreate;
  });

  const handleDelete = async (id: number) => {
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
      });
      void queryClient.invalidateQueries({ queryKey: ['credit-card-bills'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const billAssociatedAccount = useMemo(() => {
    if (!selectedBill) return undefined;
    const card = creditCards.find((c) => c.id === selectedBill.credit_card);
    if (!card) return undefined;
    return accounts.find((a) => a.id === card.associated_account);
  }, [selectedBill, creditCards, accounts]);

  const handleOpenPayment = (bill: CreditCardBill) => {
    setSelectedBill(bill);
    setIsPaymentDialogOpen(true);
  };

  const handlePayment = async (data: BillPaymentFormData) => {
    if (!selectedBill) return;
    try {
      setIsPaymentSubmitting(true);
      const response = await creditCardBillsService.payBill(selectedBill.id, data);
      toast({
        title: t('pages.creditCardBills.paySuccessDesc', {
          amount: formatCurrency(response.payment.amount),
          limit: formatCurrency(response.card.credit_limit),
        }),
      });
      setIsPaymentDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-bills'] });
    } catch (error: unknown) {
      toast({
        title: t('pages.creditCardBills.payError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleOpenRenegotiate = (bill: CreditCardBill) => {
    setSelectedBill(bill);
    setIsRenegotiateDialogOpen(true);
  };

  const handleRenegotiate = async (data: RenegotiateBillFormData) => {
    if (!selectedBill) return;
    try {
      setIsRenegotiateSubmitting(true);
      const response = await creditCardBillsService.renegotiateBill(
        selectedBill.id,
        data
      );
      toast({
        title: t('pages.creditCardBills.renegotiateSuccessDesc', {
          count: response.renegotiation.installments,
          value: formatCurrency(response.renegotiation.installment_value),
        }),
      });
      setIsRenegotiateDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['credit-card-bills'] });
      void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      const adj = response.limit_adjustment;
      if (adj) {
        const maxRaised = adj.new_max_limit !== adj.previous_max_limit;
        await showAlert({
          title: t('pages.creditCardBills.limitAdjusted.title'),
          description:
            t('pages.creditCardBills.limitAdjusted.desc', {
              previous: formatCurrency(adj.previous_credit_limit),
              value: formatCurrency(adj.new_credit_limit),
            }) +
            (maxRaised
              ? ` ${t('pages.creditCardBills.limitAdjusted.maxRaised', {
                  value: formatCurrency(adj.new_max_limit),
                })}`
              : ''),
          variant: 'warning',
        });
      }
    } catch (error: unknown) {
      toast({
        title: t('pages.creditCardBills.renegotiateError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsRenegotiateSubmitting(false);
    }
  };

  const handleReopenBill = async (bill: CreditCardBill) => {
    const confirmed = await showConfirm({
      title: t('pages.creditCardBills.reopenTitle'),
      description: t('pages.creditCardBills.reopenDesc', {
        period: `${translate('months', bill.month)}/${bill.year}`,
      }),
      confirmText: t('pages.creditCardBills.reopenBtn'),
      cancelText: t('common.actions.cancel'),
    });
    if (!confirmed) return;
    try {
      await creditCardBillsService.reopenBill(bill.id);
      toast({
        title: t('pages.creditCardBills.reopened'),
      });
      void queryClient.invalidateQueries({ queryKey: ['credit-card-bills'] });
    } catch (error: unknown) {
      toast({
        title: t('pages.creditCardBills.reopenError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  const getCardName = (bill: CreditCardBill) => {
    // Usa os dados que vêm diretamente da fatura (do backend expandido)
    const cardholderName = bill.credit_card_on_card_name || 'N/A';
    const last4 = bill.credit_card_number_masked || '****';

    // Verifica se last4 contém apenas dígitos e tem 4 caracteres
    const isValidNumber = last4 !== '****' && /^\d{4}$/.test(last4);
    const cardNumber = isValidNumber ? `**** ${last4}` : '';

    const flag = bill.credit_card_flag
      ? translate('cardBrands', bill.credit_card_flag)
      : '';

    // Formato: {nome_cartao} **** {4 últimos} - {bandeira}
    const parts = [cardholderName];
    if (cardNumber) parts.push(cardNumber);
    if (flag) parts.push(`- ${flag}`);

    return parts.join(' ');
  };

  const handleEdit = (bill: CreditCardBill) => {
    setSelectedBill(bill);
    setIsDialogOpen(true);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  // Definir colunas da tabela
  const columns: Column<CreditCardBill>[] = [
    {
      key: 'credit_card',
      label: t('pages.creditCardBills.columns.card'),
      render: (bill) => (
        <div className="gap-sm flex items-center">
          <CreditCardIcon className="h-4 w-4" />
          <span className="font-medium">{getCardName(bill)}</span>
        </div>
      ),
    },
    {
      key: 'period',
      label: t('pages.creditCardBills.columns.period'),
      render: (bill) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {translate('months', bill.month)}/{bill.year}
          </span>
          {bill.due_date && (
            <span className="text-muted-foreground text-xs">
              {t('pages.creditCardBills.columns.duePrefix')}:{' '}
              {formatDate(bill.due_date)}
            </span>
          )}
        </div>
      ),
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
      key: 'minimum_payment',
      label: t('pages.creditCardBills.columns.minPayment'),
      align: 'right',
      render: (bill) => (
        <span className="text-warning text-sm font-medium">
          {formatCurrency(bill.minimum_payment)}
        </span>
      ),
    },
    {
      key: 'paid_amount',
      label: t('pages.creditCardBills.columns.paid'),
      align: 'right',
      render: (bill) => (
        <span className="text-success font-semibold">
          {formatCurrency(bill.paid_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('pages.creditCardBills.columns.status'),
      render: (bill) => {
        const StatusIcon = CREDIT_CARD_BILL_STATUS_ICONS[bill.status];
        return (
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
            className="gap-xs"
          >
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {translate('billStatus', bill.status)}
          </Badge>
        );
      },
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

  return (
    <Wrapper embedded={embedded}>
      <FilterBar
        hasActiveFilters={
          cardFilter !== 'all' ||
          statusFilter !== 'all' ||
          yearFilter !== 'all' ||
          !!dueDateStart ||
          !!dueDateEnd
        }
        onClear={() => {
          setCardFilter('all');
          setStatusFilter('all');
          setYearFilter('all');
          setDueDateStart(undefined);
          setDueDateEnd(undefined);
        }}
        activeFilters={[
          ...(dueDateStart
            ? [
                {
                  key: 'dueDateStart',
                  label: `${t('common.fields.from')}: ${formatDate(dueDateStart)}`,
                  onRemove: () => setDueDateStart(undefined),
                },
              ]
            : []),
          ...(dueDateEnd
            ? [
                {
                  key: 'dueDateEnd',
                  label: `${t('common.fields.to')}: ${formatDate(dueDateEnd)}`,
                  onRemove: () => setDueDateEnd(undefined),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.card')} icon={CreditCardIcon}>
          <Select value={cardFilter} onValueChange={setCardFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t('pages.creditCardBills.allCards')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.creditCardBills.allCards')}</SelectItem>
              {creditCards.map((c) => {
                const masked = c.card_number_masked || '****';
                const digitsOnly = masked.replace(/[^\d]/g, '');
                const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '****';
                const hasValidNumber = last4 !== '****' && /^\d{4}$/.test(last4);
                const cardNumber = hasValidNumber ? `**** ${last4}` : '';
                const brandName = translate('cardBrands', c.flag);
                return (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.on_card_name} {cardNumber} - {brandName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-auto whitespace-nowrap"
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.creditCardBills.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.creditCardBills.allStatus')}
              </SelectItem>
              {Object.keys(TRANSLATIONS.billStatus).map((k) => {
                const StatusIcon = CREDIT_CARD_BILL_STATUS_ICONS[k];
                return (
                  <SelectItem
                    key={k}
                    value={k}
                    icon={StatusIcon ? <StatusIcon className="h-4 w-4" /> : undefined}
                  >
                    {translate('billStatus', k)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.year')} icon={CalendarDays}>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-auto whitespace-nowrap">
              <SelectValue placeholder={t('pages.creditCardBills.allYears')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.creditCardBills.allYears')}</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
          <DateRangeFilter
            startDate={dueDateStart}
            endDate={dueDateEnd}
            onStartChange={setDueDateStart}
            onEndChange={setDueDateEnd}
          />
        </FilterField>
      </FilterBar>

      <DataTable
        data={filteredBills}
        columns={columns}
        keyExtractor={(bill) => bill.id}
        pageSize={LIST_PAGE_SIZE}
        isLoading={isLoading}
        emptyState={{
          icon: <Receipt className="text-muted-foreground h-12 w-12" />,
          title: t('pages.creditCardBills.emptyState'),
        }}
        onRowClick={(bill) => {
          setSelectedBill(bill);
          setIsPurchasesDialogOpen(true);
        }}
        actions={(bill) => (
          <div className="gap-sm flex items-center justify-center">
            {bill.status === 'paid' && (
              <ReceiptButton
                source={{ type: 'credit_card_bill', data: bill }}
                memberName={getMemberDisplayName(null, user)}
              />
            )}
            {bill.status !== 'paid' && (
              <Can action="pay_bill">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenPayment(bill)}
                  aria-label={t('pages.creditCardBills.payBillLabel')}
                  title={t('pages.creditCardBills.payBillLabel')}
                >
                  <Wallet className="text-primary h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
            )}
            {bill.status !== 'paid' &&
              parseFloat(bill.paid_amount) > 0 &&
              parseFloat(bill.total_amount) - parseFloat(bill.paid_amount) > 0 && (
                <Can action="renegotiate_bill">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenRenegotiate(bill)}
                    aria-label={t('pages.creditCardBills.renegotiateBillLabel')}
                    title={t('pages.creditCardBills.renegotiateBillLabel')}
                  >
                    <RefreshCw className="text-warning h-4 w-4" aria-hidden="true" />
                  </Button>
                </Can>
              )}
            {(bill.closed || bill.status === 'paid' || bill.status === 'closed') && (
              <Can action="reopen_bill">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleReopenBill(bill)}
                  aria-label={t('pages.creditCardBills.reopenBillLabel')}
                  title={t('pages.creditCardBills.reopenBillLabel')}
                >
                  <RotateCcw className="text-warning h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
            )}
            <Can action="change">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(bill)}
                aria-label={t('common.actions.edit')}
                title={t('common.actions.edit')}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
            <Can action="delete">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(bill.id)}
                aria-label={t('common.actions.delete')}
                title={t('common.actions.delete')}
              >
                <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle mode={selectedBill ? 'edit' : 'create'}>
              {selectedBill
                ? t('pages.creditCardBills.editTitle')
                : t('pages.creditCardBills.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.creditCardBills.editDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <CreditCardBillForm
            key={selectedBill?.id ?? 'new'}
            bill={selectedBill}
            creditCards={creditCards}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <Wallet className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
              {t('pages.creditCardBills.payTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.creditCardBills.payDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {selectedBill && (
            <BillPaymentForm
              bill={selectedBill}
              associatedAccount={billAssociatedAccount}
              onSubmit={handlePayment}
              onCancel={() => setIsPaymentDialogOpen(false)}
              isLoading={isPaymentSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      <BillPurchasesDialog
        bill={selectedBill}
        open={isPurchasesDialogOpen}
        onOpenChange={setIsPurchasesDialogOpen}
      />

      {selectedBill && (
        <RenegotiateBillDialog
          bill={selectedBill}
          open={isRenegotiateDialogOpen}
          onOpenChange={setIsRenegotiateDialogOpen}
          onSubmit={handleRenegotiate}
          isLoading={isRenegotiateSubmitting}
        />
      )}
    </Wrapper>
  );
}
