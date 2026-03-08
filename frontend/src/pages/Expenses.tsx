import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  TrendingDown,
  ChevronDown,
  Download,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { ExportModal } from '@/components/common/ExportModal';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { expensesService } from '@/services/expenses-service';
import type { ExpenseExportParams } from '@/services/expenses-service';
import { loansService } from '@/services/loans-service';
import { payablesService } from '@/services/payables-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Expense, ExpenseFormData, Account, Loan, Payable } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const toDateParam = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Expenses() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, unknown> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all')
        params.payed = statusFilter === 'paid' ? 'true' : 'false';
      if (startDate) params.date_from = toDateParam(startDate);
      if (endDate) params.date_to = toDateParam(endDate);
      if (selectedAccounts.length > 0) params.accounts = selectedAccounts.join(',');
      const data = await expensesService.getAll(params);
      setExpenses(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    categoryFilter,
    statusFilter,
    startDate,
    endDate,
    selectedAccounts,
    t,
    toast,
  ]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [accountsData, loansData, payablesData] = await Promise.all([
          accountsService.getAll(),
          loansService.getAll(),
          payablesService.getAll(),
        ]);
        setAccounts(accountsData);
        setLoans(Array.isArray(loansData) ? loansData : []);
        setPayables(Array.isArray(payablesData) ? payablesData : []);
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    };
    void loadReferenceData();
  }, [t, toast]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const toggleAccount = (accountId: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedAccounts([]);
  };

  const handleSubmit = async (data: ExpenseFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedExpense) {
        await expensesService.update(selectedExpense.id, data);
        toast({
          title: t('pages.expenses.updated'),
          description: t('pages.expenses.updatedDesc'),
        });
      } else {
        await expensesService.create(data);
        toast({
          title: t('pages.expenses.created'),
          description: t('pages.expenses.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadExpenses();
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
    if (accounts.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.expenses.noAccountMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedExpense(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.expenses.deleteTitle'),
      description: t('pages.expenses.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await expensesService.delete(id);
      toast({
        title: t('pages.expenses.deleted'),
        description: t('pages.expenses.deletedDesc'),
      });
      void loadExpenses();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleExport = async (modalParams: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => {
    const params: ExpenseExportParams = {
      export_format: modalParams.export_format,
      date_from: modalParams.date_from,
      date_to: modalParams.date_to,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      payed:
        statusFilter !== 'all'
          ? statusFilter === 'paid'
            ? 'true'
            : 'false'
          : undefined,
      search: searchTerm || undefined,
      account: selectedAccounts.length > 0 ? selectedAccounts : undefined,
    };
    try {
      await expensesService.exportExpenses(params);
      toast({
        title: t('common.messages.exportSuccess'),
        description: t('common.messages.exportSuccessDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.exportError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const totalExpenses = sumByProperty(
    expenses.map((e) => ({ value: parseFloat(e.value) })),
    'value'
  );

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDialogOpen(true);
  };

  // Definir colunas da tabela
  const columns: Column<Expense>[] = [
    {
      key: 'description',
      label: t('pages.expenses.columns.description'),
      render: (expense) => <div className="font-medium">{expense.description}</div>,
    },
    {
      key: 'value',
      label: t('pages.expenses.columns.amount'),
      align: 'right',
      render: (expense) => (
        <span className="font-semibold text-destructive">
          {formatCurrency(expense.value)}
        </span>
      ),
    },
    {
      key: 'account_name',
      label: t('pages.expenses.columns.account'),
      render: (expense) => (
        <Badge variant="outline" className="font-medium">
          {expense.account_name || 'N/A'}
        </Badge>
      ),
    },
    {
      key: 'category',
      label: t('pages.expenses.columns.category'),
      render: (expense) => (
        <div className="flex items-center gap-1">
          <Badge variant="secondary">
            {translate('expenseCategories', expense.category)}
          </Badge>
          {expense.auto_categorized && (
            <Badge
              variant="outline"
              className="px-1 py-0 text-xs text-muted-foreground"
            >
              Auto
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'payed',
      label: t('pages.expenses.columns.status'),
      render: (expense) => (
        <Badge variant={expense.payed ? 'success' : 'destructive'}>
          {expense.payed ? t('common.status.paid') : t('common.status.pending')}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: t('pages.expenses.columns.date'),
      render: (expense) => (
        <div>
          <div className="text-sm">{formatDateTime(expense.date, expense.horary)}</div>
          {expense.member_name && (
            <div className="text-xs">Membro: {expense.member_name}</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('pages.expenses.title')} icon={<TrendingDown />}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t('common.actions.export')}
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('pages.expenses.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-semibold">{t('common.actions.filter')}</span>
          </div>
          {(searchTerm ||
            categoryFilter !== 'all' ||
            statusFilter !== 'all' ||
            startDate ||
            endDate ||
            selectedAccounts.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('common.actions.clearFilters')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder={t('pages.expenses.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.expenses.allCategories')}</SelectItem>
              {Object.entries(TRANSLATIONS.expenseCategories).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.expenses.allStatus')}</SelectItem>
              <SelectItem value="paid">{t('common.status.paid')}</SelectItem>
              <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <span className="text-sm">{t('pages.expenses.dateFrom')}</span>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder={t('pages.expenses.dateFromPlaceholder')}
              clearable
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">{t('pages.expenses.dateTo')}</span>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder={t('pages.expenses.datePlaceholder')}
              clearable
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">{t('common.fields.account')}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedAccounts.length === 0
                    ? t('pages.expenses.allAccounts')
                    : t('pages.expenses.selectedAccounts', {
                        count: selectedAccounts.length,
                      })}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2">
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {accounts.map((account) => (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                    <div
                      key={account.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-accent"
                      onClick={() => toggleAccount(account.id)}
                    >
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => toggleAccount(account.id)}
                      />
                      <span className="text-sm">{account.account_name}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm">
            {t('pages.expenses.foundExpenses', { count: expenses.length })}
          </span>
          <span className="text-lg font-bold text-destructive">
            {t('pages.expenses.total')} {formatCurrency(totalExpenses)}
          </span>
        </div>
      </div>

      <DataTable
        data={expenses}
        columns={columns}
        keyExtractor={(expense) => expense.id}
        isLoading={isLoading}
        emptyState={{
          message: t('pages.expenses.emptyState'),
        }}
        actions={(expense) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'expense', data: expense }}
              memberName={getMemberDisplayName(expense.member_name, user)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(expense)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(expense.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <ExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        title={t('pages.expenses.exportTitle')}
        description={t('pages.expenses.exportDesc')}
        onExport={handleExport}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense
                ? t('pages.expenses.editTitle')
                : t('pages.expenses.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedExpense
                ? t('pages.expenses.editDesc')
                : t('pages.expenses.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            expense={selectedExpense}
            accounts={accounts}
            loans={loans}
            payables={payables}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
