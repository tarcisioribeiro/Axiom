/* eslint-disable max-lines, react-hooks/incompatible-library */
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flag,
  ListChecks,
  Loader2,
  NotebookPen,
  Plus,
  Trash2,
  Save,
  SkipForward,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import type { WorkoutDay, WorkoutSession } from '@/types/workout';

// 'bw' só existe no form: a série salva peso corporal como carga em branco
const LOAD_UNITS = ['bw', 'kg', 'lb'] as const;
const DEFAULT_SESSION_DURATION_MINUTES = 45;

// Slide entre exercícios da sequência (direção: 1 avança, -1 volta)
const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 60 : -60, opacity: 0 }),
};

/** Carga no formato do idioma (vírgula pt-BR, ponto en-US), máx. 1 casa. */
function formatLoad(value: string | number | null | undefined, locale: string) {
  if (value == null || value === '') return '';
  const n = Number(String(value).replace(',', '.'));
  if (Number.isNaN(n)) return '';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(n);
}

const parseLoad = (value: string) => value.replace(',', '.');

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
  /** Último peso registrado em Medidas Corporais (kg). */
  bodyWeightKg?: string | null;
}

function newSet(
  setNumber: number,
  load = '',
  loadUnit = 'kg',
  repsDone = ''
): SessionSetValues {
  const bodyweight = loadUnit === 'bw';
  return {
    set_number: setNumber,
    load: bodyweight ? '' : load,
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
  bodyWeightKg,
}: WorkoutSessionFormProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const locale = i18n.language;
  const fmt = (v: string | number | null | undefined) => formatLoad(v, locale);
  const bodyweightLabel = bodyWeightKg
    ? `${t('pages.workoutSessions.bodyweight')} - ${fmt(bodyWeightKg)} kg`
    : t('pages.workoutSessions.bodyweight');
  const durationOf = (dayId: string) =>
    workoutDays.find((d) => String(d.id) === dayId)?.default_duration_minutes ??
    DEFAULT_SESSION_DURATION_MINUTES;

  const today = formatLocalDate(new Date());
  const defaultStart = nowTimeStr();

  const { register, handleSubmit, control, watch, setValue, getValues } =
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
                    load: fmt(s.load),
                    load_unit: s.load ? s.load_unit : 'bw',
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

  const { fields: exerciseFields, remove: removeExercise } = useFieldArray({
    control,
    name: 'exercises',
    keyName: 'fieldKey',
  });

  // Sequência: um exercício por vez; step === length é a etapa final.
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const pendingSkipRef = useRef<number | null>(null);
  const handleExitComplete = () => {
    const idx = pendingSkipRef.current;
    if (idx == null) return;
    pendingSkipRef.current = null;
    removeExercise(idx);
    setStep(idx);
  };
  const goTo = (delta: number) => {
    setDirection(delta);
    setStep((s) => s + delta);
  };
  const atEnd = step >= exerciseFields.length;

  const handleSkip = async () => {
    const confirmed = await showConfirm({
      title: t('pages.workoutSessions.skipConfirmTitle'),
      description: t('pages.workoutSessions.skipConfirmDesc', {
        name: getValues(`exercises.${step}.exercise_name`),
      }),
      confirmText: t('pages.workoutSessions.skip'),
      variant: 'warning',
    });
    // Remover o atual já deixa `step` apontando para o próximo
    // Anima a saída do exercício pulado antes de removê-lo (ver onExitComplete)
    if (confirmed) {
      pendingSkipRef.current = step;
      goTo(1);
    }
  };

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
    setStep(0);
    if (selectedDayId) {
      const day = workoutDays.find((d) => String(d.id) === selectedDayId);
      if (day?.exercises && day.exercises.length > 0) {
        const preloaded: SessionExerciseValues[] = day.exercises.map((ex, idx) => ({
          exercise: ex.id,
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
            newSet(
              i + 1,
              fmt(ex.set_targets?.[i]?.load ?? ex.load),
              ex.load_unit || 'kg',
              String(ex.set_targets?.[i]?.reps ?? ex.reps_min)
            )
          ),
        }));
        setValue('exercises', preloaded);
      } else {
        setValue('exercises', []);
      }

      if (day?.default_start_time) {
        setValue('started_at', day.default_start_time.slice(0, 5));
      }
    }
    const start = getValues('started_at');
    if (start) {
      setValue('finished_at', addMinutesToTimeStr(start, durationOf(selectedDayId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- durationOf deriva de workoutDays
  }, [selectedDayId, workoutDays, setValue, getValues]);

  // Término = início + duração padrão da divisão; segue editável à mão
  const handleStartChange = (start: string) => {
    setValue('started_at', start);
    if (start) {
      setValue(
        'finished_at',
        addMinutesToTimeStr(start, durationOf(getValues('workout_day')))
      );
    }
  };

  const handleFormSubmit = async (data: WorkoutSessionFormValues) => {
    try {
      await onSubmit({
        ...data,
        exercises: data.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((s) =>
            s.load_unit === 'bw'
              ? { ...s, load: '', load_unit: 'kg' }
              : { ...s, load: parseLoad(s.load) }
          ),
        })),
      });
    } catch {
      toast({ title: t('pages.workoutSessions.saveError'), variant: 'destructive' });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="gap-md flex min-h-0 flex-1 flex-col"
    >
      <FormSection title={t('pages.workoutSessions.sectionSession')}>
        <div className="gap-sm grid grid-cols-1 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-sm">
            <Label htmlFor="session-date" className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-4 w-4" />
              {t('pages.workoutSessions.date')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              maxDate={new Date()}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-sm">
            <Label htmlFor="session-day" className="gap-xs flex items-center">
              <Dumbbell className="text-muted-foreground h-4 w-4" />
              {t('pages.workoutSessions.workoutDay')}
            </Label>
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
            <Label className="gap-xs flex items-center">
              <Clock className="text-muted-foreground h-4 w-4" />
              {t('pages.workoutSessions.startTime')}
            </Label>
            <TimePicker
              value={watch('started_at') || undefined}
              onChange={(t) => handleStartChange(t ?? '')}
            />
          </div>
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Flag className="text-muted-foreground h-4 w-4" />
              {t('pages.workoutSessions.endTime')}
            </Label>
            <TimePicker
              value={watch('finished_at') || undefined}
              onChange={(t) => setValue('finished_at', t ?? '')}
            />
          </div>
        </div>
      </FormSection>

      <div className="gap-sm flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <Label className="gap-xs flex items-center">
            <ListChecks className="text-muted-foreground h-4 w-4" />
            {t('pages.workoutSessions.exercisesSection')}
          </Label>
          {!atEnd && (
            <span className="text-muted-foreground text-xs font-medium">
              {t('pages.workoutSessions.exerciseProgress', {
                current: step + 1,
                total: exerciseFields.length,
              })}
            </span>
          )}
        </div>

        {/* my-auto no card: centraliza quando cabe e vira 0 quando rola */}
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pr-1">
          <AnimatePresence
            initial={false}
            custom={direction}
            mode="wait"
            onExitComplete={handleExitComplete}
          >
            <motion.div
              key={atEnd ? 'end' : exerciseFields[step].fieldKey}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={atEnd ? 'h-full' : 'my-auto'}
            >
              {!atEnd ? (
                <ExerciseBlock
                  // step no key: remonta o useFieldArray das séries quando o
                  // índice muda após remover um exercício pulado
                  key={`${exerciseFields[step].fieldKey}-${step}`}
                  exIdx={step}
                  control={control}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  t={t}
                  fmt={fmt}
                  bodyweightLabel={bodyweightLabel}
                />
              ) : (
                <div className="gap-xs flex h-full flex-col items-center justify-center text-center text-sm">
                  <p className="font-medium">
                    {exerciseFields.length > 0
                      ? t('pages.workoutSessions.sequenceDone')
                      : t('pages.workoutSessions.noSequence')}
                  </p>
                  <p className="text-muted-foreground">
                    {exerciseFields.length > 0
                      ? t('pages.workoutSessions.sequenceDoneDesc')
                      : t('pages.workoutSessions.noSequenceDesc')}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="gap-sm flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => goTo(-1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {atEnd && exerciseFields.length > 0
              ? t('pages.workoutSessions.backToSequence')
              : t('common.actions.previous')}
          </Button>
          {!atEnd && (
            <div className="gap-sm flex">
              <Button type="button" variant="outline" size="sm" onClick={handleSkip}>
                <SkipForward className="mr-1 h-4 w-4" />
                {t('pages.workoutSessions.skip')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => goTo(1)}>
                {t('common.actions.next')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="session-notes" className="gap-xs flex items-center">
          <NotebookPen className="text-muted-foreground h-4 w-4" />
          {t('pages.workoutSessions.sessionNotes')}
        </Label>
        <Textarea
          id="session-notes"
          placeholder={t('pages.workoutSessions.sessionNotesPlaceholder')}
          rows={2}
          {...register('notes')}
        />
      </div>

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="mr-sm h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        {/* Sessão sempre vinculada a uma divisão (sem sessão avulsa) */}
        <Button type="submit" disabled={isLoading || (!session && !selectedDayId)}>
          {isLoading ? (
            <Loader2 className="mr-sm h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-sm h-4 w-4" />
          )}

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
  t: (key: string) => string;
  fmt: (v: string) => string;
  bodyweightLabel: string;
}

function ExerciseBlock({
  exIdx,
  control,
  register,
  watch,
  setValue,
  t,
  fmt,
  bodyweightLabel,
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
    <div className="space-y-sm border-category-exercise/40 border-l-category-exercise bg-card p-sm rounded-md border border-l-2">
      <div className="gap-sm flex items-center">
        <ExerciseThumbnail
          gifUrl={watch(`exercises.${exIdx}.gif_url`)}
          thumbnailUrl={watch(`exercises.${exIdx}.thumbnail_url`)}
          size="sm"
        />
        <span className="flex-1 font-medium">
          {watch(`exercises.${exIdx}.exercise_name`)}
        </span>
      </div>

      <div className="space-y-xs">
        <div className="gap-xs px-xs text-muted-foreground grid grid-cols-[2rem_1fr_1.5fr_1fr_2rem] text-xs font-medium">
          <span>{t('pages.workoutSessions.setNumber')}</span>
          <span>{t('pages.workoutSessions.load')}</span>
          <span>{t('pages.workoutSessions.loadUnit')}</span>
          <span>{t('pages.workoutSessions.repsDone')}</span>
          <span />
        </div>
        {setFields.map((setField, sIdx) => {
          const loadPath = `exercises.${exIdx}.sets.${sIdx}.load` as const;
          const unitPath = `exercises.${exIdx}.sets.${sIdx}.load_unit` as const;
          const isBodyweight = watch(unitPath) === 'bw';
          return (
            <div
              key={setField.fieldKey}
              className="gap-xs grid grid-cols-[2rem_1fr_1.5fr_1fr_2rem] items-center"
            >
              <span className="text-muted-foreground text-center text-xs font-medium">
                {sIdx + 1}
              </span>
              <Input
                type="text"
                inputMode="decimal"
                disabled={isBodyweight}
                placeholder={isBodyweight ? '—' : fmt('0')}
                {...register(loadPath, {
                  onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
                    setValue(loadPath, fmt(e.target.value)),
                })}
              />
              <Select
                value={watch(unitPath)}
                onValueChange={(v) => {
                  setValue(unitPath, v);
                  if (v === 'bw') setValue(loadPath, '');
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOAD_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u === 'bw' ? bodyweightLabel : t(`units.${u}`)}
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
                aria-label={t('common.actions.remove')}
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                onClick={() => removeSet(sIdx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full text-xs"
          onClick={() =>
            appendSet(
              newSet(
                setFields.length + 1,
                fmt(watch(`exercises.${exIdx}.load_target`)),
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
