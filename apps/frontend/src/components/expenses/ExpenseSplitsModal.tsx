import {
  PlusIcon as Plus,
  TrashIcon as Trash2,
  CheckCircleIcon as CheckCircle2,
  XCircleIcon as XCircle,
} from '@heroicons/react/24/solid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { expenseSplitsService } from '@/services/expense-splits-service';
import type { Expense, ExpenseSplitFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface ExpenseSplitsModalProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getDefaultForm(): ExpenseSplitFormData {
  return { description: '', value: 0, payed: false };
}

export function ExpenseSplitsModal({
  expense,
  open,
  onOpenChange,
}: ExpenseSplitsModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ExpenseSplitFormData>(getDefaultForm());
  const [addingNew, setAddingNew] = useState(false);

  const expenseId = expense?.id;

  const { data: splits = [], isLoading } = useQuery({
    queryKey: ['expense-splits', expenseId],
    queryFn: () => expenseSplitsService.getAll(expenseId!),
    enabled: !!expenseId && open,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['expense-splits', expenseId] });

  const createMutation = useMutation({
    mutationFn: (data: ExpenseSplitFormData) =>
      expenseSplitsService.create(expenseId!, data),
    onSuccess: () => {
      toast({ title: t('pages.expenses.splits.created') });
      setForm(getDefaultForm());
      setAddingNew(false);
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ splitId, payed }: { splitId: number; payed: boolean }) =>
      expenseSplitsService.update(expenseId!, splitId, { payed }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (splitId: number) => expenseSplitsService.delete(expenseId!, splitId),
    onSuccess: () => {
      toast({ title: t('pages.expenses.splits.deleted') });
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      }),
  });

  const handleDelete = async (splitId: number) => {
    const confirmed = await showConfirm({
      title: t('pages.expenses.splits.deleteTitle'),
      description: t('pages.expenses.splits.deleteDesc'),
      confirmText: t('common.actions.delete'),
      variant: 'destructive',
    });
    if (confirmed) deleteMutation.mutate(splitId);
  };

  const totalSplitValue = splits.reduce((acc, s) => acc + parseFloat(s.value), 0);
  const expenseTotal = expense ? parseFloat(expense.value) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.expenses.splits.title')}</DialogTitle>
          <DialogDescription>
            {expense?.description} — {expense && formatCurrency(expenseTotal)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-sm">
          {isLoading ? (
            <p className="py-md text-muted-foreground text-center text-sm">
              {t('common.messages.loading')}
            </p>
          ) : splits.length === 0 && !addingNew ? (
            <p className="py-md text-muted-foreground text-center text-sm">
              {t('pages.expenses.splits.empty')}
            </p>
          ) : (
            <div className="space-y-xs">
              {splits.map((split) => (
                <div
                  key={split.id}
                  className="gap-sm border-border px-sm py-xs flex items-center rounded-md border"
                >
                  <Checkbox
                    checked={split.payed}
                    onCheckedChange={(v) =>
                      toggleMutation.mutate({ splitId: split.id, payed: !!v })
                    }
                    aria-label={t('pages.expenses.splits.markPaid')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{split.description}</p>
                    {split.member_name && (
                      <p className="text-muted-foreground text-xs">
                        {split.member_name}
                      </p>
                    )}
                  </div>
                  <div className="gap-sm flex shrink-0 items-center">
                    <span
                      className={`text-sm font-semibold ${split.payed ? 'text-success' : 'text-foreground'}`}
                    >
                      {formatCurrency(parseFloat(split.value))}
                    </span>
                    {split.payed ? (
                      <CheckCircle2 className="text-success h-4 w-4" />
                    ) : (
                      <XCircle className="text-muted-foreground h-4 w-4" />
                    )}
                    <button
                      onClick={() => void handleDelete(split.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {splits.length > 0 && (
            <div className="pt-xs text-muted-foreground flex justify-between border-t text-xs">
              <span>{t('pages.expenses.splits.total')}</span>
              <span
                className={
                  totalSplitValue > expenseTotal
                    ? 'text-destructive'
                    : 'text-foreground'
                }
              >
                {formatCurrency(totalSplitValue)} / {formatCurrency(expenseTotal)}
              </span>
            </div>
          )}

          {addingNew ? (
            <div className="space-y-sm border-border p-sm rounded-md border">
              <div className="space-y-xs">
                <Label htmlFor="split-desc">
                  {t('pages.expenses.splits.description')}
                </Label>
                <Input
                  id="split-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder={t('pages.expenses.splits.descriptionPlaceholder')}
                />
              </div>
              <div className="space-y-xs">
                <Label htmlFor="split-value">{t('common.fields.value')}</Label>
                <Input
                  id="split-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value || ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, value: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="gap-sm flex items-center">
                <Checkbox
                  id="split-payed"
                  checked={form.payed}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, payed: !!v }))}
                />
                <Label htmlFor="split-payed">
                  {t('pages.expenses.splits.markPaid')}
                </Label>
              </div>
              <div className="gap-sm flex">
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate(form)}
                  disabled={
                    !form.description || !form.value || createMutation.isPending
                  }
                >
                  {t('common.actions.save')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingNew(false);
                    setForm(getDefaultForm());
                  }}
                >
                  {t('common.actions.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-xs w-full"
              onClick={() => setAddingNew(true)}
            >
              <Plus className="h-4 w-4" />
              {t('pages.expenses.splits.add')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
