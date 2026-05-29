/* eslint-disable react-hooks/incompatible-library */
import {
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
      is_active: plan?.is_active ?? false,
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
      toast({ title: t('pages.workoutPlans.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header visual */}
      <div className="flex items-center gap-md rounded-lg bg-category-exercise/10 px-md py-sm ring-1 ring-category-exercise/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-exercise/20">
          <Dumbbell className="h-5 w-5 text-category-exercise" />
        </div>
        <div>
          <p className="text-sm font-semibold text-category-exercise">
            {plan
              ? t('pages.workoutPlans.editPlanTitle')
              : t('pages.workoutPlans.newPlanTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('pages.workoutPlans.newPlanDesc')}
          </p>
        </div>
      </div>

      {/* Identificação */}
      <FormSection title={t('pages.workoutPlans.planName')} icon={ClipboardList}>
        <div className="space-y-sm">
          <Input
            placeholder={t('pages.workoutPlans.planNamePlaceholder')}
            {...register('name', { required: true })}
            className={cn(errors.name && 'border-destructive')}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{t('common.required')}</p>
          )}
        </div>
      </FormSection>

      {/* Descrição */}
      <FormSection title={t('pages.workoutPlans.planDescription')} icon={FileText}>
        <Textarea
          placeholder={t('pages.workoutPlans.planDescriptionPlaceholder')}
          rows={3}
          {...register('description')}
          className="resize-none"
        />
      </FormSection>

      {/* Status */}
      <div className="space-y-sm">
        <Label className="flex items-center gap-xs text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('pages.workoutPlans.planActive')}
        </Label>
        <div className="grid grid-cols-2 gap-sm">
          <button
            type="button"
            onClick={() => setValue('is_active', true)}
            className={cn(
              'flex items-center justify-center gap-sm rounded-lg border-2 px-md py-sm text-sm font-medium transition-all',
              isActive
                ? 'border-success bg-success/10 text-success'
                : 'border-border bg-card text-muted-foreground hover:border-success/40 hover:bg-success/5'
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('pages.workoutPlans.active')}
          </button>
          <button
            type="button"
            onClick={() => setValue('is_active', false)}
            className={cn(
              'flex items-center justify-center gap-sm rounded-lg border-2 px-md py-sm text-sm font-medium transition-all',
              !isActive
                ? 'border-muted-foreground/40 bg-muted/60 text-muted-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30'
            )}
          >
            <XCircle className="h-4 w-4" />
            {t('pages.workoutPlans.inactive')}
          </button>
        </div>
        {isActive && (
          <p className="text-xs text-muted-foreground">
            {t(
              'pages.workoutPlans.activeWarning',
              'Planos ativos aparecem em destaque na tela de treinos.'
            )}
          </p>
        )}
      </div>

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
