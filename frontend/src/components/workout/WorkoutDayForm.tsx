/* eslint-disable react-hooks/incompatible-library */
import { Activity, Dumbbell, Flame, Layers, Loader2, Target, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WorkoutDay } from '@/types/workout';

interface WorkoutDayFormValues {
  name: string;
  muscle_groups: string;
  order: number;
}

interface WorkoutDayFormProps {
  day?: WorkoutDay;
  planId: number;
  ownerId: number;
  onSubmit: (
    data: WorkoutDayFormValues & { plan: number; owner: number }
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const MUSCLE_CHIPS = [
  { label: 'Peito', icon: Dumbbell },
  { label: 'Costas', icon: Dumbbell },
  { label: 'Ombros', icon: Dumbbell },
  { label: 'Bíceps', icon: Zap },
  { label: 'Tríceps', icon: Zap },
  { label: 'Abdômen', icon: Target },
  { label: 'Quadríceps', icon: Flame },
  { label: 'Posteriores', icon: Flame },
  { label: 'Glúteos', icon: Flame },
  { label: 'Panturrilha', icon: Flame },
  { label: 'Cardio', icon: Activity },
  { label: 'Full Body', icon: Layers },
];

export function WorkoutDayForm({
  day,
  planId,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: WorkoutDayFormProps) {
  const { t } = useTranslation();
  const [selectedChips, setSelectedChips] = useState<string[]>(() => {
    if (!day?.muscle_groups) return [];
    return day.muscle_groups
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WorkoutDayFormValues>({
    defaultValues: {
      name: day?.name ?? '',
      muscle_groups: day?.muscle_groups ?? '',
      order: day?.order ?? 0,
    },
  });

  useEffect(() => {
    if (day) {
      const chips = day.muscle_groups
        ? day.muscle_groups
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      setSelectedChips(chips);
      reset({
        name: day.name,
        muscle_groups: day.muscle_groups ?? '',
        order: day.order,
      });
    }
  }, [day, reset]);

  const muscleGroupsValue = watch('muscle_groups');

  const toggleChip = (label: string) => {
    setSelectedChips((prev) => {
      const next = prev.includes(label)
        ? prev.filter((c) => c !== label)
        : [...prev, label];
      setValue('muscle_groups', next.join(', '));
      return next;
    });
  };

  const handleFormSubmit = async (data: WorkoutDayFormValues) => {
    await onSubmit({ ...data, plan: planId, owner: ownerId });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header visual */}
      <div className="flex items-center gap-md rounded-lg bg-category-exercise/10 px-md py-sm ring-1 ring-category-exercise/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-exercise/20">
          <Layers className="h-5 w-5 text-category-exercise" />
        </div>
        <div>
          <p className="text-sm font-semibold text-category-exercise">
            {day
              ? t('pages.workoutPlans.editDayTitle')
              : t('pages.workoutPlans.newDayTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('pages.workoutPlans.newDayDesc')}
          </p>
        </div>
      </div>

      {/* Nome e ordem */}
      <FormSection title={t('pages.workoutPlans.dayName')} icon={Dumbbell}>
        <div className="grid grid-cols-[1fr_100px] gap-sm">
          <div>
            <Input
              placeholder={t('pages.workoutPlans.dayNamePlaceholder')}
              {...register('name', { required: true })}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="mt-xs text-xs text-destructive">{t('common.required')}</p>
            )}
          </div>
          <div>
            <Input
              type="number"
              min={0}
              placeholder="0"
              aria-label={t('pages.workoutPlans.order')}
              {...register('order', { valueAsNumber: true })}
              className="text-center"
            />
          </div>
        </div>
      </FormSection>

      {/* Grupos musculares */}
      <FormSection title={t('pages.workoutPlans.muscleGroups')} icon={Flame}>
        <div className="space-y-sm">
          <div className="flex flex-wrap gap-xs">
            {MUSCLE_CHIPS.map(({ label }) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleChip(label)}
                className={cn(
                  'rounded-full border px-sm py-1 text-xs font-medium transition-all',
                  selectedChips.includes(label)
                    ? 'border-category-exercise bg-category-exercise/15 text-category-exercise'
                    : 'border-border bg-background text-muted-foreground hover:border-category-exercise/40 hover:bg-category-exercise/5 hover:text-category-exercise'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            placeholder={t('pages.workoutPlans.muscleGroupsPlaceholder')}
            value={muscleGroupsValue}
            onChange={(e) => {
              setValue('muscle_groups', e.target.value);
              setSelectedChips(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              );
            }}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Selecione os grupos acima ou digite manualmente.
          </p>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t border-border pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-category-exercise hover:bg-category-exercise/90"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
