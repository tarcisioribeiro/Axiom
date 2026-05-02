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
import { LoanAmortizationDialog } from '@/components/loans/LoanAmortizationDialog';
import { LoanForm } from '@/components/loans/LoanForm';
import { LoanInstallmentsDialog } from '@/components/loans/LoanInstallmentsDialog';
import { LoanPaymentDialog } from '@/components/loans/LoanPaymentDialog';
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
import { translate } from '@/config/constants';
import { useLoansPage } from '@/hooks/use-loans-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { cn } from '@/lib/utils';
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

type LoanRole = 'all' | 'benefited' | 'creditor';

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

  const [roleFilter, setRoleFilter] = useState<LoanRole>('all');
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

  const currentMemberId = useMemo(
    () => members.find((m) => m.user === user?.id)?.id ?? null,
    [members, user?.id]
  );

  const roleFilteredLoans = useMemo(() => {
    if (roleFilter === 'benefited' && currentMemberId !== null)
      return filteredLoans.filter((l) => l.benefited === currentMemberId);
    if (roleFilter === 'creditor' && currentMemberId !== null)
      return filteredLoans.filter((l) => l.creditor === currentMemberId);
    return filteredLoans;
  }, [filteredLoans, roleFilter, currentMemberId]);

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

      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        <Card className="overflow-hidden border-t-2 border-t-primary/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.loans.stats.total')}</p>
            <div className="rounded-lg bg-primary/10 p-sm ring-1 ring-primary/20">
              <HandCoins className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{loans.length}</div>
            <p className="mt-xs text-xs text-muted-foreground">empréstimos</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-warning/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.loans.stats.active')}</p>
            <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{activeCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">em andamento</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-success/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.loans.stats.paid')}</p>
            <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{paidCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">quitados</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-destructive/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.loans.stats.totalDebt')}</p>
            <div className="rounded-lg bg-destructive/10 p-sm ring-1 ring-destructive/20">
              <Banknote className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalDebt)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">saldo devedor</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          placeholder={t('pages.loans.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
        {currentMemberId !== null && (
          <div className="flex overflow-hidden rounded-lg border">
            {(
              [
                { key: 'all', label: 'Todos', icon: '📋' },
                { key: 'benefited', label: 'Beneficiário', icon: '🤲' },
                { key: 'creditor', label: 'Credor', icon: '🏦' },
              ] as { key: LoanRole; label: string; icon: string }[]
            ).map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRoleFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 border-r px-3 py-1.5 text-sm last:border-r-0 transition-colors',
                  roleFilter === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {roleFilteredLoans.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.loans.emptySearch') : t('pages.loans.emptyState')
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roleFilteredLoans.map((loan) => {
            const total = parseFloat(loan.value);
            const paid = parseFloat(loan.payed_value);
            const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
            return (
              <div
                key={loan.id}
                className="space-y-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{loan.description}</h3>
                    <p className="text-sm text-muted-foreground">
                      {translate('expenseCategories', loan.category)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[loan.status] ?? 'default'}>
                    {translate('loanStatus', loan.status)}
                  </Badge>
                </div>

                {/* Amortization progress */}
                <div className="space-y-xs">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Quitação</span>
                    <span className="font-medium">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        pct >= 100
                          ? 'bg-success'
                          : loan.status === 'defaulted'
                            ? 'bg-destructive'
                            : 'bg-primary'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-success">
                      {formatCurrency(loan.payed_value)} pago
                    </span>
                    <span className="text-destructive">
                      {formatCurrency(total - paid)} restante
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('pages.loans.totalValue')}
                    </span>
                    <span className="font-medium">{formatCurrency(loan.value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('pages.loans.beneficiary')}
                    </span>
                    <span className="font-medium">{loan.benefited_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('pages.loans.creditor')}
                    </span>
                    <span className="font-medium">{loan.creditor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('pages.loans.installmentsLabel')}
                    </span>
                    <span className="font-medium">{loan.installments}x</span>
                  </div>
                  {loan.due_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.loans.dueDate')}
                      </span>
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
            );
          })}
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
