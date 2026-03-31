import { Plus, Pencil, Trash2, Calendar, TrendingDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { FixedExpenseForm } from '@/components/expenses/FixedExpenseForm';
import { FixedExpenseStats } from '@/components/expenses/FixedExpenseStats';
import { LaunchExpensesDialog } from '@/components/expenses/LaunchExpensesDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TRANSLATIONS } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { accountsService } from '@/services/accounts-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type { FixedExpense, FixedExpenseFormData, Account, CreditCard } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function FixedExpenses() {
  const { t } = useTranslation();
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [expensesData, accountsData, cardsData] = await Promise.all([
        fixedExpensesService.getAll(),
        accountsService.getAll(),
        creditCardsService.getAll(),
      ]);
      setFixedExpenses(expensesData);
      setAccounts(accountsData);
      setCreditCards(cardsData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: FixedExpenseFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedExpense) {
        await fixedExpensesService.update(selectedExpense.id, data);
        toast({
          title: t('pages.fixedExpenses.updated'),
          description: t('pages.fixedExpenses.updatedDesc'),
        });
      } else {
        await fixedExpensesService.create(data);
        toast({
          title: t('pages.fixedExpenses.created'),
          description: t('pages.fixedExpenses.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.fixedExpenses.deleteTitle'),
      description: t('pages.fixedExpenses.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await fixedExpensesService.delete(id);
      toast({
        title: t('pages.fixedExpenses.deleted'),
        description: t('pages.fixedExpenses.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const columns: Column<FixedExpense>[] = [
    {
      key: 'description',
      label: t('pages.fixedExpenses.columns.description'),
      render: (item) => <div className="font-medium">{item.description}</div>,
    },
    {
      key: 'default_value',
      label: t('pages.fixedExpenses.columns.defaultAmount'),
      align: 'right',
      render: (item) => (
        <span className="font-semibold text-destructive">
          {formatCurrency(item.default_value)}
        </span>
      ),
    },
    {
      key: 'due_day',
      label: t('pages.fixedExpenses.columns.dueDay'),
      align: 'center',
      render: (item) => <Badge variant="outline">Dia {item.due_day}</Badge>,
    },
    {
      key: 'account_name',
      label: t('pages.fixedExpenses.columns.account'),
      render: (item) => <Badge variant="outline">{item.account_name || 'N/A'}</Badge>,
    },
    {
      key: 'category',
      label: t('pages.fixedExpenses.columns.category'),
      render: (item) => (
        <Badge variant="secondary">
          {TRANSLATIONS.expenseCategories[
            item.category as keyof typeof TRANSLATIONS.expenseCategories
          ] || item.category}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: t('pages.fixedExpenses.columns.status'),
      render: (item) => (
        <Badge variant={item.is_active ? 'default' : 'secondary'}>
          {item.is_active ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
    },
    {
      key: 'total_generated',
      label: t('pages.fixedExpenses.columns.generated'),
      align: 'center',
      render: (item) => <span className="text-sm">{item.total_generated}x</span>,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.fixedExpenses.title')}
        icon={<Calendar className="h-6 w-6" />}
        action={{
          label: t('pages.fixedExpenses.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setSelectedExpense(undefined);
            setIsDialogOpen(true);
          },
        }}
      />

      {/* Stats Dashboard */}
      <FixedExpenseStats />

      {/* Launch Button */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {t('pages.fixedExpenses.launchSection')}
            </h3>
            <p className="text-sm">{t('pages.fixedExpenses.launchDesc')}</p>
          </div>
          <Button onClick={() => setIsLaunchDialogOpen(true)} size="lg">
            <TrendingDown className="mr-2 h-4 w-4" />
            {t('pages.fixedExpenses.launchBtn')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={fixedExpenses}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingDown className="h-12 w-12 text-muted-foreground" />,
          message: t('pages.fixedExpenses.emptyState'),
        }}
        actions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedExpense(item);
                setIsDialogOpen(true);
              }}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(item.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense
                ? t('pages.fixedExpenses.editTitle')
                : t('pages.fixedExpenses.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedExpense
                ? t('pages.fixedExpenses.editDesc')
                : t('pages.fixedExpenses.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <FixedExpenseForm
            fixedExpense={selectedExpense}
            accounts={accounts}
            creditCards={creditCards}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Launch Dialog */}
      <LaunchExpensesDialog
        isOpen={isLaunchDialogOpen}
        onClose={() => setIsLaunchDialogOpen(false)}
        fixedExpenses={fixedExpenses.filter((e) => e.is_active)}
        onSuccess={loadData}
      />
    </PageContainer>
  );
}
