/* eslint-disable max-lines */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
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
      label: date.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const monthLabel =
        monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

      toast({
        title: t('pages.fixedExpenses.launchDialog.success'),
        description: t('pages.fixedExpenses.launchDialog.successDesc', {
          count: response.created_count,
          month: monthLabel,
        }),
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        title: t('pages.fixedExpenses.launchDialog.error'),
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
          <DialogTitle>{t('pages.fixedExpenses.launchDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.fixedExpenses.launchDialog.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          {/* Month selector */}
          <div className="space-y-sm">
            <Label>{t('pages.fixedExpenses.launchDialog.selectMonth')}</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    'pages.fixedExpenses.launchDialog.selectMonthPlaceholder'
                  )}
                />
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
          <div className="space-y-sm">
            <div className="flex items-center justify-between">
              <Label>
                {t('pages.fixedExpenses.launchDialog.expensesLabel', {
                  selected: selectedExpenses.length,
                  total: fixedExpenses.length,
                })}
              </Label>
              <div className="flex items-center gap-sm">
                <Checkbox
                  id="select-all"
                  checked={selectedExpenseIds.size === fixedExpenses.length}
                  onCheckedChange={toggleAllExpenses}
                />
                <label
                  htmlFor="select-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t('pages.fixedExpenses.launchDialog.selectAll')}
                </label>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-md">
              <div className="space-y-3">
                {fixedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className={`flex items-center gap-md rounded-lg border p-3 transition-colors ${
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
                        {t('pages.fixedExpenses.launchDialog.dueDate', {
                          day: exp.due_day,
                          account: exp.account_name,
                        })}
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
          <div className="flex items-center justify-between rounded-lg bg-muted p-md">
            <span className="font-semibold">
              {t('pages.fixedExpenses.launchDialog.total')}
            </span>
            <span className="text-2xl font-bold text-destructive">
              {formatCurrency(totalValue)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-sm">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedExpenses.length === 0}
            >
              {isSubmitting
                ? t('pages.fixedExpenses.launchDialog.generating')
                : t('pages.fixedExpenses.launchDialog.generateBtn', {
                    count: selectedExpenses.length,
                  })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
