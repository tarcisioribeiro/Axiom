import {
  Plus,
  Trash2,
  Pencil,
  Download,
  HandCoins,
  CreditCard,
  List,
  TableProperties,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { LoanForm } from '@/components/loans/LoanForm';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translate } from '@/config/constants';
import { useLoansPage } from '@/hooks/use-loans-page';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { loanInstallmentsService } from '@/services/loan-installments-service';
import { useAuthStore } from '@/stores/auth-store';
import type { AmortizationSchedule, LoanInstallment, Loan } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  paid: 'secondary',
  defaulted: 'destructive',
  cancelled: 'outline',
};

export default function Loans() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const {
    accounts,
    members,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedLoan,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    filteredLoans,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  } = useLoansPage();

  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    value: '',
    account: '',
    date: '',
    notes: '',
  });
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const [installmentsLoan, setInstallmentsLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

  const [amortizationLoan, setAmortizationLoan] = useState<Loan | null>(null);
  const [amortization, setAmortization] = useState<AmortizationSchedule | null>(null);
  const [amortizationMethod, setAmortizationMethod] = useState<'price' | 'sac'>(
    'price'
  );
  const [isLoadingAmortization, setIsLoadingAmortization] = useState(false);

  const handleOpenInstallments = async (loan: Loan) => {
    setInstallmentsLoan(loan);
    setIsLoadingInstallments(true);
    try {
      const data = await loanInstallmentsService.getByLoan(loan.id);
      setInstallments(data);
    } catch {
      setInstallments([]);
    } finally {
      setIsLoadingInstallments(false);
    }
  };

  const handleOpenAmortization = async (
    loan: Loan,
    method: 'price' | 'sac' = 'price'
  ) => {
    setAmortizationLoan(loan);
    setAmortizationMethod(method);
    setIsLoadingAmortization(true);
    try {
      const data = await loanInstallmentsService.getAmortization(loan.id, method);
      setAmortization(data);
    } catch {
      setAmortization(null);
    } finally {
      setIsLoadingAmortization(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentLoan) return;
    if (!paymentForm.value || !paymentForm.account || !paymentForm.date) {
      toast({
        title: t('pages.loans.payment.title'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    setIsPaymentSubmitting(true);
    try {
      await loanInstallmentsService.pay(paymentLoan.id, {
        value: parseFloat(paymentForm.value),
        account: parseInt(paymentForm.account),
        date: paymentForm.date,
        notes: paymentForm.notes,
      });
      toast({
        title: t('pages.loans.payment.success'),
        description: t('pages.loans.payment.successDesc'),
      });
      setPaymentLoan(null);
      setPaymentForm({ value: '', account: '', date: '', notes: '' });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.loans.title')}
        icon={<HandCoins />}
        action={{
          label: t('pages.loans.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder={t('pages.loans.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
      </div>

      {filteredLoans.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.loans.emptySearch') : t('pages.loans.emptyState')
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLoans.map((loan) => (
            <div
              key={loan.id}
              className="space-y-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{loan.description}</h3>
                  <p className="text-sm">
                    {translate('expenseCategories', loan.category)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[loan.status] ?? 'default'}>
                  {translate('loanStatus', loan.status)}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('pages.loans.totalValue')}</span>
                  <span className="font-medium">{formatCurrency(loan.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.loans.paidValue')}</span>
                  <span className="font-medium">
                    {formatCurrency(loan.payed_value)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.loans.remainingBalance')}</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(
                      parseFloat(loan.value) - parseFloat(loan.payed_value)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.loans.beneficiary')}</span>
                  <span className="font-medium">{loan.benefited_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.loans.creditor')}</span>
                  <span className="font-medium">{loan.creditor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.loans.installmentsLabel')}</span>
                  <span className="font-medium">{loan.installments}x</span>
                </div>
                {loan.due_date && (
                  <div className="flex justify-between">
                    <span>{t('pages.loans.dueDate')}</span>
                    <span className="font-medium">
                      {formatDate(loan.due_date, 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPaymentForm({
                      value: '',
                      account: '',
                      date: new Date().toISOString().split('T')[0],
                      notes: '',
                    });
                    setPaymentLoan(loan);
                  }}
                  title={t('pages.loans.payment.title')}
                  className="gap-1 text-xs"
                >
                  <CreditCard className="h-3 w-3" />
                  {t('pages.loans.payBtn')}
                </Button>
                {loan.installments > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenInstallments(loan)}
                    title={t('pages.loans.installments.title')}
                    className="gap-1 text-xs"
                  >
                    <List className="h-3 w-3" />
                    {t('pages.loans.installments.title')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleOpenAmortization(loan)}
                  title={t('pages.loans.amortization.title')}
                  className="gap-1 text-xs"
                >
                  <TableProperties className="h-3 w-3" />
                  {t('pages.loans.amortizationBtn')}
                </Button>
                <ReceiptButton
                  source={{ type: 'loan', data: loan }}
                  memberName={getMemberDisplayName(loan.benefited_name, user)}
                  variant="ghost"
                  size="icon"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(loan)}
                  title={t('common.actions.edit')}
                  aria-label={t('common.actions.edit')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(loan)}
                  title={t('common.actions.delete')}
                  aria-label={t('common.actions.delete')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
                {loan.contract_document && (
                  <Button variant="ghost" size="icon" title="Download" asChild>
                    <a href={loan.contract_document} download aria-label="Download">
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLoan ? t('pages.loans.editTitle') : t('pages.loans.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedLoan ? t('pages.loans.editDesc') : t('pages.loans.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <LoanForm
            loan={selectedLoan}
            accounts={accounts}
            members={members}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={!!paymentLoan}
        onOpenChange={(open) => {
          if (!open) setPaymentLoan(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.loans.payment.title')}</DialogTitle>
            <DialogDescription>
              {paymentLoan?.description} — {t('pages.loans.remainingBalance')}{' '}
              {paymentLoan
                ? formatCurrency(
                    parseFloat(paymentLoan.value) - parseFloat(paymentLoan.payed_value)
                  )
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('pages.loans.payment.value')} *</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentForm.value}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, value: e.target.value }))
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>{t('pages.loans.payment.account')} *</Label>
              <Select
                value={paymentForm.account}
                onValueChange={(v) => setPaymentForm((f) => ({ ...f, account: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.fields.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('pages.loans.payment.date')} *</Label>
              <Input
                type="date"
                value={paymentForm.date}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('pages.loans.payment.notes')}</Label>
              <Input
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder={t('common.fields.notes')}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentLoan(null)}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={() => void handlePaymentSubmit()}
                disabled={isPaymentSubmitting}
              >
                {isPaymentSubmitting
                  ? t('common.actions.saving')
                  : t('pages.loans.payment.submit')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Installments Dialog */}
      <Dialog
        open={!!installmentsLoan}
        onOpenChange={(open) => {
          if (!open) setInstallmentsLoan(null);
        }}
      >
        <DialogContent className="custom-scrollbar max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.loans.installments.title')}</DialogTitle>
            <DialogDescription>{installmentsLoan?.description}</DialogDescription>
          </DialogHeader>
          {isLoadingInstallments ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('common.actions.loading')}
            </div>
          ) : installments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('pages.loans.installments.emptyState')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">
                      {t('pages.loans.installments.number')}
                    </th>
                    <th className="pb-2 pr-4">
                      {t('pages.loans.installments.dueDate')}
                    </th>
                    <th className="pb-2 pr-4 text-right">
                      {t('pages.loans.installments.value')}
                    </th>
                    <th className="pb-2">{t('pages.loans.installments.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => (
                    <tr key={inst.id} className="border-b">
                      <td className="py-2 pr-4">{inst.installment_number}</td>
                      <td className="py-2 pr-4">
                        {formatDate(inst.due_date, 'dd/MM/yyyy')}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatCurrency(inst.value)}
                      </td>
                      <td className="py-2">
                        <Badge variant={inst.payed ? 'secondary' : 'outline'}>
                          {inst.payed
                            ? t('pages.loans.installments.paid')
                            : t('pages.loans.installments.pending')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Amortization Dialog */}
      <Dialog
        open={!!amortizationLoan}
        onOpenChange={(open) => {
          if (!open) {
            setAmortizationLoan(null);
            setAmortization(null);
          }
        }}
      >
        <DialogContent className="custom-scrollbar max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.loans.amortization.title')}</DialogTitle>
            <DialogDescription>{amortizationLoan?.description}</DialogDescription>
          </DialogHeader>
          <div className="mb-4 flex items-center gap-3">
            <Label>{t('pages.loans.amortization.method')}:</Label>
            <div className="flex gap-2">
              {(['price', 'sac'] as const).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={amortizationMethod === m ? 'default' : 'outline'}
                  onClick={() =>
                    amortizationLoan && void handleOpenAmortization(amortizationLoan, m)
                  }
                >
                  {t(`pages.loans.amortization.${m}`)}
                </Button>
              ))}
            </div>
          </div>
          {isLoadingAmortization ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('pages.loans.amortization.loading')}
            </div>
          ) : !amortization ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('pages.loans.amortization.noData')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">
                      {t('pages.loans.amortization.dueDate')}
                    </th>
                    <th className="pb-2 pr-3 text-right">
                      {t('pages.loans.amortization.payment')}
                    </th>
                    <th className="pb-2 pr-3 text-right">
                      {t('pages.loans.amortization.principal')}
                    </th>
                    <th className="pb-2 pr-3 text-right">
                      {t('pages.loans.amortization.interest')}
                    </th>
                    <th className="pb-2 text-right">
                      {t('pages.loans.amortization.balance')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {amortization.schedule.map((entry) => (
                    <tr key={entry.installment} className="border-b">
                      <td className="py-1 pr-3">{entry.installment}</td>
                      <td className="py-1 pr-3">
                        {formatDate(entry.due_date, 'dd/MM/yyyy')}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {formatCurrency(entry.payment)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {formatCurrency(entry.principal)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {formatCurrency(entry.interest)}
                      </td>
                      <td className="py-1 text-right">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
