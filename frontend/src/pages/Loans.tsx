import { Plus, Trash2, Pencil, Download, HandCoins } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { LoanForm } from '@/components/loans/LoanForm';
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
import { useLoansPage } from '@/hooks/use-loans-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paid: 'secondary',
  defaulted: 'destructive',
  cancelled: 'outline',
};

export default function Loans() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    accounts, members, isLoading,
    isDialogOpen, setIsDialogOpen, selectedLoan, isSubmitting,
    searchTerm, setSearchTerm, filteredLoans,
    handleCreate, handleEdit, handleDelete, handleSubmit,
  } = useLoansPage();

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.loans.title')}
        icon={<HandCoins />}
        action={{ label: t('pages.loans.newBtn'), icon: <Plus className="h-4 w-4" />, onClick: handleCreate }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder={t('pages.loans.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
      </div>

      {filteredLoans.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-12 w-12 text-muted-foreground" />}
          message={searchTerm ? t('pages.loans.emptySearch') : t('pages.loans.emptyState')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLoans.map((loan) => (
            <div key={loan.id} className="space-y-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{loan.description}</h3>
                  <p className="text-sm">{translate('expenseCategories', loan.category)}</p>
                </div>
                <Badge variant={STATUS_VARIANTS[loan.status] ?? 'default'}>
                  {translate('loanStatus', loan.status)}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Valor Total:</span><span className="font-medium">{formatCurrency(loan.value)}</span></div>
                <div className="flex justify-between"><span>Valor Pago:</span><span className="font-medium">{formatCurrency(loan.payed_value)}</span></div>
                <div className="flex justify-between">
                  <span>Saldo:</span>
                  <span className="font-medium text-destructive">{formatCurrency(parseFloat(loan.value) - parseFloat(loan.payed_value))}</span>
                </div>
                <div className="flex justify-between"><span>Beneficiado:</span><span className="font-medium">{loan.benefited_name}</span></div>
                <div className="flex justify-between"><span>Credor:</span><span className="font-medium">{loan.creditor_name}</span></div>
                <div className="flex justify-between"><span>Parcelas:</span><span className="font-medium">{loan.installments}x</span></div>
                {loan.due_date && (
                  <div className="flex justify-between"><span>Vencimento:</span><span className="font-medium">{formatDate(loan.due_date, 'dd/MM/yyyy')}</span></div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 border-t pt-2">
                <ReceiptButton source={{ type: 'loan', data: loan }} memberName={getMemberDisplayName(loan.benefited_name, user)} variant="ghost" size="icon" />
                <Button variant="ghost" size="icon" onClick={() => handleEdit(loan)} title={t('common.actions.edit')} aria-label={t('common.actions.edit')}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(loan)} title={t('common.actions.delete')} aria-label={t('common.actions.delete')}>
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                </Button>
                {loan.contract_document && (
                  <Button variant="ghost" size="icon" title="Download" asChild>
                    <a href={loan.contract_document} download aria-label="Download">
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLoan ? t('pages.loans.editTitle') : t('pages.loans.newTitle')}</DialogTitle>
            <DialogDescription>{selectedLoan ? t('pages.loans.editDesc') : t('pages.loans.newDesc')}</DialogDescription>
          </DialogHeader>
          <LoanForm
            loan={selectedLoan}
            accounts={accounts}
            members={members}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
