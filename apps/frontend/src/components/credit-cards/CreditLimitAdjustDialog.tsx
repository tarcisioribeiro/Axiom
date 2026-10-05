import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { creditCardsService } from '@/services/credit-cards-service';
import type { CreditCard } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STEP = 10;
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
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      }),
  });

  const pct = maxLimit > 0 ? (value / maxLimit) * 100 : 0;

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
            <Slider
              min={0}
              max={maxLimit}
              step={STEP}
              floor={used}
              value={value}
              onChange={setValue}
              aria-label={t('pages.creditCards.adjustLimit.title')}
              className="absolute inset-x-0 top-1/2 -translate-y-1/2"
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
            <X className="mr-sm h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Save className="mr-sm h-4 w-4" />
            {t('common.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
