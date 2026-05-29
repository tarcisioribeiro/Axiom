/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Link2,
  Loader2,
  Repeat,
  Settings2,
  Tag,
  Target,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { IconPicker } from '@/components/ui/icon-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusToggle } from '@/components/ui/status-toggle';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { translate } from '@/config/constants';
import { TASK_CATEGORY_ICONS, PRIORITY_ICONS, PERIODICITY_ICONS } from '@/config/icons';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { routineTaskSchema } from '@/lib/validations';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import { financialGoalsService } from '@/services/vaults-service';
import {
  TASK_CATEGORIES,
  PERIODICITY_CHOICES,
  WEEKDAY_CHOICES,
  PRIORITY_CHOICES,
  UNIT_CHOICES,
  type RoutineTask,
} from '@/types';

type RoutineTaskFormData = z.infer<typeof routineTaskSchema>;

interface RoutineTaskFormProps {
  task?: RoutineTask;
  onSubmit: (data: RoutineTaskFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RoutineTaskForm({
  task,
  onSubmit,
  onCancel,
  isLoading = false,
}: RoutineTaskFormProps) {
  const { t } = useTranslation();
  const [linksOpen, setLinksOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RoutineTaskFormData>({
    resolver: zodResolver(routineTaskSchema),
    defaultValues: task
      ? {
          name: task.name,
          description: task.description || '',
          category: task.category,
          icon: task.icon || null,
          periodicity: task.periodicity,
          weekday: task.weekday,
          day_of_month: task.day_of_month,
          is_active: task.is_active,
          priority: task.priority ?? 'medium',
          allowed_skips_per_month: task.allowed_skips_per_month ?? 0,
          target_quantity: task.target_quantity,
          unit: task.unit as RoutineTaskFormData['unit'],
          owner: task.owner,
          default_time: task.default_time ? task.default_time.substring(0, 5) : null,
          closing_time: task.closing_time ? task.closing_time.substring(0, 5) : null,
          daily_occurrences: task.daily_occurrences || 1,
          interval_hours: task.interval_hours || null,
          scheduled_times: task.scheduled_times || null,
          linked_financial_goal: task.linked_financial_goal ?? null,
          linked_book: task.linked_book ?? null,
        }
      : {
          name: '',
          description: '',
          category: 'health',
          icon: null,
          periodicity: 'daily',
          weekday: undefined,
          day_of_month: undefined,
          is_active: true,
          priority: 'medium' as const,
          allowed_skips_per_month: 0,
          target_quantity: 1,
          unit: 'vez',
          owner: 0,
          default_time: null,
          closing_time: null,
          daily_occurrences: 1,
          interval_hours: null,
          scheduled_times: null,
          linked_financial_goal: null,
          linked_book: null,
        },
  });

  const periodicity = watch('periodicity');
  const isActive = watch('is_active');
  const dailyOccurrences = watch('daily_occurrences');

  useEffect(() => {
    if (task) {
      reset({
        name: task.name,
        description: task.description || '',
        category: task.category,
        icon: task.icon || null,
        periodicity: task.periodicity,
        weekday: task.weekday,
        day_of_month: task.day_of_month,
        is_active: task.is_active,
        priority: task.priority ?? 'medium',
        allowed_skips_per_month: task.allowed_skips_per_month ?? 0,
        target_quantity: task.target_quantity,
        unit: task.unit as RoutineTaskFormData['unit'],
        owner: task.owner,
        default_time: task.default_time ? task.default_time.substring(0, 5) : null,
        closing_time: task.closing_time ? task.closing_time.substring(0, 5) : null,
        daily_occurrences: task.daily_occurrences || 1,
        interval_hours: task.interval_hours || null,
        scheduled_times: task.scheduled_times || null,
        linked_financial_goal: task.linked_financial_goal ?? null,
        linked_book: task.linked_book ?? null,
      });
    }
  }, [task, reset]);

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!task) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [task, setValue]);

  const { data: financialGoals = [] } = useQuery({
    queryKey: ['financial-goals-active'],
    queryFn: () => financialGoalsService.getAll({ is_active: 'true' }),
    staleTime: 60_000,
  });

  const { data: readingBooksList = [] } = useQuery({
    queryKey: ['books-reading'],
    queryFn: () => booksService.getAll({ read_status: 'reading' }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (periodicity === 'daily') {
      setValue('weekday', undefined);
      setValue('day_of_month', undefined);
    } else if (periodicity === 'weekly') {
      setValue('day_of_month', undefined);
      if (watch('weekday') === undefined) {
        setValue('weekday', 0);
      }
    } else if (periodicity === 'monthly') {
      setValue('weekday', undefined);
      if (watch('day_of_month') === undefined) {
        setValue('day_of_month', 1);
      }
    }
  }, [periodicity, setValue, watch]);

  const hasLinks = financialGoals.length > 0 || readingBooksList.length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection
        title={t('pages.routineTasks.form.sectionIdentification')}
        icon={CheckSquare}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="flex items-center gap-xs">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.routineTasks.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="description" className="flex items-center gap-xs">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.descriptionLabel')}
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('pages.routineTasks.form.descriptionPlaceholder')}
              rows={3}
              disabled={isLoading}
            />
            {errors.description && (
              <p className="mt-xs text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.categoryLabel')}
            </Label>
            <Select
              value={watch('category')}
              onValueChange={(value) => setValue('category', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_CATEGORIES.map((cat) => {
                  const CatIcon = TASK_CATEGORY_ICONS[cat.value];
                  return (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        {CatIcon && <CatIcon className="h-4 w-4" />}
                        {translate('taskCategories', cat.value)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="mt-xs text-sm text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="icon" className="flex items-center gap-xs">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.iconLabel')}
            </Label>
            <IconPicker
              value={watch('icon')}
              onChange={(value) => setValue('icon', value)}
            />
            {errors.icon && (
              <p className="mt-xs text-sm text-destructive">{errors.icon.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        title={t('pages.routineTasks.form.sectionPeriodicity')}
        icon={Repeat}
      >
        <div className="space-y-md">
          {/* Toggle visual de periodicidade */}
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.periodicityLabel')}
            </Label>
            <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
              {PERIODICITY_CHOICES.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => setValue('periodicity', period.value)}
                  disabled={isLoading}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                    periodicity === period.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {(() => {
                    const PeriodIcon = PERIODICITY_ICONS[period.value];
                    return PeriodIcon ? <PeriodIcon className="h-3.5 w-3.5" /> : null;
                  })()}
                  <span className="hidden sm:inline">
                    {t(`pages.routineTasks.form.periodicityOptions.${period.value}`)}
                  </span>
                </button>
              ))}
            </div>
            {errors.periodicity && (
              <p className="mt-xs text-sm text-destructive">
                {errors.periodicity.message}
              </p>
            )}
          </div>

          {periodicity === 'weekly' && (
            <div className="space-y-sm">
              <Label className="flex items-center gap-xs">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.weekdayLabel')}
              </Label>
              <Select
                value={watch('weekday')?.toString()}
                onValueChange={(value) => setValue('weekday', parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('pages.routineTasks.form.weekdayPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_CHOICES.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {t(`pages.routineTasks.form.weekdayOptions.${day.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.weekday && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.weekday.message}
                </p>
              )}
            </div>
          )}

          {periodicity === 'monthly' && (
            <div className="space-y-sm">
              <Label htmlFor="day_of_month" className="flex items-center gap-xs">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.dayOfMonthLabel')}
              </Label>
              <Input
                id="day_of_month"
                type="number"
                min="1"
                max="31"
                {...register('day_of_month', {
                  setValueAs: (value: string) =>
                    value === '' ? undefined : parseInt(value),
                })}
                placeholder="1-31"
                disabled={isLoading}
              />
              {errors.day_of_month && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.day_of_month.message}
                </p>
              )}
            </div>
          )}

          {periodicity === 'weekdays' && (
            <p className="text-sm text-muted-foreground">
              {t('pages.routineTasks.form.weekdaysNote')}
            </p>
          )}

          {periodicity === 'custom' && (
            <div className="space-y-md rounded-lg border bg-muted/50 p-md">
              <h4 className="flex items-center gap-xs text-sm font-medium">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.customSection')}
              </h4>

              <div>
                <Label className="text-sm">
                  {t('pages.routineTasks.form.customWeekdaysLabel')}
                </Label>
                <div className="mt-sm grid grid-cols-7 gap-sm">
                  {WEEKDAY_CHOICES.map((day) => (
                    <div key={day.value} className="flex flex-col items-center gap-xs">
                      <Checkbox
                        id={`custom-weekday-${day.value}`}
                        checked={watch('custom_weekdays')?.includes(day.value) || false}
                        onCheckedChange={(checked) => {
                          const current = watch('custom_weekdays') || [];
                          setValue(
                            'custom_weekdays',
                            checked
                              ? [...current, day.value]
                              : current.filter((d) => d !== day.value)
                          );
                        }}
                        disabled={isLoading}
                      />
                      <Label
                        htmlFor={`custom-weekday-${day.value}`}
                        className="cursor-pointer text-xs"
                      >
                        {t(
                          `pages.routineTasks.form.weekdayOptions.${day.value}`
                        ).substring(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="custom_month_days" className="text-sm">
                  {t('pages.routineTasks.form.customMonthDaysLabel')}
                </Label>
                <Input
                  id="custom_month_days"
                  type="text"
                  placeholder="Ex: 1,15,30"
                  value={watch('custom_month_days')?.join(',') || ''}
                  onChange={(e) => {
                    const values = e.target.value
                      .split(',')
                      .map((v) => parseInt(v.trim()))
                      .filter((v) => !isNaN(v) && v >= 1 && v <= 31);
                    setValue('custom_month_days', values.length > 0 ? values : null);
                  }}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <Label htmlFor="times_per_week" className="text-sm">
                    {t('pages.routineTasks.form.timesPerWeekLabel')}
                  </Label>
                  <Input
                    id="times_per_week"
                    type="number"
                    min="1"
                    max="7"
                    {...register('times_per_week', {
                      setValueAs: (value: string) =>
                        value === '' ? null : parseInt(value),
                    })}
                    placeholder="1-7"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="times_per_month" className="text-sm">
                    {t('pages.routineTasks.form.timesPerMonthLabel')}
                  </Label>
                  <Input
                    id="times_per_month"
                    type="number"
                    min="1"
                    max="31"
                    {...register('times_per_month', {
                      setValueAs: (value: string) =>
                        value === '' ? null : parseInt(value),
                    })}
                    placeholder="1-31"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <Label htmlFor="interval_days" className="text-sm">
                    {t('pages.routineTasks.form.intervalDaysLabel')}
                  </Label>
                  <Input
                    id="interval_days"
                    type="number"
                    min="1"
                    {...register('interval_days', {
                      setValueAs: (value: string) =>
                        value === '' ? null : parseInt(value),
                    })}
                    placeholder="Ex: 3"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="interval_start_date" className="text-sm">
                    {t('pages.routineTasks.form.intervalStartDateLabel')}
                  </Label>
                  <DatePicker
                    value={watch('interval_start_date') ?? undefined}
                    onChange={(date) =>
                      setValue(
                        'interval_start_date',
                        date ? formatLocalDate(date) : undefined
                      )
                    }
                    placeholder={t(
                      'pages.routineTasks.form.intervalStartDatePlaceholder'
                    )}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {errors.interval_start_date && (
                <p className="text-sm text-destructive">
                  {errors.interval_start_date.message}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.routineTasks.form.sectionGoalUnit')} icon={Target}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="target_quantity" className="flex items-center gap-xs">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.targetQuantityLabel')}
            </Label>
            <Input
              id="target_quantity"
              type="number"
              min="1"
              {...register('target_quantity', {
                setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
              })}
              disabled={isLoading}
            />
            {errors.target_quantity && (
              <p className="mt-xs text-sm text-destructive">
                {errors.target_quantity.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.unitLabel')}
            </Label>
            <Select
              value={watch('unit') ?? 'vez'}
              onValueChange={(value) =>
                setValue('unit', value as (typeof UNIT_CHOICES)[number]['value'])
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_CHOICES.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {t(`pages.routineTasks.form.unitOptions.${u.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unit && (
              <p className="mt-xs text-sm text-destructive">{errors.unit.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.routineTasks.form.scheduleSection')} icon={Clock}>
        <div className="space-y-md">
          <p className="text-xs text-muted-foreground">
            {t('pages.routineTasks.form.scheduleSectionNote')}
          </p>

          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <div className="space-y-sm">
              <Label htmlFor="default_time" className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.defaultTimeLabel')}
              </Label>
              <TimePicker
                value={watch('default_time') ?? undefined}
                onChange={(t) => setValue('default_time', t ?? null)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('pages.routineTasks.form.defaultTimeHint')}
              </p>
              {errors.default_time && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.default_time.message}
                </p>
              )}
            </div>

            <div className="space-y-sm">
              <Label htmlFor="daily_occurrences" className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.dailyOccurrencesLabel')}
              </Label>
              <Input
                id="daily_occurrences"
                type="number"
                min="1"
                max="24"
                {...register('daily_occurrences', {
                  setValueAs: (value: string) => (value === '' ? 1 : parseInt(value)),
                })}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('pages.routineTasks.form.dailyOccurrencesHint')}
              </p>
            </div>

            <div className="space-y-sm">
              <Label htmlFor="interval_hours" className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.intervalHoursLabel')}
              </Label>
              <Input
                id="interval_hours"
                type="number"
                min="1"
                max="23"
                value={watch('interval_hours') || ''}
                onChange={(e) =>
                  setValue(
                    'interval_hours',
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                placeholder={t('pages.routineTasks.form.intervalHoursPlaceholder')}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('pages.routineTasks.form.intervalHoursHint')}
              </p>
              {errors.interval_hours && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.interval_hours.message}
                </p>
              )}
            </div>

            {(dailyOccurrences ?? 1) === 1 && (
              <div className="space-y-sm">
                <Label htmlFor="closing_time" className="flex items-center gap-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.routineTasks.form.closingTimeLabel')}
                </Label>
                <TimePicker
                  value={watch('closing_time') ?? undefined}
                  onChange={(t) => setValue('closing_time', t ?? null)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {t('pages.routineTasks.form.closingTimeHint')}
                </p>
                {errors.closing_time && (
                  <p className="mt-xs text-sm text-destructive">
                    {errors.closing_time.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-sm md:col-span-2">
              <Label htmlFor="scheduled_times" className="flex items-center gap-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.routineTasks.form.scheduledTimesLabel')}
              </Label>
              <Input
                id="scheduled_times"
                type="text"
                placeholder={t('pages.routineTasks.form.scheduledTimesPlaceholder')}
                value={watch('scheduled_times')?.join(', ') || ''}
                onChange={(e) => {
                  const times = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t));
                  setValue('scheduled_times', times.length > 0 ? times : null);
                }}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t('pages.routineTasks.form.scheduledTimesHint')}
              </p>
              {errors.scheduled_times && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.scheduled_times.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title={t('pages.routineTasks.form.sectionBehavior')}
        icon={Settings2}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.priorityLabel')}
            </Label>
            <Select
              value={watch('priority') ?? 'medium'}
              onValueChange={(value) =>
                setValue('priority', value as 'low' | 'medium' | 'high' | 'critical')
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_CHOICES.map((p) => {
                  const PriorIcon = PRIORITY_ICONS[p.value];
                  return (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        {PriorIcon && <PriorIcon className="h-4 w-4" />}
                        {t(`pages.routineTasks.form.priorityOptions.${p.value}`)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="mt-xs text-sm text-destructive">
                {errors.priority.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label
              htmlFor="allowed_skips_per_month"
              className="flex items-center gap-xs"
            >
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.allowedSkipsLabel')}
            </Label>
            <Input
              id="allowed_skips_per_month"
              type="number"
              min="0"
              max="31"
              {...register('allowed_skips_per_month', {
                setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
              })}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {t('pages.routineTasks.form.allowedSkipsHint')}
            </p>
            {errors.allowed_skips_per_month && (
              <p className="mt-xs text-sm text-destructive">
                {errors.allowed_skips_per_month.message}
              </p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.routineTasks.form.isActiveLabel')}
            </Label>
            <StatusToggle
              value={isActive ? 'true' : 'false'}
              options={[
                {
                  value: 'false',
                  label: t('common.status.inactive'),
                  activeClass: 'bg-background text-foreground shadow-sm',
                },
                {
                  value: 'true',
                  label: t('common.status.active'),
                  activeClass: 'bg-success/15 text-success shadow-sm',
                },
              ]}
              onChange={(v) => setValue('is_active', v === 'true')}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      {hasLinks && (
        <div className="space-y-md">
          <button
            type="button"
            onClick={() => setLinksOpen((o) => !o)}
            className="flex w-full items-center gap-xs text-left"
          >
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('common.form.sections.links')}
            </span>
            <div className="h-px flex-1 bg-border/50" />
            {linksOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {linksOpen && (
            <div className="grid grid-cols-1 gap-md md:grid-cols-2">
              {financialGoals.length > 0 && (
                <div className="space-y-sm">
                  <Label className="flex items-center gap-xs">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.routineTasks.form.linkedFinancialGoalLabel')}
                  </Label>
                  <Select
                    value={watch('linked_financial_goal')?.toString() ?? ''}
                    onValueChange={(value) =>
                      setValue(
                        'linked_financial_goal',
                        value && value !== 'none' ? parseInt(value) : null
                      )
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          'pages.routineTasks.form.linkedFinancialGoalPlaceholder'
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t('pages.routineTasks.form.linkedFinancialGoalPlaceholder')}
                      </SelectItem>
                      {financialGoals.map((goal) => (
                        <SelectItem key={goal.id} value={goal.id.toString()}>
                          {goal.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.routineTasks.form.linkedFinancialGoalHint')}
                  </p>
                </div>
              )}

              {readingBooksList.length > 0 && (
                <div className="space-y-sm">
                  <Label className="flex items-center gap-xs">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.routineTasks.form.linkedBookLabel')}
                  </Label>
                  <Select
                    value={watch('linked_book')?.toString() ?? ''}
                    onValueChange={(value) =>
                      setValue(
                        'linked_book',
                        value && value !== 'none' ? parseInt(value) : null
                      )
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('pages.routineTasks.form.linkedBookPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t('pages.routineTasks.form.linkedBookPlaceholder')}
                      </SelectItem>
                      {readingBooksList.map((book) => (
                        <SelectItem key={book.id} value={book.id.toString()}>
                          {book.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.routineTasks.form.linkedBookHint')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-sm border-t pt-md">
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
