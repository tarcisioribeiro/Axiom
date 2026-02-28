import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type { FixedExpense, BulkGenerateRequest } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fixedExpenses: FixedExpense[];
  onSuccess: () => void;
}

export const LaunchExpensesDialog = ({
  isOpen,
  onClose,
  fixedExpenses,
  onSuccess,
}: Props) => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expenseValues, setExpenseValues] = useState<Record<number, number>>({});
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Generate month options (current month + next 2 months)
  const monthOptions = Array.from({ length: 3 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    };
  });

  useEffect(() => {
    if (isOpen) {
      // Set default month to current
      setSelectedMonth(monthOptions[0].value);

      // Initialize values with default_value
      const initialValues: Record<number, number> = {};
      fixedExpenses.forEach((exp) => {
        initialValues[exp.id] = parseFloat(exp.default_value);
      });
      setExpenseValues(initialValues);

      // Initialize all expenses as selected
      setSelectedExpenseIds(new Set(fixedExpenses.map((exp) => exp.id)));
    }
  }, [isOpen, fixedExpenses]);

  const toggleExpenseSelection = (expenseId: number) => {
    setSelectedExpenseIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId);
      } else {
        newSet.add(expenseId);
      }
      return newSet;
    });
  };

  const toggleAllExpenses = () => {
    if (selectedExpenseIds.size === fixedExpenses.length) {
      setSelectedExpenseIds(new Set());
    } else {
      setSelectedExpenseIds(new Set(fixedExpenses.map((exp) => exp.id)));
    }
  };

  const selectedExpenses = fixedExpenses.filter((exp) =>
    selectedExpenseIds.has(exp.id)
  );

  const handleValueChange = (expenseId: number, value: string) => {
    setExpenseValues((prev) => ({
      ...prev,
      [expenseId]: parseFloat(value) || 0,
    }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const request: BulkGenerateRequest = {
        month: selectedMonth,
        expense_values: selectedExpenses.map((exp) => ({
          fixed_expense_id: exp.id,
          value: expenseValues[exp.id] || parseFloat(exp.default_value),
        })),
      };

      const response = await fixedExpensesService.bulkGenerate(request);

      // Formatar mês para exibição (YYYY-MM -> Mês/Ano)
      const monthLabel =
        monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

      toast({
        title: 'Despesas lançadas com sucesso!',
        description: `${response.created_count} despesas foram criadas para ${monthLabel}`,
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao lançar despesas',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalValue = selectedExpenses.reduce(
    (sum, exp) => sum + (expenseValues[exp.id] || parseFloat(exp.default_value)),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lançar Despesas Fixas do Mês</DialogTitle>
          <DialogDescription>
            Selecione o mês e ajuste os valores antes de gerar as despesas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month selector */}
          <div className="space-y-2">
            <Label>Selecione o Mês</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expense list with editable values */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Despesas ({selectedExpenses.length} de {fixedExpenses.length}{' '}
                selecionadas)
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedExpenseIds.size === fixedExpenses.length}
                  onCheckedChange={toggleAllExpenses}
                />
                <label
                  htmlFor="select-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  Selecionar todas
                </label>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-3">
                {fixedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className={`flex items-center gap-4 rounded-lg border p-3 transition-colors ${
                      selectedExpenseIds.has(exp.id)
                        ? 'bg-background'
                        : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <Checkbox
                      checked={selectedExpenseIds.has(exp.id)}
                      onCheckedChange={() => toggleExpenseSelection(exp.id)}
                      disabled={isSubmitting}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{exp.description}</p>
                      <p className="text-sm">
                        Vencimento: dia {exp.due_day} • {exp.account_name}
                      </p>
                    </div>
                    <div className="w-32">
                      {exp.allow_value_edit ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={expenseValues[exp.id] ?? parseFloat(exp.default_value)}
                          onChange={(e) => handleValueChange(exp.id, e.target.value)}
                          disabled={isSubmitting || !selectedExpenseIds.has(exp.id)}
                        />
                      ) : (
                        <div className="text-right font-semibold">
                          {formatCurrency(exp.default_value)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <span className="font-semibold">Total:</span>
            <span className="text-2xl font-bold text-destructive">
              {formatCurrency(totalValue)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedExpenses.length === 0}
            >
              {isSubmitting
                ? 'Gerando...'
                : `Gerar ${selectedExpenses.length} Despesa${selectedExpenses.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
