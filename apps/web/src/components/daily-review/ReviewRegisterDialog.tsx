/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  Droplets,
  Leaf,
  Save,
  Scale,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AddSessionForm } from '@/components/library/CourseDetailModal';
import { WaterLogPanel } from '@/components/nutrition/Hydration';
import { MealLogForm } from '@/components/nutrition/MealLogForm';
import { DailyReflectionForm } from '@/components/personal-planning/DailyReflectionForm';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckinFormDialog,
  SelfEsteemFormDialog,
} from '@/components/wellness/WellnessFormDialogs';
import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import { useCurrentMember } from '@/hooks/use-current-member';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { formatLocalDate } from '@/lib/utils';
import { createWorkoutSession } from '@/lib/workout-session';
import { coursesService } from '@/services/courses-service';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { mealLogService, mealTypeService } from '@/services/nutrition-service';
import { wellnessService } from '@/services/wellness-service';
import { bodyMetricService, workoutDayService } from '@/services/workout-service';
import { getErrorMessage } from '@/utils/error-utils';

import type { RegisterTarget } from './review-steps';

interface Props {
  target: RegisterTarget | null;
  onClose: () => void;
}

const today = () => formatLocalDate(new Date());

/** Registro de um item pendente pelo formulário do próprio módulo, aberto
 * por cima da revisão. Ao salvar, a revisão é recarregada. */
export function ReviewRegisterDialog({ target, onClose }: Props) {
  const queryClient = useQueryClient();
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ['daily-review'] });
    onClose();
  };
  const onOpenChange = (open: boolean) => !open && done();
  const step = target?.step;

  switch (step) {
    case 'checkin':
      return <CheckinFormDialog open onOpenChange={onOpenChange} date={target?.date} />;
    case 'self_esteem':
    case 'self_esteem_periodic':
      return (
        <SelfEsteemFormDialog
          open
          onOpenChange={onOpenChange}
          date={step === 'self_esteem' ? target?.date : today()}
        />
      );
    case 'reflection':
      return <ReflectionDialog date={target!.date} onDone={done} />;
    case 'workout':
      return <WorkoutDialog target={target!} onDone={done} />;
    case 'meals':
      return <MealDialog target={target!} onDone={done} />;
    case 'hydration':
      return <HydrationDialog date={target!.date} onDone={done} />;
    case 'study':
      return <StudyDialog target={target!} onDone={done} />;
    case 'wellness':
      return <WellnessDialog onDone={done} />;
    case 'weigh_in':
      return <WeighInDialog onDone={done} />;
    default:
      return null;
  }
}

interface DoneProps {
  onDone: () => void;
}

