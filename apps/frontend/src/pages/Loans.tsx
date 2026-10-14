/* eslint-disable max-lines */
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  CreditCard,
  Download,
  HandCoins,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shield,
  TableProperties,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { LoanAmortizationDialog } from '@/components/loans/LoanAmortizationDialog';
import { LoanDetailModal } from '@/components/loans/LoanDetailModal';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  // Radix portals the "..." menu outside the card's DOM subtree, so a click
  // on one of its items can still resolve onto the card underneath once the
  // menu closes. Marked on pointerdown (before Radix unmounts the portal),
  // checked once by the card's own click handler. Only one menu can be open
  // at a time, so a single shared ref (not one per card) is enough.
  const suppressDetailRef = useRef(false);

  const [installmentsLoan, setInstallmentsLoan] = useState<Loan | null>(null);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);

  const [paymentPlanLoan, setPaymentPlanLoan] = useState<Loan | null>(null);

  const [progressLoan, setProgressLoan] = useState<Loan | null>(null);

  const [amortizationLoan, setAmortizationLoan] = useState<Loan | null>(null);
  const [amortization, setAmortization] = useState<AmortizationSchedule | null>(null);
  const [amortizationMethod, setAmortizationMethod] = useState<'price' | 'sac'>(
    'price'
  );

  const loadInstallments = async (loan: Loan) => {
    try {
      const data = await loanInstallmentsService.getByLoan(loan.id);
      setInstallments(data);
    } catch {
      setInstallments([]);
    }
  };

  // Abre só com os dados prontos: abrir em "Carregando…" e depois crescer até a
  // tabela faz o modal saltar de tamanho (efeito de "modal fantasma").
  const handleOpenInstallments = async (loan: Loan) => {
    await loadInstallments(loan);
    setInstallmentsLoan(loan);
  };

  const handleOpenAmortization = async (
    loan: Loan,
    method: 'price' | 'sac' = 'price'
  ) => {
    const data = await loanInstallmentsService
      .getAmortization(loan.id, method)
      .catch(() => null);
    setAmortization(data);
    setAmortizationMethod(method);
    setAmortizationLoan(loan);
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
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.loans.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        {currentUserMemberId !== null && (
          <FilterField label={t('common.filterLabels.role')} icon={Shield}>
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
          </FilterField>
        )}
        <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
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
        </FilterField>
        <FilterField label={t('common.fields.category')} icon={Tag}>
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
        </FilterField>
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
          <DateRangeFilter
            startDate={dueStartDate}
            endDate={dueEndDate}
            onStartChange={setDueStartDate}
            onEndChange={setDueEndDate}
          />
        </FilterField>
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
          pageSize={GRID_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
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
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if (suppressDetailRef.current) {
                      suppressDetailRef.current = false;
                      return;
                    }
                    if (!(e.target as HTMLElement).closest('button'))
                      setDetailLoan(loan);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      !(e.target as HTMLElement).closest('button')
                    ) {
                      e.preventDefault();
                      setDetailLoan(loan);
                    }
                  }}
                  className="bg-card px-md py-sm space-y-sm cursor-pointer rounded-lg border transition-colors"
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

                  <div className="gap-sm text-muted-foreground flex items-center text-xs">
                    <span className="shrink-0">
                      {t(
                        isCreditor
                          ? 'pages.loans.receivedAmount'
                          : 'pages.loans.paidAmount',
                        { value: formatCurrency(loan.payed_value) }
                      )}
                    </span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full w-full origin-left rounded-full transition-transform',
                          pct >= 100
                            ? 'bg-success'
                            : loan.status === 'defaulted'
                              ? 'bg-destructive'
                              : 'bg-primary'
                        )}
                        style={{ transform: `scaleX(${pct / 100})` }}
                      />
                    </div>
                    <span className="shrink-0">{pct.toFixed(0)}%</span>
                  </div>

                  <div
                    role="presentation"
                    className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
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
                    <ReceiptButton
                      source={{ type: 'loan', data: loan }}
                      memberName={getMemberDisplayName(loan.benefited_name, user)}
                      variant="ghost"
                      size="icon"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('common.actions.moreOptions')}
                          aria-label={t('common.actions.moreOptions')}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onPointerDown={() => {
                          suppressDetailRef.current = true;
                        }}
                      >
                        {loan.installments > 1 ? (
                          <DropdownMenuItem
                            onClick={() => void handleOpenInstallments(loan)}
                          >
                            <List className="mr-sm h-4 w-4" aria-hidden="true" />
                            {t('pages.loans.installments.title')}
                          </DropdownMenuItem>
                        ) : (
                          loan.status !== 'paid' &&
                          loan.status !== 'cancelled' && (
                            <DropdownMenuItem onClick={() => setPaymentPlanLoan(loan)}>
                              <CalendarRange
                                className="mr-sm h-4 w-4"
                                aria-hidden="true"
                              />
                              {t('pages.loans.paymentPlan.createBtn')}
                            </DropdownMenuItem>
                          )
                        )}
                        <DropdownMenuItem onClick={() => setProgressLoan(loan)}>
                          <CheckCircle2 className="mr-sm h-4 w-4" aria-hidden="true" />
                          {t('pages.loans.progress.progressBtn')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleOpenAmortization(loan)}
                        >
                          <TableProperties
                            className="mr-sm h-4 w-4"
                            aria-hidden="true"
                          />
                          {t('pages.loans.amortizationBtn')}
                        </DropdownMenuItem>
                        {loan.contract_document && (
                          <DropdownMenuItem asChild>
                            <a href={loan.contract_document} download>
                              <Download className="mr-sm h-4 w-4" aria-hidden="true" />
                              {t('common.actions.download')}
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  </div>
                </div>
              );
            })
          }
        </PaginatedSlide>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={selectedLoan ? 'max-w-5xl' : 'max-w-2xl'}>
          <DialogHeader>
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

      <LoanDetailModal
        loan={detailLoan}
        currentUserMemberId={currentUserMemberId}
        onClose={() => setDetailLoan(null)}
      />

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
        onClose={() => {
          setAmortizationLoan(null);
          setAmortization(null);
        }}
        onChangeMethod={(loan, method) => void handleOpenAmortization(loan, method)}
      />
    </PageContainer>
  );
}
