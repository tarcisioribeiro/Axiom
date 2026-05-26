/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Edit, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { membersService } from '@/services/members-service';
import { exerciseService } from '@/services/workout-service';
import type { Exercise } from '@/types/workout';

interface ExerciseFormValues {
  name: string;
  muscle_groups: string;
  description: string;
}

type DialogMode = { type: 'new' } | { type: 'edit'; exercise: Exercise } | null;

export default function ExercisesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const ownerId = member?.id ?? 0;

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['exercises'] });

  const createMutation = useMutation({
    mutationFn: (data: ExerciseFormValues) =>
      exerciseService.create({ ...data, owner: ownerId }),
    onSuccess: () => {
      void invalidate();
      toast({ title: t('pages.exercises.created') });
      setDialog(null);
    },
    onError: () =>
      toast({ title: t('pages.exercises.saveError'), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExerciseFormValues }) =>
      exerciseService.update(id, { ...data, owner: ownerId }),
    onSuccess: () => {
      void invalidate();
      toast({ title: t('pages.exercises.updated') });
      setDialog(null);
    },
    onError: () =>
      toast({ title: t('pages.exercises.saveError'), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => exerciseService.delete(id),
    onSuccess: () => {
      void invalidate();
      toast({ title: t('pages.exercises.deleted') });
    },
  });

  const handleDelete = async (exercise: Exercise) => {
    const confirmed = await showConfirm({
      title: t('pages.exercises.deleteTitle'),
      description: t('pages.exercises.deleteDesc', { name: exercise.name }),
    });
    if (confirmed) deleteMutation.mutate(exercise.id);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.exercises.title')}
          icon={<Dumbbell className="h-6 w-6 text-category-exercise" />}
        />

        <div className="mb-md flex justify-end">
          <Button onClick={() => setDialog({ type: 'new' })}>
            <Plus className="mr-sm h-4 w-4" />
            {t('pages.exercises.newBtn')}
          </Button>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : exercises.length === 0 ? (
          <EmptyState
            title={t('pages.exercises.empty')}
            description={t('pages.exercises.emptyDesc')}
            icon={<Dumbbell className="h-8 w-8" />}
          />
        ) : (
          <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onEdit={() => setDialog({ type: 'edit', exercise })}
                onDelete={() => handleDelete(exercise)}
              />
            ))}
          </div>
        )}

        <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialog?.type === 'edit'
                  ? t('pages.exercises.editTitle')
                  : t('pages.exercises.newTitle')}
              </DialogTitle>
              <DialogDescription>
                {dialog?.type === 'edit'
                  ? t('pages.exercises.editDesc')
                  : t('pages.exercises.newDesc')}
              </DialogDescription>
            </DialogHeader>

            {dialog && (
              <ExerciseForm
                exercise={dialog.type === 'edit' ? dialog.exercise : undefined}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit') {
                    await updateMutation.mutateAsync({ id: dialog.exercise.id, data });
                  } else {
                    await createMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={isSubmitting}
              />
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}

function ExerciseCard({
  exercise,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card p-md transition-shadow hover:shadow-md">
      <div className="mb-sm flex items-start justify-between gap-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-exercise/10">
          <Dumbbell className="h-5 w-5 text-category-exercise" />
        </div>
        <div className="flex gap-xs opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="font-semibold leading-tight text-foreground">{exercise.name}</p>

      {exercise.muscle_groups && (
        <p className="mt-xs text-xs text-muted-foreground">{exercise.muscle_groups}</p>
      )}

      {exercise.description && (
        <p className="mt-sm line-clamp-2 text-xs text-muted-foreground/70">
          {exercise.description}
        </p>
      )}
    </div>
  );
}

function ExerciseForm({
  exercise,
  onSubmit,
  onCancel,
  isLoading,
}: {
  exercise?: Exercise;
  onSubmit: (data: ExerciseFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExerciseFormValues>({
    defaultValues: {
      name: exercise?.name ?? '',
      muscle_groups: exercise?.muscle_groups ?? '',
      description: exercise?.description ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="ex-name">{t('pages.exercises.fieldName')}</Label>
        <Input
          id="ex-name"
          placeholder={t('pages.exercises.fieldNamePlaceholder')}
          {...register('name', { required: true })}
          className={errors.name ? 'border-destructive' : ''}
        />
      </div>

      <div className="space-y-sm">
        <Label htmlFor="ex-muscles">{t('pages.exercises.fieldMuscles')}</Label>
        <Input
          id="ex-muscles"
          placeholder={t('pages.exercises.fieldMusclesPlaceholder')}
          {...register('muscle_groups')}
        />
      </div>

      <div className="space-y-sm">
        <Label htmlFor="ex-desc">{t('pages.exercises.fieldDescription')}</Label>
        <Textarea
          id="ex-desc"
          placeholder={t('pages.exercises.fieldDescriptionPlaceholder')}
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
