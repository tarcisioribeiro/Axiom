import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function WorkoutDayForm({
  day,
  planId,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: WorkoutDayFormProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
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
      reset({
        name: day.name,
        muscle_groups: day.muscle_groups ?? '',
        order: day.order,
      });
    }
  }, [day, reset]);

  const handleFormSubmit = async (data: WorkoutDayFormValues) => {
    await onSubmit({ ...data, plan: planId, owner: ownerId });
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

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
