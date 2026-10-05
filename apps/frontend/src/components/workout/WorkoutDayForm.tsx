/* eslint-disable react-hooks/incompatible-library */
/* eslint-disable max-lines */
import {
  Activity,
  Calendar,
  Clock,
  Dumbbell,
  Flame,
  Layers,
  Loader2,
  Target,
  Zap,
  Save,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
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
  days_of_week: number[];
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
      'default_start_time' | 'default_duration_minutes'
    > & {
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
    control,
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
      days_of_week: day?.days_of_week ?? [],
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
        days_of_week: day.days_of_week ?? [],
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
      default_start_time: data.default_start_time || null,
      default_duration_minutes:
        data.default_duration_minutes === '' ? null : data.default_duration_minutes,
      plan: planId,
      owner: ownerId,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="gap-md flex min-h-0 flex-1 flex-col"
    >
      {/* Só os campos rolam; título (DialogHeader) e rodapé ficam fixos */}
      {/* px-xs: folga para o anel de foco dos campos não ser cortado pela rolagem */}
      <div className="space-y-lg px-xs min-h-0 flex-1 overflow-y-auto">
        {/* Nome e ordem */}
        <FormSection title={t('pages.workoutPlans.dayName')} icon={Dumbbell}>
          <div className="gap-sm grid grid-cols-[1fr_auto]">
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
            <NumberStepper
              value={watch('order')}
              onChange={(v) => setValue('order', v ?? 0)}
              aria-label={t('pages.workoutPlans.order')}
            />
          </div>
        </FormSection>

        {/* Dia da semana */}
        <FormSection title={t('pages.workoutPlans.dayOfWeek')} icon={Calendar}>
          <div className="gap-xs flex flex-wrap justify-center">
            {WEEKDAYS.map((wd, i) => {
              const days = watch('days_of_week');
              const selected = days.includes(i);
              return (
                <button
                  key={wd}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setValue(
                      'days_of_week',
                      selected ? days.filter((d) => d !== i) : [...days, i].sort()
                    )
                  }
                  className={cn(
                    'px-sm rounded-full border py-1 text-xs font-medium transition',
                    selected
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
                  )}
                >
                  {t(`pages.workoutPlans.weekdays.${wd}`)}
                </button>
              );
            })}
          </div>
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
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
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
              readOnly
              tabIndex={-1}
              aria-label={t('pages.workoutPlans.muscleGroups')}
              // Só exibe o que os chips acima selecionam
              className="bg-muted/30 text-muted-foreground cursor-default text-sm focus-visible:ring-0"
            />
          </div>
        </FormSection>

        {/* Horário padrão */}
        <FormSection
          title={t('pages.workoutPlans.defaultScheduleSection')}
          icon={Clock}
        >
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
              <Controller
                control={control}
                name="default_duration_minutes"
                render={({ field }) => (
                  <NumberStepper
                    placeholder="45"
                    min={0}
                    optional
                    aria-label={t('pages.workoutPlans.defaultDurationMinutes')}
                    value={field.value === '' ? null : field.value}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                )}
              />
            </div>
          </div>
        </FormSection>
      </div>

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="mr-sm h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-sm h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-sm h-4 w-4" />
          )}

          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
