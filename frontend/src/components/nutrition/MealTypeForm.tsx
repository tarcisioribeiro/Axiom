import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { MealType, MealTypeFormData } from '@/types/nutrition';

interface MealTypeFormProps {
  mealType?: MealType;
  ownerId: number;
  onSubmit: (data: MealTypeFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
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

  const handleFormSubmit = async (data: MealTypeFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionMealTypes.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="meal-name">{t('pages.nutritionMealTypes.mealTypeName')}</Label>
        <Input
          id="meal-name"
          placeholder={t('pages.nutritionMealTypes.mealTypeNamePlaceholder')}
          {...register('name', { required: true })}
          className={errors.name ? 'border-destructive' : ''}
        />
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-sm">
          <Label htmlFor="meal-time">
            {t('pages.nutritionMealTypes.suggestedTime')}
          </Label>
          <Input id="meal-time" type="time" {...register('suggested_time')} />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="meal-order">
            {t('pages.nutritionMealTypes.mealTypeOrder')}
          </Label>
          <Input
            id="meal-order"
            type="number"
            min={0}
            {...register('order', { valueAsNumber: true })}
          />
        </div>
      </div>
      <div className="flex items-center gap-sm">
        <Switch
          id="meal-active"
          checked={isActive}
          onCheckedChange={(val: boolean) => setValue('is_active', val)}
        />
        <Label htmlFor="meal-active">
          {t('pages.nutritionMealTypes.mealTypeActive')}
        </Label>
      </div>
      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
