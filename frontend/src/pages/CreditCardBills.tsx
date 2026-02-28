import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  CreditCard as CreditCardIcon,
  Receipt,
  Wallet,
  RotateCcw,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { BillPaymentForm } from '@/components/credit-cards/BillPaymentForm';
import { CreditCardBillForm } from '@/components/credit-cards/CreditCardBillForm';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { translate, TRANSLATIONS } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  CreditCardBill,
  CreditCardBillFormData,
  CreditCard,
  BillPaymentFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function CreditCardBills() {
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<CreditCardBill[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<CreditCardBill | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    filterBills();
  }, [cardFilter, statusFilter, yearFilter, bills]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [billsData, cardsData] = await Promise.all([
        creditCardBillsService.getAll(),
        creditCardsService.getAll(),
      ]);
      setBills(billsData);
      setFilteredBills(billsData);
      setCreditCards(cardsData);
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

  // Mapeamento de abreviações de mês para número
  const MONTH_TO_NUMBER: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };

  const filterBills = () => {
    let filtered = [...bills];
    if (cardFilter !== 'all') {
      filtered = filtered.filter((b) => b.credit_card.toString() === cardFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }
    if (yearFilter !== 'all') {
      filtered = filtered.filter((b) => b.year === yearFilter);
    }

    // Sort bills: current open bill first, then by date (oldest to newest)
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    filtered.sort((a, b) => {
      const aMonth = MONTH_TO_NUMBER[a.month] || 1;
      const bMonth = MONTH_TO_NUMBER[b.month] || 1;

      // Check if bill is current (current month and year, not paid)
      const aIsCurrent =
        aMonth === currentMonth &&
        parseInt(a.year) === currentYear &&
        a.status !== 'paid';
      const bIsCurrent =
        bMonth === currentMonth &&
        parseInt(b.year) === currentYear &&
        b.status !== 'paid';

      // Current open bill always first
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      // Open/overdue bills before paid/closed ones
      const aIsOpen = a.status === 'open' || a.status === 'overdue';
      const bIsOpen = b.status === 'open' || b.status === 'overdue';
      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;

      // Then sort by date (oldest to newest)
      const aDate = new Date(parseInt(a.year), aMonth - 1);
      const bDate = new Date(parseInt(b.year), bMonth - 1);
      return aDate.getTime() - bDate.getTime();
    });

    setFilteredBills(filtered);
  };

  const handleSubmit = async (data: CreditCardBillFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedBill) {
        await creditCardBillsService.update(selectedBill.id, data);
        toast({
          title: 'Fatura atualizada',
          description: 'A fatura foi atualizada com sucesso.',
        });
      } else {
        await creditCardBillsService.create(data);
        toast({
          title: 'Fatura criada',
          description: 'A fatura foi criada com sucesso.',
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
    if (creditCards.length === 0) {
      toast({
        title: 'Ação não permitida',
        description:
          'É necessário ter pelo menos um cartão de crédito cadastrado antes de criar uma fatura.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedBill(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir fatura',
      description:
        'Tem certeza que deseja excluir esta fatura? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await creditCardBillsService.delete(id);
      toast({
        title: 'Fatura excluída',
        description: 'A fatura foi excluída com sucesso.',
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

  const handleOpenPayment = (bill: CreditCardBill) => {
    setSelectedBill(bill);
    setIsPaymentDialogOpen(true);
  };

  const handlePayment = async (data: BillPaymentFormData) => {
    if (!selectedBill) return;
    try {
      setIsPaymentSubmitting(true);
      const response = await creditCardBillsService.payBill(selectedBill.id, data);
      toast({
        title: 'Pagamento realizado',
        description: `Pagamento de ${formatCurrency(response.payment.amount)} processado com sucesso. Novo limite: ${formatCurrency(response.card.credit_limit)}`,
      });
      setIsPaymentDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao processar pagamento',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleReopenBill = async (bill: CreditCardBill) => {
    const confirmed = await showConfirm({
      title: 'Reabrir fatura',
      description: `Deseja reabrir a fatura de ${translate('months', bill.month)}/${bill.year}? Isso permitirá adicionar ou remover lançamentos.`,
      confirmText: 'Reabrir',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await creditCardBillsService.reopenBill(bill.id);
      toast({
        title: 'Fatura reaberta',
        description: 'A fatura foi reaberta com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao reabrir fatura',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const getCardName = (bill: CreditCardBill) => {
    // Usa os dados que vêm diretamente da fatura (do backend expandido)
    const cardholderName = bill.credit_card_on_card_name || 'N/A';
    const last4 = bill.credit_card_number_masked || '****';

    // Verifica se last4 contém apenas dígitos e tem 4 caracteres
    const isValidNumber = last4 !== '****' && /^\d{4}$/.test(last4);
    const cardNumber = isValidNumber ? `**** ${last4}` : '';

    const flag = bill.credit_card_flag
      ? translate('cardBrands', bill.credit_card_flag)
      : '';

    // Formato: {nome_cartao} **** {4 últimos} - {bandeira}
    const parts = [cardholderName];
    if (cardNumber) parts.push(cardNumber);
    if (flag) parts.push(`- ${flag}`);

    return parts.join(' ');
  };

  const handleEdit = (bill: CreditCardBill) => {
    setSelectedBill(bill);
    setIsDialogOpen(true);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  // Definir colunas da tabela
  const columns: Column<CreditCardBill>[] = [
    {
      key: 'credit_card',
      label: 'Cartão',
      render: (bill) => (
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4" />
          <span className="font-medium">{getCardName(bill)}</span>
        </div>
      ),
    },
    {
      key: 'period',
      label: 'Período',
      render: (bill) => `${translate('months', bill.month)}/${bill.year}`,
    },
    {
      key: 'total_amount',
      label: 'Valor Total',
      align: 'right',
      render: (bill) => (
        <span className="font-semibold">{formatCurrency(bill.total_amount)}</span>
      ),
    },
    {
      key: 'minimum_payment',
      label: 'Pag. Mínimo',
      align: 'right',
      render: (bill) => (
        <span className="text-sm font-medium text-warning">
          {formatCurrency(bill.minimum_payment)}
        </span>
      ),
    },
    {
      key: 'paid_amount',
      label: 'Pago',
      align: 'right',
      render: (bill) => (
        <span className="font-semibold text-success">
          {formatCurrency(bill.paid_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (bill) => (
        <Badge
          variant={
            bill.status === 'paid'
              ? 'success'
              : bill.status === 'overdue'
                ? 'destructive'
                : bill.status === 'closed'
                  ? 'secondary'
                  : 'default'
          }
        >
          {translate('billStatus', bill.status)}
        </Badge>
      ),
    },
    {
      key: 'due_date',
      label: 'Vencimento',
      render: (bill) => (
        <span className="text-sm">
          {bill.due_date ? formatDate(bill.due_date) : 'N/A'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Faturas de Cartão"
        icon={<Receipt />}
        action={{
          label: 'Nova Fatura',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-semibold">Filtros</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Select value={cardFilter} onValueChange={setCardFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os Cartões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Cartões</SelectItem>
              {creditCards.map((c) => {
                const masked = c.card_number_masked || '****';
                const digitsOnly = masked.replace(/[^\d]/g, '');
                const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : '****';
                const hasValidNumber = last4 !== '****' && /^\d{4}$/.test(last4);
                const cardNumber = hasValidNumber ? `**** ${last4}` : '';
                const brandName = translate('cardBrands', c.flag);
                return (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.on_card_name} {cardNumber} - {brandName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {Object.entries(TRANSLATIONS.billStatus).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os Anos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Anos</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm">
            {filteredBills.length} fatura(s) encontrada(s)
          </span>
        </div>
      </div>

      <DataTable
        data={filteredBills}
        columns={columns}
        keyExtractor={(bill) => bill.id}
        isLoading={isLoading}
        emptyState={{
          message: 'Nenhuma fatura encontrada.',
        }}
        actions={(bill) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'credit_card_bill', data: bill }}
              memberName={getMemberDisplayName(null, user)}
            />
            {bill.status !== 'paid' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenPayment(bill)}
                aria-label="Pagar fatura"
              >
                <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
              </Button>
            )}
            {(bill.closed || bill.status === 'paid' || bill.status === 'closed') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReopenBill(bill)}
                aria-label="Reabrir fatura"
              >
                <RotateCcw className="h-4 w-4 text-warning" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(bill)}
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(bill.id)}
              aria-label="Excluir"
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBill ? 'Editar' : 'Nova'} Fatura de Cartão
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da fatura de cartão de crédito
            </DialogDescription>
          </DialogHeader>
          <CreditCardBillForm
            bill={selectedBill}
            creditCards={creditCards}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
            <DialogDescription>
              Realize o pagamento da fatura de cartão de crédito
            </DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <BillPaymentForm
              bill={selectedBill}
              onSubmit={handlePayment}
              onCancel={() => setIsPaymentDialogOpen(false)}
              isLoading={isPaymentSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
