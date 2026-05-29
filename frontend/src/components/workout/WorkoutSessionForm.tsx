/* eslint-disable max-lines, react-hooks/incompatible-library */
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
import { TimePicker } from '@/components/ui/time-picker';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import type { WorkoutDay } from '@/types/workout';

const LOAD_UNITS = ['kg', 'lb'] as const;

interface SessionSetValues {
  set_number: number;
  load: string;
  load_unit: string;
  reps_done: string;
  completed: boolean;
  notes: string;
}

interface SessionExerciseValues {
  exercise_name: string;
  sets_target: number;
  reps_target_min: number;
  reps_target_max: number;
  order: number;
  sets: SessionSetValues[];
}

interface WorkoutSessionFormValues {
  workout_day: string;
  date: string;
  started_at: string;
  finished_at: string;
  notes: string;
  exercises: SessionExerciseValues[];
}

interface WorkoutSessionFormProps {
  workoutDays: WorkoutDay[];
  ownerId: number;
  onSubmit: (data: WorkoutSessionFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function newSet(setNumber: number): SessionSetValues {
  return {
    set_number: setNumber,
    load: '',
    load_unit: 'kg',
    reps_done: '',
    completed: true,
    notes: '',
  };
}

export function WorkoutSessionForm({
  workoutDays,
  ownerId: _ownerId,
  onSubmit,
  onCancel,
  isLoading = false,
}: WorkoutSessionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, control, watch, setValue } =
    useForm<WorkoutSessionFormValues>({
      defaultValues: {
        workout_day: '',
        date: today,
        started_at: '',
        finished_at: '',
        notes: '',
        exercises: [],
      },
    });

  const {
    fields: exerciseFields,
    append: appendExercise,
    remove: removeExercise,
  } = useFieldArray({ control, name: 'exercises' });

  const selectedDayId = watch('workout_day');

  useEffect(() => {
    if (selectedDayId) {
      const day = workoutDays.find((d) => String(d.id) === selectedDayId);
      if (day?.exercises && day.exercises.length > 0) {
        const preloaded: SessionExerciseValues[] = day.exercises.map((ex, idx) => ({
          exercise_name: ex.name,
          sets_target: ex.sets,
          reps_target_min: ex.reps_min,
          reps_target_max: ex.reps_max,
          order: idx,
          sets: Array.from({ length: ex.sets }, (_, i) => newSet(i + 1)),
        }));
        setValue('exercises', preloaded);
      } else {
        setValue('exercises', []);
      }
    }
  }, [selectedDayId, workoutDays, setValue]);

  const handleFormSubmit = async (data: WorkoutSessionFormValues) => {
    try {
      await onSubmit(data);
    } catch {
      toast({ title: t('pages.workoutSessions.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-md">
      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-sm">
          <Label htmlFor="session-date">{t('pages.workoutSessions.date')}</Label>
          <DatePicker
            value={watch('date')}
            onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="session-day">{t('pages.workoutSessions.workoutDay')}</Label>
          <Select
            value={watch('workout_day')}
            onValueChange={(v) => setValue('workout_day', v)}
          >
            <SelectTrigger id="session-day">
              <SelectValue
                placeholder={t('pages.workoutSessions.workoutDayPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t('pages.workoutSessions.noWorkoutDay')}
              </SelectItem>
              {workoutDays.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                  {d.muscle_groups ? ` — ${d.muscle_groups}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-sm">
          <Label>{t('pages.workoutSessions.startTime')}</Label>
          <TimePicker
            value={watch('started_at') || undefined}
            onChange={(t) => setValue('started_at', t ?? '')}
          />
        </div>
        <div className="space-y-sm">
          <Label>{t('pages.workoutSessions.endTime')}</Label>
          <TimePicker
            value={watch('finished_at') || undefined}
            onChange={(t) => setValue('finished_at', t ?? '')}
          />
        </div>
      </div>

      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <Label>{t('pages.workoutSessions.exercisesSection')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendExercise({
                exercise_name: '',
                sets_target: 3,
                reps_target_min: 8,
                reps_target_max: 12,
                order: exerciseFields.length,
                sets: [newSet(1)],
              })
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('pages.workoutSessions.addExercise')}
          </Button>
        </div>

        <div className="max-h-80 space-y-sm overflow-y-auto pr-1">
          {exerciseFields.map((exField, exIdx) => (
            <ExerciseBlock
              key={exField.id}
              exIdx={exIdx}
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              onRemove={() => removeExercise(exIdx)}
              t={t}
            />
          ))}
        </div>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="session-notes">{t('pages.workoutSessions.sessionNotes')}</Label>
        <Textarea
          id="session-notes"
          placeholder={t('pages.workoutSessions.sessionNotesPlaceholder')}
          rows={2}
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}

interface ExerciseBlockProps {
  exIdx: number;
  control: ReturnType<typeof useForm<WorkoutSessionFormValues>>['control'];
  register: ReturnType<typeof useForm<WorkoutSessionFormValues>>['register'];
  watch: ReturnType<typeof useForm<WorkoutSessionFormValues>>['watch'];
  setValue: ReturnType<typeof useForm<WorkoutSessionFormValues>>['setValue'];
  onRemove: () => void;
  t: (key: string) => string;
}

function ExerciseBlock({
  exIdx,
  control,
  register,
  watch,
  setValue,
  onRemove,
  t,
}: ExerciseBlockProps) {
  const {
    fields: setFields,
    append: appendSet,
    remove: removeSet,
  } = useFieldArray({
    control,
    name: `exercises.${exIdx}.sets`,
  });

  return (
    <div className="space-y-sm rounded-md border-l-2 border-category-exercise bg-card p-sm">
      <div className="flex items-center gap-sm">
        <Input
          className="flex-1"
          placeholder={t('pages.workoutSessions.exerciseNamePlaceholder')}
          {...register(`exercises.${exIdx}.exercise_name`, { required: true })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-xs">
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-xs px-xs text-xs font-medium text-muted-foreground">
          <span>{t('pages.workoutSessions.setNumber')}</span>
          <span>{t('pages.workoutSessions.load')}</span>
          <span>{t('pages.workoutSessions.loadUnit')}</span>
          <span>{t('pages.workoutSessions.repsDone')}</span>
          <span />
        </div>
        {setFields.map((setField, sIdx) => (
          <div
            key={setField.id}
            className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center gap-xs"
          >
            <span className="text-center text-xs font-medium text-muted-foreground">
              {sIdx + 1}
            </span>
            <Input
              type="number"
              step="0.5"
              min={0}
              placeholder={t('pages.workoutSessions.bodyweight')}
              {...register(`exercises.${exIdx}.sets.${sIdx}.load`)}
            />
            <Select
              value={watch(`exercises.${exIdx}.sets.${sIdx}.load_unit`)}
              onValueChange={(v) =>
                setValue(`exercises.${exIdx}.sets.${sIdx}.load_unit`, v)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOAD_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {t(`units.${u}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              {...register(`exercises.${exIdx}.sets.${sIdx}.reps_done`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeSet(sIdx)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => appendSet(newSet(setFields.length + 1))}
        >
          <Plus className="mr-1 h-3 w-3" />
          {t('pages.workoutSessions.addSet')}
        </Button>
      </div>
    </div>
  );
}
