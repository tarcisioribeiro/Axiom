import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange,
  EyeOff,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { resetHiddenTours } from '@/config/page-tour';
import { useUserPreferences } from '@/hooks/use-daily-review';
import { useToast } from '@/hooks/use-toast';
import { dailyReviewService } from '@/services/daily-review-service';
import type { SelfEsteemFrequency, UserPreferences } from '@/types/daily-review';
import { getErrorMessage } from '@/utils/error-utils';

const FREQUENCIES: SelfEsteemFrequency[] = [1, 7, 14];

/** Preferências do app (revisão diária e tours), abertas em Meu Perfil. */
export function AppPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data } = useUserPreferences();
  return (
    <Dialog open={open && !!data} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={SlidersHorizontal}>
            {t('userProfile.appPreferences.title')}
          </DialogTitle>
        </DialogHeader>
        {data && <PreferencesForm initial={data} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PreferencesForm({
  initial,
  onClose,
}: {
  initial: UserPreferences;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);

  const mutation = useMutation({
    mutationFn: () => dailyReviewService.updatePreferences(form),
    onSuccess: (saved) => {
      queryClient.setQueryData(['me', 'preferences'], saved);
      // fins de semana e frequência mudam o que a revisão cobra
      void queryClient.invalidateQueries({ queryKey: ['daily-review'] });
      toast({ title: t('userProfile.appPreferences.saved') });
      onClose();
    },
    onError: (err: unknown) =>
      toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  return (
    <>
      <div className="space-y-md">
        <label className="gap-sm flex cursor-pointer items-center text-sm">
          <Checkbox
            checked={form.daily_review_on_weekends}
            onCheckedChange={(c) =>
              setForm((f) => ({ ...f, daily_review_on_weekends: c === true }))
            }
          />
          <span className="gap-xs flex items-center">
            <CalendarRange className="text-muted-foreground h-3.5 w-3.5" />
            {t('userProfile.appPreferences.weekends')}
          </span>
        </label>

        <FormField
          id="pref-self-esteem"
          label={t('userProfile.appPreferences.selfEsteemFrequency')}
          icon={Star}
        >
          <Select
            value={String(form.self_esteem_frequency_days)}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                self_esteem_frequency_days: Number(v) as SelfEsteemFrequency,
              }))
            }
          >
            <SelectTrigger id="pref-self-esteem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {t(`userProfile.appPreferences.frequency.${days}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="gap-md flex items-center justify-between">
          <label className="gap-sm flex cursor-pointer items-center text-sm">
            <Checkbox
              checked={form.tours_disabled}
              onCheckedChange={(c) =>
                setForm((f) => ({ ...f, tours_disabled: c === true }))
              }
            />
            <span className="gap-xs flex items-center">
              <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
              {t('userProfile.appPreferences.toursDisabled')}
            </span>
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetHiddenTours();
              toast({ title: t('userProfile.appPreferences.toursReset') });
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('userProfile.appPreferences.resetTours')}
          </Button>
        </div>
      </div>

      <DialogFooter className="gap-sm">
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {!mutation.isPending && <Save className="h-4 w-4" />}
          {t('common.actions.save')}
        </Button>
      </DialogFooter>
    </>
  );
}
