import {
  Building2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Link2,
  Lock,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

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
import { ACTION_COLOR } from '@/lib/action-colors';
import type { StoredBankAccount } from '@/types';

export interface RevealedAccount {
  account_number?: string;
  password?: string;
  password2?: string;
}

interface Props {
  account: StoredBankAccount | null;
  revealed?: RevealedAccount;
  isRevealing: boolean;
  onReveal: (id: number) => void;
  onClose: () => void;
}

/** Detalhe da conta guardada (§2.3): somente leitura, Fechar à esquerda. */
export function StoredAccountDetailModal({
  account: selected,
  revealed,
  isRevealing,
  onReveal,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Mantém a última conta para o modal sair inteiro na animação de fechamento.
  const [account, setAccount] = useState(selected);
  if (selected && selected !== account) setAccount(selected);

  if (!account) return null;

  const secrets = [
    {
      icon: Hash,
      label: t('pages.storedAccounts.columns.number'),
      value: revealed?.account_number ?? account.account_number_masked,
    },
    {
      icon: Lock,
      label: t('pages.storedAccounts.password1'),
      value: revealed ? revealed.password || '—' : '••••••••',
    },
    {
      icon: Lock,
      label: t('pages.storedAccounts.password2'),
      value: revealed ? revealed.password2 || '—' : '••••••••',
    },
  ];

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle icon={Wallet}>{account.name}</DialogTitle>
          <DialogDescription>{account.name}</DialogDescription>
        </DialogHeader>

        <div className="gap-md grid grid-cols-2">
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Building2 className="h-3.5 w-3.5" />
              {t('common.fields.institution')}
            </p>
            <p className="truncate font-semibold">
              {translate('institutions', account.institution_name)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Wallet className="h-3.5 w-3.5" />
              {t('common.fields.type')}
            </p>
            <p className="truncate font-semibold">
              {translate('accountTypes', account.account_type)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Hash className="h-3.5 w-3.5" />
              {t('pages.storedAccounts.columns.agency')}
            </p>
            <p className="truncate font-semibold">{account.agency || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Link2 className="h-3.5 w-3.5" />
              {t('pages.storedAccounts.form.financeAccountLabel')}
            </p>
            {account.finance_account_name ? (
              <button
                type="button"
                className="gap-xs text-primary flex max-w-full items-center font-semibold hover:underline"
                onClick={() => void navigate('/accounts')}
              >
                <span className="truncate">{account.finance_account_name}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </button>
            ) : (
              <p className="font-semibold">—</p>
            )}
          </div>
        </div>

        <div className="bg-muted/30 p-md space-y-sm rounded-lg border">
          {secrets.map(({ icon: Icon, label, value }) => (
            <div key={label} className="gap-sm flex items-center">
              <span className="gap-xs text-muted-foreground flex w-40 shrink-0 items-center text-xs">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
              <code className="min-w-0 flex-1 truncate text-sm">{value}</code>
            </div>
          ))}
        </div>

        {account.notes && (
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <FileText className="h-3.5 w-3.5" />
              {t('common.fields.notes')}
            </p>
            <p className="text-sm">{account.notes}</p>
          </div>
        )}

        <DialogCloseFooter>
          <div className="gap-sm flex flex-wrap justify-end">
            <Button
              variant="outline"
              onClick={() => onReveal(account.id)}
              loading={isRevealing}
            >
              {!isRevealing &&
                (revealed ? (
                  <EyeOff className={ACTION_COLOR.reveal} />
                ) : (
                  <Eye className={ACTION_COLOR.reveal} />
                ))}
              {revealed ? t('common.actions.hide') : t('common.actions.reveal')}
            </Button>
          </div>
        </DialogCloseFooter>
      </DialogContent>
    </Dialog>
  );
}
