import { useQuery } from '@tanstack/react-query';
import { X, CalendarPlus, Loader2 } from 'lucide-react';
/* eslint-disable max-lines */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MaskedCurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type { FixedExpense, BulkGenerateRequest } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fixedExpenses: FixedExpense[];
  onSuccess: () => void;
}

/** Limites (1º e último dia) do mês `YYYY-MM`. */
function monthBounds(month: string): { min: Date; max: Date; lastDay: number } {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return {
    min: new Date(year, monthNum - 1, 1),
    max: new Date(year, monthNum - 1, lastDay),
    lastDay,
  };
}

/** Data padrão (dia de vencimento, limitado ao mês) para um template. */
function defaultDateFor(month: string, dueDay: number): string {
  const [year, monthNum] = month.split('-').map(Number);
  const { lastDay } = monthBounds(month);
  return formatLocalDate(new Date(year, monthNum - 1, Math.min(dueDay, lastDay)));
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
  const [expenseDates, setExpenseDates] = useState<Record<number, string>>({});
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showAlert } = useAlertDialog();

  const { data: fullyGeneratedMonths = [] } = useQuery({
    queryKey: ['fixedExpenses', 'generatedMonths'],
    queryFn: () => fixedExpensesService.getFullyGeneratedMonths(),
    enabled: isOpen,
    staleTime: 0,
  });

  // Mês corrente + os próximos 3, removendo os que já foram totalmente
  // lançados (todos os templates ativos já têm lançamento naquele mês).
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      // Constrói o mês a partir do dia 1 para evitar o "roll-over" do JS
      // (ex.: 31/ago + 1 mês => 01/out), que duplicava meses e pulava um.
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        value,
        label: date.toLocaleDateString(i18n.language, {
          month: 'long',
          year: 'numeric',
        }),
      };
    }).filter((opt) => !fullyGeneratedMonths.includes(opt.value));
  }, [i18n.language, fullyGeneratedMonths]);

  // Reinicia o formulário quando o dialog abre (derivado durante o render —
  // sem efeito — comparando com a última transição de `isOpen`).
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) {
      const initialValues: Record<number, number> = {};
      fixedExpenses.forEach((exp) => {
        initialValues[exp.id] = parseFloat(exp.default_value);
      });
      setExpenseValues(initialValues);
      setExpenseDates({});
      setSelectedExpenseIds(new Set(fixedExpenses.map((exp) => exp.id)));
    }
  }

  // Mantém o mês selecionado válido conforme as opções mudam (quando os
  // "meses já lançados" chegam da API). Convergência durante o render.
  const validMonth =
    monthOptions.find((opt) => opt.value === selectedMonth)?.value ??
    monthOptions[0]?.value ??
    '';
  if (validMonth !== selectedMonth) setSelectedMonth(validMonth);

  const toggleExpenseSelection = (expenseId: number) => {
    setSelectedExpenseIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) newSet.delete(expenseId);
      else newSet.add(expenseId);
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

  const handleValueChange = (expenseId: number, value: number) => {
    setExpenseValues((prev) => ({
      ...prev,
      [expenseId]: value,
    }));
  };

  const dateFor = (exp: FixedExpense): string =>
    expenseDates[exp.id] ?? (validMonth ? defaultDateFor(validMonth, exp.due_day) : '');

  const handleSubmit = async () => {
    if (!validMonth) return;
    try {
      setIsSubmitting(true);

      const request: BulkGenerateRequest = {
        month: validMonth,
        expense_values: selectedExpenses.map((exp) => ({
          fixed_expense_id: exp.id,
          value: expenseValues[exp.id] || parseFloat(exp.default_value),
          date: dateFor(exp) || undefined,
        })),
      };

      const response = await fixedExpensesService.bulkGenerate(request);

      const monthLabel =
        monthOptions.find((m) => m.value === validMonth)?.label || validMonth;

      const createdDesc = t('pages.fixedExpenses.launchDialog.successDesc', {
        count: response.created_count,
        month: monthLabel,
      });
      const skippedNotice =
        response.skipped_count > 0
          ? ` ${t('pages.fixedExpenses.launchDialog.skippedNotice', {
              count: response.skipped_count,
            })}`
          : '';

      toast({
        title: `${createdDesc}${skippedNotice}`,
      });

      if (response.blocked_cards.length > 0) {
        await showAlert({
          title: t('pages.fixedExpenses.launchDialog.blockedTitle'),
          description: response.blocked_cards
            .map((c) =>
              t('pages.fixedExpenses.launchDialog.blockedLine', {
                card: c.card_name,
                missing: formatCurrency(c.missing),
              })
            )
            .join('\n'),
          variant: 'destructive',
        });
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        title: t('pages.fixedExpenses.launchDialog.error', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bounds = validMonth ? monthBounds(validMonth) : null;
  const noMonthsAvailable = monthOptions.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <CalendarPlus className="text-primary h-5 w-5" aria-hidden="true" />
            {t('pages.fixedExpenses.launchDialog.title')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              {t('pages.fixedExpenses.launchDialog.desc')}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        {noMonthsAvailable ? (
          <div className="py-xl text-muted-foreground text-center text-sm">
            {t('pages.fixedExpenses.launchDialog.allGenerated')}
          </div>
        ) : (
          <div className="space-y-md">
            {/* Month selector */}
            <div className="space-y-sm">
              <Label>{t('pages.fixedExpenses.launchDialog.selectMonth')}</Label>
              <Select value={validMonth} onValueChange={setSelectedMonth}>
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

            {/* Expense list with editable values + dates */}
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <Label>
                  {t('pages.fixedExpenses.launchDialog.expensesLabel', {
                    selected: selectedExpenses.length,
                    total: fixedExpenses.length,
                  })}
                </Label>
                <div className="gap-sm flex items-center">
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
              <div className="p-md rounded-md border">
                <PaginatedSlide items={fixedExpenses} pageSize={5} pinNav={false}>
                  {(pageItems) => (
                    <div className="space-y-3">
                      {pageItems.map((exp) => (
                        <div
                          key={exp.id}
                          className={`gap-md flex items-center rounded-lg border p-3 transition-colors ${
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
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{exp.description}</p>
                            <p className="text-muted-foreground text-sm whitespace-nowrap">
                              {t('pages.fixedExpenses.launchDialog.dueDate', {
                                day: exp.due_day,
                                account: exp.account_name,
                              })}
                            </p>
                          </div>
                          <div className="w-48 shrink-0">
                            <DatePicker
                              value={dateFor(exp)}
                              minDate={bounds?.min}
                              maxDate={bounds?.max}
                              floating
                              disabled={isSubmitting || !selectedExpenseIds.has(exp.id)}
                              onChange={(date) =>
                                setExpenseDates((prev) => ({
                                  ...prev,
                                  [exp.id]: date ? formatLocalDate(date) : '',
                                }))
                              }
                            />
                          </div>
                          <div className="w-40 shrink-0">
                            {exp.allow_value_edit ? (
                              <MaskedCurrencyInput
                                value={
                                  expenseValues[exp.id] ?? parseFloat(exp.default_value)
                                }
                                onValueChange={(v) => handleValueChange(exp.id, v)}
                                disabled={
                                  isSubmitting || !selectedExpenseIds.has(exp.id)
                                }
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
                  )}
                </PaginatedSlide>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="dialog-footer gap-sm flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          {!noMonthsAvailable && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !validMonth || selectedExpenses.length === 0}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              {isSubmitting
                ? t('pages.fixedExpenses.launchDialog.generating')
                : t('pages.fixedExpenses.launchDialog.generateBtn', {
                    count: selectedExpenses.length,
                  })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
