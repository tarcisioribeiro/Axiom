import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { creditCardsService } from '@/services/credit-cards-service';
import type { CreditCard } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STEP = 10;
const THUMB_CLASSES =
  'absolute inset-0 w-full cursor-pointer appearance-none bg-transparent ' +
  '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background ' +
  '[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow ' +
  '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary';

interface CreditLimitAdjustDialogProps {
  card?: CreditCard;
  onOpenChange: (open: boolean) => void;
}

export function CreditLimitAdjustDialog({
  card,
  onOpenChange,
}: CreditLimitAdjustDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const maxLimit = card ? parseFloat(card.max_limit) : 0;
  const used = Math.min(card?.used_credit ?? 0, maxLimit);
  const [value, setValue] = useState(() => (card ? parseFloat(card.credit_limit) : 0));

  const mutation = useMutation({
    mutationFn: () => creditCardsService.patch(card!.id, { credit_limit: value }),
    onSuccess: () => {
      toast({ title: t('pages.creditCards.adjustLimit.saved') });
      void queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      }),
  });

  const pct = maxLimit > 0 ? (value / maxLimit) * 100 : 0;
  const usedPct = maxLimit > 0 ? (used / maxLimit) * 100 : 0;

  return (
    <Dialog open={!!card} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.creditCards.adjustLimit.title')}</DialogTitle>
          <DialogDescription>{card?.name}</DialogDescription>
        </DialogHeader>

        <div className="pt-xl pb-md">
          <div className="relative h-8">
            <span
              className="bg-primary text-primary-foreground px-sm absolute -top-7 -translate-x-1/2 rounded-md py-0.5 text-sm font-semibold whitespace-nowrap"
              style={{ left: `clamp(3rem, ${pct}%, calc(100% - 3rem))` }}
            >
              {formatCurrency(value)}
            </span>
            {/* Trilho: parte já utilizada (bloqueada) + parte ajustável */}
            <div className="bg-muted absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full" />
            <div
              className="bg-primary/60 absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
              style={{ width: `${pct}%` }}
            />
            <div
              className="bg-destructive/70 absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
              style={{ width: `${usedPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={maxLimit}
              step={STEP}
              value={value}
              onChange={(e) => {
                const v = Number(e.target.value);
                // step não alcança um máximo fora do múltiplo de 10 — encaixa no topo
                setValue(v + STEP > maxLimit ? maxLimit : Math.max(used, v));
              }}
              aria-label={t('pages.creditCards.adjustLimit.title')}
              className={THUMB_CLASSES}
            />
          </div>
          <div className="mt-sm text-muted-foreground flex justify-between text-xs">
            <span>
              {t('pages.creditCards.adjustLimit.used', { value: formatCurrency(used) })}
            </span>
            <span>
              {t('pages.creditCards.adjustLimit.max', {
                value: formatCurrency(maxLimit),
              })}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {t('common.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
