import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  Filter,
  ChevronDown,
  Download,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { ExportModal } from '@/components/common/ExportModal';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { RevenueForm } from '@/components/revenues/RevenueForm';
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
import { TRANSLATIONS, translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { loansService } from '@/services/loans-service';
import type { RevenueExportParams } from '@/services/revenues-service';
import { revenuesService } from '@/services/revenues-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Revenue, RevenueFormData, Account, Loan } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Revenues() {
  const { t } = useTranslation();
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [filteredRevenues, setFilteredRevenues] = useState<Revenue[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<Revenue | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
    void loadData();
  }, []);

  useEffect(() => {
    filterRevenues();
  }, [
    searchTerm,
    categoryFilter,
    statusFilter,
    startDate,
    endDate,
    selectedAccounts,
    revenues,
  ]);

  const filterRevenues = () => {
    let filtered = [...revenues];
    if (searchTerm) {
      filtered = filtered.filter(
        (r) =>
          r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.source?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => r.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) =>
        statusFilter === 'received' ? r.received : !r.received
      );
    }
    if (startDate) {
      filtered = filtered.filter((r) => new Date(r.date) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((r) => new Date(r.date) <= endDate);
    }
    if (selectedAccounts.length > 0) {
      filtered = filtered.filter((r) => selectedAccounts.includes(r.account));
    }
    setFilteredRevenues(filtered);
  };

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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [revenuesData, accountsData, loansData] = await Promise.all([
        revenuesService.getAll(),
        accountsService.getAll(),
        loansService.getAll(),
      ]);
      setRevenues(revenuesData);
      setFilteredRevenues(revenuesData);
      setAccounts(accountsData);
      setLoans(Array.isArray(loansData) ? loansData : []);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: RevenueFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedRevenue) {
        await revenuesService.update(selectedRevenue.id, data);
        toast({
          title: t('pages.revenues.updated'),
          description: t('pages.revenues.updatedDesc'),
        });
      } else {
        await revenuesService.create(data);
        toast({
          title: t('pages.revenues.created'),
          description: t('pages.revenues.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
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
        description: t('pages.revenues.noAccountMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedRevenue(undefined);
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
      toast({
        title: t('pages.revenues.deleted'),
        description: t('pages.revenues.deletedDesc'),
      });
      void loadData();
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
    const params: RevenueExportParams = {
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
      await revenuesService.exportRevenues(params);
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
    filteredRevenues.map((r) => ({ value: parseFloat(r.value) })),
    'value'
  );

  const handleEdit = (revenue: Revenue) => {
    setSelectedRevenue(revenue);
    setIsDialogOpen(true);
  };

  // Definir colunas da tabela
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
        <span className="text-sm">{revenue.account_name || 'N/A'}</span>
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
          {revenue.member_name && (
            <div className="text-xs">Membro: {revenue.member_name}</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('pages.revenues.title')} icon={<TrendingUp />}>
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
            {t('pages.revenues.newBtn')}
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
            placeholder={t('pages.revenues.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.revenues.allCategories')}</SelectItem>
              {Object.entries(TRANSLATIONS.revenueCategories).map(([k, v]) => (
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
              <SelectItem value="all">{t('pages.revenues.allStatus')}</SelectItem>
              <SelectItem value="received">Recebido</SelectItem>
              <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <span className="text-sm">{t('pages.revenues.dateFrom')}</span>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="De..."
              clearable
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">{t('pages.revenues.dateTo')}</span>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Até..."
              clearable
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">{t('common.fields.account')}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedAccounts.length === 0
                    ? t('pages.revenues.allAccounts')
                    : t('pages.revenues.selectedAccounts', {
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
            {t('pages.revenues.foundRevenues', { count: filteredRevenues.length })}
          </span>
          <span className="text-lg font-bold text-success">
            {t('pages.revenues.total')} {formatCurrency(totalRevenues)}
          </span>
        </div>
      </div>

      <DataTable
        data={filteredRevenues}
        columns={columns}
        keyExtractor={(revenue) => revenue.id}
        isLoading={isLoading}
        emptyState={{
          message: t('pages.revenues.emptyState'),
        }}
        actions={(revenue) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'revenue', data: revenue }}
              memberName={getMemberDisplayName(revenue.member_name, user)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(revenue)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(revenue.id)}
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
        title={t('pages.revenues.exportTitle')}
        description={t('pages.revenues.exportDesc')}
        onExport={handleExport}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRevenue
                ? t('pages.revenues.editTitle')
                : t('pages.revenues.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedRevenue
                ? t('pages.revenues.editDesc')
                : t('pages.revenues.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <RevenueForm
            revenue={selectedRevenue}
            accounts={accounts}
            loans={loans}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
