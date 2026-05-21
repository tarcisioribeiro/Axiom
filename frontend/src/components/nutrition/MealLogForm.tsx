import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { MealLog, MealLogFormData, MealType } from '@/types/nutrition';

interface MealLogFormProps {
  log?: MealLog;
  mealTypes: MealType[];
  ownerId: number;
  onSubmit: (data: MealLogFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MealLogForm({
  log,
  mealTypes,
  ownerId,
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
      meal_type: log?.meal_type ?? (0 as unknown as number),
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
  const selectedMealType = mealTypes.find((mt) => mt.id === Number(selectedMealTypeId));

  const handleFormSubmit = async (data: MealLogFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionLog.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-sm">
          <Label htmlFor="log-date">{t('pages.nutritionLog.logDate')}</Label>
          <Input
            id="log-date"
            type="date"
            {...register('date', { required: true })}
            className={errors.date ? 'border-destructive' : ''}
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="log-time">{t('pages.nutritionLog.logTime')}</Label>
          <Input id="log-time" type="time" {...register('time')} />
        </div>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="log-meal-type">{t('pages.nutritionLog.mealType')}</Label>
        <Select
          value={selectedMealTypeId ? String(selectedMealTypeId) : ''}
          onValueChange={(v) => {
            setValue('meal_type', Number(v));
            setValue('menu_option', undefined);
          }}
        >
          <SelectTrigger
            id="log-meal-type"
            className={errors.meal_type ? 'border-destructive' : ''}
          >
            <SelectValue placeholder={t('pages.nutritionLog.mealTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {mealTypes.map((mt) => (
              <SelectItem key={mt.id} value={String(mt.id)}>
                {mt.name}
                {mt.suggested_time ? ` (${mt.suggested_time.slice(0, 5)})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMealType && !isFreeMeal && selectedMealType.options.length > 0 && (
        <div className="space-y-sm">
          <Label>{t('pages.nutritionLog.menuOption')}</Label>
          <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
            {selectedMealType.options.map((opt) => {
              const isSelected = watch('menu_option') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setValue('menu_option', isSelected ? undefined : opt.id)
                  }
                  className={`rounded-md border p-sm text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <p className="mb-xs text-sm font-medium">{opt.name}</p>
                  <ul className="space-y-0.5">
                    {opt.ingredients.map((ing) => (
                      <li
                        key={ing.id}
                        className="flex items-center gap-xs text-xs text-muted-foreground"
                      >
                        {ing.is_optional && (
                          <span className="italic text-muted-foreground/60">[opt]</span>
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
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-sm">
        <Checkbox
          id="free-meal"
          checked={isFreeMeal}
          onCheckedChange={(v) => {
            setValue('is_free_meal', Boolean(v));
            if (v) setValue('menu_option', undefined);
          }}
        />
        <div>
          <Label htmlFor="free-meal">{t('pages.nutritionLog.isFreeMeal')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('pages.nutritionLog.isFreeMealDesc')}
          </p>
        </div>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="log-notes">{t('pages.nutritionLog.logNotes')}</Label>
        <Textarea
          id="log-notes"
          placeholder={t('pages.nutritionLog.logNotesPlaceholder')}
          rows={2}
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
