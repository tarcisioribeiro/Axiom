import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RevenueForm } from '@/components/revenues/RevenueForm';
import { ReceiptButton } from '@/components/receipts';
import { TRANSLATIONS } from '@/config/constants';
import { revenuesService } from '@/services/revenues-service';
import { accountsService } from '@/services/accounts-service';
import { loansService } from '@/services/loans-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/utils/error-utils';
import { translate } from '@/config/constants';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { sumByProperty } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import type { Revenue, RevenueFormData, Account, Loan } from '@/types';
import { PageContainer } from '@/components/common/PageContainer';

export default function Revenues() {
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
        title: 'Erro ao carregar dados',
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
          title: 'Receita atualizada',
          description: 'A receita foi atualizada com sucesso.',
        });
      } else {
        await revenuesService.create(data);
        toast({
          title: 'Receita criada',
          description: 'A receita foi criada com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
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
        title: 'Ação não permitida',
        description:
          'É necessário ter pelo menos uma conta cadastrada antes de criar uma receita.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedRevenue(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir receita',
      description:
        'Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await revenuesService.delete(id);
      toast({
        title: 'Receita excluída',
        description: 'A receita foi excluída com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
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
      label: 'Descrição',
      render: (revenue) => (
        <div>
          <div className="font-medium">{revenue.description}</div>
          {revenue.source && <div className="text-xs">Origem: {revenue.source}</div>}
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Valor',
      align: 'right',
      render: (revenue) => (
        <span className="font-semibold text-success">
          {formatCurrency(revenue.value)}
        </span>
      ),
    },
    {
      key: 'account',
      label: 'Conta',
      render: (revenue) => (
        <span className="text-sm">{revenue.account_name || 'N/A'}</span>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (revenue) => (
        <Badge variant="success">
          {translate('revenueCategories', revenue.category)}
        </Badge>
      ),
    },
    {
      key: 'received',
      label: 'Status',
      render: (revenue) => (
        <Badge variant={revenue.received ? 'success' : 'destructive'}>
          {revenue.received ? 'Recebido' : 'Pendente'}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: 'Data',
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
      <PageHeader
        title="Receitas"
        icon={<TrendingUp />}
        action={{
          label: 'Nova Receita',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-semibold">Filtros</span>
          </div>
          {(searchTerm ||
            categoryFilter !== 'all' ||
            statusFilter !== 'all' ||
            startDate ||
            endDate ||
            selectedAccounts.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Buscar por descrição ou origem..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
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
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="received">Recebido</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm">Data Inicial</label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="De..."
              clearable
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Data Final</label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Até..."
              clearable
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Contas</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedAccounts.length === 0
                    ? 'Todas as Contas'
                    : `${selectedAccounts.length} conta(s) selecionada(s)`}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2">
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {accounts.map((account) => (
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
            {filteredRevenues.length} receita(s) encontrada(s)
          </span>
          <span className="text-lg font-bold text-success">
            Total: {formatCurrency(totalRevenues)}
          </span>
        </div>
      </div>

      <DataTable
        data={filteredRevenues}
        columns={columns}
        keyExtractor={(revenue) => revenue.id}
        isLoading={isLoading}
        emptyState={{
          message: 'Nenhuma receita cadastrada.',
        }}
        actions={(revenue) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'revenue', data: revenue }}
              memberName={getMemberDisplayName(revenue.member_name, user)}
            />
            <Button variant="ghost" size="icon" onClick={() => handleEdit(revenue)} aria-label="Editar">
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(revenue.id)} aria-label="Excluir">
              <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRevenue ? 'Editar Receita' : 'Nova Receita'}
            </DialogTitle>
            <DialogDescription>
              {selectedRevenue
                ? 'Atualize as informações da receita'
                : 'Adicione uma nova receita ao sistema'}
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
