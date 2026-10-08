/* eslint-disable max-lines */
import { useQueryClient } from '@tanstack/react-query';
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
  Users,
  CalendarRange,
  Tag,
  CircleDot,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { LoanAmortizationDialog } from '@/components/loans/LoanAmortizationDialog';
import { LoanForm } from '@/components/loans/LoanForm';
import { LoanInstallmentsDialog } from '@/components/loans/LoanInstallmentsDialog';
import { LoanPaymentDialog } from '@/components/loans/LoanPaymentDialog';
import { LoanPaymentPlanDialog } from '@/components/loans/LoanPaymentPlanDialog';
import { LoanProgressDialog } from '@/components/loans/LoanProgressDialog';
import { LoanReceiptDialog } from '@/components/loans/LoanReceiptDialog';
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
import {
  EXPENSE_CATEGORIES_CANONICAL,
  getLoanStatusLabel,
  translate,
} from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS, LOAN_STATUS_ICONS } from '@/config/icons';
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
  const queryClient = useQueryClient();
  const invalidateLoans = () => queryClient.invalidateQueries({ queryKey: ['loans'] });
  const {
    accounts,
    members,
    currentUserMemberId,
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dueStartDate, setDueStartDate] = useState<Date | undefined>(undefined);
  const [dueEndDate, setDueEndDate] = useState<Date | undefined>(undefined);
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);
  const [receiptLoan, setReceiptLoan] = useState<Loan | null>(null);

  const [installmentsLoan, setInstallmentsLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

  const [paymentPlanLoan, setPaymentPlanLoan] = useState<Loan | null>(null);

  const [progressLoan, setProgressLoan] = useState<Loan | null>(null);

  const [amortizationLoan, setAmortizationLoan] = useState<Loan | null>(null);
  const [amortization, setAmortization] = useState<AmortizationSchedule | null>(null);
  const [amortizationMethod, setAmortizationMethod] = useState<'price' | 'sac'>(
    'price'
  );
  const [isLoadingAmortization, setIsLoadingAmortization] = useState(false);

  const loadInstallments = async (loan: Loan) => {
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

  const handleOpenInstallments = async (loan: Loan) => {
    setInstallmentsLoan(loan);
    await loadInstallments(loan);
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

  const roleFilteredLoans = useMemo(() => {
    let result = filteredLoans;
    if (roleFilter === 'benefited' && currentUserMemberId !== null)
      result = result.filter((l) => l.benefited === currentUserMemberId);
    if (roleFilter === 'creditor' && currentUserMemberId !== null)
      result = result.filter((l) => l.creditor === currentUserMemberId);
    if (statusFilter !== 'all')
      result = result.filter((l) => l.status === statusFilter);
    if (categoryFilter !== 'all')
      result = result.filter((l) => l.category === categoryFilter);
    if (dueStartDate)
      result = result.filter((l) => l.due_date && new Date(l.due_date) >= dueStartDate);
    if (dueEndDate)
      result = result.filter((l) => l.due_date && new Date(l.due_date) <= dueEndDate);
    return result;
  }, [
    filteredLoans,
    roleFilter,
    currentUserMemberId,
    statusFilter,
    categoryFilter,
    dueStartDate,
    dueEndDate,
  ]);

  const hasExtraFilters =
    roleFilter !== 'all' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    !!dueStartDate ||
    !!dueEndDate;

  const clearExtraFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setDueStartDate(undefined);
    setDueEndDate(undefined);
  };

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader title={t('pages.loans.title')} icon={<HandCoins />}>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.loans.newBtn')}
        </Button>
      </PageHeader>

      <FilterBar
        hasActiveFilters={!!searchTerm || hasExtraFilters}
        onClear={clearExtraFilters}
        activeFilters={[
          ...(roleFilter !== 'all'
            ? [
                {
                  key: 'role',
                  label: t(`pages.loans.filter.${roleFilter}`),
                  onRemove: () => setRoleFilter('all'),
                },
              ]
            : []),
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${translate('loanStatus', statusFilter)}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('common.fields.category')}: ${EXPENSE_CATEGORIES_CANONICAL.find((c) => c.key === categoryFilter)?.label ?? categoryFilter}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(dueStartDate
            ? [
                {
                  key: 'dueStartDate',
                  label: `${t('common.fields.from')}: ${formatDate(dueStartDate)}`,
                  onRemove: () => setDueStartDate(undefined),
                },
              ]
            : []),
          ...(dueEndDate
            ? [
                {
                  key: 'dueEndDate',
                  label: `${t('common.fields.to')}: ${formatDate(dueEndDate)}`,
                  onRemove: () => setDueEndDate(undefined),
                },
              ]
            : []),
        ]}
      >
        <SearchInput
          placeholder={t('pages.loans.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
        {currentUserMemberId !== null && (
          <Select
            value={roleFilter}
            onValueChange={(v) => setRoleFilter(v as LoanRole)}
          >
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.loans.allRoles')}
              startIcon={<Users className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.loans.allRoles')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.loans.filter.all')}</SelectItem>
              <SelectItem value="benefited">
                {t('pages.loans.filter.benefited')}
              </SelectItem>
              <SelectItem value="creditor">
                {t('pages.loans.filter.creditor')}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-40"
            aria-label={t('pages.loans.allStatus')}
            startIcon={<CircleDot className="h-3.5 w-3.5" />}
          >
            <SelectValue placeholder={t('pages.loans.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.loans.allStatus')}</SelectItem>
            <SelectItem
              value="active"
              icon={<LOAN_STATUS_ICONS.active className="h-4 w-4" />}
            >
              {translate('loanStatus', 'active')}
            </SelectItem>
            <SelectItem
              value="paid"
              icon={<LOAN_STATUS_ICONS.paid className="h-4 w-4" />}
            >
              {translate('loanStatus', 'paid')}
            </SelectItem>
            <SelectItem
              value="defaulted"
              icon={<LOAN_STATUS_ICONS.defaulted className="h-4 w-4" />}
            >
              {translate('loanStatus', 'defaulted')}
            </SelectItem>
            <SelectItem
              value="cancelled"
              icon={<LOAN_STATUS_ICONS.cancelled className="h-4 w-4" />}
            >
              {translate('loanStatus', 'cancelled')}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger
            className="w-44"
            aria-label={t('pages.loans.allCategories')}
            startIcon={<Tag className="h-3.5 w-3.5" />}
          >
            <SelectValue placeholder={t('pages.loans.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.loans.allCategories')}</SelectItem>
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
        <DateRangeFilter
          startDate={dueStartDate}
          endDate={dueEndDate}
          onStartChange={setDueStartDate}
          onEndChange={setDueEndDate}
        />
      </FilterBar>

      {roleFilteredLoans.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm || hasExtraFilters
              ? t('pages.loans.emptySearch')
              : t('pages.loans.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={`${roleFilter}-${statusFilter}-${categoryFilter}-${dueStartDate?.getTime()}-${dueEndDate?.getTime()}-${searchTerm}`}
          items={roleFilteredLoans}
          pageSize={LIST_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3"
        >
          {(pageItems) =>
            pageItems.map((loan) => {
              const total = parseFloat(loan.value);
              const paid = parseFloat(loan.payed_value);
              const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
              const isCreditor = loan.creditor === currentUserMemberId;
              return (
                <div
                  key={loan.id}
                  className="bg-card p-md space-y-3 rounded-lg border transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{loan.description}</h3>
                      <p className="text-muted-foreground text-sm">
                        {translate('expenseCategories', loan.category)}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANTS[loan.status] ?? 'default'}
                      className="gap-xs"
                    >
                      {(() => {
                        const StatusIcon = LOAN_STATUS_ICONS[loan.status];
                        return StatusIcon ? (
                          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : null;
                      })()}
                      {getLoanStatusLabel(loan.status, isCreditor)}
                    </Badge>
                  </div>

                  {/* Amortization progress */}
                  <div className="space-y-xs">
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>{t('pages.loans.payoff')}</span>
                      <span className="font-medium">{Math.round(pct)}%</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full rounded-full transition',
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
                        {t(
                          isCreditor
                            ? 'pages.loans.receivedAmount'
                            : 'pages.loans.paidAmount',
                          {
                            value: formatCurrency(loan.payed_value),
                          }
                        )}
                      </span>
                      <span className="text-destructive">
                        {t(
                          isCreditor
                            ? 'pages.loans.toReceiveAmount'
                            : 'pages.loans.remainingAmount',
                          {
                            value: formatCurrency(total - paid),
                          }
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-xs text-sm">
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

                  <div className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t">
                    {loan.status !== 'paid' &&
                      loan.status !== 'cancelled' &&
                      (Number(loan.creditor) === currentUserMemberId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptLoan(loan)}
                          title={t('pages.loans.receipt.title')}
                          className="gap-xs text-success text-xs"
                        >
                          <CreditCard className="h-3 w-3" />
                          {t('pages.loans.receiveBtn')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentLoan(loan)}
                          disabled={Number(loan.benefited) !== currentUserMemberId}
                          title={t('pages.loans.payment.title')}
                          className="gap-xs text-xs"
                        >
                          <CreditCard className="h-3 w-3" />
                          {t('pages.loans.payBtn')}
                        </Button>
                      ))}
                    {loan.installments > 1 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleOpenInstallments(loan)}
                        title={t('pages.loans.installments.title')}
                        className="gap-xs text-xs"
                      >
                        <List className="h-3 w-3" />
                        {t('pages.loans.installments.title')}
                      </Button>
                    ) : (
                      loan.status !== 'paid' &&
                      loan.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentPlanLoan(loan)}
                          title={t('pages.loans.paymentPlan.title')}
                          className="gap-xs text-xs"
                        >
                          <CalendarRange className="h-3 w-3" />
                          {t('pages.loans.paymentPlan.createBtn')}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProgressLoan(loan)}
                      title={t('pages.loans.progress.progressBtn')}
                      className="gap-xs text-xs"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {t('pages.loans.progress.progressBtn')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleOpenAmortization(loan)}
                      title={t('pages.loans.amortization.title')}
                      className="gap-xs text-xs"
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
                      <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
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
            })
          }
        </PaginatedSlide>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader sticky>
            <DialogTitle mode={selectedLoan ? 'edit' : 'create'}>
              {selectedLoan ? t('pages.loans.editTitle') : t('pages.loans.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedLoan ? t('pages.loans.editDesc') : t('pages.loans.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <LoanForm
            loan={selectedLoan}
            accounts={accounts}
            members={members}
            currentUserMemberId={currentUserMemberId}
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

      <LoanReceiptDialog
        loan={receiptLoan}
        accounts={accounts}
        onClose={() => setReceiptLoan(null)}
      />

      <LoanProgressDialog
        loan={progressLoan}
        isCreditor={
          progressLoan !== null && progressLoan.creditor === currentUserMemberId
        }
        onClose={() => setProgressLoan(null)}
      />

      <LoanInstallmentsDialog
        loan={installmentsLoan}
        installments={installments}
        isLoading={isLoadingInstallments}
        onClose={() => setInstallmentsLoan(null)}
        onUpdated={() => {
          void invalidateLoans();
          if (installmentsLoan) void loadInstallments(installmentsLoan);
        }}
      />

      <LoanPaymentPlanDialog
        loan={paymentPlanLoan}
        onClose={() => setPaymentPlanLoan(null)}
        onSuccess={invalidateLoans}
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
