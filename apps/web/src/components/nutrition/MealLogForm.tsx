/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Moon,
  Save,
  StickyNote,
  Sun,
  Sunrise,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { notifyFormErrors } from '@/lib/form-errors';
import { optionCalories } from '@/lib/nutrition-calories';
import { cn, formatLocalDate, formatQuantity } from '@/lib/utils';
import type { MealLog, MealLogFormData, MealType, MenuOption } from '@/types/nutrition';

interface MealLogFormProps {
  log?: MealLog;
  mealTypes: MealType[];
  ownerId: number;
  prefillMealTypeId?: number;
  prefillDate?: string;
  onSubmit: (data: MealLogFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function timeInputValue(time?: string | null): string {
  return time ? time.slice(0, 5) : '';
}

function getPeriodIcon(time?: string | null): ReactNode {
  if (!time) return <UtensilsCrossed className="h-4 w-4" />;
  const h = parseInt(time.slice(0, 2));
  if (h >= 4 && h < 9) return <Sunrise className="text-warning h-4 w-4" />;
  if (h >= 9 && h < 12) return <Sun className="text-warning h-4 w-4" />;
  if (h >= 12 && h < 19) return <Sun className="text-category-nutrition h-4 w-4" />;
  return <Moon className="text-info h-4 w-4" />;
}

export function MealLogForm({
  log,
  mealTypes,
  ownerId,
  prefillMealTypeId,
  prefillDate,
  onSubmit,
  onCancel,
  isLoading = false,
}: MealLogFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const today = prefillDate ?? formatLocalDate(new Date());
  const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
  const initialMealType = mealTypes.find(
    (mt) => mt.id === (log?.meal_type ?? prefillMealTypeId)
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MealLogFormData>({
    defaultValues: {
      meal_type: log?.meal_type ?? prefillMealTypeId ?? 0,
      menu_option: log?.menu_option ?? undefined,
      is_free_meal: log?.is_free_meal ?? false,
      date: log?.date ?? today,
      time: log
        ? timeInputValue(log.time)
        : timeInputValue(initialMealType?.suggested_time) || nowTime,
      notes: log?.notes ?? '',
      owner: ownerId,
    },
  });

  // Remembers the time that was auto-filled from a meal type's suggested_time,
  // so a later meal-type change can safely replace it without clobbering a
  // time the user picked manually.
  const autoFilledTimeRef = useRef<string | null>(
    log ? null : timeInputValue(initialMealType?.suggested_time) || nowTime
  );

  useEffect(() => {
    if (log) {
      reset({
        meal_type: log.meal_type,
        menu_option: log.menu_option ?? undefined,
        is_free_meal: log.is_free_meal,
        date: log.date,
        time: timeInputValue(log.time),
        notes: log.notes ?? '',
        owner: ownerId,
      });
      autoFilledTimeRef.current = null;
    }
  }, [log, ownerId, reset]);

  const [detailOption, setDetailOption] = useState<MenuOption | null>(null);
  const selectedMealTypeId = watch('meal_type');
  const isFreeMeal = watch('is_free_meal');
  const selectedMenuOption = watch('menu_option');
  const selectedMealType = mealTypes.find((mt) => mt.id === Number(selectedMealTypeId));

  register('meal_type', {
    validate: (v) =>
      !!v || t('common.fieldRequired', { field: t('pages.nutritionLog.mealType') }),
  });

  const handleFormSubmit = async (data: MealLogFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionLog.saveError'), variant: 'destructive' });
    }
  };

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(handleFormSubmit, notifyFormErrors)}
        className="space-y-lg"
      >
        {/* Data e hora */}
        <FormSection title="Data & Hora" icon={CalendarDays}>
          <div className="gap-sm grid grid-cols-2">
            <div className="space-y-xs">
              <Label className="gap-xs text-muted-foreground flex items-center text-xs">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.nutritionLog.logDate')}
              </Label>
              <DatePicker
                value={watch('date')}
                onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-xs">
              <Label className="gap-xs text-muted-foreground flex items-center text-xs">
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.nutritionLog.logTime')}
              </Label>
              <TimePicker
                value={watch('time') || undefined}
                onChange={(t) => {
                  setValue('time', t ?? '');
                  autoFilledTimeRef.current = null;
                }}
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

              const currentTime = watch('time');
              if (!currentTime || currentTime === autoFilledTimeRef.current) {
                const newMealType = mealTypes.find((mt) => mt.id === Number(v));
                const suggested = timeInputValue(newMealType?.suggested_time);
                autoFilledTimeRef.current = suggested || null;
                setValue('time', suggested);
              }
            }}
          >
            <SelectTrigger
              disabled={prefillMealTypeId !== undefined || isLoading}
              aria-invalid={!!errors.meal_type}
            >
              <SelectValue placeholder={t('pages.nutritionLog.mealTypePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {mealTypes.map((mt) => (
                <SelectItem key={mt.id} value={String(mt.id)}>
                  <span className="gap-sm flex items-center">
                    {getPeriodIcon(mt.suggested_time)}
                    {mt.name}
                    {mt.suggested_time && (
                      <span className="text-muted-foreground text-xs">
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
            'gap-sm p-sm flex items-start rounded-lg border-2 transition',
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
            <Label htmlFor="free-meal" className="gap-xs flex items-center font-medium">
              <Zap className="text-primary h-3.5 w-3.5" />
              {t('pages.nutritionLog.isFreeMeal')}
            </Label>
          </div>
        </div>

        {/* Opções de cardápio */}
        {selectedMealType && !isFreeMeal && selectedMealType.options.length > 0 && (
          <FormSection title={t('pages.nutritionLog.menuOption')} icon={CheckCircle2}>
            <div className="gap-sm grid">
              {selectedMealType.options.map((opt) => {
                const isSelected = selectedMenuOption === opt.id;
                return (
                  <div
                    key={opt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailOption(opt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailOption(opt);
                      }
                    }}
                    className={cn(
                      'gap-sm p-sm flex cursor-pointer items-center rounded-lg border transition',
                      isSelected
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    {/* Só o checkbox seleciona; o clique nele não abre o detalhe */}
                    <div
                      role="presentation"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        aria-label={opt.name}
                        checked={isSelected}
                        onCheckedChange={(v) =>
                          setValue('menu_option', v ? opt.id : undefined)
                        }
                      />
                    </div>
                    <span className="text-sm font-medium">{opt.name}</span>
                    {(() => {
                      const kcal = optionCalories(opt);
                      return kcal != null && kcal > 0 ? (
                        <span className="text-warning ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs">
                          <Flame className="h-3 w-3" />
                          {kcal} kcal
                        </span>
                      ) : null;
                    })()}
                  </div>
                );
              })}
            </div>
          </FormSection>
        )}

        {/* Observações */}
        <FormSection title={t('pages.nutritionLog.logNotes')} icon={StickyNote}>
          <Textarea
            placeholder={t('pages.nutritionLog.logNotesPlaceholder')}
            rows={1}
            {...register('notes')}
            className="resize-none"
          />
        </FormSection>

        <div className="dialog-footer gap-sm border-border pt-md flex justify-end border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {!isLoading && <Save className="h-4 w-4" />}

            {t('common.actions.save')}
          </Button>
        </div>
      </form>

      <Dialog
        open={detailOption !== null}
        onOpenChange={(open) => !open && setDetailOption(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle icon={UtensilsCrossed}>{detailOption?.name}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('pages.nutritionLog.menuOption')}
            </DialogDescription>
          </DialogHeader>
          {detailOption && detailOption.ingredients.length > 0 ? (
            <ul className="space-y-xs">
              {detailOption.ingredients.map((ing) => (
                <li
                  key={ing.id}
                  className="gap-xs text-muted-foreground flex items-center text-sm"
                >
                  <span className="bg-category-nutrition/40 h-1 w-1 rounded-full" />
                  {ing.is_optional && <span className="italic opacity-60">[opt.]</span>}
                  <span>
                    {ing.food_name}
                    {ing.quantity
                      ? ` — ${formatQuantity(t, ing.quantity, ing.unit)}`
                      : ''}
                    {ing.notes ? ` (${ing.notes})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('pages.nutritionMealTypes.noIngredients')}
            </p>
          )}
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailOption(null)}
            >
              <X className="h-4 w-4" />
              {t('common.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
