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
    <div className="flex flex-col items-center gap-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-col items-center rounded-lg border border-border bg-background shadow-sm">
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-10 items-center justify-center rounded-t-lg border-b border-border text-muted-foreground transition-colors hover:bg-category-exercise/10 hover:text-category-exercise"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <span className="flex h-10 w-10 items-center justify-center text-lg font-bold tabular-nums text-foreground">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-10 items-center justify-center rounded-b-lg border-t border-border text-muted-foreground transition-colors hover:bg-category-exercise/10 hover:text-category-exercise"
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
      load: existing?.load ?? '',
      load_unit: existing?.load_unit ?? 'kg',
      notes: existing?.notes ?? '',
    },
  });

  const loadUnit = useWatch({ control, name: 'load_unit' });
  const sets = watch('sets');
  const repsMin = watch('reps_min');
  const repsMax = watch('reps_max');

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
      load: data.load || null,
      load_unit: data.load_unit,
      order: existing?.order ?? nextOrder,
      notes: data.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-lg">
      {/* Header */}
      <div className="flex items-center gap-md rounded-lg bg-category-exercise/10 px-md py-sm ring-1 ring-category-exercise/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-exercise/20">
          <Dumbbell className="h-5 w-5 text-category-exercise" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-category-exercise">
            {existing
              ? t('pages.workoutPlans.editExerciseTitle')
              : t('pages.workoutPlans.addExerciseTitle')}
          </p>
          {selectedExercise ? (
            <p className="truncate text-xs text-muted-foreground">
              {selectedExercise.name}
              {selectedExercise.muscle_groups && (
                <span className="ml-xs opacity-60">
                  · {selectedExercise.muscle_groups}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('pages.workoutPlans.selectExercise')}
            </p>
          )}
        </div>
      </div>

      {/* Seleção de exercício */}
      <FormSection title={t('pages.workoutPlans.selectExercise')} icon={Search}>
        <div className="space-y-xs">
          <div className="relative">
            <Search className="absolute left-sm top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('pages.workoutPlans.searchExercise')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-sm text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="max-h-40 space-y-xs overflow-y-auto rounded-lg border border-border p-xs">
            {filtered.length === 0 ? (
              <p className="py-sm text-center text-xs text-muted-foreground">
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
                      'flex w-full items-center gap-sm rounded-lg px-sm py-xs text-left transition-all',
                      isSelected
                        ? 'bg-category-exercise/15 ring-1 ring-category-exercise/30'
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
                        <span className="text-xs text-muted-foreground">
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
        <div className="flex items-start justify-center gap-lg py-xs">
          <CounterInput
            value={sets}
            onChange={(v) => setValue('sets', v)}
            label={t('pages.workoutPlans.sets')}
          />
          <div className="flex items-center gap-md pt-8">
            <CounterInput
              value={repsMin}
              onChange={(v) => setValue('reps_min', Math.min(v, repsMax))}
              label={t('pages.workoutPlans.repsMin')}
            />
            <span className="pb-2 text-xs font-medium text-muted-foreground">–</span>
            <CounterInput
              value={repsMax}
              onChange={(v) => setValue('reps_max', Math.max(v, repsMin))}
              label={t('pages.workoutPlans.repsMax')}
            />
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 py-xs text-center text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">{sets}</strong> séries de{' '}
          <strong className="font-semibold text-foreground">
            {repsMin === repsMax ? repsMin : `${repsMin}–${repsMax}`}
          </strong>{' '}
          repetições
        </div>
      </FormSection>

      {/* Carga */}
      <FormSection title={t('pages.workoutPlans.load')} icon={Minus}>
        <div className="flex items-center gap-sm">
          <input
            type="number"
            min={0}
            step="0.5"
            placeholder="0"
            {...register('load')}
            className="w-24 rounded-lg border border-input bg-background px-sm py-2 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-xs">
            {LOAD_UNITS.map((unit) => (
              <button
                key={unit.value}
                type="button"
                onClick={() => setValue('load_unit', unit.value)}
                className={cn(
                  'rounded-lg border px-sm py-xs text-xs font-semibold transition-all',
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
          className="flex items-center gap-xs text-xs font-medium text-muted-foreground hover:text-foreground"
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

      <div className="flex justify-end gap-sm border-t border-border pt-md">
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
