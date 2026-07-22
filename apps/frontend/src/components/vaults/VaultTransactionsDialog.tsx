/* eslint-disable max-lines */
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { cn } from '@/lib/utils';
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
  const [filter, setFilter] = useState('all');
  const [editingTx, setEditingTx] = useState<VaultTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTransactions = async (typeFilter?: string) => {
    if (!vault) return;
    try {
      const type =
        (typeFilter ?? filter) === 'all' ? undefined : (typeFilter ?? filter);
      const data = await vaultsService.getTransactions(vault.id, type);
      setTransactions(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setTimeout(() => void loadTransactions(value), 0);
  };

  const handleOpenChange = async (isOpen: boolean) => {
    if (isOpen && vault) {
      setFilter('all');
      setEditingTx(null);
      await loadTransactions('all');
    }
    onOpenChange(isOpen);
  };

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
        title: t('pages.vaults.invalidAmount'),
        description: t('common.messages.fillRequired'),
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
        description: t('pages.vaults.transactionUpdatedDesc'),
      });
      cancelEdit();
      void loadTransactions();
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.updateError'),
        description: getErrorMessage(error),
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
        title: t('pages.vaults.transactionDeleted'),
        description: t('pages.vaults.transactionDeletedDesc'),
      });
      void loadTransactions();
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => void handleOpenChange(v)}>
      <DialogContent className="custom-scrollbar max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.vaults.transactionsTitle')}</DialogTitle>
          <DialogDescription>
            {vault && (
              <>
                {t('pages.vaults.transactionHistoryDesc', { name: vault.description })}
                <br />
                {t('pages.vaults.columns.currentBalance')}:{' '}
                {formatCurrency(parseFloat(vault.current_balance))} |{' '}
                {t('pages.vaults.columns.yields')}:{' '}
                {formatCurrency(parseFloat(vault.accumulated_yield))}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="flex items-center gap-sm">
            <Label>{t('pages.vaults.filterByType')}</Label>
            <Select value={filter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-48">
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
                <SelectItem value="yield">{t('pages.vaults.filterYields')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-xl text-center text-muted-foreground"
                    >
                      {t('pages.vaults.noTransactions')}
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
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
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-24"
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
                      <TableCell>
                        {editingTx?.id === tx.id ? (
                          <Input
                            value={editDesc}
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
                        <div className="flex items-center justify-end gap-xs">
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
                                  {t('common.actions.save')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={cancelEdit}>
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
                                    className="h-4 w-4 text-destructive"
                                    aria-hidden="true"
                                  />
                                </Button>
                              </>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
