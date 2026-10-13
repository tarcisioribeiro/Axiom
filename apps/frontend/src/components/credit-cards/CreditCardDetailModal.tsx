import { useQuery } from '@tanstack/react-query';
import { CreditCard as CreditCardIcon, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { BRAND_COLORS, BRAND_ICONS } from '@/components/credit-cards/card-brands';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { translate } from '@/config/constants';
import { formatCurrency } from '@/lib/formatters';
import { getCurrentCreditCardBill } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import type { CreditCard } from '@/types';

function UsageArc({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color =
    pct >= 90
      ? 'hsl(var(--destructive))'
      : pct >= 70
        ? 'hsl(var(--warning))'
        : 'hsl(var(--success))';
  const circle = { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: 5 };
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle {...circle} stroke="currentColor" className="text-white/20" />
      <circle
        {...circle}
        stroke={color}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/** Remove o " *" de campo obrigatório dos rótulos do formulário, reaproveitados aqui como texto. */
const stripRequired = (label: string) => label.replace(/ \*$/, '');

interface Props {
  card: CreditCard | null;
  onClose: () => void;
}

export function CreditCardDetailModal({ card, onClose }: Props) {
  const { t } = useTranslation();
  const cardId = card?.id;

  const billsQuery = useQuery({
    queryKey: ['creditCards', cardId, 'recentBills'],
    queryFn: () => creditCardBillsService.getAll({ credit_card: cardId }),
    enabled: !!cardId,
  });

  if (!card) return null;

  const limit = parseFloat(card.credit_limit);
  const available = card.available_credit ?? 0;
  const used = Math.max(0, limit - available);
  const usagePct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const brandGradient = BRAND_COLORS[card.flag] ?? 'from-slate-600 to-slate-900';
  const openBill = getCurrentCreditCardBill(billsQuery.data ?? []);

  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center text-lg">
            <CreditCardIcon className="h-5 w-5" aria-hidden="true" />
            {card.name}
          </DialogTitle>
          <DialogDescription className="sr-only">{card.name}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'p-lg relative overflow-hidden rounded-lg bg-gradient-to-br text-white shadow-lg',
            brandGradient
          )}
        >
          <div className="space-y-md relative">
            <div className="flex items-start justify-end">
              <span className="text-sm font-bold tracking-widest opacity-90">
                {BRAND_ICONS[card.flag] ?? translate('cardBrands', card.flag)}
              </span>
            </div>

            <div className="gap-lg flex flex-wrap items-center">
              <div className="relative">
                <UsageArc pct={usagePct} size={64} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  {Math.round(usagePct)}%
                </span>
              </div>
              <div>
                <p className="text-xs opacity-70">{t('pages.creditCards.limit')}</p>
                <p className="text-2xl font-bold">{formatCurrency(available)}</p>
                <p className="text-xs opacity-70">
                  {t('pages.creditCards.ofLimit', { value: formatCurrency(limit) })}
                </p>
              </div>
              <div className="space-y-xs">
                <div>
                  <p className="text-xs opacity-70">
                    {t('pages.creditCardHub.usedCredit')}
                  </p>
                  <p className="text-xl font-semibold">{formatCurrency(used)}</p>
                </div>
                {openBill && (
                  <div>
                    <p className="text-xs opacity-70">
                      {t('pages.creditCardHub.currentBill')}
                    </p>
                    <p className="text-sm font-medium">
                      {formatCurrency(parseFloat(openBill.total_amount))}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-xs">
              <p className="text-sm tracking-widest opacity-90">
                {card.card_number_masked || '**** **** **** ****'}
              </p>
              <div className="gap-md flex items-end justify-between">
                <div className="min-w-0">
                  <p className="text-xs opacity-60">{t('common.fields.name')}</p>
                  <p className="truncate text-sm font-semibold tracking-wider uppercase">
                    {card.on_card_name || '—'}
                  </p>
                </div>
                <div className="gap-lg flex shrink-0 items-end text-right">
                  <div>
                    <p className="text-xs opacity-60">
                      {t('pages.creditCards.dueDay')}
                    </p>
                    <p className="gap-xs flex items-center justify-end text-sm">
                      <CalendarDays className="h-3 w-3" />
                      {card.due_day}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs opacity-60">VALIDADE</p>
                    <p className="text-sm">
                      {card.validation_date
                        ? `${card.validation_date.substring(5, 7)}/${card.validation_date.substring(2, 4)}`
                        : '••/••'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />
        </div>

        <div className="gap-md grid grid-cols-2 sm:grid-cols-3">
          <DetailField
            label={stripRequired(t('pages.creditCards.form.maxLimitLabel'))}
            value={formatCurrency(card.max_limit)}
          />
          <DetailField
            label={stripRequired(t('pages.creditCards.form.closingDayLabel'))}
            value={t('pages.creditCards.dueDayValue', { day: card.closing_day })}
          />
          <DetailField
            label={stripRequired(t('pages.creditCards.form.associatedAccountLabel'))}
            value={card.associated_account_name ?? '—'}
          />
          {card.interest_rate && (
            <DetailField
              label={stripRequired(t('pages.creditCards.form.interestRateLabel'))}
              value={`${card.interest_rate}%`}
            />
          )}
          {card.annual_fee && (
            <DetailField
              label={stripRequired(t('pages.creditCards.form.annualFeeLabel'))}
              value={formatCurrency(card.annual_fee)}
            />
          )}
        </div>

        {card.notes && (
          <div>
            <p className="text-muted-foreground text-xs">
              {stripRequired(t('pages.creditCards.form.notesLabel'))}
            </p>
            <p className="text-sm">{card.notes}</p>
          </div>
        )}

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
