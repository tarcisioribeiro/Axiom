import {
  CalendarDays,
  CreditCard as CreditCardIcon,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Link2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { BRAND_COLORS, BRAND_ICONS } from '@/components/credit-cards/card-brands';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ACTION_COLOR } from '@/lib/action-colors';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { StoredCreditCard } from '@/types';

interface Props {
  card: StoredCreditCard | null;
  revealed?: { number: string; cvv: string };
  isRevealing: boolean;
  onReveal: (id: number) => void;
  onClose: () => void;
}

/** Detalhe do cartão guardado (§2.3); a face usa o degradê da bandeira (§9). */
export function StoredCardDetailModal({
  card: selected,
  revealed,
  isRevealing,
  onReveal,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Mantém o último cartão para o modal sair inteiro na animação de fechamento.
  const [card, setCard] = useState(selected);
  if (selected && selected !== card) setCard(selected);

  if (!card) return null;

  const expiry = `${String(card.expiration_month).padStart(2, '0')}/${card.expiration_year}`;

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle icon={CreditCardIcon}>{card.name}</DialogTitle>
          <DialogDescription>{card.name}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'p-lg space-y-lg rounded-lg bg-gradient-to-br text-white shadow-lg',
            BRAND_COLORS[card.flag] ?? 'from-slate-600 to-slate-900'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="h-8 w-10 rounded-md bg-white/30" />
            <span className="text-sm font-bold tracking-widest opacity-90">
              {BRAND_ICONS[card.flag] ?? card.flag_display}
            </span>
          </div>
          <div className="gap-sm flex items-center">
            <span className="text-lg tracking-widest">
              {revealed?.number ?? `•••• •••• •••• ${card.last_four_digits || '••••'}`}
            </span>
          </div>
          <div className="gap-md flex items-end justify-between">
            <div className="min-w-0">
              <p className="text-2xs tracking-widest uppercase opacity-70">
                {t('pages.storedCards.columns.holder')}
              </p>
              <p className="truncate text-sm font-semibold uppercase">
                {card.cardholder_name}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xs tracking-widest uppercase opacity-70">
                {t('pages.storedCards.columns.expiry')}
              </p>
              <p className="text-sm font-semibold">{expiry}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xs tracking-widest uppercase opacity-70">CVV</p>
              <div className="gap-xs flex items-center">
                <p className="text-sm font-semibold">{revealed?.cvv ?? '•••'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="gap-md grid grid-cols-2">
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Link2 className="h-3.5 w-3.5" />
              {t('pages.storedCards.form.financeCardLabel')}
            </p>
            {card.finance_card_name ? (
              <button
                type="button"
                className="gap-xs text-primary flex max-w-full items-center font-semibold hover:underline"
                onClick={() => void navigate('/credit-cards')}
              >
                <span className="truncate">{card.finance_card_name}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </button>
            ) : (
              <p className="font-semibold">—</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              {t('common.fields.createdAt')}
            </p>
            <p className="font-semibold">{formatDate(card.created_at)}</p>
          </div>
          {card.notes && (
            <div className="col-span-2 min-w-0">
              <p className="gap-xs text-muted-foreground flex items-center text-xs">
                <FileText className="h-3.5 w-3.5" />
                {t('common.fields.notes')}
              </p>
              <p className="text-sm">{card.notes}</p>
            </div>
          )}
        </div>

        <DialogCloseFooter>
          <div className="gap-sm flex flex-wrap justify-end">
            <Button
              variant="outline"
              onClick={() => onReveal(card.id)}
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
