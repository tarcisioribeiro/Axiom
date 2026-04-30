import {
  Plus,
  Trash2,
  Pencil,
  Download,
  HandCoins,
  CreditCard,
  List,
  TableProperties,
  CheckCircle2,
  Clock,
  Banknote,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { StatCard } from '@/components/common/StatCard';
import { LoanAmortizationDialog } from '@/components/loans/LoanAmortizationDialog';
import { LoanForm } from '@/components/loans/LoanForm';
import { LoanInstallmentsDialog } from '@/components/loans/LoanInstallmentsDialog';
import { LoanPaymentDialog } from '@/components/loans/LoanPaymentDialog';
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
import { translate } from '@/config/constants';
import { useLoansPage } from '@/hooks/use-loans-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { loanInstallmentsService } from '@/services/loan-installments-service';
import { useAuthStore } from '@/stores/auth-store';
import type { AmortizationSchedule, LoanInstallment, Loan } from '@/types';

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
  const {
    loans,
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

  const { activeCount, paidCount, totalDebt } = useMemo(() => {
    const active = loans.filter((l) => l.status === 'active');
    const paid = loans.filter((l) => l.status === 'paid');
    const debt = loans.reduce(
      (s, l) => s + Math.max(0, parseFloat(l.value) - parseFloat(l.payed_value)),
      0
    );
    return { activeCount: active.length, paidCount: paid.length, totalDebt: debt };
  }, [loans]);

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

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          title={t('pages.loans.stats.total')}
          value={loans.length}
          icon={<HandCoins />}
        />
        <StatCard
          title={t('pages.loans.stats.active')}
          value={activeCount}
          icon={<Clock />}
          variant="warning"
        />
        <StatCard
          title={t('pages.loans.stats.paid')}
          value={paidCount}
          icon={<CheckCircle2 />}
          variant="success"
        />
        <StatCard
          title={t('pages.loans.stats.totalDebt')}
          value={formatCurrency(totalDebt)}
          icon={<Banknote />}
          variant="danger"
        />
      </div>

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
                  onClick={() => setPaymentLoan(loan)}
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

      <LoanPaymentDialog
        loan={paymentLoan}
        accounts={accounts}
        onClose={() => setPaymentLoan(null)}
      />

      <LoanInstallmentsDialog
        loan={installmentsLoan}
        installments={installments}
        isLoading={isLoadingInstallments}
        onClose={() => setInstallmentsLoan(null)}
      />

      <LoanAmortizationDialog
        loan={amortizationLoan}
        amortization={amortization}
        method={amortizationMethod}
        isLoading={isLoadingAmortization}
        onClose={() => {
          setAmortizationLoan(null);
          setAmortization(null);
        }}
        onChangeMethod={(loan, method) => void handleOpenAmortization(loan, method)}
      />
    </PageContainer>
  );
}
