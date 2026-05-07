import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { goalSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import {
  GOAL_TYPE_CHOICES,
  GOAL_STATUS_CHOICES,
  type Goal,
  type RoutineTask,
} from '@/types';

type GoalFormData = z.infer<typeof goalSchema>;

interface GoalFormProps {
  goal?: Goal;
  routineTasks: RoutineTask[];
  onSubmit: (data: GoalFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function GoalForm({
  goal,
  routineTasks,
  onSubmit,
  onCancel,
  isLoading = false,
}: GoalFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: goal
      ? {
          title: goal.title,
          description: goal.description || '',
          goal_type: goal.goal_type,
          related_task: goal.related_task,
          target_value: goal.target_value,
          current_value: goal.current_value,
          start_date: goal.start_date,
          deadline: goal.deadline || '',
          end_date: goal.end_date || '',
          status: goal.status,
          owner: goal.owner,
        }
      : {
          title: '',
          description: '',
          goal_type: 'consecutive_days',
          related_task: undefined,
          target_value: 30,
          current_value: 0,
          start_date: formatLocalDate(new Date()),
          deadline: '',
          end_date: '',
          status: 'active',
          owner: 0,
        },
  });

  // Load current user member when creating new goal
  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!goal) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [goal, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">{t('pages.goals.form.titleLabel')}</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder={t('pages.goals.form.titlePlaceholder')}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">{t('pages.goals.form.descriptionLabel')}</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder={t('pages.goals.form.descriptionPlaceholder')}
            rows={3}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="goal_type">{t('pages.goals.form.goalTypeLabel')}</Label>
          <Select
            value={watch('goal_type')}
            onValueChange={(value) => setValue('goal_type', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_TYPE_CHOICES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.goal_type && (
            <p className="mt-1 text-sm text-destructive">{errors.goal_type.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="related_task">{t('pages.goals.form.relatedTaskLabel')}</Label>
          <Select
            value={watch('related_task')?.toString()}
            onValueChange={(value) =>
              setValue('related_task', value === 'none' ? undefined : parseInt(value))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('pages.goals.form.relatedTaskPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t('pages.goals.form.relatedTaskNone')}
              </SelectItem>
              {routineTasks.map((task) => (
                <SelectItem key={task.id} value={task.id.toString()}>
                  {task.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.related_task && (
            <p className="mt-1 text-sm text-destructive">
              {errors.related_task.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="target_value">{t('pages.goals.form.targetValueLabel')}</Label>
          <Input
            id="target_value"
            type="number"
            min="1"
            {...register('target_value', {
              setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
            })}
          />
          {errors.target_value && (
            <p className="mt-1 text-sm text-destructive">
              {errors.target_value.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="current_value">
            {t('pages.goals.form.currentValueLabel')}
          </Label>
          <Input
            id="current_value"
            type="number"
            min="0"
            {...register('current_value', {
              setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
            })}
          />
          {errors.current_value && (
            <p className="mt-1 text-sm text-destructive">
              {errors.current_value.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="start_date">{t('pages.goals.form.startDateLabel')}</Label>
          <DatePicker
            value={watch('start_date')}
            onChange={(date) =>
              setValue('start_date', date ? formatLocalDate(date) : '')
            }
            placeholder={t('pages.goals.form.startDatePlaceholder')}
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-destructive">{errors.start_date.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="deadline">{t('pages.goals.form.deadlineLabel')}</Label>
          <DatePicker
            value={watch('deadline') ?? ''}
            onChange={(date) =>
              setValue('deadline', date ? formatLocalDate(date) : null)
            }
            placeholder={t('pages.goals.form.deadlinePlaceholder')}
          />
          {errors.deadline && (
            <p className="mt-1 text-sm text-destructive">{errors.deadline.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="end_date">{t('pages.goals.form.endDateLabel')}</Label>
          <DatePicker
            value={watch('end_date')}
            onChange={(date) => setValue('end_date', date ? formatLocalDate(date) : '')}
            placeholder={t('pages.goals.form.endDatePlaceholder')}
          />
          {errors.end_date && (
            <p className="mt-1 text-sm text-destructive">{errors.end_date.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="status">{t('pages.goals.form.statusLabel')}</Label>
          <Select
            value={watch('status')}
            onValueChange={(value) => setValue('status', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_STATUS_CHOICES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="mt-1 text-sm text-destructive">{errors.status.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : (
            t('common.actions.save')
          )}
        </Button>
      </div>
    </form>
  );
}
