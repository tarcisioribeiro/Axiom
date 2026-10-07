/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
  Minus,
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
import { cn } from '@/lib/utils';
import { degradedReps } from '@/lib/workout-reps';
import type { Exercise, SetTarget, WorkoutExercise } from '@/types/workout';

interface FormValues {
  exercise_id: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  load: string;
  load_unit: string;
  notes: string;
}

interface WorkoutExerciseModalProps {
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
    },
  });

  const loadUnit = useWatch({ control, name: 'load_unit' });
  const sets = watch('sets');
  const repsMin = watch('reps_min');
  const repsMax = watch('reps_max');
  const restSeconds = watch('rest_seconds');

  useEffect(() => {
    if (selectedExercise) setValue('exercise_id', selectedExercise.id);
  }, [selectedExercise, setValue]);

  const handleFormSubmit = async (data: FormValues) => {
    if (!selectedExercise) return;
    const targets = Array.from({ length: data.sets }, (_, i) => ({
      // Série vazia grava a sugestão (máximo → mínimo ao longo das séries)
      reps:
        setTargets[i]?.reps ?? degradedReps(i, data.sets, data.reps_min, data.reps_max),
      load: data.load_unit === 'bw' ? null : (setTargets[i]?.load ?? null),
    }));
    await onSubmit({
      exercise: selectedExercise.id,
      name: selectedExercise.name,
      sets: data.sets,
      reps_min: data.reps_min,
      reps_max: data.reps_max,
      rest_seconds: data.rest_seconds > 0 ? data.rest_seconds : null,
      load: data.load || null,
      load_unit: data.load_unit,
      set_targets: targets.some((st) => st.reps != null || st.load != null)
        ? targets
        : [],
      order: existing?.order ?? nextOrder,
      notes: data.notes || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="gap-md flex min-h-0 flex-1 flex-col"
    >
      {/* Só os campos rolam; título (DialogHeader) e rodapé ficam fixos */}
      <div className="space-y-lg px-xs min-h-0 flex-1 overflow-y-auto">
        <FormSection title={t('pages.workoutPlans.selectExercise')} icon={Dumbbell}>
          <Select
            value={selectedExercise ? String(selectedExercise.id) : undefined}
            onValueChange={(id) =>
              setSelectedExercise(exercises.find((e) => String(e.id) === id) ?? null)
            }
            disabled={exercises.length === 0}
          >
            <SelectTrigger aria-label={t('pages.workoutPlans.selectExercise')}>
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

        {/* Séries, descanso e carga lado a lado */}
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

        {/* Carga e repetições por série */}
        {sets > 0 && (
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
        <Button type="submit" disabled={isLoading || !selectedExercise}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
