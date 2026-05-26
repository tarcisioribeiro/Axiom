/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import type { ExpensePrefillData } from '@/components/expenses/ExpenseForm';
import { Badge } from '@/components/ui/badge';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useOptimisticDelete } from '@/hooks/use-optimistic-delete';
import { useToast } from '@/hooks/use-toast';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { STALE_TIMES } from '@/lib/query-client';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import type { ExpenseExportParams } from '@/services/expenses-service';
import { expensesService } from '@/services/expenses-service';
import { loansService } from '@/services/loans-service';
import { payablesService } from '@/services/payables-service';
import type { Expense, ExpenseFormData, Account, Loan, Payable } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import type { Column } from '../components/common/DataTable';

export interface UseExpensesPageReturn {
  expenses: Expense[];
  accounts: Account[];
  loans: Loan[];
  payables: Payable[];
  isLoading: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedExpense: Expense | undefined;
  isSubmitting: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  startDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (d: Date | undefined) => void;
  selectedAccounts: number[];
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  toggleAccount: (id: number) => void;
  clearFilters: () => void;
  handleCreate: () => void;
  handleEdit: (expense: Expense) => void;
  handleDelete: (id: number) => Promise<void>;
  deletingExpenseIds: Set<number | string>;
  handleSubmit: (data: ExpenseFormData) => void;
  handleExport: (params: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => Promise<void>;
  totalExpenses: number;
  hasActiveFilters: boolean;
  columns: Column<Expense>[];
  prefillExpenseData: ExpensePrefillData | undefined;
}

export function useExpensesPage(): UseExpensesPageReturn {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as {
    prefillExpense?: ExpensePrefillData;
  } | null;
  const [isDialogOpen, setIsDialogOpen] = useState(!!locationState?.prefillExpense);
  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>();
  const prefillExpenseData = locationState?.prefillExpense;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const FILTER_DEFAULTS = useMemo(
    () => ({
      search: '',
      category: 'all',
      status: 'all',
      startDate: '',
      endDate: '',
      accounts: '',
    }),
    []
  );

  const { filters, setFilter, resetFilters, hasActiveFilters } =
    useUrlFilters(FILTER_DEFAULTS);

  const searchTerm = filters.search;
  const setSearchTerm = (v: string) => setFilter('search', v);
  const categoryFilter = filters.category;
  const setCategoryFilter = (v: string) => setFilter('category', v);
  const statusFilter = filters.status;
  const setStatusFilter = (v: string) => setFilter('status', v);

  const startDate = useMemo(
    () => (filters.startDate ? new Date(filters.startDate) : undefined),
    [filters.startDate]
  );
  const setStartDate = (d: Date | undefined) =>
    setFilter('startDate', d ? formatLocalDate(d) : '');

  const endDate = useMemo(
    () => (filters.endDate ? new Date(filters.endDate) : undefined),
    [filters.endDate]
  );
  const setEndDate = (d: Date | undefined) =>
    setFilter('endDate', d ? formatLocalDate(d) : '');

  const selectedAccounts = useMemo(
    () =>
      filters.accounts ? filters.accounts.split(',').map(Number).filter(Boolean) : [],
    [filters.accounts]
  );
  const toggleAccount = (id: number) => {
    const next = selectedAccounts.includes(id)
      ? selectedAccounts.filter((a) => a !== id)
      : [...selectedAccounts, id];
    setFilter('accounts', next.length ? next.join(',') : '');
  };

  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const params = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (categoryFilter !== 'all') p.category = categoryFilter;
    if (statusFilter !== 'all') p.payed = statusFilter === 'paid' ? 'true' : 'false';
    if (startDate) p.date_from = formatLocalDate(startDate);
    if (endDate) p.date_to = formatLocalDate(endDate);
    if (selectedAccounts.length > 0) p.accounts = selectedAccounts.join(',');
    return p;
  }, [
    debouncedSearch,
    categoryFilter,
    statusFilter,
    startDate,
    endDate,
    selectedAccounts,
  ]);

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', params],
    queryFn: () => expensesService.getAll(params),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ['loans'],
    queryFn: () => loansService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: () => payablesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const invalidateExpenses = () =>
    queryClient.invalidateQueries({ queryKey: ['expenses'] });

  const createMutation = useMutation({
    mutationFn: (data: ExpenseFormData) => expensesService.create(data),
    onSuccess: () => {
      void invalidateExpenses();
      toast({
        title: t('pages.expenses.created'),
        description: t('pages.expenses.createdDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseFormData }) =>
      expensesService.update(id, data),
    onSuccess: () => {
      void invalidateExpenses();
      toast({
        title: t('pages.expenses.updated'),
        description: t('pages.expenses.updatedDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const { deletingIds: deletingExpenseIds, handleDelete: optimisticDelete } =
    useOptimisticDelete<Expense>({
      queryKey: ['expenses', params],
      deleteFn: (id) => expensesService.delete(id as number),
      getItemId: (e) => e.id,
      resourceName: t('pages.expenses.resource'),
      onSuccess: () => {
        toast({
          title: t('pages.expenses.deleted'),
          description: t('pages.expenses.deletedDesc'),
        });
      },
    });

  const isLoading = expensesLoading || accountsLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const clearFilters = resetFilters;

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

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
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
    await optimisticDelete(id);
  };

  const handleSubmit = (data: ExpenseFormData) => {
    if (selectedExpense) {
      updateMutation.mutate({ id: selectedExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleExport = async (modalParams: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => {
    const exportParams: ExpenseExportParams = {
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
      await expensesService.exportExpenses(exportParams);
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
    expenses
      .filter(
        (e) => !e.related_transfer && !e.is_transfer_generated && !e.is_initial_balance
      )
      .map((e) => ({ value: parseFloat(e.value) })),
    'value'
  );
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
          {expense.account_name ?? 'N/A'}
        </Badge>
      ),
    },
    {
      key: 'category',
      label: t('pages.expenses.columns.category'),
      render: (expense) => (
        <div className="flex items-center gap-xs">
          <Badge variant="secondary">
            {translate('expenseCategories', expense.category)}
          </Badge>
          {expense.auto_categorized && (
            <Badge
              variant="outline"
              className="px-xs py-0 text-xs text-muted-foreground"
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

  return {
    expenses,
    accounts,
    loans,
    payables,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedExpense,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedAccounts,
    isExportModalOpen,
    setIsExportModalOpen,
    toggleAccount,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    deletingExpenseIds,
    handleSubmit,
    handleExport,
    totalExpenses,
    hasActiveFilters,
    columns,
    prefillExpenseData,
  };
}
