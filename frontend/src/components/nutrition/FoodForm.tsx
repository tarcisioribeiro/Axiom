import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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

  const handleFormSubmit = async (data: FoodFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.nutritionFoods.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="food-name">{t('pages.nutritionFoods.foodName')}</Label>
        <Input
          id="food-name"
          placeholder={t('pages.nutritionFoods.foodNamePlaceholder')}
          {...register('name', { required: true })}
          className={errors.name ? 'border-destructive' : ''}
        />
      </div>
      <div className="space-y-sm">
        <Label htmlFor="food-desc">{t('pages.nutritionFoods.foodDescription')}</Label>
        <Textarea
          id="food-desc"
          placeholder={t('pages.nutritionFoods.foodDescriptionPlaceholder')}
          rows={2}
          {...register('description')}
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
