import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { translate } from '@/config/constants';
import { usePayablesPage } from '@/hooks/use-payables-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

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

              <div className="flex items-center justify-end gap-1 border-t pt-2">
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
    </PageContainer>
  );
}
