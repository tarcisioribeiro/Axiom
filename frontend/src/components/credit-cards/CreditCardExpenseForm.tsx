import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { TRANSLATIONS, EXPENSE_CATEGORIES_CANONICAL } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { formatLocalDate } from '@/lib/utils';
import type {
  CreditCardExpense,
  CreditCardExpenseFormData,
  CreditCard,
  CreditCardBill,
} from '@/types';

interface CreditCardExpenseFormProps {
  expense?: CreditCardExpense;
  creditCards: CreditCard[];
  bills?: CreditCardBill[];
  onSubmit: (data: CreditCardExpenseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreditCardExpenseForm: React.FC<CreditCardExpenseFormProps> = ({
  expense,
  creditCards,
  bills = [],
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { showAlert } = useAlertDialog();
  const { register, handleSubmit, setValue, watch } =
    useForm<CreditCardExpenseFormData>({
      defaultValues: {
        description: '',
        value: 0,
        date: formatLocalDate(new Date()),
        horary: new Date().toTimeString().split(' ')[0].substring(0, 5),
        category: '',
        card: 0,
        total_installments: 1,
        bill: null,
        member: null,
        notes: '',
      },
    });

  // Watch valores para cálculo de parcela
  const watchedValue = watch('value');
  const watchedTotalInstallments = watch('total_installments');
  const watchedCard = watch('card');

  // Calcular valor por parcela
  const installmentValue =
    watchedTotalInstallments > 0
      ? watchedValue / watchedTotalInstallments
      : watchedValue;

  // Faturas filtradas pelo cartão selecionado
  const filteredBills = useMemo(() => {
    if (!watchedCard || watchedCard === 0) return [];
    return bills.filter((b) => b.credit_card === watchedCard);
  }, [watchedCard, bills]);

  // Função para encontrar a fatura atual de um cartão
  const getCurrentBill = (cardId: number) => {
    if (!bills || bills.length === 0) return null;

    const today = new Date();
    const cardBills = bills.filter((b) => b.credit_card === cardId);

    // Encontrar fatura cujo período inclui a data atual
    const currentBill = cardBills.find((b) => {
      const beginDate = new Date(b.invoice_beginning_date);
      const endDate = new Date(b.invoice_ending_date);
      return today >= beginDate && today <= endDate;
    });

    if (currentBill) return currentBill.id;

    // Se não encontrar, pegar a fatura mais recente em aberto
    const openBills = cardBills.filter((b) => b.status === 'open');
    if (openBills.length > 0) {
      openBills.sort(
        (a, b) =>
          new Date(b.invoice_beginning_date).getTime() -
          new Date(a.invoice_beginning_date).getTime()
      );
      return openBills[0].id;
    }

    // Se não há faturas abertas, retornar a primeira fatura do cartão
    if (cardBills.length > 0) {
      return cardBills[0].id;
    }

    return null;
  };

  // Função auxiliar para exibir informações do cartão
  const getCardDisplayInfo = (card: CreditCard) => {
    const digitsOnly = card.card_number_masked?.replace(/[^\d]/g, '') || '';
    const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : null;
    const hasNumber = last4 !== null;
    const brandName =
      TRANSLATIONS.cardBrands[card.flag as keyof typeof TRANSLATIONS.cardBrands] ||
      card.flag;
    const accountName = card.associated_account_name || '';

    return { last4, hasNumber, brandName, accountName };
  };

  // Auto-selecionar primeiro cartão e sua primeira fatura ao abrir o form (modo criação)
  useEffect(() => {
    if (!expense && creditCards.length > 0) {
      const firstCard = creditCards[0];
      setValue('card', firstCard.id);

      // Atualizar membro
      if (firstCard.owner) {
        setValue('member', firstCard.owner);
      }

      // Auto-selecionar fatura
      const billId = getCurrentBill(firstCard.id);
      if (billId) {
        setValue('bill', billId);
      }
    }
  }, [expense, creditCards.length]); // Não incluir creditCards inteiro para evitar loop

  // Atualizar membro e fatura quando cartão muda
  useEffect(() => {
    if (watchedCard && watchedCard !== 0 && creditCards.length > 0 && !expense) {
      const selectedCard = creditCards.find((c) => c.id === watchedCard);

      // Atualizar membro
      if (selectedCard?.owner) {
        setValue('member', selectedCard.owner);
      }

      // Atualizar fatura automaticamente para o novo cartão
      const billId = getCurrentBill(watchedCard);
      setValue('bill', billId);
    }
  }, [watchedCard]);

  // Carregar dados da despesa em edição
  useEffect(() => {
    if (expense) {
      setValue('description', expense.description);
      setValue('value', parseFloat(expense.value));
      setValue('date', expense.date);
      setValue('horary', expense.horary);
      setValue('category', expense.category);
      setValue('card', expense.card);
      setValue('total_installments', expense.total_installments);
      setValue('bill', expense.bill);
      setValue('member', expense.member);
      setValue('notes', expense.notes || '');
    }
  }, [expense, setValue]);

  const handleFormSubmit = async (data: CreditCardExpenseFormData) => {
    if (!data.card || data.card === 0) {
      await showAlert({
        title: 'Campo obrigatório',
        description: 'Por favor, selecione um cartão de crédito',
        confirmText: 'Ok',
      });
      return;
    }
    if (!data.category) {
      await showAlert({
        title: 'Campo obrigatório',
        description: 'Por favor, selecione uma categoria',
        confirmText: 'Ok',
      });
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descrição *</Label>
          <Input
            id="description"
            {...register('description', { required: true })}
            placeholder="Ex: Compra no mercado"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Valor *</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            {...register('value', { required: true, valueAsNumber: true })}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select
            value={watch('category') || ''}
            onValueChange={(v) => setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Data *</Label>
          <DatePicker
            value={watch('date')}
            onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
            placeholder="Selecione a data"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="horary">Horário *</Label>
          <Input
            id="horary"
            type="time"
            {...register('horary', { required: true })}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Cartão de Crédito *</Label>
          <Select
            value={watch('card')?.toString() || ''}
            onValueChange={(v) => setValue('card', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {creditCards.map((c) => {
                const { last4, hasNumber, brandName, accountName } =
                  getCardDisplayInfo(c);
                return (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm">
                        {hasNumber ? `**** ${last4}` : 'Não cadastrado'}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {brandName}
                      </Badge>
                      {accountName && <span className="text-xs">• {accountName}</span>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_installments">Número de Parcelas *</Label>
          <Input
            id="total_installments"
            type="number"
            min="1"
            {...register('total_installments', { required: true, valueAsNumber: true })}
            disabled={isLoading}
          />
          <p className="text-xs">
            {watchedTotalInstallments > 1
              ? `Serão criadas ${watchedTotalInstallments} parcelas de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)} cada`
              : 'Pagamento à vista'}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Fatura Associada</Label>
          <Select
            value={watch('bill')?.toString() || 'none'}
            onValueChange={(v) => setValue('bill', v === 'none' ? null : parseInt(v))}
            disabled={filteredBills.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  filteredBills.length === 0 ? 'Nenhuma fatura disponível' : 'Selecione'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {filteredBills.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {TRANSLATIONS.months[b.month as keyof typeof TRANSLATIONS.months]}/
                  {b.year}
                  {b.status === 'open' && (
                    <span className="ml-2 text-xs text-success">(Aberta)</span>
                  )}
                  {b.status === 'closed' && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Fechada)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredBills.length === 0 && watchedCard > 0 && (
            <p className="text-xs text-warning">
              Nenhuma fatura cadastrada para este cartão
            </p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Informações adicionais..."
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : expense ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
