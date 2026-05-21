import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { WorkoutDay, WorkoutExercise } from '@/types/workout';

interface WorkoutDayFormValues {
  name: string;
  muscle_groups: string;
  order: number;
  exercises: {
    id?: number;
    name: string;
    sets: number;
    reps_min: number;
    reps_max: number;
    order: number;
    notes: string;
  }[];
}

interface WorkoutDayFormProps {
  day?: WorkoutDay & { exercises: WorkoutExercise[] };
  planId: number;
  ownerId: number;
  onSubmit: (
    dayData: Omit<WorkoutDayFormValues, 'exercises'> & { plan: number; owner: number },
    exercises: WorkoutDayFormValues['exercises']
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
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
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<WorkoutDayFormValues>({
    defaultValues: {
      name: day?.name ?? '',
      muscle_groups: day?.muscle_groups ?? '',
      order: day?.order ?? 0,
      exercises:
        day?.exercises?.map((e) => ({
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps_min: e.reps_min,
          reps_max: e.reps_max,
          order: e.order,
          notes: e.notes ?? '',
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });

  useEffect(() => {
    if (day) {
      reset({
        name: day.name,
        muscle_groups: day.muscle_groups ?? '',
        order: day.order,
        exercises:
          day.exercises?.map((e) => ({
            id: e.id,
            name: e.name,
            sets: e.sets,
            reps_min: e.reps_min,
            reps_max: e.reps_max,
            order: e.order,
            notes: e.notes ?? '',
          })) ?? [],
      });
    }
  }, [day, reset]);

  const handleFormSubmit = async (data: WorkoutDayFormValues) => {
    try {
      const { exercises, ...dayData } = data;
      await onSubmit({ ...dayData, plan: planId, owner: ownerId }, exercises);
    } catch {
      toast({ title: t('pages.workoutPlans.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-sm">
          <Label htmlFor="day-name">{t('pages.workoutPlans.dayName')}</Label>
          <Input
            id="day-name"
            placeholder={t('pages.workoutPlans.dayNamePlaceholder')}
            {...register('name', { required: true })}
            className={errors.name ? 'border-destructive' : ''}
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="day-order">{t('pages.workoutPlans.order')}</Label>
          <Input
            id="day-order"
            type="number"
            min={0}
            {...register('order', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="muscle-groups">{t('pages.workoutPlans.muscleGroups')}</Label>
        <Input
          id="muscle-groups"
          placeholder={t('pages.workoutPlans.muscleGroupsPlaceholder')}
          {...register('muscle_groups')}
        />
      </div>

      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <Label>{t('pages.workoutPlans.exercisesSection')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                name: '',
                sets: 3,
                reps_min: 8,
                reps_max: 12,
                order: fields.length,
                notes: '',
              })
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('pages.workoutPlans.addExercise')}
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="py-sm text-center text-sm text-muted-foreground">
            {t('pages.workoutPlans.noExercises')}
          </p>
        )}

        <div className="space-y-sm">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-sm rounded-md border border-border bg-card p-sm"
            >
              <div className="flex items-start gap-sm">
                <div className="flex-1 space-y-sm">
                  <Input
                    placeholder={t('pages.workoutPlans.exerciseNamePlaceholder')}
                    {...register(`exercises.${index}.name`, { required: true })}
                    className={
                      errors.exercises?.[index]?.name ? 'border-destructive' : ''
                    }
                  />
                  <div className="grid grid-cols-3 gap-xs">
                    <div className="space-y-xs">
                      <Label className="text-xs">{t('pages.workoutPlans.sets')}</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`exercises.${index}.sets`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="space-y-xs">
                      <Label className="text-xs">
                        {t('pages.workoutPlans.repsMin')}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`exercises.${index}.reps_min`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="space-y-xs">
                      <Label className="text-xs">
                        {t('pages.workoutPlans.repsMax')}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`exercises.${index}.reps_max`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  </div>
                  <Textarea
                    placeholder={t('pages.workoutPlans.notesPlaceholder')}
                    rows={1}
                    {...register(`exercises.${index}.notes`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => remove(index)}
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
