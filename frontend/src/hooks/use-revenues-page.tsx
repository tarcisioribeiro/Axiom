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
import { loansService } from '@/services/loans-service';
import type { RevenueExportParams } from '@/services/revenues-service';
import { revenuesService } from '@/services/revenues-service';
import type { Revenue, RevenueFormData, Account, Loan } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import type { Column } from '../components/common/DataTable';

export interface UseRevenuesPageReturn {
  revenues: Revenue[];
  accounts: Account[];
  loans: Loan[];
  isLoading: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedRevenue: Revenue | undefined;
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
  handleEdit: (revenue: Revenue) => void;
  handleDelete: (id: number) => Promise<void>;
  handleSubmit: (data: RevenueFormData) => Promise<void>;
  handleExport: (params: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => Promise<void>;
  totalRevenues: number;
  hasActiveFilters: boolean;
  columns: Column<Revenue>[];
}

export function useRevenuesPage(): UseRevenuesPageReturn {
  const { t } = useTranslation();
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<Revenue | undefined>();
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

  const loadRevenues = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, unknown> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (statusFilter !== 'all') params.received = statusFilter === 'received' ? 'true' : 'false';
      if (startDate) params.date_from = formatLocalDate(startDate);
      if (endDate) params.date_to = formatLocalDate(endDate);
      if (selectedAccounts.length > 0) params.accounts = selectedAccounts.join(',');
      const data = await revenuesService.getAll(params);
      setRevenues(data);
    } catch (error: unknown) {
      toast({ title: t('common.messages.loadError'), description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, categoryFilter, statusFilter, startDate, endDate, selectedAccounts, t, toast]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [accountsData, loansData] = await Promise.all([
          accountsService.getAll(),
          loansService.getAll(),
        ]);
        setAccounts(accountsData);
        setLoans(Array.isArray(loansData) ? loansData : []);
      } catch (error: unknown) {
        toast({ title: t('common.messages.loadError'), description: getErrorMessage(error), variant: 'destructive' });
      }
    };
    void loadReferenceData();
  }, [t, toast]);

  useEffect(() => {
    void loadRevenues();
  }, [loadRevenues]);

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
      toast({ title: t('common.messages.actionDenied'), description: t('pages.revenues.noAccountMsg'), variant: 'destructive' });
      return;
    }
    setSelectedRevenue(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (revenue: Revenue) => {
    setSelectedRevenue(revenue);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.revenues.deleteTitle'),
      description: t('pages.revenues.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await revenuesService.delete(id);
      toast({ title: t('pages.revenues.deleted'), description: t('pages.revenues.deletedDesc') });
      void loadRevenues();
    } catch (error: unknown) {
      toast({ title: t('common.messages.deleteError'), description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleSubmit = async (data: RevenueFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedRevenue) {
        await revenuesService.update(selectedRevenue.id, data);
        toast({ title: t('pages.revenues.updated'), description: t('pages.revenues.updatedDesc') });
      } else {
        await revenuesService.create(data);
        toast({ title: t('pages.revenues.created'), description: t('pages.revenues.createdDesc') });
      }
      setIsDialogOpen(false);
      void loadRevenues();
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
    const params: RevenueExportParams = {
      export_format: modalParams.export_format,
      date_from: modalParams.date_from,
      date_to: modalParams.date_to,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      received: statusFilter !== 'all' ? (statusFilter === 'received' ? 'true' : 'false') : undefined,
      search: searchTerm || undefined,
      account: selectedAccounts.length > 0 ? selectedAccounts : undefined,
    };
    try {
      await revenuesService.exportRevenues(params);
      toast({ title: t('common.messages.exportSuccess'), description: t('common.messages.exportSuccessDesc') });
    } catch (error: unknown) {
      toast({ title: t('common.messages.exportError'), description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const totalRevenues = sumByProperty(revenues.map((r) => ({ value: parseFloat(r.value) })), 'value');
  const hasActiveFilters = !!searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || !!startDate || !!endDate || selectedAccounts.length > 0;

  const columns: Column<Revenue>[] = [
    {
      key: 'description',
      label: t('pages.revenues.columns.description'),
      render: (revenue) => (
        <div>
          <div className="font-medium">{revenue.description}</div>
          {revenue.source && <div className="text-xs">Origem: {revenue.source}</div>}
        </div>
      ),
    },
    {
      key: 'value',
      label: t('pages.revenues.columns.amount'),
      align: 'right',
      render: (revenue) => (
        <span className="font-semibold text-success">{formatCurrency(revenue.value)}</span>
      ),
    },
    {
      key: 'account',
      label: t('pages.revenues.columns.account'),
      render: (revenue) => <span className="text-sm">{revenue.account_name ?? 'N/A'}</span>,
    },
    {
      key: 'category',
      label: t('pages.revenues.columns.category'),
      render: (revenue) => (
        <Badge variant="success">{translate('revenueCategories', revenue.category)}</Badge>
      ),
    },
    {
      key: 'received',
      label: t('pages.revenues.columns.status'),
      render: (revenue) => (
        <Badge variant={revenue.received ? 'success' : 'destructive'}>
          {revenue.received ? 'Recebido' : t('common.status.pending')}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: t('pages.revenues.columns.date'),
      render: (revenue) => (
        <div>
          <div className="text-sm">{formatDateTime(revenue.date, revenue.horary)}</div>
          {revenue.member_name && <div className="text-xs">Membro: {revenue.member_name}</div>}
        </div>
      ),
    },
  ];

  return {
    revenues, accounts, loans, isLoading,
    isDialogOpen, setIsDialogOpen, selectedRevenue, isSubmitting,
    searchTerm, setSearchTerm, categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter, startDate, setStartDate,
    endDate, setEndDate, selectedAccounts,
    isExportModalOpen, setIsExportModalOpen,
    toggleAccount, clearFilters,
    handleCreate, handleEdit, handleDelete, handleSubmit, handleExport,
    totalRevenues, hasActiveFilters, columns,
  };
}
