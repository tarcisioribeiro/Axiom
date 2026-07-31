/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
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
import { Tooltip } from '@/components/ui/tooltip';
import { translate } from '@/config/constants';
import { TASK_CATEGORY_ICONS, PRIORITY_ICONS, PERIODICITY_ICONS } from '@/config/icons';
import { logger } from '@/lib/logger';
import { cn, formatLocalDate } from '@/lib/utils';
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const frequencyPreview = (): string => {
    const weekdayNames = [
      t('pages.routineTasks.form.weekdayOptions.0').substring(0, 3),
      t('pages.routineTasks.form.weekdayOptions.1').substring(0, 3),
      t('pages.routineTasks.form.weekdayOptions.2').substring(0, 3),
      t('pages.routineTasks.form.weekdayOptions.3').substring(0, 3),
      t('pages.routineTasks.form.weekdayOptions.4').substring(0, 3),
      t('pages.routineTasks.form.weekdayOptions.5').substring(0, 3),
      t('pages.routineTasks.form.weekdayOptions.6').substring(0, 3),
    ];
    switch (periodicity) {
      case 'daily':
        return t('pages.routineTasks.form.frequencyPreview.daily');
      case 'weekdays':
        return t('pages.routineTasks.form.frequencyPreview.weekdays');
      case 'weekly': {
        const wd = watch('weekday');
        return wd != null
          ? t('pages.routineTasks.form.frequencyPreview.weekly', {
              day: weekdayNames[wd],
            })
          : '';
      }
      case 'monthly': {
        const dom = watch('day_of_month');
        return dom !== undefined
          ? t('pages.routineTasks.form.frequencyPreview.monthly', { day: dom })
          : '';
      }
      case 'custom': {
        const cwd = watch('custom_weekdays');
        if (cwd && cwd.length > 0) {
          return cwd.map((d) => weekdayNames[d]).join(', ');
        }
        return t('pages.routineTasks.form.frequencyPreview.custom');
      }
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection
        title={t('pages.routineTasks.form.sectionIdentification')}
        icon={CheckSquare}
      >
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="name" className="gap-xs flex items-center">
              <CheckSquare className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.routineTasks.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="description" className="gap-xs flex items-center">
              <CheckSquare className="text-muted-foreground h-3.5 w-3.5" />
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
              <p className="mt-xs text-destructive text-sm">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Tag className="text-muted-foreground h-3.5 w-3.5" />
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
              <p className="mt-xs text-destructive text-sm">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="icon" className="gap-xs flex items-center">
              <CheckSquare className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.iconLabel')}
            </Label>
            <IconPicker
              value={watch('icon')}
              onChange={(value) => setValue('icon', value)}
            />
            {errors.icon && (
              <p className="mt-xs text-destructive text-sm">{errors.icon.message}</p>
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
            <Label className="gap-xs flex items-center">
              <Repeat className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.periodicityLabel')}
              <Tooltip
                content={t('pages.routineTasks.form.periodicityTooltip')}
                side="right"
              >
                <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
              </Tooltip>
            </Label>
            <div className="border-border/70 bg-muted/30 flex rounded-md border p-0.5">
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
            {frequencyPreview() && (
              <p className="text-primary text-xs font-medium">{frequencyPreview()}</p>
            )}
            {errors.periodicity && (
              <p className="mt-xs text-destructive text-sm">
                {errors.periodicity.message}
              </p>
            )}
          </div>

          {periodicity === 'weekly' && (
            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <Repeat className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.weekdayLabel')}
              </Label>
              <div className="gap-xs flex">
                {WEEKDAY_CHOICES.map((day) => {
                  const isSelected = watch('weekday') === day.value;
                  return (
                    <button
                      key={day.value}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setValue('weekday', day.value)}
                      className={cn(
                        'flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      {t(
                        `pages.routineTasks.form.weekdayOptions.${day.value}`
                      ).substring(0, 3)}
                    </button>
                  );
                })}
              </div>
              {errors.weekday && (
                <p className="mt-xs text-destructive text-sm">
                  {errors.weekday.message}
                </p>
              )}
            </div>
          )}

          {periodicity === 'monthly' && (
            <div className="space-y-sm">
              <Label htmlFor="day_of_month" className="gap-xs flex items-center">
                <Repeat className="text-muted-foreground h-3.5 w-3.5" />
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
                <p className="mt-xs text-destructive text-sm">
                  {errors.day_of_month.message}
                </p>
              )}
            </div>
          )}

          {periodicity === 'weekdays' && (
            <p className="text-muted-foreground text-sm">
              {t('pages.routineTasks.form.weekdaysNote')}
            </p>
          )}

          {periodicity === 'custom' && (
            <div className="space-y-md bg-muted/50 p-md rounded-lg border">
              <h4 className="gap-xs flex items-center text-sm font-medium">
                <Repeat className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.customSection')}
              </h4>

              <div>
                <Label className="text-sm">
                  {t('pages.routineTasks.form.customWeekdaysLabel')}
                </Label>
                <div className="mt-sm gap-sm grid grid-cols-7">
                  {WEEKDAY_CHOICES.map((day) => (
                    <div key={day.value} className="gap-xs flex flex-col items-center">
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

              <div className="gap-md grid grid-cols-2">
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

              <div className="gap-md grid grid-cols-2">
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
                <p className="text-destructive text-sm">
                  {errors.interval_start_date.message}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.routineTasks.form.sectionGoalUnit')} icon={Target}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="target_quantity" className="gap-xs flex items-center">
              <Target className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.targetQuantityLabel')}
              <Tooltip
                content={t('pages.routineTasks.form.targetQuantityTooltip')}
                side="right"
              >
                <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
              </Tooltip>
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
              <p className="mt-xs text-destructive text-sm">
                {errors.target_quantity.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Target className="text-muted-foreground h-3.5 w-3.5" />
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
              <p className="mt-xs text-destructive text-sm">{errors.unit.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.routineTasks.form.scheduleSection')} icon={Clock}>
        <div className="space-y-md">
          <p className="text-muted-foreground text-xs">
            {t('pages.routineTasks.form.scheduleSectionNote')}
          </p>

          <div className="gap-md grid grid-cols-1 md:grid-cols-2">
            <div className="space-y-sm">
              <Label htmlFor="default_time" className="gap-xs flex items-center">
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.defaultTimeLabel')}
              </Label>
              <TimePicker
                value={watch('default_time') ?? undefined}
                onChange={(t) => setValue('default_time', t ?? null)}
                disabled={isLoading}
              />
              <p className="text-muted-foreground text-xs">
                {t('pages.routineTasks.form.defaultTimeHint')}
              </p>
              {errors.default_time && (
                <p className="mt-xs text-destructive text-sm">
                  {errors.default_time.message}
                </p>
              )}
            </div>

            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
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
                <p className="mt-xs text-destructive text-sm">
                  {errors.priority.message}
                </p>
              )}
            </div>

            <div className="space-y-sm md:col-span-2">
              <Label className="gap-xs flex items-center">
                <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
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

          {/* Advanced settings toggle */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="gap-xs flex w-full items-center text-left"
          >
            <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('pages.routineTasks.form.advancedSettings')}
            </span>
            <div className="bg-border/50 h-px flex-1" />
            {advancedOpen ? (
              <ChevronUp className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </button>

          {advancedOpen && (
            <div className="gap-md bg-muted/20 p-md grid grid-cols-1 rounded-lg border md:grid-cols-2">
              <div className="space-y-sm">
                <Label htmlFor="daily_occurrences" className="gap-xs flex items-center">
                  <Clock className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.routineTasks.form.dailyOccurrencesLabel')}
                  <Tooltip
                    content={t('pages.routineTasks.form.dailyOccurrencesHint')}
                    side="right"
                  >
                    <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                  </Tooltip>
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
              </div>

              <div className="space-y-sm">
                <Label htmlFor="interval_hours" className="gap-xs flex items-center">
                  <Clock className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.routineTasks.form.intervalHoursLabel')}
                  <Tooltip
                    content={t('pages.routineTasks.form.intervalHoursHint')}
                    side="right"
                  >
                    <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                  </Tooltip>
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
                {errors.interval_hours && (
                  <p className="mt-xs text-destructive text-sm">
                    {errors.interval_hours.message}
                  </p>
                )}
              </div>

              {(dailyOccurrences ?? 1) === 1 && (
                <div className="space-y-sm">
                  <Label htmlFor="closing_time" className="gap-xs flex items-center">
                    <Clock className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.routineTasks.form.closingTimeLabel')}
                    <Tooltip
                      content={t('pages.routineTasks.form.closingTimeHint')}
                      side="right"
                    >
                      <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                    </Tooltip>
                  </Label>
                  <TimePicker
                    value={watch('closing_time') ?? undefined}
                    onChange={(t) => setValue('closing_time', t ?? null)}
                    disabled={isLoading}
                  />
                  {errors.closing_time && (
                    <p className="mt-xs text-destructive text-sm">
                      {errors.closing_time.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-sm">
                <Label
                  htmlFor="allowed_skips_per_month"
                  className="gap-xs flex items-center"
                >
                  <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.routineTasks.form.allowedSkipsLabel')}
                  <Tooltip
                    content={t('pages.routineTasks.form.allowedSkipsHint')}
                    side="right"
                  >
                    <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                  </Tooltip>
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
                {errors.allowed_skips_per_month && (
                  <p className="mt-xs text-destructive text-sm">
                    {errors.allowed_skips_per_month.message}
                  </p>
                )}
              </div>

              <div className="space-y-sm md:col-span-2">
                <Label htmlFor="scheduled_times" className="gap-xs flex items-center">
                  <Clock className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.routineTasks.form.scheduledTimesLabel')}
                  <Tooltip
                    content={t('pages.routineTasks.form.scheduledTimesHint')}
                    side="right"
                  >
                    <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                  </Tooltip>
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
                {errors.scheduled_times && (
                  <p className="mt-xs text-destructive text-sm">
                    {errors.scheduled_times.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </FormSection>

      {hasLinks && (
        <div className="space-y-md">
          <button
            type="button"
            onClick={() => setLinksOpen((o) => !o)}
            className="gap-xs flex w-full items-center text-left"
          >
            <Link2 className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('common.form.sections.links')}
            </span>
            <div className="bg-border/50 h-px flex-1" />
            {linksOpen ? (
              <ChevronUp className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </button>

          {linksOpen && (
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              {financialGoals.length > 0 && (
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Link2 className="text-muted-foreground h-3.5 w-3.5" />
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
                  <p className="text-muted-foreground text-xs">
                    {t('pages.routineTasks.form.linkedFinancialGoalHint')}
                  </p>
                </div>
              )}

              {readingBooksList.length > 0 && (
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Link2 className="text-muted-foreground h-3.5 w-3.5" />
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
                  <p className="text-muted-foreground text-xs">
                    {t('pages.routineTasks.form.linkedBookHint')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
