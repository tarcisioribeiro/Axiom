import { Plus, Pencil, Trash2, Receipt, CreditCard, List } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { PayableForm } from '@/components/payables/PayableForm';
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
import { translate } from '@/config/constants';
import { usePayablesPage } from '@/hooks/use-payables-page';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Account, Payable, PayableInstallment } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  paid: 'secondary',
  overdue: 'destructive',
  cancelled: 'outline',
};

export default function Payables() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const {
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedPayable,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    filteredPayables,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  } = usePayablesPage();

  const [accounts, setAccounts] = useState<Account[]>([]);

  const [paymentPayable, setPaymentPayable] = useState<Payable | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    value: '',
    account: '',
    date: '',
    notes: '',
  });
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const [installmentsPayable, setInstallmentsPayable] = useState<Payable | null>(null);
  const [installments, setInstallments] = useState<PayableInstallment[]>([]);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

  useEffect(() => {
    void accountsService
      .getAll()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const handleOpenInstallments = async (payable: Payable) => {
    setInstallmentsPayable(payable);
    setIsLoadingInstallments(true);
    try {
      const data = await payableInstallmentsService.getByPayable(payable.id);
      setInstallments(data);
    } catch {
      setInstallments([]);
    } finally {
      setIsLoadingInstallments(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentPayable) return;
    if (!paymentForm.value || !paymentForm.account || !paymentForm.date) {
      toast({
        title: t('pages.payables.payment.title'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    setIsPaymentSubmitting(true);
    try {
      await payableInstallmentsService.pay(paymentPayable.id, {
        value: parseFloat(paymentForm.value),
        account: parseInt(paymentForm.account),
        date: paymentForm.date,
        notes: paymentForm.notes,
      });
      toast({
        title: t('pages.payables.payment.success'),
        description: t('pages.payables.payment.successDesc'),
      });
      setPaymentPayable(null);
      setPaymentForm({ value: '', account: '', date: '', notes: '' });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.payables.title')}
        icon={<Receipt />}
        action={{
          label: t('pages.payables.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder={t('pages.payables.searchPlaceholder')}
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
              ? t('pages.payables.emptySearch')
              : t('pages.payables.emptyState')
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
                <Badge variant={STATUS_VARIANTS[payable.status] ?? 'default'}>
                  {translate('payableStatus', payable.status)}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('pages.payables.totalValue')}</span>
                  <span className="font-medium">{formatCurrency(payable.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.payables.paidValue')}</span>
                  <span className="font-medium">
                    {formatCurrency(payable.paid_value)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.payables.remainingBalance')}</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(
                      parseFloat(payable.value) - parseFloat(payable.paid_value)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.payables.registrationDate')}</span>
                  <span className="font-medium">
                    {formatDate(payable.date, 'dd/MM/yyyy')}
                  </span>
                </div>
                {payable.due_date && (
                  <div className="flex justify-between">
                    <span>{t('pages.loans.dueDate')}</span>
                    <span className="font-medium">
                      {formatDate(payable.due_date, 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
                {payable.member_name && (
                  <div className="flex justify-between">
                    <span>{t('pages.payables.responsible')}</span>
                    <span className="font-medium">{payable.member_name}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPaymentForm({
                      value: '',
                      account: '',
                      date: new Date().toISOString().split('T')[0],
                      notes: '',
                    });
                    setPaymentPayable(payable);
                  }}
                  title={t('pages.payables.payment.title')}
                  className="gap-1 text-xs"
                >
                  <CreditCard className="h-3 w-3" />
                  {t('pages.payables.payBtn')}
                </Button>
                {(payable.installments ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenInstallments(payable)}
                    title={t('pages.payables.installments.title')}
                    className="gap-1 text-xs"
                  >
                    <List className="h-3 w-3" />
                    {t('pages.payables.installmentsBtn')}
                  </Button>
                )}
                <ReceiptButton
                  source={{ type: 'payable', data: payable }}
                  memberName={getMemberDisplayName(payable.member_name, user)}
                  variant="ghost"
                  size="icon"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(payable)}
                  title={t('common.actions.edit')}
                  aria-label={t('common.actions.edit')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(payable)}
                  title={t('common.actions.delete')}
                  aria-label={t('common.actions.delete')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPayable
                ? t('pages.payables.editTitle')
                : t('pages.payables.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedPayable
                ? t('pages.payables.editDesc')
                : t('pages.payables.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <PayableForm
            payable={selectedPayable}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={!!paymentPayable}
        onOpenChange={(open) => {
          if (!open) setPaymentPayable(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.payables.payment.title')}</DialogTitle>
            <DialogDescription>
              {paymentPayable?.description} — {t('pages.payables.remainingBalance')}{' '}
              {paymentPayable
                ? formatCurrency(
                    parseFloat(paymentPayable.value) -
                      parseFloat(paymentPayable.paid_value)
                  )
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('pages.payables.payment.value')} *</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentForm.value}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, value: e.target.value }))
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>{t('pages.payables.payment.account')} *</Label>
              <Select
                value={paymentForm.account}
                onValueChange={(v) => setPaymentForm((f) => ({ ...f, account: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.fields.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('pages.payables.payment.date')} *</Label>
              <Input
                type="date"
                value={paymentForm.date}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('pages.payables.payment.notes')}</Label>
              <Input
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder={t('common.fields.notes')}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentPayable(null)}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                onClick={() => void handlePaymentSubmit()}
                disabled={isPaymentSubmitting}
              >
                {isPaymentSubmitting
                  ? t('common.actions.saving')
                  : t('pages.payables.payment.submit')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Installments Dialog */}
      <Dialog
        open={!!installmentsPayable}
        onOpenChange={(open) => {
          if (!open) setInstallmentsPayable(null);
        }}
      >
        <DialogContent className="custom-scrollbar max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.payables.installments.title')}</DialogTitle>
            <DialogDescription>{installmentsPayable?.description}</DialogDescription>
          </DialogHeader>
          {isLoadingInstallments ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('common.actions.loading')}
            </div>
          ) : installments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('pages.payables.installments.emptyState')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">
                      {t('pages.payables.installments.number')}
                    </th>
                    <th className="pb-2 pr-4">
                      {t('pages.payables.installments.dueDate')}
                    </th>
                    <th className="pb-2 pr-4 text-right">
                      {t('pages.payables.installments.value')}
                    </th>
                    <th className="pb-2">{t('pages.payables.installments.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => (
                    <tr key={inst.id} className="border-b">
                      <td className="py-2 pr-4">{inst.installment_number}</td>
                      <td className="py-2 pr-4">
                        {formatDate(inst.due_date, 'dd/MM/yyyy')}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatCurrency(inst.value)}
                      </td>
                      <td className="py-2">
                        <Badge variant={inst.payed ? 'secondary' : 'outline'}>
                          {inst.payed
                            ? t('pages.payables.installments.paid')
                            : t('pages.payables.installments.pending')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
