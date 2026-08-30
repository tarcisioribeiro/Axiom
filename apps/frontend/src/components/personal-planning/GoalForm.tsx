/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, parseISO } from 'date-fns';
import { Activity, CalendarDays, Loader2, Tag, Target, Trophy } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
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
import { GOAL_TYPE_ICONS, GOAL_STATUS_ICONS } from '@/config/icons';
import { formatDate } from '@/lib/formatters';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { goalSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import {
  GOAL_TYPE_CHOICES,
  GOAL_SOURCE_CHOICES,
  GOAL_STATUS_CHOICES,
  type Goal,
  type RoutineTask,
} from '@/types';

type GoalFormData = z.infer<typeof goalSchema>;

const AUTO_GOAL_TYPES = new Set(['consecutive_days', 'total_days', 'avoid_habit']);

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
          goal_source: goal.goal_source ?? 'task_instances',
          related_task: goal.related_task,
          target_value: goal.target_value,
          current_value: goal.current_value,
          start_date: goal.start_date,
          end_date: goal.end_date || '',
          status: goal.status,
          owner: goal.owner,
        }
      : {
          title: '',
          description: '',
          goal_type: 'consecutive_days',
          goal_source: 'task_instances',
          related_task: undefined,
          target_value: 30,
          current_value: 0,
          start_date: formatLocalDate(new Date()),
          end_date: '',
          status: 'active',
          owner: 0,
        },
  });

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

  const watchedGoalType = watch('goal_type');
  const watchedGoalSource = watch('goal_source');
  const watchedStartDate = watch('start_date');
  const watchedTargetValue = watch('target_value');
  const isAutoType =
    AUTO_GOAL_TYPES.has(watchedGoalType) && watchedGoalSource !== 'custom';
  const isTaskSource = watchedGoalSource === 'task_instances';

  const computedEndDate = useMemo(() => {
    if (!isAutoType || !watchedStartDate || !watchedTargetValue) return null;
    try {
      return formatLocalDate(addDays(parseISO(watchedStartDate), watchedTargetValue));
    } catch {
      return null;
    }
  }, [isAutoType, watchedStartDate, watchedTargetValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection title={t('pages.goals.form.sectionIdentification')} icon={Trophy}>
        <div className="gap-md grid grid-cols-1">
          <div className="space-y-sm">
            <Label htmlFor="title" className="gap-xs flex items-center">
              <Trophy className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.form.titleLabel')}
            </Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('pages.goals.form.titlePlaceholder')}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-xs text-destructive text-sm">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="description" className="gap-xs flex items-center">
              <Trophy className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.form.descriptionLabel')}
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('pages.goals.form.descriptionPlaceholder')}
              rows={3}
              disabled={isLoading}
            />
            {errors.description && (
              <p className="mt-xs text-destructive text-sm">
                {errors.description.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.goals.form.sectionConfig')} icon={Target}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label className="gap-xs flex items-center">
              <Target className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.form.goalTypeLabel')}
            </Label>
            <Select
              value={watch('goal_type')}
              onValueChange={(value) => setValue('goal_type', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPE_CHOICES.map((type) => {
                  const TypeIcon = GOAL_TYPE_ICONS[type.value];
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        {TypeIcon && <TypeIcon className="h-4 w-4" />}
                        {t(`pages.goals.form.goalTypeOptions.${type.value}`)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.goal_type && (
              <p className="mt-xs text-destructive text-sm">
                {errors.goal_type.message}
              </p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="gap-xs flex items-center">
              <Activity className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.form.goalSourceLabel')}
            </Label>
            <Select
              value={watch('goal_source')}
              onValueChange={(value) => setValue('goal_source', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_SOURCE_CHOICES.map((src) => (
                  <SelectItem key={src.value} value={src.value}>
                    {t(`pages.goals.form.goalSourceOptions.${src.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isTaskSource && (
            <div className="space-y-sm md:col-span-2">
              <Label className="gap-xs flex items-center">
                <Tag className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.goals.form.relatedTaskLabel')}
              </Label>
              <Select
                value={watch('related_task')?.toString()}
                onValueChange={(value) =>
                  setValue(
                    'related_task',
                    value === 'none' ? undefined : parseInt(value)
                  )
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('pages.goals.form.relatedTaskPlaceholder')}
                  />
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
                <p className="mt-xs text-destructive text-sm">
                  {errors.related_task.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-sm">
            <Label htmlFor="target_value" className="gap-xs flex items-center">
              <Target className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.form.targetValueLabel')}
            </Label>
            <Input
              id="target_value"
              type="number"
              min="1"
              {...register('target_value', {
                setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
              })}
              disabled={isLoading}
            />
            {errors.target_value && (
              <p className="mt-xs text-destructive text-sm">
                {errors.target_value.message}
              </p>
            )}
          </div>

          {!isAutoType && (
            <div className="space-y-sm">
              <Label htmlFor="current_value" className="gap-xs flex items-center">
                <Target className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.goals.form.currentValueLabel')}
              </Label>
              <Input
                id="current_value"
                type="number"
                min="0"
                {...register('current_value', {
                  setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
                })}
                disabled={isLoading}
              />
              {errors.current_value && (
                <p className="mt-xs text-destructive text-sm">
                  {errors.current_value.message}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.goals.form.sectionPeriod')} icon={CalendarDays}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.form.startDateLabel')}
            </Label>
            <DatePicker
              value={watch('start_date')}
              onChange={(date) =>
                setValue('start_date', date ? formatLocalDate(date) : '')
              }
              placeholder={t('pages.goals.form.startDatePlaceholder')}
              disabled={isLoading}
            />
            {errors.start_date && (
              <p className="mt-xs text-destructive text-sm">
                {errors.start_date.message}
              </p>
            )}
          </div>

          {isAutoType ? (
            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.goals.form.endDateLabel')}
              </Label>
              <div className="border-input bg-muted/40 text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
                {computedEndDate ? formatDate(computedEndDate) : '—'}
              </div>
              <p className="text-muted-foreground text-xs">
                {t('pages.goals.form.endDateComputedHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.goals.form.endDateLabel')}
              </Label>
              <DatePicker
                value={watch('end_date') ?? ''}
                onChange={(date) =>
                  setValue('end_date', date ? formatLocalDate(date) : null)
                }
                placeholder={t('pages.goals.form.endDatePlaceholder')}
                disabled={isLoading}
              />
              {errors.end_date && (
                <p className="mt-xs text-destructive text-sm">
                  {errors.end_date.message}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.goals.form.sectionStatus')} icon={Activity}>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center">
            <Activity className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.goals.form.statusLabel')}
          </Label>
          <Select
            value={watch('status')}
            onValueChange={(value) => setValue('status', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_STATUS_CHOICES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  <span className="flex items-center gap-2">
                    {(() => {
                      const StatusIcon = GOAL_STATUS_ICONS[status.value];
                      return StatusIcon ? <StatusIcon className="h-4 w-4" /> : null;
                    })()}
                    {t(`pages.goals.form.statusOptions.${status.value}`)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="mt-xs text-destructive text-sm">{errors.status.message}</p>
          )}
        </div>
      </FormSection>

      <div className="gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
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
