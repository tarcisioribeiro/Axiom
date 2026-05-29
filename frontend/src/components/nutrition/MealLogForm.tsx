/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Moon,
  StickyNote,
  Sun,
  Sunrise,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { useToast } from '@/hooks/use-toast';
import { cn, formatLocalDate } from '@/lib/utils';
import type { MealLog, MealLogFormData, MealType } from '@/types/nutrition';

interface MealLogFormProps {
  log?: MealLog;
  mealTypes: MealType[];
  ownerId: number;
  prefillMealTypeId?: number;
  onSubmit: (data: MealLogFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function getPeriodIcon(time?: string | null): ReactNode {
  if (!time) return <UtensilsCrossed className="h-4 w-4" />;
  const h = parseInt(time.slice(0, 2));
  if (h >= 4 && h < 9) return <Sunrise className="h-4 w-4 text-amber-500" />;
  if (h >= 9 && h < 15) return <Sun className="h-4 w-4 text-yellow-500" />;
  if (h >= 15 && h < 19) return <Sun className="h-4 w-4 text-amber-600" />;
  return <Moon className="h-4 w-4 text-violet-500" />;
}

export function MealLogForm({
  log,
  mealTypes,
  ownerId,
  prefillMealTypeId,
  onSubmit,
  onCancel,
  isLoading = false,
}: MealLogFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MealLogFormData>({
    defaultValues: {
      meal_type: log?.meal_type ?? prefillMealTypeId ?? (0 as unknown as number),
      menu_option: log?.menu_option ?? undefined,
      is_free_meal: log?.is_free_meal ?? false,
      date: log?.date ?? today,
      time: log?.time ?? '',
      notes: log?.notes ?? '',
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (log) {
      reset({
        meal_type: log.meal_type,
        menu_option: log.menu_option ?? undefined,
        is_free_meal: log.is_free_meal,
        date: log.date,
        time: log.time ?? '',
        notes: log.notes ?? '',
        owner: ownerId,
      });
    }
  }, [log, ownerId, reset]);

  const selectedMealTypeId = watch('meal_type');
  const isFreeMeal = watch('is_free_meal');
  const selectedMenuOption = watch('menu_option');
  const selectedMealType = mealTypes.find((mt) => mt.id === Number(selectedMealTypeId));

  const handleFormSubmit = async (data: MealLogFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionLog.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header */}
      <div className="flex items-center gap-md rounded-lg bg-category-nutrition/10 px-md py-sm ring-1 ring-category-nutrition/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-nutrition/20">
          <CheckCircle2 className="h-5 w-5 text-category-nutrition" />
        </div>
        <div>
          <p className="text-sm font-semibold text-category-nutrition">
            {log
              ? t('pages.nutritionLog.editLogTitle')
              : t('pages.nutritionLog.newLogTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedMealType?.name ?? t('pages.nutritionLog.newLogDesc')}
          </p>
        </div>
      </div>

      {/* Data e hora */}
      <FormSection title="Data & Hora" icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-sm">
          <div className="space-y-xs">
            <Label className="text-xs text-muted-foreground">
              {t('pages.nutritionLog.logDate')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-xs">
            <Label className="text-xs text-muted-foreground">
              {t('pages.nutritionLog.logTime')}
            </Label>
            <TimePicker
              value={watch('time') || undefined}
              onChange={(t) => setValue('time', t ?? '')}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {/* Tipo de refeição */}
      <FormSection title={t('pages.nutritionLog.mealType')} icon={UtensilsCrossed}>
        <Select
          value={selectedMealTypeId ? String(selectedMealTypeId) : ''}
          onValueChange={(v) => {
            setValue('meal_type', Number(v));
            setValue('menu_option', undefined);
          }}
        >
          <SelectTrigger className={cn(errors.meal_type && 'border-destructive')}>
            <SelectValue placeholder={t('pages.nutritionLog.mealTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {mealTypes.map((mt) => (
              <SelectItem key={mt.id} value={String(mt.id)}>
                <span className="flex items-center gap-sm">
                  {getPeriodIcon(mt.suggested_time)}
                  {mt.name}
                  {mt.suggested_time && (
                    <span className="text-xs text-muted-foreground">
                      {mt.suggested_time.slice(0, 5)}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormSection>

      {/* Refeição livre */}
      <div
        className={cn(
          'flex items-start gap-sm rounded-lg border-2 p-sm transition-all',
          isFreeMeal ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
        )}
      >
        <Checkbox
          id="free-meal"
          checked={isFreeMeal}
          onCheckedChange={(v) => {
            setValue('is_free_meal', Boolean(v));
            if (v) setValue('menu_option', undefined);
          }}
          className="mt-0.5"
        />
        <div>
          <Label htmlFor="free-meal" className="flex items-center gap-xs font-medium">
            <Zap className="h-3.5 w-3.5 text-primary" />
            {t('pages.nutritionLog.isFreeMeal')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('pages.nutritionLog.isFreeMealDesc')}
          </p>
        </div>
      </div>

      {/* Opções de cardápio */}
      {selectedMealType && !isFreeMeal && selectedMealType.options.length > 0 && (
        <FormSection title={t('pages.nutritionLog.menuOption')} icon={CheckCircle2}>
          <div className="grid gap-sm">
            {selectedMealType.options.map((opt) => {
              const isSelected = selectedMenuOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setValue('menu_option', isSelected ? undefined : opt.id)
                  }
                  className={cn(
                    'rounded-lg border-2 p-sm text-left transition-all',
                    isSelected
                      ? 'bg-category-nutrition/8 border-category-nutrition/50 ring-1 ring-category-nutrition/20'
                      : 'border-border bg-card hover:border-category-nutrition/30 hover:bg-category-nutrition/5'
                  )}
                >
                  <div className="mb-xs flex items-center gap-xs">
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
                        isSelected
                          ? 'border-category-nutrition bg-category-nutrition'
                          : 'border-border'
                      )}
                    >
                      {isSelected && (
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 8 8"
                          fill="none"
                          className="text-white"
                        >
                          <path
                            d="M1.5 4L3 5.5L6.5 2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{opt.name}</p>
                  </div>
                  {opt.ingredients.length > 0 && (
                    <ul className="ml-xs space-y-0.5">
                      {opt.ingredients.map((ing) => (
                        <li
                          key={ing.id}
                          className="flex items-center gap-xs text-xs text-muted-foreground"
                        >
                          <span className="h-1 w-1 rounded-full bg-category-nutrition/40" />
                          {ing.is_optional && (
                            <span className="italic opacity-60">[opt.]</span>
                          )}
                          <span>
                            {ing.food_name}
                            {ing.quantity
                              ? ` — ${ing.quantity} ${t(`units.${ing.unit}`)}`
                              : ''}
                            {ing.notes ? ` (${ing.notes})` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </FormSection>
      )}

      {/* Observações */}
      <FormSection title={t('pages.nutritionLog.logNotes')} icon={StickyNote}>
        <Textarea
          placeholder={t('pages.nutritionLog.logNotesPlaceholder')}
          rows={2}
          {...register('notes')}
          className="resize-none"
        />
      </FormSection>

      <div className="flex justify-end gap-sm border-t border-border pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-category-nutrition hover:bg-category-nutrition/90"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
