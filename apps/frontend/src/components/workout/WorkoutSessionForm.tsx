/* eslint-disable max-lines, react-hooks/incompatible-library */
import {
  ArrowPathIcon as Loader2,
  PlusIcon as Plus,
  TrashIcon as Trash2,
} from '@heroicons/react/24/solid';
import { useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
import { TimePicker } from '@/components/ui/time-picker';
import { ExerciseThumbnail } from '@/components/workout/ExerciseThumbnail';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import type { WorkoutDay, WorkoutSession } from '@/types/workout';

const LOAD_UNITS = ['kg', 'lb'] as const;
const DEFAULT_SESSION_DURATION_MINUTES = 45;

interface SessionSetValues {
  id?: number;
  set_number: number;
  load: string;
  load_unit: string;
  reps_done: string;
  completed: boolean;
  notes: string;
}

interface SessionExerciseValues {
  id?: number;
  exercise?: number | null;
  exercise_name: string;
  gif_url?: string | null;
  thumbnail_url?: string | null;
  sets_target: number;
  reps_target_min: number;
  reps_target_max: number;
  load_target: string;
  load_target_unit: string;
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
  session?: WorkoutSession;
  onSubmit: (data: WorkoutSessionFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function newSet(
  setNumber: number,
  load = '',
  loadUnit = 'kg',
  repsDone = ''
): SessionSetValues {
  return {
    set_number: setNumber,
    load,
    load_unit: loadUnit,
    reps_done: repsDone,
    completed: true,
    notes: '',
  };
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addMinutesToTimeStr(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const wrapped = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

export function WorkoutSessionForm({
  workoutDays,
  ownerId: _ownerId,
  session,
  onSubmit,
  onCancel,
  isLoading = false,
}: WorkoutSessionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = nowTimeStr();

  const { register, handleSubmit, control, watch, setValue } =
    useForm<WorkoutSessionFormValues>({
      defaultValues: session
        ? {
            workout_day: session.workout_day ? String(session.workout_day) : '',
            date: session.date,
            started_at: session.started_at ?? '',
            finished_at: session.finished_at ?? '',
            notes: session.notes ?? '',
            exercises: [...session.session_exercises]
              .sort((a, b) => a.order - b.order)
              .map((ex) => ({
                id: ex.id,
                exercise: ex.exercise,
                exercise_name: ex.exercise_name,
                gif_url: ex.gif_url,
                thumbnail_url: ex.thumbnail_url,
                sets_target: ex.sets_target,
                reps_target_min: ex.reps_target_min,
                reps_target_max: ex.reps_target_max,
                load_target: ex.load_target ?? '',
                load_target_unit: ex.load_target_unit || 'kg',
                order: ex.order,
                sets: [...ex.sets]
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((s) => ({
                    id: s.id,
                    set_number: s.set_number,
                    load: s.load ?? '',
                    load_unit: s.load_unit,
                    reps_done: s.reps_done != null ? String(s.reps_done) : '',
                    completed: s.completed,
                    notes: s.notes ?? '',
                  })),
              })),
          }
        : {
            workout_day: '',
            date: today,
            started_at: defaultStart,
            finished_at: addMinutesToTimeStr(
              defaultStart,
              DEFAULT_SESSION_DURATION_MINUTES
            ),
            notes: '',
            exercises: [],
          },
    });

  const {
    fields: exerciseFields,
    append: appendExercise,
    remove: removeExercise,
  } = useFieldArray({ control, name: 'exercises', keyName: 'fieldKey' });

  const selectedDayId = watch('workout_day');

  // Skip on initial mount so editing a session doesn't get its loaded
  // sets/reps clobbered by the workout day's template — this effect should
  // only react to the user explicitly changing the day dropdown afterwards.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (selectedDayId) {
      const day = workoutDays.find((d) => String(d.id) === selectedDayId);
      if (day?.exercises && day.exercises.length > 0) {
        const preloaded: SessionExerciseValues[] = day.exercises.map((ex, idx) => ({
          exercise: ex.exercise,
          exercise_name: ex.name,
          gif_url: ex.gif_url,
          thumbnail_url: ex.thumbnail_url,
          sets_target: ex.sets,
          reps_target_min: ex.reps_min,
          reps_target_max: ex.reps_max,
          load_target: ex.load ?? '',
          load_target_unit: ex.load_unit || 'kg',
          order: idx,
          sets: Array.from({ length: ex.sets }, (_, i) =>
            newSet(i + 1, ex.load ?? '', ex.load_unit || 'kg', String(ex.reps_min))
          ),
        }));
        setValue('exercises', preloaded);
      } else {
        setValue('exercises', []);
      }

      if (day?.default_start_time) {
        const start = day.default_start_time.slice(0, 5);
        setValue('started_at', start);
        setValue(
          'finished_at',
          addMinutesToTimeStr(
            start,
            day.default_duration_minutes ?? DEFAULT_SESSION_DURATION_MINUTES
          )
        );
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
      <FormSection title={t('pages.workoutSessions.sectionSession')}>
        <div className="gap-sm grid grid-cols-2">
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

        <div className="gap-sm grid grid-cols-2">
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
      </FormSection>

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
                load_target: '',
                load_target_unit: 'kg',
                order: exerciseFields.length,
                sets: [newSet(1)],
              })
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('pages.workoutSessions.addExercise')}
          </Button>
        </div>

        <div className="space-y-sm max-h-80 overflow-y-auto pr-1">
          {exerciseFields.map((exField, exIdx) => (
            <ExerciseBlock
              key={exField.fieldKey}
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

      <div className="gap-sm pt-sm flex justify-end">
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
    keyName: 'fieldKey',
  });

  return (
    <div className="space-y-sm border-category-exercise bg-card p-sm rounded-md border-l-2">
      <div className="gap-sm flex items-center">
        <ExerciseThumbnail
          gifUrl={watch(`exercises.${exIdx}.gif_url`)}
          thumbnailUrl={watch(`exercises.${exIdx}.thumbnail_url`)}
          size="sm"
        />
        <Input
          className="flex-1"
          placeholder={t('pages.workoutSessions.exerciseNamePlaceholder')}
          {...register(`exercises.${exIdx}.exercise_name`, { required: true })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-xs">
        <div className="gap-xs px-xs text-muted-foreground grid grid-cols-[2rem_1fr_1fr_1fr_2rem] text-xs font-medium">
          <span>{t('pages.workoutSessions.setNumber')}</span>
          <span>{t('pages.workoutSessions.load')}</span>
          <span>{t('pages.workoutSessions.loadUnit')}</span>
          <span>{t('pages.workoutSessions.repsDone')}</span>
          <span />
        </div>
        {setFields.map((setField, sIdx) => (
          <div
            key={setField.fieldKey}
            className="gap-xs grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center"
          >
            <span className="text-muted-foreground text-center text-xs font-medium">
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
              className="text-muted-foreground hover:text-destructive h-7 w-7"
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
          className="text-muted-foreground w-full text-xs"
          onClick={() =>
            appendSet(
              newSet(
                setFields.length + 1,
                watch(`exercises.${exIdx}.load_target`),
                watch(`exercises.${exIdx}.load_target_unit`) || 'kg',
                String(watch(`exercises.${exIdx}.reps_target_min`) ?? '')
              )
            )
          }
        >
          <Plus className="mr-1 h-3 w-3" />
          {t('pages.workoutSessions.addSet')}
        </Button>
      </div>
    </div>
  );
}
