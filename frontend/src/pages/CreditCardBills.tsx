/* eslint-disable max-lines */
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard as CreditCardIcon,
  Receipt,
  Wallet,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { BillPaymentForm } from '@/components/credit-cards/BillPaymentForm';
import { CreditCardBillForm } from '@/components/credit-cards/CreditCardBillForm';
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
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  Account,
  CreditCardBill,
  CreditCardBillFormData,
  CreditCard,
  BillPaymentFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function CreditCardBills({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<CreditCardBill[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditCardBill | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardFilter, statusFilter, yearFilter, bills]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [billsData, cardsData, accountsData] = await Promise.all([
        creditCardBillsService.getAll(),
        creditCardsService.getAll(),
        accountsService.getAll(),
      ]);
      setBills(billsData);
      setFilteredBills(billsData);
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

  const filterBills = () => {
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

    // Sort bills: current open bill first, then by date (oldest to newest)
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    filtered.sort((a, b) => {
      const aMonth = MONTH_TO_NUMBER[a.month] || 1;
      const bMonth = MONTH_TO_NUMBER[b.month] || 1;

      // Check if bill is current (current month and year, not paid)
      const aIsCurrent =
        aMonth === currentMonth &&
        parseInt(a.year) === currentYear &&
        a.status !== 'paid';
      const bIsCurrent =
        bMonth === currentMonth &&
        parseInt(b.year) === currentYear &&
        b.status !== 'paid';

      // Current open bill always first
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      // Open/overdue bills before paid/closed ones
      const aIsOpen = a.status === 'open' || a.status === 'overdue';
      const bIsOpen = b.status === 'open' || b.status === 'overdue';
      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;

      // Then sort by date (oldest to newest)
      const aDate = new Date(parseInt(a.year), aMonth - 1);
      const bDate = new Date(parseInt(b.year), bMonth - 1);
      return aDate.getTime() - bDate.getTime();
    });

    setFilteredBills(filtered);
  };

  const handleSubmit = async (data: CreditCardBillFormData) => {
    try {
      setIsSubmitting(true);
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
    if (creditCards.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.creditCardBills.noCardMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedBill(undefined);
    setIsDialogOpen(true);
  };

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
        description: t('pages.creditCardBills.deletedDesc'),
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
        title: t('pages.creditCardBills.paySuccess'),
        description: t('pages.creditCardBills.paySuccessDesc', {
          amount: formatCurrency(response.payment.amount),
          limit: formatCurrency(response.card.credit_limit),
        }),
      });
      setIsPaymentDialogOpen(false);
      void loadData();
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
        description: t('pages.creditCardBills.reopenedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.creditCardBills.reopenError'),
        description: getErrorMessage(error),
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
        <div className="flex items-center gap-sm">
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
            <span className="text-xs text-muted-foreground">
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
        <span className="text-sm font-medium text-warning">
          {formatCurrency(bill.minimum_payment)}
        </span>
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

  const Wrapper = embedded
    ? ({ children }: { children: ReactNode }) => (
        <div className="space-y-lg">{children}</div>
      )
    : PageContainer;

  return (
    <Wrapper>
      <PageHeader title={t('pages.creditCardBills.title')} icon={<Receipt />}>
        <div className="flex flex-wrap items-center gap-sm">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t('pages.creditCardBills.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.creditCardBills.allStatus')}
              </SelectItem>
              {Object.keys(TRANSLATIONS.billStatus).map((k) => (
                <SelectItem key={k} value={k}>
                  {translate('billStatus', k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-28">
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
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.creditCardBills.newBtn')}
          </Button>
        </div>
      </PageHeader>

      {/* Summary cards */}
      {filteredBills.length > 0 &&
        (() => {
          const openBills = filteredBills.filter(
            (b) => b.status === 'open' || b.status === 'overdue'
          );
          const totalOpen = openBills.reduce(
            (sum, b) => sum + parseFloat(b.total_amount),
            0
          );
          const totalPaid = filteredBills
            .filter((b) => b.status === 'paid')
            .reduce((sum, b) => sum + parseFloat(b.paid_amount), 0);
          const totalMinimum = openBills.reduce(
            (sum, b) => sum + parseFloat(b.minimum_payment),
            0
          );
          return (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
              <Card className="overflow-hidden border-t-2 border-t-destructive/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
                  <p className="text-sm font-medium">
                    {t('pages.creditCardBills.stats.open')}
                  </p>
                  <div className="rounded-lg bg-destructive/10 p-sm ring-1 ring-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(totalOpen)}
                  </div>
                  <p className="mt-xs text-xs text-muted-foreground">
                    {t('pages.creditCardBills.stats.openCount', {
                      count: openBills.length,
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-t-2 border-t-success/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
                  <p className="text-sm font-medium">
                    {t('pages.creditCardBills.stats.paid')}
                  </p>
                  <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(totalPaid)}
                  </div>
                  <p className="mt-xs text-xs text-muted-foreground">
                    {t('pages.creditCardBills.stats.paidCount', {
                      count: filteredBills.filter((b) => b.status === 'paid').length,
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-t-2 border-t-warning/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
                  <p className="text-sm font-medium">
                    {t('pages.creditCardBills.stats.minPending')}
                  </p>
                  <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
                    <Wallet className="h-4 w-4 text-warning" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">
                    {formatCurrency(totalMinimum)}
                  </div>
                  <p className="mt-xs text-xs text-muted-foreground">
                    {t('pages.creditCardBills.stats.minPaymentNote')}
                  </p>
                </CardContent>
              </Card>
            </div>
          );
        })()}

      <DataTable
        data={filteredBills}
        columns={columns}
        keyExtractor={(bill) => bill.id}
        isLoading={isLoading}
        emptyState={{
          icon: <Receipt className="h-12 w-12 text-muted-foreground" />,
          message: t('pages.creditCardBills.emptyState'),
        }}
        rowClassName={(bill) => {
          if (bill.status === 'overdue')
            return 'border-l-4 border-l-destructive bg-destructive/3';
          if (bill.status === 'paid') return 'border-l-4 border-l-success bg-success/3';
          if (bill.status === 'open') return 'border-l-4 border-l-warning';
          return '';
        }}
        actions={(bill) => (
          <div className="flex items-center justify-end gap-sm">
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
                onClick={() => handleOpenPayment(bill)}
                aria-label={t('pages.creditCardBills.payBillLabel')}
                title={t('pages.creditCardBills.payBillLabel')}
              >
                <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
              </Button>
            )}
            {(bill.closed || bill.status === 'paid' || bill.status === 'closed') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReopenBill(bill)}
                aria-label={t('pages.creditCardBills.reopenBillLabel')}
                title={t('pages.creditCardBills.reopenBillLabel')}
              >
                <RotateCcw className="h-4 w-4 text-warning" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(bill)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(bill.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBill
                ? t('pages.creditCardBills.editTitle')
                : t('pages.creditCardBills.newTitle')}
            </DialogTitle>
            <DialogDescription>{t('pages.creditCardBills.editDesc')}</DialogDescription>
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
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.creditCardBills.payTitle')}</DialogTitle>
            <DialogDescription>{t('pages.creditCardBills.payDesc')}</DialogDescription>
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
    </Wrapper>
  );
}
