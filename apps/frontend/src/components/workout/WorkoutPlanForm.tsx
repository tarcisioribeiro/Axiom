/* eslint-disable react-hooks/incompatible-library */
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  FileText,
  Power,
  Save,
  X,
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
import { notifyFormErrors } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import { ValidationError } from '@/services/api-errors';
import { WORKOUT_CATEGORIES } from '@/types/workout';
import type { WorkoutPlan, WorkoutPlanFormData } from '@/types/workout';
import { getErrorMessage } from '@/utils/error-utils';

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
    setError,
    formState: { errors },
  } = useForm<WorkoutPlanFormData>({
    defaultValues: {
      name: plan?.name ?? '',
      description: plan?.description ?? '',
      category: plan?.category ?? 'resistance',
      is_active: plan?.is_active ?? false,
      owner: ownerId,
    },
  });

  useEffect(() => {
    if (plan) {
      reset({
        name: plan.name,
        description: plan.description ?? '',
        category: plan.category,
        is_active: plan.is_active,
        owner: ownerId,
      });
    }
  }, [plan, ownerId, reset]);

  const isActive = watch('is_active');
  const category = watch('category');

  const handleFormSubmit = async (data: WorkoutPlanFormData) => {
    try {
      await onSubmit(data);
    } catch (err: unknown) {
      // Nome duplicado (mesmo nome + categoria) → mensagem no próprio campo
      const nameError = err instanceof ValidationError ? err.errors.name?.[0] : null;
      if (nameError) {
        setError('name', { type: 'server', message: nameError });
        toast({ title: nameError, variant: 'destructive' });
        return;
      }
      toast({
        title: t('pages.workoutPlans.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit, notifyFormErrors)}
      className="gap-md flex min-h-0 flex-1 flex-col"
    >
      {/* Só os campos rolam; título (DialogHeader) e rodapé ficam fixos */}
      <div className="space-y-lg px-xs">
        {/* Identificação */}
        <FormSection title={t('pages.workoutPlans.planName')} icon={ClipboardList}>
          <div className="space-y-sm">
            <Input
              placeholder={t('pages.workoutPlans.planNamePlaceholder')}
              {...register('name', { required: true })}
              aria-invalid={!!errors.name}
            />
          </div>
        </FormSection>

        {/* Categoria */}
        <FormSection title={t('pages.workoutPlans.category')} icon={Activity}>
          <div className="gap-sm grid grid-cols-3">
            {WORKOUT_CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setValue('category', key)}
                className={cn(
                  'px-sm py-sm rounded-lg border-2 text-sm font-medium transition',
                  category === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                )}
              >
                {t(`pages.workoutPlans.categories.${key}`)}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Descrição */}
        <FormSection title={t('pages.workoutPlans.planDescription')} icon={FileText}>
          <Textarea
            placeholder={t('pages.workoutPlans.planDescriptionPlaceholder')}
            rows={1}
            {...register('description')}
            className="resize-none"
          />
        </FormSection>

        {/* Status */}
        <div className="space-y-sm">
          <Label className="gap-xs text-muted-foreground flex items-center text-xs font-semibold tracking-wider uppercase">
            <Power className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.workoutPlans.planActive')}
          </Label>
          <div className="gap-sm grid grid-cols-2">
            <button
              type="button"
              onClick={() => setValue('is_active', true)}
              className={cn(
                'gap-sm px-md py-sm flex items-center justify-center rounded-lg border-2 text-sm font-medium transition',
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
                'gap-sm px-md py-sm flex items-center justify-center rounded-lg border-2 text-sm font-medium transition',
                !isActive
                  ? 'border-muted-foreground/40 bg-muted/60 text-muted-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30'
              )}
            >
              <XCircle className="h-4 w-4" />
              {t('pages.workoutPlans.inactive')}
            </button>
          </div>
        </div>
      </div>

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
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
