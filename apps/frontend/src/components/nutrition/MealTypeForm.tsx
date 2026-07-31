/* eslint-disable react-hooks/incompatible-library */
import {
  CheckCircle2,
  Clock,
  Loader2,
  Moon,
  Sun,
  Sunrise,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { MealType, MealTypeFormData } from '@/types/nutrition';

interface MealTypeFormProps {
  mealType?: MealType;
  ownerId: number;
  onSubmit: (data: MealTypeFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function getPeriodInfo(time: string): {
  icon: ReactNode;
  labelKey: string;
  color: string;
} {
  if (!time)
    return {
      icon: <UtensilsCrossed className="h-5 w-5" />,
      labelKey: '',
      color: 'text-muted-foreground',
    };
  const h = parseInt(time.slice(0, 2));
  if (h >= 4 && h < 9)
    return {
      icon: <Sunrise className="h-5 w-5 text-amber-500" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeEarlyMorning',
      color: 'text-amber-500',
    };
  if (h >= 9 && h < 12)
    return {
      icon: <Sun className="h-5 w-5 text-yellow-500" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeMorning',
      color: 'text-yellow-500',
    };
  if (h >= 12 && h < 15)
    return {
      icon: <Sun className="h-5 w-5 text-orange-500" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeLunch',
      color: 'text-orange-500',
    };
  if (h >= 15 && h < 19)
    return {
      icon: <Sun className="h-5 w-5 text-amber-600" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeAfternoon',
      color: 'text-amber-600',
    };
  return {
    icon: <Moon className="h-5 w-5 text-violet-500" />,
    labelKey: 'pages.nutritionMealTypes.suggestedTimeNight',
    color: 'text-violet-500',
  };
}

export function MealTypeForm({
  mealType,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: MealTypeFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MealTypeFormData>({
    defaultValues: {
      name: mealType?.name ?? '',
      suggested_time: mealType?.suggested_time ?? '',
      order: mealType?.order ?? 0,
      is_active: mealType?.is_active ?? true,
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (mealType) {
      reset({
        name: mealType.name,
        suggested_time: mealType.suggested_time ?? '',
        order: mealType.order,
        is_active: mealType.is_active,
        owner: ownerId,
      });
    }
  }, [mealType, ownerId, reset]);

  const isActive = watch('is_active');
  const suggestedTime = watch('suggested_time');
  const period = getPeriodInfo(suggestedTime ?? '');

  const handleFormSubmit = async (data: MealTypeFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionMealTypes.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header visual */}
      <div className="gap-md bg-category-nutrition/10 px-md py-sm ring-category-nutrition/20 flex items-center rounded-lg ring-1">
        <div className="bg-category-nutrition/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <UtensilsCrossed className="text-category-nutrition h-5 w-5" />
        </div>
        <div>
          <p className="text-category-nutrition text-sm font-semibold">
            {mealType
              ? t('pages.nutritionMealTypes.editMealTypeTitle')
              : t('pages.nutritionMealTypes.newMealTypeTitle')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t('pages.nutritionMealTypes.newMealTypeDesc')}
          </p>
        </div>
      </div>

      {/* Nome */}
      <FormSection
        title={t('pages.nutritionMealTypes.mealTypeName')}
        icon={UtensilsCrossed}
      >
        <Input
          placeholder={t('pages.nutritionMealTypes.mealTypeNamePlaceholder')}
          {...register('name', { required: true })}
          className={cn(errors.name && 'border-destructive')}
        />
        {errors.name && (
          <p className="mt-xs text-destructive text-xs">{t('common.required')}</p>
        )}
      </FormSection>

      {/* Horário */}
      <FormSection title={t('pages.nutritionMealTypes.suggestedTime')} icon={Clock}>
        <div className="gap-md flex items-center">
          <TimePicker
            value={watch('suggested_time') || undefined}
            onChange={(t) => setValue('suggested_time', t ?? '')}
            className="w-36"
          />
          {suggestedTime && (
            <div
              className={cn(
                'gap-xs flex items-center text-sm font-medium',
                period.color
              )}
            >
              {period.icon}
              <span>{period.labelKey ? t(period.labelKey) : ''}</span>
            </div>
          )}
        </div>
      </FormSection>

      {/* Status e Ordem */}
      <div className="gap-md grid grid-cols-[1fr_auto] items-start">
        <div className="space-y-sm">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {t('pages.nutritionMealTypes.mealTypeActive')}
          </span>
          <div className="gap-sm grid grid-cols-2">
            <button
              type="button"
              onClick={() => setValue('is_active', true)}
              className={cn(
                'gap-xs px-sm py-xs flex items-center justify-center rounded-lg border-2 text-xs font-medium transition-all',
                isActive
                  ? 'border-success bg-success/10 text-success'
                  : 'border-border bg-card text-muted-foreground hover:border-success/40 hover:bg-success/5'
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('pages.nutritionMealTypes.active')}
            </button>
            <button
              type="button"
              onClick={() => setValue('is_active', false)}
              className={cn(
                'gap-xs px-sm py-xs flex items-center justify-center rounded-lg border-2 text-xs font-medium transition-all',
                !isActive
                  ? 'border-muted-foreground/40 bg-muted/60 text-muted-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/20'
              )}
            >
              <XCircle className="h-3.5 w-3.5" />
              {t('pages.nutritionMealTypes.inactive')}
            </button>
          </div>
        </div>
        <div className="space-y-sm">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {t('pages.nutritionMealTypes.mealTypeOrder')}
          </span>
          <Input
            type="number"
            min={0}
            {...register('order', { valueAsNumber: true })}
            className="w-20 text-center"
          />
        </div>
      </div>

      <div className="gap-sm border-border pt-md flex justify-end border-t">
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
