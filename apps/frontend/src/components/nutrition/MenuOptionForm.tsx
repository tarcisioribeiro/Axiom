/* eslint-disable max-lines, react-hooks/incompatible-library */
import type { TFunction } from 'i18next';
import {
  GripVertical,
  ListChecks,
  Loader2,
  Plus,
  Salad,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormSection } from '@/components/ui/form-section';
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
import { cn } from '@/lib/utils';
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
  alternative_group: string;
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

interface VisualGroup {
  groupId: string | null;
  indices: number[];
}

function buildVisualGroups(ingredients: IngredientValues[]): VisualGroup[] {
  const groups: VisualGroup[] = [];
  const groupMap = new Map<string, number>(); // groupId → index in groups

  ingredients.forEach((ing, idx) => {
    const ag = ing.alternative_group?.trim();
    if (!ag) {
      groups.push({ groupId: null, indices: [idx] });
    } else {
      const existing = groupMap.get(ag);
      if (existing !== undefined) {
        groups[existing].indices.push(idx);
      } else {
        groupMap.set(ag, groups.length);
        groups.push({ groupId: ag, indices: [idx] });
      }
    }
  });

  return groups;
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
          alternative_group:
            i.alternative_group != null ? String(i.alternative_group) : '',
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
            alternative_group:
              i.alternative_group != null ? String(i.alternative_group) : '',
          })) ?? [],
      });
    }
  }, [option, reset]);

  const nameValue = watch('name');
  const allIngredients = watch('ingredients');
  const visualGroups = buildVisualGroups(allIngredients);

  const nextGroupId = (): string => {
    const max = Math.max(
      0,
      ...allIngredients
        .filter((i) => i.alternative_group)
        .map((i) => parseInt(i.alternative_group) || 0)
    );
    return String(max + 1);
  };

  const addStandalone = () =>
    append({
      food: '',
      quantity: '',
      unit: 'g',
      is_optional: false,
      notes: '',
      order: fields.length,
      alternative_group: '',
    });

  const addNewGroup = () => {
    const gid = nextGroupId();
    append({
      food: '',
      quantity: '',
      unit: 'g',
      is_optional: false,
      notes: '',
      order: fields.length,
      alternative_group: gid,
    });
  };

  const addVariantToGroup = (groupId: string) =>
    append({
      food: '',
      quantity: '',
      unit: 'g',
      is_optional: false,
      notes: '',
      order: fields.length,
      alternative_group: groupId,
    });

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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header */}
      <div className="flex items-center gap-md rounded-lg bg-category-nutrition/10 px-md py-sm ring-1 ring-category-nutrition/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-nutrition/20">
          <ListChecks className="h-5 w-5 text-category-nutrition" />
        </div>
        <div>
          <p className="text-sm font-semibold text-category-nutrition">
            {option
              ? t('pages.nutritionMealTypes.editOptionTitle')
              : t('pages.nutritionMealTypes.newOptionTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {nameValue || t('pages.nutritionMealTypes.newOptionDesc')}
          </p>
        </div>
      </div>

      {/* Nome e ordem */}
      <FormSection title={t('pages.nutritionMealTypes.optionName')} icon={ListChecks}>
        <div className="grid grid-cols-[1fr_80px] gap-sm">
          <div>
            <Input
              placeholder={t('pages.nutritionMealTypes.optionNamePlaceholder')}
              {...register('name', { required: true })}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="mt-xs text-xs text-destructive">{t('common.required')}</p>
            )}
          </div>
          <Input
            type="number"
            min={0}
            aria-label={t('pages.nutritionMealTypes.optionOrder')}
            {...register('order', { valueAsNumber: true })}
            className="text-center"
          />
        </div>
      </FormSection>

      {/* Ingredientes agrupados */}
      <FormSection
        title={t('pages.nutritionMealTypes.ingredientsSection')}
        icon={Salad}
      >
        <div className="space-y-sm">
          {fields.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-category-nutrition/20 py-md text-center">
              <Salad className="mx-auto mb-xs h-8 w-8 text-category-nutrition/30" />
              <p className="text-sm text-muted-foreground">
                {t('pages.nutritionMealTypes.noIngredients')}
              </p>
            </div>
          ) : (
            <div className="max-h-96 space-y-sm overflow-y-auto pr-1">
              {visualGroups.map((group) =>
                group.groupId === null ? (
                  // ── Ingrediente simples ──────────────────────────────────────
                  group.indices.map((idx) => (
                    <IngredientRow
                      key={fields[idx]?.id}
                      idx={idx}
                      label={t('pages.nutritionMealTypes.ingredientsSection')}
                      foods={foods}
                      register={register}
                      watch={watch}
                      setValue={setValue}
                      onRemove={() => remove(idx)}
                      t={t}
                    />
                  ))
                ) : (
                  // ── Grupo de alternativas ────────────────────────────────────
                  <div
                    key={`group-${group.groupId}`}
                    className="rounded-lg border border-category-nutrition/30 bg-category-nutrition/5"
                  >
                    <div className="flex items-center justify-between border-b border-category-nutrition/20 px-sm py-xs">
                      <span className="text-xs font-semibold uppercase tracking-wider text-category-nutrition">
                        {t(
                          'pages.nutritionMealTypes.altGroupLabel',
                          'Grupo de alternativas'
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => addVariantToGroup(group.groupId!)}
                        className="flex items-center gap-xs rounded px-xs py-0.5 text-xs font-medium text-category-nutrition hover:bg-category-nutrition/10"
                      >
                        <Plus className="h-3 w-3" />
                        {t('pages.nutritionMealTypes.addVariant', '+ Variante')}
                      </button>
                    </div>
                    <div className="space-y-0 p-sm">
                      {group.indices.map((idx, position) => (
                        <div key={fields[idx]?.id}>
                          <IngredientRow
                            idx={idx}
                            label={`${t('pages.nutritionMealTypes.variantLabel', 'Opção')} ${position + 1}`}
                            foods={foods}
                            register={register}
                            watch={watch}
                            setValue={setValue}
                            onRemove={() => remove(idx)}
                            t={t}
                          />
                          {position < group.indices.length - 1 && (
                            <p className="my-xs text-center text-[10px] font-bold uppercase tracking-widest text-category-nutrition/60">
                              {t('pages.nutritionMealTypes.ingredientOr')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Botões de adição */}
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={addStandalone}
              className="flex flex-1 items-center justify-center gap-sm rounded-lg border-2 border-dashed border-category-nutrition/30 py-sm text-sm font-medium text-category-nutrition transition-all hover:border-category-nutrition/60 hover:bg-category-nutrition/5"
            >
              <Plus className="h-4 w-4" />
              {t('pages.nutritionMealTypes.addIngredient')}
            </button>
            <button
              type="button"
              onClick={addNewGroup}
              className="flex flex-1 items-center justify-center gap-sm rounded-lg border-2 border-dashed border-category-nutrition/20 py-sm text-sm font-medium text-category-nutrition/70 transition-all hover:border-category-nutrition/40 hover:bg-category-nutrition/5"
            >
              <Plus className="h-4 w-4" />
              {t('pages.nutritionMealTypes.addAltGroup', '+ Alternativas')}
            </button>
          </div>
        </div>
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

// ── Ingredient row (shared by standalone and group) ─────────────────────────

interface IngredientRowProps {
  idx: number;
  label: string;
  foods: Food[];
  register: ReturnType<typeof useForm<MenuOptionFormValues>>['register'];
  watch: ReturnType<typeof useForm<MenuOptionFormValues>>['watch'];
  setValue: ReturnType<typeof useForm<MenuOptionFormValues>>['setValue'];
  onRemove: () => void;
  t: TFunction;
}

function IngredientRow({
  idx,
  label,
  foods,
  register,
  watch,
  setValue,
  onRemove,
  t,
}: IngredientRowProps) {
  return (
    <div className="group relative rounded-lg border border-border bg-card p-sm transition-all hover:border-category-nutrition/30">
      {/* Row header */}
      <div className="mb-sm flex items-center gap-xs">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Food + Quantity + Unit */}
      <div className="grid grid-cols-[1fr_80px_100px] gap-xs">
        <div className="space-y-xs">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('pages.nutritionMealTypes.food')}
          </Label>
          <Select
            value={watch(`ingredients.${idx}.food`)}
            onValueChange={(v) => setValue(`ingredients.${idx}.food`, v)}
          >
            <SelectTrigger className="h-8 text-sm">
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
        <div className="space-y-xs">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('pages.nutritionMealTypes.quantity')}
          </Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0"
            {...register(`ingredients.${idx}.quantity`)}
            className="h-8 text-center text-sm"
          />
        </div>
        <div className="space-y-xs">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('pages.nutritionMealTypes.unit')}
          </Label>
          <Select
            value={watch(`ingredients.${idx}.unit`)}
            onValueChange={(v) => setValue(`ingredients.${idx}.unit`, v)}
          >
            <SelectTrigger className="h-8 text-sm">
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

      {/* Optional + Notes */}
      <div className="mt-xs flex items-center gap-sm">
        <label className="flex cursor-pointer items-center gap-xs">
          <Checkbox
            checked={watch(`ingredients.${idx}.is_optional`)}
            onCheckedChange={(v) =>
              setValue(`ingredients.${idx}.is_optional`, Boolean(v))
            }
          />
          <span className="text-xs text-muted-foreground">
            {t('pages.nutritionMealTypes.optional')}
          </span>
        </label>
        <div className="relative flex-1">
          <StickyNote className="absolute left-xs top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder={t('pages.nutritionMealTypes.ingredientNotesPlaceholder')}
            {...register(`ingredients.${idx}.notes`)}
            className="h-7 pl-6 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
