import { FileText, Flame, Loader2, Ruler, Salad, Save, Scale, X } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/ui/decimal-input';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Food, FoodFormData } from '@/types/nutrition';

const SERVING_UNIT_VALUES = [
  'g',
  'ml',
  'unit',
  'scoop',
  'tablespoon',
  'teaspoon',
  'cup',
  'slice',
  'portion',
] as const;

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
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FoodFormData>({
    defaultValues: {
      name: food?.name ?? '',
      description: food?.description ?? '',
      calories_per_serving: food?.calories_per_serving ?? '',
      serving_size: food?.serving_size ?? '',
      serving_unit: food?.serving_unit ?? 'g',
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (food)
      reset({
        name: food.name,
        description: food.description ?? '',
        calories_per_serving: food.calories_per_serving ?? '',
        serving_size: food.serving_size ?? '',
        serving_unit: food.serving_unit ?? 'g',
        owner: ownerId,
      });
  }, [food, ownerId, reset]);

  const handleFormSubmit = async (data: FoodFormData) => {
    try {
      await onSubmit({
        ...data,
        calories_per_serving: data.calories_per_serving || null,
        serving_size: data.serving_size || null,
        serving_unit: data.serving_unit || null,
      });
    } catch {
      toast({ title: t('pages.nutritionFoods.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Nome */}
      <FormSection title={t('pages.nutritionFoods.foodName')} icon={Salad}>
        <Input
          placeholder={t('pages.nutritionFoods.foodNamePlaceholder')}
          {...register('name', { required: true })}
          className={cn(errors.name && 'border-destructive')}
        />
        {errors.name && (
          <p className="mt-xs text-destructive text-xs">{t('common.required')}</p>
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

      {/* Informação nutricional */}
      <FormSection
        title={t('pages.nutritionFoods.caloriesSection', 'Informação Calórica')}
        icon={Flame}
      >
        <div className="space-y-sm">
          <div className="gap-sm grid grid-cols-2">
            <div className="space-y-xs">
              <label className="gap-xs text-foreground flex items-center text-xs font-medium">
                <Scale className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.nutritionFoods.servingSize', 'Tamanho da Porção')}
              </label>
              <Controller
                control={control}
                name="serving_size"
                render={({ field }) => (
                  <DecimalInput
                    decimals={1}
                    placeholder="100"
                    aria-label={t(
                      'pages.nutritionFoods.servingSize',
                      'Tamanho da Porção'
                    )}
                    value={field.value}
                    onChange={(v) => field.onChange(v === null ? '' : String(v))}
                  />
                )}
              />
            </div>
            <div className="space-y-xs">
              <label className="gap-xs text-foreground flex items-center text-xs font-medium">
                <Ruler className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.nutritionFoods.servingUnit', 'Unidade')}
              </label>
              <Controller
                name="serving_unit"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'g'} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVING_UNIT_VALUES.map((val) => (
                        <SelectItem key={val} value={val}>
                          {t(`units.${val}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-xs">
            <label className="gap-xs text-foreground flex items-center text-xs font-medium">
              <Flame className="text-muted-foreground h-3.5 w-3.5" />
              {t(
                'pages.nutritionFoods.caloriesPerServing',
                'Calorias (kcal) por Porção'
              )}
            </label>
            <Controller
              control={control}
              name="calories_per_serving"
              render={({ field }) => (
                <DecimalInput
                  decimals={1}
                  unit="kcal"
                  placeholder="Ex.: 70"
                  aria-label={t(
                    'pages.nutritionFoods.caloriesPerServing',
                    'Calorias (kcal) por Porção'
                  )}
                  value={field.value}
                  onChange={(v) => field.onChange(v === null ? '' : String(v))}
                />
              )}
            />
          </div>
        </div>
      </FormSection>

      <div className="dialog-footer gap-sm border-border pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
