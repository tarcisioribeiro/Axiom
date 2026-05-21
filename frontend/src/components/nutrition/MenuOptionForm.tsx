import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { useToast } from '@/hooks/use-toast';
import type { Food, MenuOption } from '@/types/nutrition';

const UNIT_KEYS = [
  'g',
  'kg',
  'mg',
  'lb',
  'oz',
  'ml',
  'l',
  'dl',
  'cl',
  'teaspoon',
  'tablespoon',
  'dessert_spoon',
  'cup',
  'glass',
  'slice',
  'portion',
  'pinch',
  'drizzle',
  'to_taste',
  'at_will',
  'unit',
  'piece',
  'segment',
  'clove',
  'leaf',
  'sprig',
  'handful',
  'scoop',
  'dose',
  'tablet',
  'capsule',
  'mcg',
  'ui',
] as const;

interface IngredientValues {
  id?: number;
  food: string;
  quantity: string;
  unit: string;
  is_optional: boolean;
  notes: string;
  order: number;
}

interface MenuOptionFormValues {
  name: string;
  order: number;
  ingredients: IngredientValues[];
}

interface MenuOptionFormProps {
  option?: MenuOption;
  mealTypeId: number;
  ownerId: number;
  foods: Food[];
  onSubmit: (
    optionData: { meal_type: number; name: string; order: number; owner: number },
    ingredients: IngredientValues[]
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MenuOptionForm({
  option,
  mealTypeId,
  ownerId,
  foods,
  onSubmit,
  onCancel,
  isLoading = false,
}: MenuOptionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MenuOptionFormValues>({
    defaultValues: {
      name: option?.name ?? '',
      order: option?.order ?? 0,
      ingredients:
        option?.ingredients?.map((i) => ({
          id: i.id,
          food: String(i.food),
          quantity: i.quantity ?? '',
          unit: i.unit,
          is_optional: i.is_optional,
          notes: i.notes ?? '',
          order: i.order,
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' });

  useEffect(() => {
    if (option) {
      reset({
        name: option.name,
        order: option.order,
        ingredients:
          option.ingredients?.map((i) => ({
            id: i.id,
            food: String(i.food),
            quantity: i.quantity ?? '',
            unit: i.unit,
            is_optional: i.is_optional,
            notes: i.notes ?? '',
            order: i.order,
          })) ?? [],
      });
    }
  }, [option, reset]);

  const handleFormSubmit = async (data: MenuOptionFormValues) => {
    try {
      const { ingredients, ...optionData } = data;
      await onSubmit(
        { ...optionData, meal_type: mealTypeId, owner: ownerId },
        ingredients
      );
    } catch {
      toast({ title: t('pages.nutritionMealTypes.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-sm">
          <Label htmlFor="opt-name">{t('pages.nutritionMealTypes.optionName')}</Label>
          <Input
            id="opt-name"
            placeholder={t('pages.nutritionMealTypes.optionNamePlaceholder')}
            {...register('name', { required: true })}
            className={errors.name ? 'border-destructive' : ''}
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="opt-order">{t('pages.nutritionMealTypes.optionOrder')}</Label>
          <Input
            id="opt-order"
            type="number"
            min={0}
            {...register('order', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <Label>{t('pages.nutritionMealTypes.ingredientsSection')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                food: '',
                quantity: '',
                unit: 'g',
                is_optional: false,
                notes: '',
                order: fields.length,
              })
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('pages.nutritionMealTypes.addIngredient')}
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="py-sm text-center text-sm text-muted-foreground">
            {t('pages.nutritionMealTypes.noIngredients')}
          </p>
        )}

        <div className="max-h-72 space-y-sm overflow-y-auto pr-1">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="space-y-sm rounded-md border border-border bg-card p-sm"
            >
              <div className="grid grid-cols-[1fr_auto] items-start gap-xs">
                <div className="space-y-sm">
                  <div className="grid grid-cols-2 gap-xs">
                    <div className="space-y-xs">
                      <Label className="text-xs">
                        {t('pages.nutritionMealTypes.food')}
                      </Label>
                      <Select
                        value={watch(`ingredients.${idx}.food`)}
                        onValueChange={(v) => setValue(`ingredients.${idx}.food`, v)}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('pages.nutritionMealTypes.foodPlaceholder')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {foods.map((f) => (
                            <SelectItem key={f.id} value={String(f.id)}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-xs">
                      <div className="space-y-xs">
                        <Label className="text-xs">
                          {t('pages.nutritionMealTypes.quantity')}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...register(`ingredients.${idx}.quantity`)}
                        />
                      </div>
                      <div className="space-y-xs">
                        <Label className="text-xs">
                          {t('pages.nutritionMealTypes.unit')}
                        </Label>
                        <Select
                          value={watch(`ingredients.${idx}.unit`)}
                          onValueChange={(v) => setValue(`ingredients.${idx}.unit`, v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_KEYS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {t(`units.${u}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-xs">
                    <div className="flex items-center gap-xs">
                      <Checkbox
                        id={`opt-${idx}`}
                        checked={watch(`ingredients.${idx}.is_optional`)}
                        onCheckedChange={(v) =>
                          setValue(`ingredients.${idx}.is_optional`, Boolean(v))
                        }
                      />
                      <Label htmlFor={`opt-${idx}`} className="text-xs">
                        {t('pages.nutritionMealTypes.optional')}
                      </Label>
                    </div>
                    <Input
                      placeholder={t(
                        'pages.nutritionMealTypes.ingredientNotesPlaceholder'
                      )}
                      {...register(`ingredients.${idx}.notes`)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => remove(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
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
