import { Pencil, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { translate } from '@/config/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Account } from '@/types';

interface Props {
  account: Account | null;
  onClose: () => void;
  onEdit: (account: Account) => void;
  onDelete: (id: number) => void;
}

export function AccountDetailModal({
  account: selected,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  // Mantém a última conta para o modal sair inteiro na animação de fechamento.
  const [account, setAccount] = useState(selected);
  if (selected && selected !== account) setAccount(selected);

  if (!account) return null;

  const balance = parseFloat(account.balance);
  const overdraft = parseFloat(account.overdraft_limit ?? '0');
  const reservedInVaults = parseFloat(account.deposited_in_vaults ?? '0');
  const availableForSpending = parseFloat(account.available_balance ?? account.balance);

  const fields: { label: string; value: string; className?: string }[] = [
    {
      label: t('pages.accounts.columns.number'),
      value: account.account_number_masked || '—',
    },
    {
      label: t('pages.accounts.form.overdraftLabel'),
      value: formatCurrency(String(overdraft)),
    },
    {
      label: t('pages.accounts.detailLabels.available'),
      value: formatCurrency(String(balance + overdraft)),
      className: balance + overdraft >= 0 ? undefined : 'text-destructive',
    },
    {
      label: t('pages.accounts.detailLabels.reservedInVaults'),
      value: formatCurrency(String(reservedInVaults)),
    },
    {
      label: t('pages.accounts.detailLabels.availableForSpending'),
      value: formatCurrency(String(availableForSpending)),
      className: availableForSpending >= 0 ? 'text-info' : 'text-destructive',
    },
    {
      label: t('pages.accounts.columns.createdAt'),
      value: formatDate(account.created_at),
    },
  ];

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle icon={Wallet}>{account.account_name}</DialogTitle>
          <DialogDescription>{account.account_name}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between">
          <p className="text-muted-foreground text-sm">
            {translate('institutions', account.institution)}
          </p>
          <Badge variant="secondary">
            {translate('accountTypes', account.account_type)}
          </Badge>
        </div>

        <div>
          <p className="text-muted-foreground text-xs">
            {t('pages.accounts.columns.balance')}
          </p>
          <p
            className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}
          >
            {formatCurrency(account.balance)}
          </p>
        </div>

        <div className="gap-md grid grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-muted-foreground text-xs">{f.label}</p>
              <p className={`font-semibold ${f.className ?? ''}`}>{f.value}</p>
            </div>
          ))}
        </div>

        <DialogCloseFooter>
          <Button variant="outline" onClick={() => onDelete(account.id)}>
            <Trash2 className="text-destructive h-4 w-4" />
            {t('common.actions.delete')}
          </Button>
          <Button onClick={() => onEdit(account)}>
            <Pencil className="h-4 w-4" />
            {t('common.actions.edit')}
          </Button>
        </DialogCloseFooter>
      </DialogContent>
    </Dialog>
  );
}
