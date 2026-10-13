/* eslint-disable max-lines */
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Pencil,
  Save,
  Shapes,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PaginatedSlide, LIST_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { cn, formatLocalDate } from '@/lib/utils';
import { vaultsService } from '@/services/vaults-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Vault, VaultTransaction } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | undefined;
  onSuccess: () => void;
}

export function VaultTransactionsDialog({
  open,
  onOpenChange,
  vault,
  onSuccess,
}: VaultTransactionsDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  const [transactions, setTransactions] = useState<VaultTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [editingTx, setEditingTx] = useState<VaultTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTransactions = async () => {
    if (!vault) return;
    setIsLoading(true);
    try {
      const data = await vaultsService.getTransactions(vault.id, {
        type: filter === 'all' ? undefined : filter,
        start_date: startDate ? formatLocalDate(startDate) : undefined,
        end_date: endDate ? formatLocalDate(endDate) : undefined,
      });
      setTransactions(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Radix's Dialog only calls onOpenChange for user-driven close interactions
  // (Esc, overlay click, close button) — not when the parent programmatically
  // sets `open` to true. Load fresh data here instead, keyed to the dialog
  // actually being open, so a new deposit/withdrawal always shows up.
  useEffect(() => {
    if (!open || !vault) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch triggered by dialog opening or filter change, not a derived-state update
    void loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vault?.id, filter, startDate, endDate]);

  // Reset transient state when the dialog opens (or switches vault) during
  // render rather than in an effect — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const openKey = open ? vault?.id : undefined;
  const [prevOpenKey, setPrevOpenKey] = useState(openKey);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (openKey !== undefined) {
      setFilter('all');
      setStartDate(undefined);
      setEndDate(undefined);
      setEditingTx(null);
    }
  }

  const startEdit = (tx: VaultTransaction) => {
    setEditingTx(tx);
    setEditAmount(tx.amount);
    setEditDesc(tx.description || '');
  };
  const cancelEdit = () => {
    setEditingTx(null);
    setEditAmount('');
    setEditDesc('');
  };

  const handleUpdate = async () => {
    if (!editingTx) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      await vaultsService.updateTransaction(editingTx.id, {
        amount,
        description: editDesc || undefined,
      });
      toast({
        title: t('pages.vaults.transactionUpdated'),
      });
      cancelEdit();
      void loadTransactions();
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.updateError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tx: VaultTransaction) => {
    const confirmed = await showConfirm({
      title: t('pages.vaults.deleteTransactionTitle'),
      description: `${t('pages.vaults.deleteTransactionTitle')}: ${formatCurrency(parseFloat(tx.amount))}`,
    });
    if (!confirmed) return;
    try {
      await vaultsService.deleteTransaction(tx.id);
      toast({
        title: t('pages.vaults.transactionDeletedDesc'),
      });
      void loadTransactions();
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <History className="text-primary h-4 w-4" aria-hidden="true" />
            {t('pages.vaults.transactionsTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('pages.vaults.transactionsTitle')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <FilterBar
            hasActiveFilters={filter !== 'all' || !!startDate || !!endDate}
            onClear={() => {
              setFilter('all');
              setStartDate(undefined);
              setEndDate(undefined);
            }}
          >
            <FilterField label={t('common.fields.type')} icon={Shapes}>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger aria-label={t('pages.vaults.filterByType')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pages.vaults.filterAll')}</SelectItem>
                  <SelectItem value="deposit">
                    {t('pages.vaults.filterDeposits')}
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    {t('pages.vaults.filterWithdrawals')}
                  </SelectItem>
                  <SelectItem value="yield">
                    {t('pages.vaults.filterYields')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t('common.fields.from')} icon={ArrowUpRight}>
              <DatePicker value={startDate} onChange={setStartDate} />
            </FilterField>
            <FilterField label={t('common.fields.to')} icon={ArrowDownLeft}>
              <DatePicker value={endDate} onChange={setEndDate} />
            </FilterField>
          </FilterBar>

          {isLoading ? (
            <LoadingState />
          ) : transactions.length === 0 ? (
            <EmptyState title={t('pages.vaults.noTransactions')} />
          ) : (
            <PaginatedSlide
              key={`${filter}-${startDate?.getTime()}-${endDate?.getTime()}`}
              items={transactions}
              pageSize={LIST_PAGE_SIZE}
              pinNav={false}
            >
              {(pageItems) => (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('pages.vaults.columns.date')}</TableHead>
                        <TableHead>{t('pages.vaults.columns.type')}</TableHead>
                        <TableHead>{t('pages.vaults.columns.amount')}</TableHead>
                        <TableHead>{t('common.fields.description')}</TableHead>
                        <TableHead>{t('pages.vaults.columns.afterBalance')}</TableHead>
                        <TableHead className="text-right">
                          {t('common.table.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            {new Date(tx.transaction_date).toLocaleDateString(
                              i18n.language
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                tx.transaction_type === 'deposit'
                                  ? 'default'
                                  : tx.transaction_type === 'withdrawal'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {tx.transaction_type_display}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {editingTx?.id === tx.id ? (
                              <CurrencyInput
                                min="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-32"
                              />
                            ) : (
                              <span
                                className={cn(
                                  tx.transaction_type === 'deposit' ||
                                    tx.transaction_type === 'yield'
                                    ? 'text-success'
                                    : 'text-destructive'
                                )}
                              >
                                {tx.transaction_type === 'withdrawal' ? '-' : '+'}
                                {formatCurrency(parseFloat(tx.amount))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {editingTx?.id === tx.id ? (
                              <Input
                                value={editDesc}
                                placeholder={t('pages.vaults.depositPlaceholder')}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="w-40"
                              />
                            ) : (
                              tx.description || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(parseFloat(tx.balance_after))}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="gap-xs flex items-center justify-end">
                              {(tx.transaction_type === 'deposit' ||
                                tx.transaction_type === 'withdrawal') &&
                                vault && (
                                  <ReceiptButton
                                    source={{
                                      type:
                                        tx.transaction_type === 'deposit'
                                          ? 'vault_deposit'
                                          : 'vault_withdrawal',
                                      data: { vault, transaction: tx },
                                    }}
                                    memberName={getMemberDisplayName(null, user)}
                                  />
                                )}
                              {tx.transaction_type === 'yield' &&
                                (editingTx?.id === tx.id ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => void handleUpdate()}
                                      disabled={isSubmitting}
                                    >
                                      <Save aria-hidden="true" />
                                      {t('common.actions.save')}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEdit}
                                    >
                                      <X aria-hidden="true" />
                                      {t('common.actions.cancel')}
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => startEdit(tx)}
                                      aria-label={t('common.actions.edit')}
                                      title={t('common.actions.edit')}
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => void handleDelete(tx)}
                                      aria-label={t('common.actions.delete')}
                                      title={t('common.actions.delete')}
                                    >
                                      <Trash2
                                        className="text-destructive h-4 w-4"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PaginatedSlide>
          )}
        </div>
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
