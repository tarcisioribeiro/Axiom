/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import type { RevenuePrefillData } from '@/components/revenues/RevenueForm';
import { Badge } from '@/components/ui/badge';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { STALE_TIMES } from '@/lib/query-client';
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
  handleSubmit: (data: RevenueFormData) => void;
  handleExport: (params: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => Promise<void>;
  totalRevenues: number;
  hasActiveFilters: boolean;
  columns: Column<Revenue>[];
  prefillRevenueData: RevenuePrefillData | undefined;
}

export function useRevenuesPage(): UseRevenuesPageReturn {
  const location = useLocation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const locationState = location.state as {
    prefillRevenue?: RevenuePrefillData;
  } | null;
  const [isDialogOpen, setIsDialogOpen] = useState(!!locationState?.prefillRevenue);
  const [selectedRevenue, setSelectedRevenue] = useState<Revenue | undefined>();
  const prefillRevenueData = locationState?.prefillRevenue;
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

  const params = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (categoryFilter !== 'all') p.category = categoryFilter;
    if (statusFilter !== 'all')
      p.received = statusFilter === 'received' ? 'true' : 'false';
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

  const { data: revenues = [], isLoading: revenuesLoading } = useQuery({
    queryKey: ['revenues', params],
    queryFn: () => revenuesService.getAll(params),
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

  const invalidateRevenues = () =>
    queryClient.invalidateQueries({ queryKey: ['revenues'] });

  const createMutation = useMutation({
    mutationFn: (data: RevenueFormData) => revenuesService.create(data),
    onSuccess: () => {
      void invalidateRevenues();
      toast({
        title: t('pages.revenues.created'),
        description: t('pages.revenues.createdDesc'),
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
    mutationFn: ({ id, data }: { id: number; data: RevenueFormData }) =>
      revenuesService.update(id, data),
    onSuccess: () => {
      void invalidateRevenues();
      toast({
        title: t('pages.revenues.updated'),
        description: t('pages.revenues.updatedDesc'),
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => revenuesService.delete(id),
    onSuccess: () => {
      void invalidateRevenues();
      toast({
        title: t('pages.revenues.deleted'),
        description: t('pages.revenues.deletedDesc'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const isLoading = revenuesLoading || accountsLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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

  const handleCreate = () => {
    if (accounts.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.revenues.noAccountMsg'),
        variant: 'destructive',
      });
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
    deleteMutation.mutate(id);
  };

  const handleSubmit = (data: RevenueFormData) => {
    if (selectedRevenue) {
      updateMutation.mutate({ id: selectedRevenue.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleExport = async (modalParams: {
    export_format: 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }) => {
    const exportParams: RevenueExportParams = {
      export_format: modalParams.export_format,
      date_from: modalParams.date_from,
      date_to: modalParams.date_to,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      received:
        statusFilter !== 'all'
          ? statusFilter === 'received'
            ? 'true'
            : 'false'
          : undefined,
      search: searchTerm || undefined,
      account: selectedAccounts.length > 0 ? selectedAccounts : undefined,
    };
    try {
      await revenuesService.exportRevenues(exportParams);
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

  const totalRevenues = sumByProperty(
    revenues
      .filter(
        (r) => !r.related_transfer && !r.is_transfer_generated && !r.is_initial_balance
      )
      .map((r) => ({ value: parseFloat(r.value) })),
    'value'
  );
  const hasActiveFilters =
    !!searchTerm ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    !!startDate ||
    !!endDate ||
    selectedAccounts.length > 0;

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
        <span className="font-semibold text-success">
          {formatCurrency(revenue.value)}
        </span>
      ),
    },
    {
      key: 'account',
      label: t('pages.revenues.columns.account'),
      render: (revenue) => (
        <span className="text-sm">{revenue.account_name ?? 'N/A'}</span>
      ),
    },
    {
      key: 'category',
      label: t('pages.revenues.columns.category'),
      render: (revenue) => (
        <Badge variant="success">
          {translate('revenueCategories', revenue.category)}
        </Badge>
      ),
    },
    {
      key: 'received',
      label: t('pages.revenues.columns.status'),
      render: (revenue) => (
        <Badge variant={revenue.received ? 'success' : 'destructive'}>
          {revenue.received
            ? t('pages.revenues.statusReceived')
            : t('common.status.pending')}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: t('pages.revenues.columns.date'),
      render: (revenue) => (
        <div>
          <div className="text-sm">{formatDateTime(revenue.date, revenue.horary)}</div>
          {revenue.member_name && (
            <div className="text-xs">Membro: {revenue.member_name}</div>
          )}
        </div>
      ),
    },
  ];

  return {
    revenues,
    accounts,
    loans,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedRevenue,
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
    handleSubmit,
    handleExport,
    totalRevenues,
    hasActiveFilters,
    columns,
    prefillRevenueData,
  };
}
