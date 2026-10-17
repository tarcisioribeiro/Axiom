/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  CheckCircle2,
  Clock,
  Moon,
  Star,
  Sun,
  Sunrise,
  UtensilsCrossed,
  XCircle,
  Save,
  X,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
import { useToast } from '@/hooks/use-toast';
import { notifyFormErrors } from '@/lib/form-errors';
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
      icon: <Sunrise className="text-warning h-5 w-5" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeEarlyMorning',
      color: 'text-warning',
    };
  if (h >= 9 && h < 12)
    return {
      icon: <Sun className="text-warning h-5 w-5" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeMorning',
      color: 'text-warning',
    };
  if (h >= 12 && h < 15)
    return {
      icon: <Sun className="text-category-nutrition h-5 w-5" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeLunch',
      color: 'text-category-nutrition',
    };
  if (h >= 15 && h < 19)
    return {
      icon: <Sun className="text-category-nutrition h-5 w-5" />,
      labelKey: 'pages.nutritionMealTypes.suggestedTimeAfternoon',
      color: 'text-category-nutrition',
    };
  return {
    icon: <Moon className="text-info h-5 w-5" />,
    labelKey: 'pages.nutritionMealTypes.suggestedTimeNight',
    color: 'text-info',
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

  const nowTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MealTypeFormData>({
    defaultValues: {
      name: mealType?.name ?? '',
      suggested_time: mealType ? (mealType.suggested_time ?? '') : nowTime,
      order: mealType?.order ?? 0,
      is_active: mealType?.is_active ?? true,
      default_menu_option: mealType?.default_menu_option ?? null,
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
        default_menu_option: mealType.default_menu_option ?? null,
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
    <form
      noValidate
      onSubmit={handleSubmit(handleFormSubmit, notifyFormErrors)}
      className="space-y-lg"
    >
      {/* Nome */}
      <FormSection
        title={t('pages.nutritionMealTypes.mealTypeName')}
        icon={UtensilsCrossed}
      >
        <Input
          placeholder={t('pages.nutritionMealTypes.mealTypeNamePlaceholder')}
          aria-invalid={!!errors.name}
          {...register('name', {
            required: t('common.fieldRequired', {
              field: t('pages.nutritionMealTypes.mealTypeName'),
            }),
          })}
        />
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

      {/* Opção padrão — só na edição, quando a refeição já tem opções */}
      {mealType && mealType.options.length > 0 && (
        <FormSection title={t('pages.nutritionMealTypes.defaultOption')} icon={Star}>
          <Select
            value={watch('default_menu_option')?.toString() ?? 'auto'}
            onValueChange={(value) =>
              setValue('default_menu_option', value === 'auto' ? null : parseInt(value))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                {t('pages.nutritionMealTypes.defaultOptionAuto')}
              </SelectItem>
              {mealType.options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id.toString()}>
                  {opt.name}
                  {opt.calories ? ` · ${Math.round(opt.calories)} kcal` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSection>
      )}

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
                'gap-xs px-sm py-xs flex items-center justify-center rounded-lg border-2 text-xs font-medium transition',
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
                'gap-xs px-sm py-xs flex items-center justify-center rounded-lg border-2 text-xs font-medium transition',
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
          <Controller
            control={control}
            name="order"
            render={({ field }) => (
              <NumberStepper
                min={0}
                aria-label={t('pages.nutritionMealTypes.mealTypeOrder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <div className="dialog-footer gap-sm border-border pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Save className="h-4 w-4" />}

          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