function ReflectionDialog({ date, onDone }: DoneProps & { date: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle mode="create">
            {t('pages.dailyReflections.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <DailyReflectionForm
          defaultDate={date}
          isLoading={saving}
          onCancel={onDone}
          onSubmit={async (data) => {
            setSaving(true);
            try {
              await dailyReflectionsService.create(data);
              toast({ title: t('pages.dailyReflections.created') });
              onDone();
            } catch (error) {
              toast({
                title: t('pages.dailyReflections.saveError', {
                  reason: getErrorMessage(error),
                }),
                variant: 'destructive',
              });
            } finally {
              setSaving(false);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function WorkoutDialog({ target, onDone }: DoneProps & { target: RegisterTarget }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member } = useCurrentMember();
  const { data: days } = useQuery({
    queryKey: ['workout-days'],
    queryFn: () => workoutDayService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof createWorkoutSession>[0]) =>
      createWorkoutSession(data, member?.id ?? 0),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workout-sessions'] });
      toast({ title: t('pages.workoutSessions.sessionCreated') });
      onDone();
    },
    onError: (err: unknown) =>
      toast({
        title: t('pages.workoutSessions.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      }),
  });
  return (
    <Dialog open={!!days && !!member} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle mode="create">
            {t('pages.workoutSessions.newSessionTitle')}
          </DialogTitle>
        </DialogHeader>
        {days && member && (
          <WorkoutSessionForm
            workoutDays={days}
            ownerId={member.id}
            prefill={{ date: target.date, workoutDayId: target.item.id! }}
            isLoading={mutation.isPending}
            onCancel={onDone}
            onSubmit={async (data) => {
              await mutation.mutateAsync(data);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MealDialog({ target, onDone }: DoneProps & { target: RegisterTarget }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member } = useCurrentMember();
  const { data: mealTypes } = useQuery({
    queryKey: ['meal-types'],
    queryFn: () => mealTypeService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const mutation = useMutation({
    mutationFn: mealLogService.create.bind(mealLogService),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
      toast({ title: t('pages.nutritionLog.logCreated') });
      onDone();
    },
    onError: (err: unknown) =>
      toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });
  return (
    <Dialog open={!!mealTypes && !!member} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle mode="create">{t('pages.nutritionLog.newLogTitle')}</DialogTitle>
        </DialogHeader>
        {mealTypes && member && (
          <MealLogForm
            mealTypes={mealTypes}
            ownerId={member.id}
            prefillMealTypeId={target.item.id}
            prefillDate={target.date}
            isLoading={mutation.isPending}
            onCancel={onDone}
            onSubmit={async (data) => {
              await mutation.mutateAsync(data);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HydrationDialog({ date, onDone }: DoneProps & { date: string }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle icon={Droplets}>
            {t('dailyReview.steps.hydration.title')}
          </DialogTitle>
        </DialogHeader>
        <WaterLogPanel date={date} />
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}

function StudyDialog({ target, onDone }: DoneProps & { target: RegisterTarget }) {
  const { t } = useTranslation();
  const { data: course } = useQuery({
    queryKey: ['courses', target.item.id],
    queryFn: () => coursesService.getById(target.item.id!),
  });
  return (
    <Dialog open={!!course} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle mode="create">
            {t('pages.courses.sessions.newTitle')}
          </DialogTitle>
        </DialogHeader>
        {course && (
          <AddSessionForm
            course={course}
            defaultDate={target.date}
            onSaved={onDone}
            onCancel={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WellnessDialog({ onDone }: DoneProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [intervention, setIntervention] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { data } = useQuery({
    queryKey: ['wellness', 'interventions', 'all'],
    queryFn: () => wellnessService.getInterventions(),
  });
  const mutation = useMutation({
    mutationFn: () =>
      wellnessService.completeIntervention({
        intervention: Number(intervention),
        completed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      toast({ title: t('pages.emotionalWellness.library.completedToast') });
      onDone();
    },
    onError: (err: unknown) =>
      toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });
  const submit = () => {
    if (!intervention) {
      setInvalid(true);
      toast({
        title: t('common.fieldRequired', {
          field: t('dailyReview.register.intervention'),
        }),
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate();
  };
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onDone()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={Leaf}>
            {t('dailyReview.register.wellnessTitle')}
          </DialogTitle>
        </DialogHeader>
        <FormField
          id="review-intervention"
          label={t('dailyReview.register.intervention')}
          icon={Leaf}
        >
          <Select
            value={intervention}
            onValueChange={(v) => {
              setIntervention(v);
              setInvalid(false);
            }}
          >
            <SelectTrigger id="review-intervention" aria-invalid={invalid}>
              <SelectValue placeholder={t('common.placeholders.select')} />
            </SelectTrigger>
            <SelectContent>
              {(data?.results ?? []).map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter className="gap-sm">
          <Button variant="outline" onClick={onDone}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {!mutation.isPending && <CheckCircle2 className="h-4 w-4" />}
            {t('dailyReview.register.action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WeighInDialog({ onDone }: DoneProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member } = useCurrentMember();
  const [date, setDate] = useState(today());
  const [weight, setWeight] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      bodyMetricService.create({
        measured_at: date,
        weight_kg: String(weight),
        owner: member!.id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['body-metrics'] });
      toast({ title: t('dailyReview.register.weighInSaved') });
      onDone();
    },
    onError: (err: unknown) =>
      toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });
  const submit = () => {
    if (!weight) {
      setInvalid(true);
      toast({
        title: t('common.fieldRequired', { field: t('dailyReview.register.weight') }),
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate();
  };
  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onDone()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle icon={Scale}>
            {t('dailyReview.register.weighInTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="gap-md grid grid-cols-2">
          <FormField
            id="review-weigh-date"
            label={t('common.fields.date')}
            icon={CalendarDays}
          >
            <DatePicker
              value={date}
              maxDate={new Date()}
              onChange={(d) => d && setDate(formatLocalDate(d))}
            />
          </FormField>
          <FormField
            id="review-weight"
            label={t('dailyReview.register.weight')}
            icon={Scale}
          >
            <DecimalInput
              id="review-weight"
              value={weight}
              onChange={(v) => {
                setWeight(v);
                setInvalid(false);
              }}
              min={0}
              max={500}
              decimals={1}
              unit="kg"
              aria-invalid={invalid}
            />
          </FormField>
        </div>
        <DialogFooter className="gap-sm">
          <Button variant="outline" onClick={onDone}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {!mutation.isPending && <Save className="h-4 w-4" />}
            {t('common.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
