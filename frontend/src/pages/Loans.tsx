import { Plus, Pencil, Trash2, Loader2, Download, HandCoins } from 'lucide-react';
import { useState, useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { loansService } from '@/services/loans-service';
import { membersService } from '@/services/members-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Loan, LoanFormData, Account, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';
const EXPENSE_CATEGORIES = [
  'food and drink',
  'bills and services',
  'electronics',
  'family and friends',
  'pets',
  'digital signs',
  'house',
  'purchases',
  'donate',
  'education',
  'loans',
  'entertainment',
  'taxes',
  'investments',
  'others',
  'vestuary',
  'health and care',
  'professional services',
  'supermarket',
  'rates',
  'transport',
  'travels',
];

const PAYMENT_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
];
const LOAN_STATUSES = ['active', 'paid', 'defaulted', 'cancelled'];

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<LoanFormData>({
    description: '',
    value: 0,
    payed_value: 0,
    date: formatLocalDate(new Date()),
    horary: new Date().toTimeString().slice(0, 5),
    category: 'loans',
    account: 0,
    benefited: 0,
    creditor: 0,
    payed: false,
    installments: 1,
    payment_frequency: 'monthly',
    late_fee: 0,
    status: 'active',
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loansData, accountsData, membersData] = await Promise.all([
        loansService.getAll(),
        accountsService.getAll(),
        membersService.getAll(),
      ]);
      setLoans(Array.isArray(loansData) ? loansData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      setLoans([]);
      setAccounts([]);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    if (accounts.length === 0 || members.length === 0) {
      const missing = [];
      if (accounts.length === 0) missing.push('contas');
      if (members.length === 0) missing.push('membros');

      toast({
        title: 'Ação não permitida',
        description: `É necessário ter ${missing.join(' e ')} cadastrados antes de criar um empréstimo.`,
        variant: 'destructive',
      });
      return;
    }
    setSelectedLoan(undefined);
    setFormData({
      description: '',
      value: 0,
      payed_value: 0,
      date: formatLocalDate(new Date()),
      horary: new Date().toTimeString().slice(0, 5),
      category: 'loans',
      account: accounts[0]?.id || 0,
      benefited: members[0]?.id || 0,
      creditor: members[0]?.id || 0,
      payed: false,
      installments: 1,
      payment_frequency: 'monthly',
      late_fee: 0,
      status: 'active',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setSelectedLoan(loan);
    setFormData({
      description: loan.description,
      value: parseFloat(loan.value),
      payed_value: parseFloat(loan.payed_value),
      date: loan.date,
      horary: loan.horary,
      category: loan.category,
      account: loan.account,
      benefited: loan.benefited,
      creditor: loan.creditor,
      payed: loan.payed,
      interest_rate: loan.interest_rate ? parseFloat(loan.interest_rate) : undefined,
      installments: loan.installments,
      due_date: loan.due_date,
      payment_frequency: loan.payment_frequency,
      late_fee: parseFloat(loan.late_fee),
      guarantor: loan.guarantor,
      notes: loan.notes,
      status: loan.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (loan: Loan) => {
    const confirmed = await showConfirm({
      title: 'Confirmar exclusão',
      description: `Tem certeza que deseja excluir o empréstimo "${loan.description}"?`,
    });

    if (confirmed) {
      try {
        await loansService.delete(loan.id);
        toast({
          title: 'Empréstimo excluído',
          description: 'O empréstimo foi excluído com sucesso.',
        });
        void loadData();
      } catch (error: unknown) {
        toast({
          title: 'Erro ao excluir',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedLoan) {
        // Exclude payed_value when updating to preserve auto-calculated value
        const { payed_value: _payed_value, ...updateData } = formData;
        await loansService.update(selectedLoan.id, updateData);
        toast({
          title: 'Empréstimo atualizado',
          description: 'O empréstimo foi atualizado com sucesso.',
        });
      } else {
        await loansService.create(formData);
        toast({
          title: 'Empréstimo criado',
          description: 'O empréstimo foi criado com sucesso.',
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

  const filteredLoans = loans.filter(
    (loan) =>
      loan.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.benefited_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      active: 'default',
      paid: 'secondary',
      defaulted: 'destructive',
      cancelled: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {translate('loanStatus', status)}
      </Badge>
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Empréstimos"
        icon={<HandCoins />}
        action={{
          label: 'Novo Empréstimo',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder="Buscar empréstimos..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
      </div>

      {filteredLoans.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum empréstimo encontrado para a pesquisa atual.'
              : 'Nenhum empréstimo cadastrado. Clique em "Novo Empréstimo" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLoans.map((loan) => (
            <div
              key={loan.id}
              className="space-y-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{loan.description}</h3>
                  <p className="text-sm">
                    {translate('expenseCategories', loan.category)}
                  </p>
                </div>
                {getStatusBadge(loan.status)}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor Total:</span>
                  <span className="font-medium">{formatCurrency(loan.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Pago:</span>
                  <span className="font-medium">
                    {formatCurrency(loan.payed_value)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Saldo:</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(
                      parseFloat(loan.value) - parseFloat(loan.payed_value)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Beneficiado:</span>
                  <span className="font-medium">{loan.benefited_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Credor:</span>
                  <span className="font-medium">{loan.creditor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Parcelas:</span>
                  <span className="font-medium">{loan.installments}x</span>
                </div>
                {loan.due_date && (
                  <div className="flex justify-between">
                    <span>Vencimento:</span>
                    <span className="font-medium">
                      {formatDate(loan.due_date, 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t pt-2">
                <ReceiptButton
                  source={{ type: 'loan', data: loan }}
                  memberName={getMemberDisplayName(loan.benefited_name, user)}
                  variant="outline"
                  size="sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(loan)}
                  className="flex-1"
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(loan)}
                  className="flex-1"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Excluir
                </Button>
                {loan.contract_document && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={loan.contract_document} download>
                      <Download className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLoan ? 'Editar Empréstimo' : 'Novo Empréstimo'}
            </DialogTitle>
            <DialogDescription>
              {selectedLoan
                ? 'Atualize as informações do empréstimo'
                : 'Preencha as informações do novo empréstimo'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="value">Valor Total *</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="payed_value">
                  Valor Pago {selectedLoan ? '(Calculado)' : '*'}
                </Label>
                <Input
                  id="payed_value"
                  type="number"
                  step="0.01"
                  value={formData.payed_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payed_value: parseFloat(e.target.value),
                    })
                  }
                  required={!selectedLoan}
                  disabled={!!selectedLoan}
                  className={selectedLoan ? 'cursor-not-allowed bg-muted' : ''}
                />
                {selectedLoan && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Calculado automaticamente a partir das receitas/despesas vinculadas
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="date">Data *</Label>
                <DatePicker
                  value={formData.date || undefined}
                  onChange={(date) =>
                    setFormData({
                      ...formData,
                      date: date ? formatLocalDate(date) : '',
                    })
                  }
                  placeholder="Selecione a data"
                />
              </div>

              <div>
                <Label htmlFor="horary">Horário *</Label>
                <Input
                  id="horary"
                  type="time"
                  value={formData.horary}
                  onChange={(e) => setFormData({ ...formData, horary: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {translate('expenseCategories', cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="account">Conta *</Label>
                <Select
                  value={formData.account.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="benefited">Beneficiado *</Label>
                <Select
                  value={formData.benefited.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, benefited: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="creditor">Credor *</Label>
                <Select
                  value={formData.creditor.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, creditor: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="installments">Parcelas</Label>
                <Input
                  id="installments"
                  type="number"
                  value={formData.installments}
                  onChange={(e) =>
                    setFormData({ ...formData, installments: parseInt(e.target.value) })
                  }
                />
              </div>

              <div>
                <Label htmlFor="interest_rate">Taxa de Juros (%)</Label>
                <Input
                  id="interest_rate"
                  type="number"
                  step="0.01"
                  value={formData.interest_rate || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      interest_rate: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="due_date">Data de Vencimento</Label>
                <DatePicker
                  value={formData.due_date || undefined}
                  onChange={(date) =>
                    setFormData({
                      ...formData,
                      due_date: date ? formatLocalDate(date) : '',
                    })
                  }
                  placeholder="Selecione a data de vencimento"
                />
              </div>

              <div>
                <Label htmlFor="payment_frequency">Frequência de Pagamento</Label>
                <Select
                  value={formData.payment_frequency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {translate('paymentFrequency', freq)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="late_fee">Multa por Atraso</Label>
                <Input
                  id="late_fee"
                  type="number"
                  step="0.01"
                  value={formData.late_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, late_fee: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {translate('loanStatus', status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="guarantor">Avalista</Label>
                <Select
                  value={formData.guarantor?.toString() || 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      guarantor: value === 'none' ? null : parseInt(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id.toString()}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="contract_document">Documento do Contrato</Label>
                <Input
                  id="contract_document"
                  type="file"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contract_document: e.target.files?.[0] || null,
                    })
                  }
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="payed"
                  checked={formData.payed}
                  onChange={(e) =>
                    setFormData({ ...formData, payed: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="payed" className="cursor-pointer">
                  Empréstimo Pago
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
