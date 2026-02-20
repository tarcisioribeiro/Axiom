import { Plus, Pencil, Trash2, Filter, TrendingDown , ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

import { DataTable, type Column } from '@/components/common/DataTable';
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
import { loansService } from '@/services/loans-service';
import { payablesService } from '@/services/payables-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Expense, ExpenseFormData, Account, Loan, Payable } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | undefined>();
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
    filterExpenses();
  }, [
    searchTerm,
    categoryFilter,
    statusFilter,
    startDate,
    endDate,
    selectedAccounts,
    expenses,
  ]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [expensesData, accountsData, loansData, payablesData] = await Promise.all([
        expensesService.getAll(),
        accountsService.getAll(),
        loansService.getAll(),
        payablesService.getAll(),
      ]);
      setExpenses(expensesData);
      setFilteredExpenses(expensesData);
      setAccounts(accountsData);
      setLoans(Array.isArray(loansData) ? loansData : []);
      setPayables(Array.isArray(payablesData) ? payablesData : []);
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

  const filterExpenses = () => {
    let filtered = [...expenses];
    if (searchTerm) {
      filtered = filtered.filter((e) =>
        e.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => (statusFilter === 'paid' ? e.payed : !e.payed));
    }
    if (startDate) {
      filtered = filtered.filter((e) => new Date(e.date) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((e) => new Date(e.date) <= endDate);
    }
    if (selectedAccounts.length > 0) {
      filtered = filtered.filter((e) => selectedAccounts.includes(e.account));
    }
    setFilteredExpenses(filtered);
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

  const handleSubmit = async (data: ExpenseFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedExpense) {
        await expensesService.update(selectedExpense.id, data);
        toast({
          title: 'Despesa atualizada',
          description: 'A despesa foi atualizada com sucesso.',
        });
      } else {
        await expensesService.create(data);
        toast({
          title: 'Despesa criada',
          description: 'A despesa foi criada com sucesso.',
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
          'É necessário ter pelo menos uma conta cadastrada antes de criar uma despesa.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedExpense(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir despesa',
      description:
        'Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await expensesService.delete(id);
      toast({
        title: 'Despesa excluída',
        description: 'A despesa foi excluída com sucesso.',
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

  const totalExpenses = sumByProperty(
    filteredExpenses.map((e) => ({ value: parseFloat(e.value) })),
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
      label: 'Descrição',
      render: (expense) => <div className="font-medium">{expense.description}</div>,
    },
    {
      key: 'value',
      label: 'Valor',
      align: 'right',
      render: (expense) => (
        <span className="font-semibold text-destructive">
          {formatCurrency(expense.value)}
        </span>
      ),
    },
    {
      key: 'account_name',
      label: 'Conta',
      render: (expense) => (
        <Badge variant="outline" className="font-medium">
          {expense.account_name || 'N/A'}
        </Badge>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (expense) => (
        <Badge variant="secondary">
          {translate('expenseCategories', expense.category)}
        </Badge>
      ),
    },
    {
      key: 'payed',
      label: 'Status',
      render: (expense) => (
        <Badge variant={expense.payed ? 'success' : 'destructive'}>
          {expense.payed ? 'Pago' : 'Pendente'}
        </Badge>
      ),
    },
    {
      key: 'date',
      label: 'Data',
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
      <PageHeader
        title="Despesas"
        icon={<TrendingDown />}
        action={{
          label: 'Nova Despesa',
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
            placeholder="Buscar por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
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
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <span className="text-sm">Data Inicial</span>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="De..."
              clearable
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">Data Final</span>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Até..."
              clearable
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">Contas</span>
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
            {filteredExpenses.length} despesa(s) encontrada(s)
          </span>
          <span className="text-lg font-bold text-destructive">
            Total: {formatCurrency(totalExpenses)}
          </span>
        </div>
      </div>

      <DataTable
        data={filteredExpenses}
        columns={columns}
        keyExtractor={(expense) => expense.id}
        isLoading={isLoading}
        emptyState={{
          message: 'Nenhuma despesa encontrada.',
        }}
        actions={(expense) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'expense', data: expense }}
              memberName={getMemberDisplayName(expense.member_name, user)}
            />
            <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)} aria-label="Editar">
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)} aria-label="Excluir">
              <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense ? 'Editar Despesa' : 'Nova Despesa'}
            </DialogTitle>
            <DialogDescription>
              {selectedExpense
                ? 'Atualize as informações da despesa'
                : 'Adicione uma nova despesa ao sistema'}
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
