/* eslint-disable react-hooks/incompatible-library */
/* eslint-disable max-lines */
import {
  BoltIcon as Activity,
  CalendarIcon as Calendar,
  ClockIcon as Clock,
  FireIcon as Dumbbell,
  FireIcon as Flame,
  Square3Stack3DIcon as Layers,
  ArrowPathIcon as Loader2,
  ViewfinderCircleIcon as Target,
  BoltIcon as Zap,
} from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';
import type { WorkoutDay } from '@/types/workout';

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

interface WorkoutDayFormValues {
  name: string;
  muscle_groups: string;
  day_of_week: number | '';
  order: number;
  default_start_time: string;
  default_duration_minutes: number | '';
}

interface WorkoutDayFormProps {
  day?: WorkoutDay;
  planId: number;
  ownerId: number;
  onSubmit: (
    data: Omit<
      WorkoutDayFormValues,
      'day_of_week' | 'default_start_time' | 'default_duration_minutes'
    > & {
      day_of_week: number | null;
      default_start_time: string | null;
      default_duration_minutes: number | null;
      plan: number;
      owner: number;
    }
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const MUSCLE_CHIP_KEYS = [
  { key: 'chest', icon: Dumbbell },
  { key: 'back', icon: Dumbbell },
  { key: 'shoulders', icon: Dumbbell },
  { key: 'biceps', icon: Zap },
  { key: 'triceps', icon: Zap },
  { key: 'abs', icon: Target },
  { key: 'quads', icon: Flame },
  { key: 'hamstrings', icon: Flame },
  { key: 'glutes', icon: Flame },
  { key: 'calves', icon: Flame },
  { key: 'forearms', icon: Zap },
  { key: 'lowerBack', icon: Flame },
  { key: 'traps', icon: Dumbbell },
  { key: 'adductors', icon: Flame },
  { key: 'abductors', icon: Flame },
  { key: 'core', icon: Target },
  { key: 'push', icon: Dumbbell },
  { key: 'pull', icon: Dumbbell },
  { key: 'cardio', icon: Activity },
  { key: 'hiit', icon: Activity },
  { key: 'running', icon: Activity },
  { key: 'cycling', icon: Activity },
  { key: 'swimming', icon: Activity },
  { key: 'fullBody', icon: Layers },
];

function toHHMM(time?: string | null): string {
  return time ? time.slice(0, 5) : '';
}

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
      day_of_week: day?.day_of_week ?? '',
      order: day?.order ?? 0,
      default_start_time: toHHMM(day?.default_start_time),
      default_duration_minutes: day?.default_duration_minutes ?? '',
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
        day_of_week: day.day_of_week ?? '',
        order: day.order,
        default_start_time: toHHMM(day.default_start_time),
        default_duration_minutes: day.default_duration_minutes ?? '',
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
    await onSubmit({
      ...data,
      day_of_week: data.day_of_week === '' ? null : data.day_of_week,
      default_start_time: data.default_start_time || null,
      default_duration_minutes:
        data.default_duration_minutes === '' ? null : data.default_duration_minutes,
      plan: planId,
      owner: ownerId,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header visual */}
      <div className="gap-md bg-category-exercise/10 px-md py-sm ring-category-exercise/20 flex items-center rounded-lg ring-1">
        <div className="bg-category-exercise/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Layers className="text-category-exercise h-5 w-5" />
        </div>
        <div>
          <p className="text-category-exercise text-sm font-semibold">
            {day
              ? t('pages.workoutPlans.editDayTitle')
              : t('pages.workoutPlans.newDayTitle')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t('pages.workoutPlans.newDayDesc')}
          </p>
        </div>
      </div>

      {/* Nome e ordem */}
      <FormSection title={t('pages.workoutPlans.dayName')} icon={Dumbbell}>
        <div className="gap-sm grid grid-cols-[1fr_100px]">
          <div>
            <Input
              placeholder={t('pages.workoutPlans.dayNamePlaceholder')}
              {...register('name', { required: true })}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="mt-xs text-destructive text-xs">{t('common.required')}</p>
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

      {/* Dia da semana */}
      <FormSection title={t('pages.workoutPlans.dayOfWeek')} icon={Calendar}>
        <div className="gap-xs flex flex-wrap">
          {WEEKDAYS.map((wd, i) => {
            const selected = watch('day_of_week') === i;
            return (
              <button
                key={wd}
                type="button"
                onClick={() => setValue('day_of_week', selected ? '' : i)}
                className={cn(
                  'px-sm rounded-full border py-1 text-xs font-medium transition',
                  selected
                    ? 'border-category-exercise bg-category-exercise/15 text-category-exercise'
                    : 'border-border bg-background text-muted-foreground hover:border-category-exercise/40 hover:bg-category-exercise/5 hover:text-category-exercise'
                )}
              >
                {t(`pages.workoutPlans.weekdays.${wd}`)}
              </button>
            );
          })}
        </div>
        <p className="mt-xs text-muted-foreground text-xs">
          {t('pages.workoutPlans.dayOfWeekHint')}
        </p>
      </FormSection>

      {/* Grupos musculares */}
      <FormSection title={t('pages.workoutPlans.muscleGroups')} icon={Flame}>
        <div className="space-y-sm">
          <div className="gap-xs flex flex-wrap">
            {MUSCLE_CHIP_KEYS.map(({ key }) => {
              const label = t(`pages.workoutPlans.muscleChips.${key}`);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleChip(label)}
                  className={cn(
                    'px-sm rounded-full border py-1 text-xs font-medium transition',
                    selectedChips.includes(label)
                      ? 'border-category-exercise bg-category-exercise/15 text-category-exercise'
                      : 'border-border bg-background text-muted-foreground hover:border-category-exercise/40 hover:bg-category-exercise/5 hover:text-category-exercise'
                  )}
                >
                  {label}
                </button>
              );
            })}
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
          <p className="text-muted-foreground text-xs">
            {t('pages.workoutPlans.muscleGroupsHint')}
          </p>
        </div>
      </FormSection>

      {/* Horário padrão */}
      <FormSection title={t('pages.workoutPlans.defaultScheduleSection')} icon={Clock}>
        <div className="gap-sm grid grid-cols-2">
          <div className="space-y-sm">
            <Label>{t('pages.workoutPlans.defaultStartTime')}</Label>
            <TimePicker
              value={watch('default_start_time') || undefined}
              onChange={(v) => setValue('default_start_time', v ?? '')}
            />
          </div>
          <div className="space-y-sm">
            <Label>{t('pages.workoutPlans.defaultDurationMinutes')}</Label>
            <Input
              type="number"
              min={0}
              placeholder="45"
              {...register('default_duration_minutes', {
                setValueAs: (v) => (v === '' ? '' : Number(v)),
              })}
            />
          </div>
        </div>
        <p className="mt-xs text-muted-foreground text-xs">
          {t('pages.workoutPlans.defaultScheduleHint')}
        </p>
      </FormSection>

      <div className="gap-sm border-border pt-md flex justify-end border-t">
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
