import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
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
  handleSubmit: (data: ExpenseFormData) => Promise<void>;
  handleExport: (params: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => Promise<void>;
  totalExpenses: number;
  hasActiveFilters: boolean;
  columns: Column<Expense>[];
}

export function useExpensesPage(): UseExpensesPageReturn {
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
      if (statusFilter !== 'all') params.payed = statusFilter === 'paid' ? 'true' : 'false';
      if (startDate) params.date_from = formatLocalDate(startDate);
      if (endDate) params.date_to = formatLocalDate(endDate);
      if (selectedAccounts.length > 0) params.accounts = selectedAccounts.join(',');
      const data = await expensesService.getAll(params);
      setExpenses(data);
    } catch (error: unknown) {
      toast({ title: t('common.messages.loadError'), description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, categoryFilter, statusFilter, startDate, endDate, selectedAccounts, t, toast]);

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
        toast({ title: t('common.messages.loadError'), description: getErrorMessage(error), variant: 'destructive' });
      }
    };
    void loadReferenceData();
  }, [t, toast]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const toggleAccount = (accountId: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
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

  const handleCreate = () => {
    if (accounts.length === 0) {
      toast({ title: t('common.messages.actionDenied'), description: t('pages.expenses.noAccountMsg'), variant: 'destructive' });
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
    try {
      await expensesService.delete(id);
      toast({ title: t('pages.expenses.deleted'), description: t('pages.expenses.deletedDesc') });
      void loadExpenses();
    } catch (error: unknown) {
      toast({ title: t('common.messages.deleteError'), description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleSubmit = async (data: ExpenseFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedExpense) {
        await expensesService.update(selectedExpense.id, data);
        toast({ title: t('pages.expenses.updated'), description: t('pages.expenses.updatedDesc') });
      } else {
        await expensesService.create(data);
        toast({ title: t('pages.expenses.created'), description: t('pages.expenses.createdDesc') });
      }
      setIsDialogOpen(false);
      void loadExpenses();
    } catch (error: unknown) {
      toast({ title: t('common.messages.saveError'), description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
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
      payed: statusFilter !== 'all' ? (statusFilter === 'paid' ? 'true' : 'false') : undefined,
      search: searchTerm || undefined,
      account: selectedAccounts.length > 0 ? selectedAccounts : undefined,
    };
    try {
      await expensesService.exportExpenses(params);
      toast({ title: t('common.messages.exportSuccess'), description: t('common.messages.exportSuccessDesc') });
    } catch (error: unknown) {
      toast({ title: t('common.messages.exportError'), description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const totalExpenses = sumByProperty(expenses.map((e) => ({ value: parseFloat(e.value) })), 'value');
  const hasActiveFilters = !!searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || !!startDate || !!endDate || selectedAccounts.length > 0;

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
        <span className="font-semibold text-destructive">{formatCurrency(expense.value)}</span>
      ),
    },
    {
      key: 'account_name',
      label: t('pages.expenses.columns.account'),
      render: (expense) => (
        <Badge variant="outline" className="font-medium">{expense.account_name ?? 'N/A'}</Badge>
      ),
    },
    {
      key: 'category',
      label: t('pages.expenses.columns.category'),
      render: (expense) => (
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{translate('expenseCategories', expense.category)}</Badge>
          {expense.auto_categorized && (
            <Badge variant="outline" className="px-1 py-0 text-xs text-muted-foreground">Auto</Badge>
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
          {expense.member_name && <div className="text-xs">Membro: {expense.member_name}</div>}
        </div>
      ),
    },
  ];

  return {
    expenses, accounts, loans, payables, isLoading,
    isDialogOpen, setIsDialogOpen, selectedExpense, isSubmitting,
    searchTerm, setSearchTerm, categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter, startDate, setStartDate,
    endDate, setEndDate, selectedAccounts,
    isExportModalOpen, setIsExportModalOpen,
    toggleAccount, clearFilters,
    handleCreate, handleEdit, handleDelete, handleSubmit, handleExport,
    totalExpenses, hasActiveFilters, columns,
  };
}
