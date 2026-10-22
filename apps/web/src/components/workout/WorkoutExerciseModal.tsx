/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Gauge,
  Minus,
  Repeat,
  Timer,
  Save,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/ui/decimal-input';
import { FormSection } from '@/components/ui/form-section';
import { NumberStepper } from '@/components/ui/number-stepper';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusToggle } from '@/components/ui/status-toggle';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { degradedReps } from '@/lib/workout-reps';
import type {
  Exercise,
  SetTarget,
  WorkoutCategory,
  WorkoutExercise,
} from '@/types/workout';

interface FormValues {
  exercise_id: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  load: string;
  load_unit: string;
  notes: string;
  execution_count: number | null;
  duration_seconds: number | null;
  is_lateral: boolean;
  avg_speed: string;
  incline_percent: string;
  has_speed_intervals: boolean;
  interval_seconds: number | null;
  interval_count: number | null;
  interval_speed_high: string;
  interval_speed_low: string;
}

interface WorkoutExerciseModalProps {
  category: WorkoutCategory;
  exercises: Exercise[];
  existing?: WorkoutExercise;
  nextOrder: number;
  onSubmit: (data: {
    exercise: number;
    name: string;
    sets: number;
    reps_min: number;
    reps_max: number;
    rest_seconds: number | null;
    load: string | null;
    load_unit: string;
    set_targets: SetTarget[];
    order: number;
    notes: string | null;
    execution_count: number | null;
    duration_seconds: number | null;
    is_lateral: boolean;
    avg_speed: string | null;
    incline_percent: string | null;
    has_speed_intervals: boolean;
    interval_seconds: number | null;
    interval_count: number | null;
    interval_speed_high: string | null;
    interval_speed_low: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  /** Último peso da tela de Medidas, exibido quando a carga é peso corporal. */
  bodyWeightKg?: string | number | null;
}

const LOAD_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
  { value: 'bw', label: 'Peso Corp.' },
];

const REST_PRESETS = [30, 60, 90, 120, 180];

function CounterInput({
  value,
  onChange,
  min = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="gap-xs flex flex-col items-center">
      <span className="text-muted-foreground text-2xs font-semibold tracking-wider whitespace-nowrap uppercase">
        {label}
      </span>
      <div className="border-border bg-background flex flex-col items-center rounded-lg border">
        <PlainButton
          aria-label={t('common.actions.increase')}
          type="button"
          onClick={() => onChange(value + 1)}
          className="border-border text-muted-foreground hover:bg-primary/10 hover:text-primary flex h-8 w-10 items-center justify-center rounded-t-lg border-b transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </PlainButton>
        <span className="text-foreground flex h-10 w-10 items-center justify-center text-lg font-bold tabular-nums">
          {value}
        </span>
        <PlainButton
          aria-label={t('common.actions.decrease')}
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="border-border text-muted-foreground hover:bg-primary/10 hover:text-primary flex h-8 w-10 items-center justify-center rounded-b-lg border-t transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </PlainButton>
      </div>
    </div>
  );
}

export function WorkoutExerciseModal({
  category,
  exercises,
  existing,
  nextOrder,
  onSubmit,
  onCancel,
  isLoading = false,
  bodyWeightKg = null,
}: WorkoutExerciseModalProps) {
  const { t, i18n } = useTranslation();
  const [setTargets, setSetTargets] = useState<SetTarget[]>(
    existing?.set_targets ?? []
  );
  const updateSetTarget = (idx: number, patch: Partial<SetTarget>) =>
    setSetTargets((prev) => {
      const next = [...prev];
      for (let i = next.length; i <= idx; i++) next.push({ reps: null, load: null });
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    existing ? (exercises.find((e) => e.id === existing.exercise) ?? null) : null
  );

  const { handleSubmit, setValue, watch, control } = useForm<FormValues>({
    defaultValues: {
      exercise_id: existing?.exercise ?? 0,
      sets: existing?.sets ?? 3,
      reps_min: existing?.reps_min ?? 8,
      reps_max: existing?.reps_max ?? 12,
      rest_seconds: existing?.rest_seconds ?? 60,
      load: existing?.load ?? '',
      load_unit: existing?.load_unit ?? 'kg',
      notes: existing?.notes ?? '',
      execution_count: existing?.execution_count ?? null,
      duration_seconds: existing?.duration_seconds ?? null,
      is_lateral: existing?.is_lateral ?? false,
      avg_speed: existing?.avg_speed ?? '',
      incline_percent: existing?.incline_percent ?? '',
      has_speed_intervals: existing?.has_speed_intervals ?? false,
      interval_seconds: existing?.interval_seconds ?? null,
      interval_count: existing?.interval_count ?? null,
      interval_speed_high: existing?.interval_speed_high ?? '',
      interval_speed_low: existing?.interval_speed_low ?? '',
    },
  });

  const loadUnit = useWatch({ control, name: 'load_unit' });
  const sets = watch('sets');
  const repsMin = watch('reps_min');
  const repsMax = watch('reps_max');
  const restSeconds = watch('rest_seconds');
  const isLateral = watch('is_lateral');
  const hasSpeedIntervals = watch('has_speed_intervals');

  useEffect(() => {
    if (selectedExercise) setValue('exercise_id', selectedExercise.id);
  }, [selectedExercise, setValue]);

  const [exerciseInvalid, setExerciseInvalid] = useState(false);

  const handleFormSubmit = async (data: FormValues) => {
    if (!selectedExercise) {
      setExerciseInvalid(true);
      toast({
        title: t('common.fieldRequired', {
          field: t('pages.workoutPlans.selectExercise'),
        }),
        variant: 'destructive',
      });
      return;
    }
    const isResistance = category === 'resistance';
    const targets = isResistance
      ? Array.from({ length: data.sets }, (_, i) => ({
          // Série vazia grava a sugestão (máximo → mínimo ao longo das séries)
          reps:
            setTargets[i]?.reps ??
            degradedReps(i, data.sets, data.reps_min, data.reps_max),
          load: data.load_unit === 'bw' ? null : (setTargets[i]?.load ?? null),
        }))
      : [];
    await onSubmit({
      exercise: selectedExercise.id,
      name: selectedExercise.name,
      sets: isResistance ? data.sets : 0,
      reps_min: isResistance ? data.reps_min : 0,
      reps_max: isResistance ? data.reps_max : 0,
      rest_seconds: isResistance && data.rest_seconds > 0 ? data.rest_seconds : null,
      load: isResistance ? data.load || null : null,
      load_unit: data.load_unit,
      set_targets: targets.some((st) => st.reps != null || st.load != null)
        ? targets
        : [],
      order: existing?.order ?? nextOrder,
      notes: data.notes || null,
      execution_count: category === 'mobility' ? data.execution_count : null,
      duration_seconds:
        category === 'mobility' || category === 'cardio' ? data.duration_seconds : null,
      is_lateral: category === 'mobility' ? data.is_lateral : false,
      avg_speed: category === 'cardio' ? data.avg_speed || null : null,
      incline_percent: category === 'cardio' ? data.incline_percent || null : null,
      has_speed_intervals: category === 'cardio' ? data.has_speed_intervals : false,
      interval_seconds:
        category === 'cardio' && data.has_speed_intervals
          ? data.interval_seconds
          : null,
      interval_count:
        category === 'cardio' && data.has_speed_intervals ? data.interval_count : null,
      interval_speed_high:
        category === 'cardio' && data.has_speed_intervals
          ? data.interval_speed_high || null
          : null,
      interval_speed_low:
        category === 'cardio' && data.has_speed_intervals
          ? data.interval_speed_low || null
          : null,
    });
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(handleFormSubmit)}
      className="gap-md flex min-h-0 flex-1 flex-col"
    >
      {/* Só os campos rolam; título (DialogHeader) e rodapé ficam fixos */}
      <div className="space-y-lg px-xs">
        <FormSection title={t('pages.workoutPlans.selectExercise')} icon={Dumbbell}>
          <Select
            value={selectedExercise ? String(selectedExercise.id) : undefined}
            onValueChange={(id) => {
              setSelectedExercise(exercises.find((e) => String(e.id) === id) ?? null);
              setExerciseInvalid(false);
            }}
            disabled={exercises.length === 0}
          >
            <SelectTrigger
              aria-label={t('pages.workoutPlans.selectExercise')}
              aria-invalid={exerciseInvalid}
            >
              <SelectValue
                placeholder={
                  exercises.length === 0
                    ? t('pages.exercises.empty')
                    : t('pages.workoutPlans.selectExercise')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((ex) => (
                <SelectItem key={ex.id} value={String(ex.id)}>
                  {ex.name}
                  {ex.muscle_groups && (
                    <span className="text-muted-foreground ml-xs text-xs">
                      · {ex.muscle_groups}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSection>

        {/* Séries, descanso e carga lado a lado — só faz sentido em resistência */}
        {category === 'resistance' && (
          <div className="gap-lg grid md:grid-cols-3">
            {/* Séries e repetições */}
            <FormSection
              title={
                t('pages.workoutPlans.sets') + ' & ' + t('pages.workoutPlans.repsMin')
              }
              icon={Dumbbell}
            >
              <div className="gap-lg py-xs flex items-start justify-center">
                <CounterInput
                  value={sets}
                  onChange={(v) => setValue('sets', v)}
                  min={0}
                  label={t('pages.workoutPlans.sets')}
                />
                <div className="gap-md flex items-end">
                  <CounterInput
                    value={repsMin}
                    onChange={(v) => setValue('reps_min', Math.min(v, repsMax))}
                    min={0}
                    label={t('pages.workoutPlans.repsMin')}
                  />
                  {/* Mesma altura do corpo do contador (h-8 + h-10 + h-8): "–" no meio */}
                  <span className="text-muted-foreground flex h-[6.5rem] items-center text-xs font-medium">
                    –
                  </span>
                  <CounterInput
                    value={repsMax}
                    onChange={(v) => setValue('reps_max', Math.max(v, repsMin))}
                    min={0}
                    label={t('pages.workoutPlans.repsMax')}
                  />
                </div>
              </div>
            </FormSection>

            {/* Descanso entre séries */}
            <FormSection
              title={t('pages.workoutPlans.restSeconds', 'Descanso entre séries')}
              icon={Timer}
              // Seções da linha esticam até a mais alta (contadores): opções no meio
              className="flex flex-col"
              contentClassName="flex flex-1 items-center justify-center"
            >
              <div className="gap-xs flex flex-wrap justify-center">
                {REST_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setValue('rest_seconds', preset)}
                    className={cn(
                      'px-sm py-xs rounded-lg border text-xs font-semibold transition',
                      restSeconds === preset
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
                    )}
                  >
                    {preset}s
                  </button>
                ))}
              </div>
            </FormSection>

            {/* Carga */}
            <FormSection
              title={t('pages.workoutPlans.load')}
              icon={Minus}
              className="flex flex-col"
              contentClassName="flex flex-1 items-center justify-center"
            >
              <div className="gap-sm flex items-center">
                <Controller
                  control={control}
                  name="load"
                  render={({ field }) => (
                    <DecimalInput
                      decimals={1}
                      step={0.5}
                      placeholder="0"
                      aria-label={t('pages.workoutPlans.load')}
                      value={field.value}
                      onChange={(v) => field.onChange(v === null ? '' : String(v))}
                      className="w-36"
                    />
                  )}
                />
                <div className="gap-xs flex">
                  {LOAD_UNITS.map((unit) => (
                    <button
                      key={unit.value}
                      type="button"
                      onClick={() => setValue('load_unit', unit.value)}
                      className={cn(
                        'px-sm py-xs rounded-lg border text-xs font-semibold transition',
                        loadUnit === unit.value
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
                      )}
                    >
                      {unit.label}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>
          </div>
        )}

        {/* Mobilidade: quantidade de execuções e/ou tempo, e lateralidade */}
        {category === 'mobility' && (
          <div className="gap-lg grid md:grid-cols-3">
            <FormSection title={t('pages.workoutPlans.executionCount')} icon={Repeat}>
              <div className="py-xs flex items-center justify-center">
                <Controller
                  control={control}
                  name="execution_count"
                  render={({ field }) => (
                    <NumberStepper
                      optional
                      aria-label={t('pages.workoutPlans.executionCount')}
                      value={field.value}
                      onChange={field.onChange}
                      min={0}
                      className="w-full"
                    />
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title={t('pages.workoutPlans.executionDurationSeconds')}
              icon={Timer}
            >
              <div className="py-xs flex items-center justify-center">
                <Controller
                  control={control}
                  name="duration_seconds"
                  render={({ field }) => (
                    <NumberStepper
                      optional
                      aria-label={t('pages.workoutPlans.executionDurationSeconds')}
                      value={field.value}
                      onChange={field.onChange}
                      min={0}
                      className="w-full"
                    />
                  )}
                />
              </div>
            </FormSection>

            <FormSection
              title={t('pages.workoutPlans.isLateral')}
              icon={Repeat}
              className="flex flex-col"
              contentClassName="flex flex-1 items-center justify-center"
            >
              <StatusToggle
                value={isLateral ? 'true' : 'false'}
                options={[
                  { value: 'true', label: t('common.actions.yes') },
                  { value: 'false', label: t('common.actions.no') },
                ]}
                onChange={(v) => setValue('is_lateral', v === 'true')}
              />
            </FormSection>
          </div>
        )}

        {/* Cardio: velocidade, inclinação, duração e alternância de intensidade */}
        {category === 'cardio' && (
          <>
            <div className="gap-lg grid md:grid-cols-4">
              <FormSection title={t('pages.workoutPlans.avgSpeed')} icon={Gauge}>
                <div className="py-xs flex items-center justify-center">
                  <Controller
                    control={control}
                    name="avg_speed"
                    render={({ field }) => (
                      <DecimalInput
                        decimals={1}
                        step={0.5}
                        placeholder="0"
                        unit="km/h"
                        aria-label={t('pages.workoutPlans.avgSpeed')}
                        value={field.value}
                        onChange={(v) => field.onChange(v === null ? '' : String(v))}
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title={t('pages.workoutPlans.inclinePercent')} icon={Minus}>
                <div className="py-xs flex items-center justify-center">
                  <Controller
                    control={control}
                    name="incline_percent"
                    render={({ field }) => (
                      <DecimalInput
                        decimals={1}
                        step={0.5}
                        placeholder="0"
                        unit="%"
                        aria-label={t('pages.workoutPlans.inclinePercent')}
                        value={field.value}
                        onChange={(v) => field.onChange(v === null ? '' : String(v))}
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </FormSection>

              <FormSection
                title={t('pages.workoutPlans.exerciseDurationSeconds')}
                icon={Timer}
              >
                <div className="py-xs flex items-center justify-center">
                  <Controller
                    control={control}
                    name="duration_seconds"
                    render={({ field }) => (
                      <NumberStepper
                        optional
                        aria-label={t('pages.workoutPlans.exerciseDurationSeconds')}
                        value={field.value}
                        onChange={field.onChange}
                        min={0}
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </FormSection>

              <FormSection
                title={t('pages.workoutPlans.hasSpeedIntervals')}
                icon={Repeat}
                className="flex flex-col"
                contentClassName="flex flex-1 items-center justify-center"
              >
                <StatusToggle
                  value={hasSpeedIntervals ? 'true' : 'false'}
                  options={[
                    { value: 'true', label: t('common.actions.yes') },
                    { value: 'false', label: t('common.actions.no') },
                  ]}
                  onChange={(v) => setValue('has_speed_intervals', v === 'true')}
                />
              </FormSection>
            </div>

            {hasSpeedIntervals && (
              <div className="gap-lg grid md:grid-cols-4">
                <FormSection
                  title={t('pages.workoutPlans.intervalCount')}
                  icon={Repeat}
                >
                  <div className="py-xs flex items-center justify-center">
                    <Controller
                      control={control}
                      name="interval_count"
                      render={({ field }) => (
                        <NumberStepper
                          optional
                          aria-label={t('pages.workoutPlans.intervalCount')}
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title={t('pages.workoutPlans.intervalSeconds')}
                  icon={Timer}
                >
                  <div className="py-xs flex items-center justify-center">
                    <Controller
                      control={control}
                      name="interval_seconds"
                      render={({ field }) => (
                        <NumberStepper
                          optional
                          aria-label={t('pages.workoutPlans.intervalSeconds')}
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title={t('pages.workoutPlans.intervalSpeedHigh')}
                  icon={Gauge}
                >
                  <div className="py-xs flex items-center justify-center">
                    <Controller
                      control={control}
                      name="interval_speed_high"
                      render={({ field }) => (
                        <DecimalInput
                          decimals={1}
                          step={0.5}
                          placeholder="0"
                          unit="km/h"
                          aria-label={t('pages.workoutPlans.intervalSpeedHigh')}
                          value={field.value}
                          onChange={(v) => field.onChange(v === null ? '' : String(v))}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title={t('pages.workoutPlans.intervalSpeedLow')}
                  icon={Gauge}
                >
                  <div className="py-xs flex items-center justify-center">
                    <Controller
                      control={control}
                      name="interval_speed_low"
                      render={({ field }) => (
                        <DecimalInput
                          decimals={1}
                          step={0.5}
                          placeholder="0"
                          unit="km/h"
                          aria-label={t('pages.workoutPlans.intervalSpeedLow')}
                          value={field.value}
                          onChange={(v) => field.onChange(v === null ? '' : String(v))}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </FormSection>
              </div>
            )}
          </>
        )}

        {/* Carga e repetições por série */}
        {category === 'resistance' && sets > 0 && (
          <FormSection title={t('pages.workoutPlans.perSetTitle')} icon={Dumbbell}>
            <div className="space-y-xs">
              <div className="gap-xs px-xs text-muted-foreground grid grid-cols-[3.5rem_1fr_1fr] text-center text-xs font-medium">
                <span>{t('pages.workoutPlans.setLabel')}</span>
                <span>{t('pages.workoutPlans.repsShort')}</span>
                <span>{t('pages.workoutPlans.load')}</span>
              </div>
              {Array.from({ length: sets }, (_, i) => (
                <div
                  key={i}
                  className="gap-xs grid grid-cols-[3.5rem_1fr_1fr] items-center"
                >
                  <span className="text-muted-foreground text-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <NumberStepper
                    optional
                    aria-label={`${t('pages.workoutPlans.setLabel')} ${i + 1} — ${t('pages.workoutPlans.repsShort')}`}
                    placeholder={String(degradedReps(i, sets, repsMin, repsMax))}
                    value={setTargets[i]?.reps ?? null}
                    onChange={(v) => updateSetTarget(i, { reps: v })}
                    className="w-full"
                  />
                  {loadUnit === 'bw' ? (
                    <span className="text-muted-foreground text-center text-xs">
                      {t('pages.workoutPlans.bodyweight')}
                      {bodyWeightKg != null &&
                        ` - ${Number(bodyWeightKg).toLocaleString(i18n.language)} kg`}
                    </span>
                  ) : (
                    <DecimalInput
                      decimals={1}
                      step={0.5}
                      aria-label={`${t('pages.workoutPlans.setLabel')} ${i + 1} — ${t('pages.workoutPlans.load')}`}
                      placeholder={watch('load') || '0'}
                      value={setTargets[i]?.load}
                      onChange={(v) =>
                        updateSetTarget(i, { load: v === null ? null : String(v) })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </FormSection>
        )}
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
