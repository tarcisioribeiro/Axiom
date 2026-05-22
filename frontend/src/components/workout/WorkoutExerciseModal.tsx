import { Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  { value: 'bw', label: 'Peso corporal' },
];

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
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    existing ? (exercises.find((e) => e.id === existing.exercise) ?? null) : null
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
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

  useEffect(() => {
    if (selectedExercise) {
      setValue('exercise_id', selectedExercise.id);
    }
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      {/* Exercise picker */}
      <div className="space-y-sm">
        <Label>{t('pages.workoutPlans.selectExercise')}</Label>

        <div className="relative">
          <Search className="absolute left-sm top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('pages.workoutPlans.searchExercise')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="max-h-44 space-y-xs overflow-y-auto rounded-lg border border-border p-xs">
          {filtered.length === 0 ? (
            <p className="py-sm text-center text-xs text-muted-foreground">
              {t('pages.exercises.empty')}
            </p>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSelectedExercise(ex)}
                className={cn(
                  'flex w-full flex-col rounded-md px-sm py-xs text-left transition-colors',
                  selectedExercise?.id === ex.id
                    ? 'bg-category-exercise/10 text-category-exercise ring-1 ring-category-exercise/30'
                    : 'hover:bg-accent'
                )}
              >
                <span className="text-sm font-medium">{ex.name}</span>
                {ex.muscle_groups && (
                  <span className="text-xs text-muted-foreground">
                    {ex.muscle_groups}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {errors.exercise_id && !selectedExercise && (
          <p className="text-xs text-destructive">
            {t('pages.workoutPlans.exerciseRequired')}
          </p>
        )}
      </div>

      {/* Sets + reps */}
      <div className="grid grid-cols-3 gap-sm">
        <div className="space-y-xs">
          <Label htmlFor="we-sets" className="text-xs">
            {t('pages.workoutPlans.sets')}
          </Label>
          <Input
            id="we-sets"
            type="number"
            min={1}
            {...register('sets', { valueAsNumber: true, required: true, min: 1 })}
            className={errors.sets ? 'border-destructive' : ''}
          />
        </div>
        <div className="space-y-xs">
          <Label htmlFor="we-reps-min" className="text-xs">
            {t('pages.workoutPlans.repsMin')}
          </Label>
          <Input
            id="we-reps-min"
            type="number"
            min={1}
            {...register('reps_min', { valueAsNumber: true, required: true, min: 1 })}
            className={errors.reps_min ? 'border-destructive' : ''}
          />
        </div>
        <div className="space-y-xs">
          <Label htmlFor="we-reps-max" className="text-xs">
            {t('pages.workoutPlans.repsMax')}
          </Label>
          <Input
            id="we-reps-max"
            type="number"
            min={1}
            {...register('reps_max', { valueAsNumber: true, required: true, min: 1 })}
            className={errors.reps_max ? 'border-destructive' : ''}
          />
        </div>
      </div>

      {/* Load + unit */}
      <div className="grid grid-cols-[1fr_auto] gap-sm">
        <div className="space-y-xs">
          <Label htmlFor="we-load" className="text-xs">
            {t('pages.workoutPlans.load')}
          </Label>
          <Input
            id="we-load"
            type="number"
            min={0}
            step="0.5"
            placeholder="0"
            {...register('load')}
          />
        </div>
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.workoutPlans.loadUnit')}</Label>
          <div className="flex gap-xs">
            {LOAD_UNITS.map((unit) => (
              <button
                key={unit.value}
                type="button"
                onClick={() => setValue('load_unit', unit.value)}
                className={cn(
                  'rounded-md border px-sm py-xs text-xs font-medium transition-colors',
                  loadUnit === unit.value
                    ? 'border-category-exercise bg-category-exercise/10 text-category-exercise'
                    : 'border-border hover:bg-accent'
                )}
              >
                {unit.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-xs">
        <Label htmlFor="we-notes" className="text-xs">
          {t('pages.workoutPlans.notes')}
        </Label>
        <Textarea
          id="we-notes"
          placeholder={t('pages.workoutPlans.notesPlaceholder')}
          rows={2}
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-sm pt-xs">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || !selectedExercise}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
