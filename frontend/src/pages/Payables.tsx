import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReceiptButton } from '@/components/receipts';
import { payablesService } from '@/services/payables-service';
import { membersService } from '@/services/members-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/utils/error-utils';
import { translate } from '@/config/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import type { Payable, PayableFormData, Member } from '@/types';
import { PageContainer } from '@/components/common/PageContainer';
import { formatLocalDate } from '@/lib/utils';

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

const PAYABLE_STATUSES = ['active', 'paid', 'overdue', 'cancelled'];

export default function Payables() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<Payable | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<PayableFormData>({
    description: '',
    value: 0,
    paid_value: 0,
    date: formatLocalDate(new Date()),
    category: 'others',
    status: 'active',
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [payablesData, memberData] = await Promise.all([
        payablesService.getAll(),
        membersService.getCurrentUserMember(),
      ]);
      setPayables(Array.isArray(payablesData) ? payablesData : []);
      setCurrentUserMember(memberData);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      setPayables([]);
      setCurrentUserMember(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPayable(undefined);
    setFormData({
      description: '',
      value: 0,
      paid_value: 0,
      date: formatLocalDate(new Date()),
      category: 'others',
      status: 'active',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (payable: Payable) => {
    setSelectedPayable(payable);
    setFormData({
      description: payable.description,
      value: parseFloat(payable.value),
      paid_value: parseFloat(payable.paid_value),
      date: payable.date,
      due_date: payable.due_date,
      category: payable.category,
      notes: payable.notes,
      status: payable.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (payable: Payable) => {
    const confirmed = await showConfirm({
      title: 'Confirmar exclusão',
      description: `Tem certeza que deseja excluir o valor a pagar "${payable.description}"?`,
    });

    if (confirmed) {
      try {
        await payablesService.delete(payable.id);
        toast({
          title: 'Valor a pagar excluído',
          description: 'O valor a pagar foi excluído com sucesso.',
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
      const dataToSend = {
        ...formData,
        member: currentUserMember?.id ?? null,
      };

      if (selectedPayable) {
        await payablesService.update(selectedPayable.id, dataToSend);
        toast({
          title: 'Valor a pagar atualizado',
          description: 'O valor a pagar foi atualizado com sucesso.',
        });
      } else {
        await payablesService.create(dataToSend);
        toast({
          title: 'Valor a pagar criado',
          description: 'O valor a pagar foi criado com sucesso.',
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

  const filteredPayables = payables.filter(
    (payable) =>
      payable.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payable.member_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      active: 'default',
      paid: 'secondary',
      overdue: 'destructive',
      cancelled: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {translate('payableStatus', status)}
      </Badge>
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Valores a Pagar"
        icon={<Receipt />}
        action={{
          label: 'Novo Valor a Pagar',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder="Buscar valores a pagar..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
      </div>

      {filteredPayables.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum valor a pagar encontrado para a pesquisa atual.'
              : 'Nenhum valor a pagar cadastrado. Clique em "Novo Pagamento" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPayables.map((payable) => (
            <div
              key={payable.id}
              className="space-y-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{payable.description}</h3>
                  <p className="text-sm">
                    {translate('expenseCategories', payable.category)}
                  </p>
                </div>
                {getStatusBadge(payable.status)}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor Total:</span>
                  <span className="font-medium">{formatCurrency(payable.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Pago:</span>
                  <span className="font-medium">
                    {formatCurrency(payable.paid_value)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Saldo Restante:</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(
                      parseFloat(payable.value) - parseFloat(payable.paid_value)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Data de Registro:</span>
                  <span className="font-medium">
                    {formatDate(payable.date, 'dd/MM/yyyy')}
                  </span>
                </div>
                {payable.due_date && (
                  <div className="flex justify-between">
                    <span>Vencimento:</span>
                    <span className="font-medium">
                      {formatDate(payable.due_date, 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
                {payable.member_name && (
                  <div className="flex justify-between">
                    <span>Responsável:</span>
                    <span className="font-medium">{payable.member_name}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t pt-2">
                <ReceiptButton
                  source={{ type: 'payable', data: payable }}
                  memberName={getMemberDisplayName(payable.member_name, user)}
                  variant="outline"
                  size="sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(payable)}
                  className="flex-1"
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(payable)}
                  className="flex-1"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPayable ? 'Editar Valor a Pagar' : 'Novo Valor a Pagar'}
            </DialogTitle>
            <DialogDescription>
              {selectedPayable
                ? 'Atualize as informações do valor a pagar'
                : 'Preencha as informações do novo valor a pagar'}
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
                  placeholder="Ex: Tratamento dentário, Conserto do carro"
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
                <Label htmlFor="paid_value">Valor Já Pago</Label>
                <Input
                  id="paid_value"
                  type="number"
                  step="0.01"
                  value={formData.paid_value || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, paid_value: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div>
                <Label htmlFor="date">Data de Registro *</Label>
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
                <Label htmlFor="due_date">Data de Vencimento</Label>
                <DatePicker
                  value={formData.due_date || undefined}
                  onChange={(date) =>
                    setFormData({
                      ...formData,
                      due_date: date ? formatLocalDate(date) : undefined,
                    })
                  }
                  placeholder="Selecione a data de vencimento"
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
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'active' | 'paid' | 'overdue' | 'cancelled') =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYABLE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {translate('payableStatus', status)}
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
                  placeholder="Informações adicionais sobre este valor a pagar"
                />
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
