/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
  Minus,
  Plus,
  Search,
  StickyNote,
  Timer,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Exercise, WorkoutExercise } from '@/types/workout';

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
    order: number;
    notes: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const LOAD_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
  { value: 'bw', label: 'Peso Corp.' },
];

const REST_PRESETS = [0, 30, 60, 90, 120, 180];

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
  return (
    <div className="gap-xs flex flex-col items-center">
      <span className="text-muted-foreground text-2xs font-semibold tracking-wider uppercase">
        {label}
      </span>
      <div className="border-border bg-background flex flex-col items-center rounded-lg border shadow-sm">
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="border-border text-muted-foreground hover:bg-category-exercise/10 hover:text-category-exercise flex h-8 w-10 items-center justify-center rounded-t-lg border-b transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <span className="text-foreground flex h-10 w-10 items-center justify-center text-lg font-bold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="border-border text-muted-foreground hover:bg-category-exercise/10 hover:text-category-exercise flex h-8 w-10 items-center justify-center rounded-b-lg border-t transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
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
}: WorkoutExerciseModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showNotes, setShowNotes] = useState(!!existing?.notes);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    existing ? (exercises.find((e) => e.id === existing.exercise) ?? null) : null
  );

  const { register, handleSubmit, setValue, watch, control } = useForm<FormValues>({
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

  const filtered = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.muscle_groups ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleFormSubmit = async (data: FormValues) => {
    if (!selectedExercise) return;
    await onSubmit({
      exercise: selectedExercise.id,
      name: selectedExercise.name,
      sets: data.sets,
      reps_min: data.reps_min,
      reps_max: data.reps_max,
      rest_seconds: data.rest_seconds > 0 ? data.rest_seconds : null,
      load: data.load || null,
      load_unit: data.load_unit,
      order: existing?.order ?? nextOrder,
      notes: data.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header */}
      <div className="gap-md bg-category-exercise/10 px-md py-sm ring-category-exercise/20 flex items-center rounded-lg ring-1">
        <div className="bg-category-exercise/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Dumbbell className="text-category-exercise h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-category-exercise text-sm font-semibold">
            {existing
              ? t('pages.workoutPlans.editExerciseTitle')
              : t('pages.workoutPlans.addExerciseTitle')}
          </p>
          {selectedExercise ? (
            <p className="text-muted-foreground truncate text-xs">
              {selectedExercise.name}
              {selectedExercise.muscle_groups && (
                <span className="ml-xs opacity-60">
                  · {selectedExercise.muscle_groups}
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {t('pages.workoutPlans.selectExercise')}
            </p>
          )}
        </div>
      </div>

      {/* Seleção de exercício */}
      <FormSection title={t('pages.workoutPlans.selectExercise')} icon={Search}>
        <div className="space-y-xs">
          <div className="relative">
            <Search className="left-sm text-muted-foreground absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('pages.workoutPlans.searchExercise')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-input bg-background pr-sm focus:ring-ring w-full rounded-lg border py-2 pl-8 text-sm outline-none focus:ring-2"
            />
          </div>

          <div className="space-y-xs border-border p-xs max-h-40 overflow-y-auto rounded-lg border">
            {filtered.length === 0 ? (
              <p className="py-sm text-muted-foreground text-center text-xs">
                {t('pages.exercises.empty')}
              </p>
            ) : (
              filtered.map((ex) => {
                const isSelected = selectedExercise?.id === ex.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setSelectedExercise(ex)}
                    className={cn(
                      'gap-sm px-sm py-xs flex w-full items-center rounded-lg text-left transition',
                      isSelected
                        ? 'bg-category-exercise/15 ring-category-exercise/30 ring-1'
                        : 'hover:bg-accent'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        isSelected
                          ? 'bg-category-exercise/25 text-category-exercise'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'block text-sm font-medium',
                          isSelected && 'text-category-exercise'
                        )}
                      >
                        {ex.name}
                      </span>
                      {ex.muscle_groups && (
                        <span className="text-muted-foreground text-xs">
                          {ex.muscle_groups}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </FormSection>

      {/* Séries e repetições */}
      <FormSection
        title={t('pages.workoutPlans.sets') + ' & ' + t('pages.workoutPlans.repsMin')}
        icon={Dumbbell}
      >
        <div className="gap-lg py-xs flex items-start justify-center">
          <CounterInput
            value={sets}
            onChange={(v) => setValue('sets', v)}
            min={0}
            label={t('pages.workoutPlans.sets')}
          />
          <div className="gap-md flex items-center pt-8">
            <CounterInput
              value={repsMin}
              onChange={(v) => setValue('reps_min', Math.min(v, repsMax))}
              min={0}
              label={t('pages.workoutPlans.repsMin')}
            />
            <span className="text-muted-foreground pb-2 text-xs font-medium">–</span>
            <CounterInput
              value={repsMax}
              onChange={(v) => setValue('reps_max', Math.max(v, repsMin))}
              min={0}
              label={t('pages.workoutPlans.repsMax')}
            />
          </div>
        </div>
        <div className="bg-muted/40 py-xs text-muted-foreground rounded-lg text-center text-xs">
          {sets === 0 ? (
            <span>{t('pages.workoutPlans.noSetsLabel')}</span>
          ) : repsMin === 0 && repsMax === 0 ? (
            <>
              <strong className="text-foreground font-semibold">{sets}</strong>{' '}
              {t('pages.workoutPlans.setsOf')}{' '}
              <span>{t('pages.workoutPlans.noRepsLabel', 'sem repetições')}</span>
            </>
          ) : (
            <>
              <strong className="text-foreground font-semibold">{sets}</strong>{' '}
              {t('pages.workoutPlans.setsOf')}{' '}
              <strong className="text-foreground font-semibold">
                {repsMin === repsMax ? repsMin : `${repsMin}–${repsMax}`}
              </strong>{' '}
              {t('pages.workoutPlans.repsPlural', 'repetições')}
            </>
          )}
        </div>
      </FormSection>

      {/* Descanso entre séries */}
      <FormSection
        title={t('pages.workoutPlans.restSeconds', 'Descanso entre séries')}
        icon={Timer}
      >
        <div className="space-y-sm">
          <div className="gap-xs flex flex-wrap">
            {REST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setValue('rest_seconds', preset)}
                className={cn(
                  'px-sm py-xs rounded-lg border text-xs font-semibold transition',
                  restSeconds === preset
                    ? 'border-category-exercise bg-category-exercise/15 text-category-exercise'
                    : 'border-border bg-background text-muted-foreground hover:border-category-exercise/30 hover:bg-category-exercise/5'
                )}
              >
                {preset === 0 ? t('pages.workoutPlans.noRest') : `${preset}s`}
              </button>
            ))}
          </div>
          <div className="gap-sm flex items-center">
            <input
              type="number"
              min={0}
              step={5}
              {...register('rest_seconds', { valueAsNumber: true })}
              className="border-input bg-background px-sm focus:ring-ring w-24 rounded-lg border py-2 text-center text-sm font-semibold outline-none focus:ring-2"
            />
            <span className="text-muted-foreground text-sm">
              {t('pages.workoutPlans.seconds')}
            </span>
          </div>
        </div>
      </FormSection>

      {/* Carga */}
      <FormSection title={t('pages.workoutPlans.load')} icon={Minus}>
        <div className="gap-sm flex items-center">
          <input
            type="number"
            min={0}
            step="0.5"
            placeholder="0"
            {...register('load')}
            className="border-input bg-background px-sm focus:ring-ring w-24 rounded-lg border py-2 text-center text-sm font-semibold outline-none focus:ring-2"
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
                    ? 'border-category-exercise bg-category-exercise/15 text-category-exercise'
                    : 'border-border bg-background text-muted-foreground hover:border-category-exercise/30 hover:bg-category-exercise/5'
                )}
              >
                {unit.label}
              </button>
            ))}
          </div>
        </div>
      </FormSection>

      {/* Observações */}
      <div>
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="gap-xs text-muted-foreground hover:text-foreground flex items-center text-xs font-medium"
        >
          <StickyNote className="h-3.5 w-3.5" />
          {showNotes
            ? t('pages.workoutPlans.hideNotes', 'Ocultar observações')
            : t('pages.workoutPlans.showNotes', 'Adicionar observações')}
          {showNotes ? <ChevronUp className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
        {showNotes && (
          <Textarea
            placeholder={t('pages.workoutPlans.notesPlaceholder')}
            rows={2}
            {...register('notes')}
            className="mt-sm resize-none"
          />
        )}
      </div>

      <div className="gap-sm border-border pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !selectedExercise}
          className="bg-category-exercise hover:bg-category-exercise/90"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
