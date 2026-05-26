/* eslint-disable react-hooks/incompatible-library */
import { FileText, Loader2, Salad } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Food, FoodFormData } from '@/types/nutrition';

interface FoodFormProps {
  food?: Food;
  ownerId: number;
  onSubmit: (data: FoodFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FoodForm({
  food,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: FoodFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FoodFormData>({
    defaultValues: {
      name: food?.name ?? '',
      description: food?.description ?? '',
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (food)
      reset({ name: food.name, description: food.description ?? '', owner: ownerId });
  }, [food, ownerId, reset]);

  const nameValue = watch('name');
  const initial = nameValue?.charAt(0)?.toUpperCase() || '?';

  const handleFormSubmit = async (data: FoodFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionFoods.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header visual com avatar */}
      <div className="flex items-center gap-md rounded-lg bg-category-nutrition/10 px-md py-sm ring-1 ring-category-nutrition/20">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-category-nutrition/25">
          {nameValue ? (
            <span className="text-xl font-bold text-category-nutrition">{initial}</span>
          ) : (
            <Salad className="h-6 w-6 text-category-nutrition" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-category-nutrition">
            {food
              ? t('pages.nutritionFoods.editFoodTitle')
              : t('pages.nutritionFoods.newFoodTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {nameValue || t('pages.nutritionFoods.newFoodDesc')}
          </p>
        </div>
      </div>

      {/* Nome */}
      <FormSection title={t('pages.nutritionFoods.foodName')} icon={Salad}>
        <Input
          placeholder={t('pages.nutritionFoods.foodNamePlaceholder')}
          {...register('name', { required: true })}
          className={cn(errors.name && 'border-destructive')}
        />
        {errors.name && (
          <p className="mt-xs text-xs text-destructive">{t('common.required')}</p>
        )}
      </FormSection>

      {/* Descrição */}
      <FormSection title={t('pages.nutritionFoods.foodDescription')} icon={FileText}>
        <Textarea
          placeholder={t('pages.nutritionFoods.foodDescriptionPlaceholder')}
          rows={2}
          {...register('description')}
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
