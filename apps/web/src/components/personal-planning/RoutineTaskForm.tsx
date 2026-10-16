/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  ChevronDown,
  Clock,
  HelpCircle,
  Link2,
  Repeat,
  Settings2,
  Tag,
  Target,
  Save,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormSection } from '@/components/ui/form-section';
import { IconPicker } from '@/components/ui/icon-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
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
import { useScreenAccess } from '@/hooks/use-screen-access';
import { notifyFormErrors } from '@/lib/form-errors';
import { logger } from '@/lib/logger';
import { cn, formatLocalDate } from '@/lib/utils';
import { routineTaskSchema } from '@/lib/validations';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import { hydrationGoalService, mealTypeService } from '@/services/nutrition-service';
import { routineTasksService } from '@/services/routine-tasks-service';
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

  const {
    control,
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
          is_optional: task.is_optional ?? false,
          allowed_skips_per_month: task.allowed_skips_per_month ?? 0,
          target_quantity: task.target_quantity,
          unit: task.unit as RoutineTaskFormData['unit'],
          owner: task.owner,
          default_time: task.default_time ? task.default_time.substring(0, 5) : null,
          closing_time: task.closing_time ? task.closing_time.substring(0, 5) : null,
          daily_occurrences: task.daily_occurrences || 1,
          interval_hours: task.interval_hours || 0,
          scheduled_times: task.scheduled_times || null,
          linked_financial_goal: task.linked_financial_goal ?? null,
          linked_book: task.linked_book ?? null,
          linked_meal_type: task.linked_meal_type ?? null,
          linked_hydration_goal: task.linked_hydration_goal ?? null,
          linked_workout: task.linked_workout ?? false,
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
          is_optional: false,
          allowed_skips_per_month: 0,
          target_quantity: 1,
          unit: 'vez',
          owner: 0,
          default_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
          closing_time: null,
          interval_start_date: formatLocalDate(new Date()),
          daily_occurrences: 1,
          interval_hours: 0,
          scheduled_times: null,
          linked_financial_goal: null,
          linked_book: null,
          linked_meal_type: null,
          linked_hydration_goal: null,
          linked_workout: false,
        },
  });

  const periodicity = watch('periodicity');
  const isActive = watch('is_active');
  const isOptional = watch('is_optional');
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
        is_optional: task.is_optional ?? false,
        allowed_skips_per_month: task.allowed_skips_per_month ?? 0,
        target_quantity: task.target_quantity,
        unit: task.unit as RoutineTaskFormData['unit'],
        owner: task.owner,
        default_time: task.default_time ? task.default_time.substring(0, 5) : null,
        closing_time: task.closing_time ? task.closing_time.substring(0, 5) : null,
        daily_occurrences: task.daily_occurrences || 1,
        interval_hours: task.interval_hours || 0,
        scheduled_times: task.scheduled_times || null,
        linked_financial_goal: task.linked_financial_goal ?? null,
        linked_book: task.linked_book ?? null,
        linked_meal_type: task.linked_meal_type ?? null,
        linked_hydration_goal: task.linked_hydration_goal ?? null,
        linked_workout: task.linked_workout ?? false,
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

  const isIntellect = watch('category') === 'intellect';
  const isFinance = watch('category') === 'finance';
  // Vínculos com outros módulos só para quem tem a tela de destino
  const { can } = useScreenAccess();

  const { data: financialGoals = [] } = useQuery({
    queryKey: ['financial-goals-active'],
    queryFn: () => financialGoalsService.getAll({ is_active: 'true' }),
    staleTime: 60_000,
    enabled: isFinance && can('finance.financial_goals'),
  });

  const { data: readingBooksList = [] } = useQuery({
    queryKey: ['books-reading'],
    queryFn: () => booksService.getAll({ read_status: 'reading' }),
    staleTime: 60_000,
    enabled: isIntellect && can('intellect.books'),
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

  useEffect(() => {
    if (!isIntellect) setValue('linked_book', null);
  }, [isIntellect, setValue]);

  useEffect(() => {
    if (!isFinance) setValue('linked_financial_goal', null);
  }, [isFinance, setValue]);

  // Vínculos com Dieta: só para a categoria Nutrição (regra também no backend)
  const isNutrition = watch('category') === 'nutrition';
  const { data: mealTypes = [] } = useQuery({
    queryKey: ['meal-types', 'active'],
    queryFn: () => mealTypeService.getActive(),
    staleTime: 60_000,
    enabled: isNutrition && can('planning.nutrition'),
  });
  const { data: hydrationGoal } = useQuery({
    queryKey: ['hydration-goal'],
    queryFn: () => hydrationGoalService.get(),
    staleTime: 60_000,
    enabled: isNutrition,
  });
  const hydrationGoalId = hydrationGoal?.id ?? null;
  // Refeição ↔ tarefa é 1:1: refeições já vinculadas a outra tarefa ficam
  // desabilitadas (o backend também valida)
  const { data: allTasks = [] } = useQuery({
    queryKey: ['routine-tasks', 'all-pages'],
    queryFn: () => routineTasksService.getAllPages(),
    staleTime: 60_000,
    enabled: isNutrition,
  });
  const mealTypeTakenBy = new Map(
    allTasks
      .filter((other) => other.linked_meal_type && other.id !== task?.id)
      .map((other) => [other.linked_meal_type!, other.name])
  );
  const hasNutritionLinks = isNutrition && (mealTypes.length > 0 || !!hydrationGoalId);

  useEffect(() => {
    if (!isNutrition) {
      setValue('linked_meal_type', null);
      setValue('linked_hydration_goal', null);
    }
  }, [isNutrition, setValue]);

  const isExercise = watch('category') === 'exercise';
  useEffect(() => {
    if (!isExercise) setValue('linked_workout', false);
  }, [isExercise, setValue]);

  const hasLinks =
    (isFinance && financialGoals.length > 0) ||
    (isIntellect && readingBooksList.length > 0) ||
    hasNutritionLinks ||
    isExercise;

  return (
    <form onSubmit={handleSubmit(onSubmit, notifyFormErrors)} className="space-y-lg">
      <FormSection
        title={t('pages.routineTasks.form.sectionIdentification')}
        icon={CheckSquare}
      >
        <div className="gap-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-sm">
            <Label htmlFor="name" className="gap-xs flex items-center">
              <CheckSquare className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.nameLabel')}
            </Label>
            <Input
              aria-invalid={!!errors.name}
              id="name"
              {...register('name')}
              placeholder={t('pages.routineTasks.form.namePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="description" className="gap-xs flex items-center">
              <CheckSquare className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.descriptionLabel')}
            </Label>
            <Textarea
              aria-invalid={!!errors.description}
              id="description"
              {...register('description')}
              placeholder={t('pages.routineTasks.form.descriptionPlaceholder')}
              rows={1}
              className="min-h-0 resize-none"
              disabled={isLoading}
            />
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
              <SelectTrigger aria-invalid={!!errors.category}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_CATEGORIES.map((cat) => {
                  const CatIcon = TASK_CATEGORY_ICONS[cat.value];
                  return (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="gap-sm flex items-center">
                        {CatIcon && (
                          <CatIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                        )}
                        {translate('taskCategories', cat.value)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-sm">
            <Label htmlFor="icon" className="gap-xs flex items-center">
              <CheckSquare className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.routineTasks.form.iconLabel')}
            </Label>
            <IconPicker
              aria-invalid={!!errors.icon}
              value={watch('icon')}
              onChange={(value) => setValue('icon', value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Periodicidade à esquerda, Meta e Unidade à direita (a partir de lg) */}
      <div className="gap-lg grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FormSection
          title={t('pages.routineTasks.form.sectionPeriodicity')}
          icon={Repeat}
        >
          <div className="space-y-md">
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              <div
                className={cn(
                  'space-y-sm',
                  periodicity !== 'weekly' &&
                    periodicity !== 'monthly' &&
                    periodicity !== 'custom' &&
                    'md:col-span-2'
                )}
              >
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
                <Select
                  value={periodicity}
                  onValueChange={(value) => setValue('periodicity', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger aria-invalid={!!errors.periodicity}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODICITY_CHOICES.map((period) => {
                      const PeriodIcon = PERIODICITY_ICONS[period.value];
                      return (
                        <SelectItem
                          key={period.value}
                          value={period.value}
                          icon={
                            PeriodIcon ? <PeriodIcon className="h-4 w-4" /> : undefined
                          }
                        >
                          {t(
                            `pages.routineTasks.form.periodicityOptions.${period.value}`
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {periodicity === 'weekly' && (
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Repeat className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.routineTasks.form.weekdayLabel')}
                  </Label>
                  <Select
                    value={watch('weekday')?.toString() ?? ''}
                    onValueChange={(value) => setValue('weekday', parseInt(value, 10))}
                    disabled={isLoading}
                  >
                    <SelectTrigger aria-invalid={!!errors.weekday}>
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
                </div>
              )}

              {periodicity === 'monthly' && (
                <div className="space-y-sm">
                  <Label htmlFor="day_of_month" className="gap-xs flex items-center">
                    <Repeat className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.routineTasks.form.dayOfMonthLabel')}
                  </Label>
                  <Controller
                    control={control}
                    name="day_of_month"
                    render={({ field }) => (
                      <NumberStepper
                        aria-invalid={!!errors.day_of_month}
                        id="day_of_month"
                        disabled={isLoading}
                        placeholder="Ex.: 15"
                        min={1}
                        max={31}
                        optional
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? undefined)}
                        className="mx-auto"
                      />
                    )}
                  />
                </div>
              )}

              {periodicity === 'custom' && (
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Repeat className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.routineTasks.form.customWeekdaysLabel')}
                  </Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-invalid={!!errors.custom_weekdays}
                        className="w-full justify-between font-normal"
                        disabled={isLoading}
                      >
                        <span className="truncate">
                          {(watch('custom_weekdays')?.length ?? 0) === 0
                            ? t('pages.routineTasks.form.weekdayPlaceholder')
                            : (watch('custom_weekdays') ?? [])
                                .slice()
                                .sort((a, b) => a - b)
                                .map((d) =>
                                  t(`pages.routineTasks.form.weekdayOptions.${d}`)
                                )
                                .join(', ')}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
                    >
                      {WEEKDAY_CHOICES.map((day) => (
                        <DropdownMenuCheckboxItem
                          key={day.value}
                          checked={
                            watch('custom_weekdays')?.includes(day.value) || false
                          }
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(checked) => {
                            const current = watch('custom_weekdays') || [];
                            setValue(
                              'custom_weekdays',
                              checked
                                ? [...current, day.value]
                                : current.filter((d) => d !== day.value)
                            );
                          }}
                        >
                          {t(`pages.routineTasks.form.weekdayOptions.${day.value}`)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title={t('pages.routineTasks.form.sectionGoalUnit')} icon={Target}>
          <div className="gap-md grid grid-cols-1 md:grid-cols-2">
            <div className="space-y-sm">
              <Label
                htmlFor="target_quantity"
                className="gap-xs flex items-center justify-center"
              >
                <Target className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.targetQuantityLabel')}
                <Tooltip
                  content={t('pages.routineTasks.form.targetQuantityTooltip')}
                  side="right"
                >
                  <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                </Tooltip>
              </Label>
              <Controller
                control={control}
                name="target_quantity"
                render={({ field }) => (
                  <NumberStepper
                    aria-invalid={!!errors.target_quantity}
                    id="target_quantity"
                    disabled={isLoading}
                    min={1}
                    value={field.value}
                    onChange={field.onChange}
                    className="mx-auto"
                  />
                )}
              />
            </div>

            <div className="space-y-sm">
              <Label className="gap-xs flex items-center justify-center">
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
                <SelectTrigger aria-invalid={!!errors.unit} className="mx-auto w-fit">
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
            </div>
          </div>
        </FormSection>
      </div>

      <FormSection title={t('pages.routineTasks.form.scheduleSection')} icon={Clock}>
        <div className="space-y-md">
          <div className="gap-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-sm">
              <Label htmlFor="default_time" className="gap-xs flex items-center">
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.defaultTimeLabel')}
              </Label>
              <TimePicker
                aria-invalid={!!errors.default_time}
                value={watch('default_time') ?? undefined}
                onChange={(t) => setValue('default_time', t ?? null)}
                disabled={isLoading}
              />
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
                <SelectTrigger aria-invalid={!!errors.priority}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_CHOICES.map((p) => {
                    const PriorIcon = PRIORITY_ICONS[p.value];
                    return (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="gap-sm flex items-center">
                          {PriorIcon && <PriorIcon className="h-4 w-4" />}
                          {t(`pages.routineTasks.form.priorityOptions.${p.value}`)}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.isActiveLabel')}
              </Label>
              <StatusToggle
                value={isActive ? 'true' : 'false'}
                options={[
                  {
                    value: 'true',
                    label: t('common.status.active'),
                    accentColor: 'success',
                  },
                  {
                    value: 'false',
                    label: t('common.status.inactive'),
                  },
                ]}
                onChange={(v) => setValue('is_active', v === 'true')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.isOptionalLabel')}
                <Tooltip
                  content={t('pages.routineTasks.form.isOptionalHint')}
                  side="right"
                >
                  <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                </Tooltip>
              </Label>
              <StatusToggle
                value={isOptional ? 'true' : 'false'}
                options={[
                  {
                    value: 'false',
                    label: t('pages.routineTasks.form.isOptionalRequired'),
                    accentColor: 'success',
                  },
                  {
                    value: 'true',
                    label: t('pages.routineTasks.form.isOptionalOptional'),
                  },
                ]}
                onChange={(v) => setValue('is_optional', v === 'true')}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Advanced settings */}
          <div className="gap-xs flex w-full items-center">
            <Settings2 className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('pages.routineTasks.form.advancedSettings')}
            </span>
            <div className="bg-border/50 h-px flex-1" />
          </div>

          <div className="gap-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-sm">
              <Label
                htmlFor="daily_occurrences"
                className="gap-xs flex items-center justify-center"
              >
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.dailyOccurrencesLabel')}
                <Tooltip
                  content={t('pages.routineTasks.form.dailyOccurrencesHint')}
                  side="right"
                >
                  <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                </Tooltip>
              </Label>
              <Controller
                control={control}
                name="daily_occurrences"
                render={({ field }) => (
                  <NumberStepper
                    id="daily_occurrences"
                    disabled={isLoading}
                    min={1}
                    max={24}
                    value={field.value}
                    onChange={field.onChange}
                    className="mx-auto"
                  />
                )}
              />
            </div>

            <div className="space-y-sm">
              <Label
                htmlFor="interval_hours"
                className="gap-xs flex items-center justify-center"
              >
                <Clock className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.routineTasks.form.intervalHoursLabel')}
                <Tooltip
                  content={t('pages.routineTasks.form.intervalHoursHint')}
                  side="right"
                >
                  <HelpCircle className="text-muted-foreground/60 h-3 w-3 cursor-help" />
                </Tooltip>
              </Label>
              <NumberStepper
                aria-invalid={!!errors.interval_hours}
                id="interval_hours"
                min={0}
                max={23}
                optional
                value={watch('interval_hours')}
                onChange={(v) => setValue('interval_hours', v)}
                disabled={isLoading}
                className="mx-auto"
              />
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
                  aria-invalid={!!errors.closing_time}
                  value={watch('closing_time') ?? undefined}
                  onChange={(t) => setValue('closing_time', t ?? null)}
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="space-y-sm">
              <Label
                htmlFor="allowed_skips_per_month"
                className="gap-xs flex items-center justify-center"
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
              <Controller
                control={control}
                name="allowed_skips_per_month"
                render={({ field }) => (
                  <NumberStepper
                    aria-invalid={!!errors.allowed_skips_per_month}
                    id="allowed_skips_per_month"
                    disabled={isLoading}
                    min={0}
                    max={31}
                    value={field.value}
                    onChange={field.onChange}
                    className="mx-auto"
                  />
                )}
              />
            </div>
          </div>
        </div>
      </FormSection>

      {hasLinks && (
        <div className="space-y-md">
          <div className="gap-xs flex w-full items-center">
            <Link2 className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('common.form.sections.links')}
            </span>
            <div className="bg-border/50 h-px flex-1" />
          </div>

          <div className="gap-md grid grid-cols-1 md:grid-cols-2">
            {isFinance && financialGoals.length > 0 && (
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
              </div>
            )}

            {isIntellect && readingBooksList.length > 0 && (
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
              </div>
            )}

            {isNutrition && mealTypes.length > 0 && (
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Link2 className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.routineTasks.form.linkedMealTypeLabel')}
                </Label>
                <Select
                  value={watch('linked_meal_type')?.toString() ?? ''}
                  onValueChange={(value) => {
                    setValue(
                      'linked_meal_type',
                      value && value !== 'none' ? parseInt(value) : null
                    );
                    if (value && value !== 'none')
                      setValue('linked_hydration_goal', null);
                  }}
                  disabled={isLoading || !!watch('linked_hydration_goal')}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        'pages.routineTasks.form.linkedMealTypePlaceholder'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('pages.routineTasks.form.linkedMealTypePlaceholder')}
                    </SelectItem>
                    {mealTypes.map((mt) => (
                      <SelectItem
                        key={mt.id}
                        value={mt.id.toString()}
                        disabled={mealTypeTakenBy.has(mt.id)}
                      >
                        {mt.name}
                        {mealTypeTakenBy.has(mt.id) &&
                          ` · ${t('pages.routineTasks.form.linkedMealTypeTaken', {
                            task: mealTypeTakenBy.get(mt.id),
                          })}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isExercise && (
              <div className="gap-sm flex items-center">
                <Checkbox
                  id="linked-workout"
                  checked={!!watch('linked_workout')}
                  onCheckedChange={(checked) =>
                    setValue('linked_workout', checked === true)
                  }
                  disabled={isLoading}
                />
                <Label htmlFor="linked-workout" className="gap-xs flex items-center">
                  <Link2 className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.routineTasks.form.linkedWorkoutLabel')}
                </Label>
              </div>
            )}

            {isNutrition && hydrationGoalId && (
              <div className="space-y-sm">
                <div className="gap-sm flex items-center">
                  <Checkbox
                    id="linked-hydration-goal"
                    checked={!!watch('linked_hydration_goal')}
                    onCheckedChange={(checked) => {
                      setValue(
                        'linked_hydration_goal',
                        checked ? hydrationGoalId : null
                      );
                      if (checked) setValue('linked_meal_type', null);
                    }}
                    disabled={isLoading || !!watch('linked_meal_type')}
                  />
                  <Label
                    htmlFor="linked-hydration-goal"
                    className="gap-xs flex items-center"
                  >
                    <Link2 className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.routineTasks.form.linkedHydrationLabel')}
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Save className="h-4 w-4" />}
          {isLoading ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
