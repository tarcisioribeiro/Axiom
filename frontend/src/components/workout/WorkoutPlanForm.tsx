import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { WorkoutPlan, WorkoutPlanFormData } from '@/types/workout';

interface WorkoutPlanFormProps {
  plan?: WorkoutPlan;
  ownerId: number;
  onSubmit: (data: WorkoutPlanFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function WorkoutPlanForm({
  plan,
  ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: WorkoutPlanFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkoutPlanFormData>({
    defaultValues: {
      name: plan?.name ?? '',
      description: plan?.description ?? '',
      is_active: plan?.is_active ?? true,
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (plan) {
      reset({
        name: plan.name,
        description: plan.description ?? '',
        is_active: plan.is_active,
        owner: ownerId,
      });
    }
  }, [plan, ownerId, reset]);

  const isActive = watch('is_active');

  const handleFormSubmit = async (data: WorkoutPlanFormData) => {
    try {
      await onSubmit(data);
    } catch {
      toast({
        title: t('pages.workoutPlans.saveError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="plan-name">{t('pages.workoutPlans.planName')}</Label>
        <Input
          id="plan-name"
          placeholder={t('pages.workoutPlans.planNamePlaceholder')}
          {...register('name', { required: true })}
          className={errors.name ? 'border-destructive' : ''}
        />
      </div>

      <div className="space-y-sm">
        <Label htmlFor="plan-description">
          {t('pages.workoutPlans.planDescription')}
        </Label>
        <Textarea
          id="plan-description"
          placeholder={t('pages.workoutPlans.planDescriptionPlaceholder')}
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="flex items-center gap-sm">
        <Switch
          id="plan-active"
          checked={isActive}
          onCheckedChange={(val) => setValue('is_active', val === true)}
        />
        <Label htmlFor="plan-active">{t('pages.workoutPlans.planActive')}</Label>
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
