/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Target, Pencil, Plus, Trophy, BookOpen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { DURATION, EASE_OUT } from '@/lib/animations/transitions';
import { cn } from '@/lib/utils';
import type { ReadingGoalFormData } from '@/lib/validations';
import { literaryTypeGoalsService } from '@/services/literary-type-goals-service';
import { readingGoalsService } from '@/services/reading-goals-service';
import type { LiteraryTypeGoal, ReadingGoal } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { ReadingGoalModal, type LiteraryTypeGoalDraft } from './ReadingGoalModal';

// ─── Celebration Particles ────────────────────────────────────────────────────

function CelebrationBurst() {
  const particles = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      {particles.map((i) => {
        const angle = (i / particles.length) * 360;
        const x = Math.cos((angle * Math.PI) / 180) * 60;
        const y = Math.sin((angle * Math.PI) / 180) * 60;
        const colors = ['bg-star', 'bg-accent', 'bg-info', 'bg-success', 'bg-primary'];
        return (
          <motion.div
            key={i}
            className={`absolute top-1/2 left-1/2 h-2 w-2 rounded-full ${colors[i % colors.length]}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0 }}
            transition={{ duration: DURATION.slow, delay: i * 0.05, ease: EASE_OUT }}
          />
        );
      })}
    </div>
  );
}

// ─── Single Goal Panel ────────────────────────────────────────────────────────

interface GoalPanelProps {
  goal: ReadingGoal;
  onEdit: () => void;
  onDelete: () => void;
  showCelebration: boolean;
}

function GoalPanel({ goal, onEdit, onDelete, showCelebration }: GoalPanelProps) {
  const { t, i18n } = useTranslation();
  const isCompleted = goal.progress_percentage >= 100;
  const ltgs = goal.literary_type_goals ?? [];

  return (
    <div className="relative space-y-3">
      {showCelebration && <CelebrationBurst />}

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          {goal.name
            ? goal.name
            : t('pages.libraryDashboard.readingGoals.goalFallbackName', {
                year: goal.year,
              })}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
            aria-label={t('pages.libraryDashboard.readingGoals.editTitle')}
          >
            <Pencil className={cn('h-3.5 w-3.5', ACTION_COLOR.edit)} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDelete}
            aria-label={t('pages.libraryDashboard.readingGoals.deleteTitle')}
          >
            <Trash2 className={cn('h-3.5 w-3.5', ACTION_COLOR.delete)} />
          </Button>
        </div>
      </div>

      <div className="gap-md flex items-center">
        <div className="relative flex items-center justify-center">
          <CircularProgress
            value={goal.progress_percentage}
            size={100}
            strokeWidth={8}
            color={isCompleted ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
          >
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <Trophy className="text-warning h-5 w-5" />
                </motion.div>
              ) : (
                <BookOpen className="text-muted-foreground h-4 w-4" />
              )}
              <span className="text-base leading-tight font-bold">
                {goal.progress_percentage.toFixed(0)}%
              </span>
              <span className="text-muted-foreground text-2xs">
                {goal.books_read_this_year}/{goal.books_goal}
              </span>
            </div>
          </CircularProgress>
        </div>

        <div className="space-y-sm min-w-0 flex-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {t('pages.libraryDashboard.readingGoals.booksRead', {
                count: goal.books_read_this_year,
              })}
            </span>
            <span>
              {t('pages.libraryDashboard.readingGoals.pagesAbbrev', {
                pages: goal.pages_read_this_year,
              })}
            </span>
          </div>

          {goal.pages_goal > 0 && (
            <div className="space-y-0.5">
              <div className="text-muted-foreground text-2xs flex justify-between">
                <span>{t('pages.libraryDashboard.readingGoals.pages')}</span>
                <span>
                  {goal.pages_read_this_year.toLocaleString(i18n.language)} /{' '}
                  {goal.pages_goal.toLocaleString(i18n.language)} (
                  {goal.pages_progress_percentage.toFixed(0)}%)
                </span>
              </div>
              <Progress
                value={Math.min(goal.pages_progress_percentage, 100)}
                className="bg-muted h-1.5"
              />
            </div>
          )}

          {ltgs.length > 0 && (
            <div className="space-y-xs pt-xs border-t">
              {ltgs.map((ltg) => (
                <div key={ltg.id} className="space-y-0.5">
                  <div className="text-muted-foreground text-2xs flex justify-between">
                    <span>{t('pages.books.literaryTypes.' + ltg.literary_type)}</span>
                    <span>
                      {ltg.books_read_this_year}/{ltg.goal_count}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(ltg.progress_percentage, 100)}
                    className="bg-muted h-1"
                    indicatorClassName="bg-primary/70"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isCompleted && (
        <motion.p
          className="text-warning text-center text-xs font-medium"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {t('pages.libraryDashboard.readingGoals.achieved')}
        </motion.p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ReadingGoalsDialogProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY_GOALS: ReadingGoal[] = [];

/**
 * Metas de leitura do ano (aberto pelo botão "Meta de Leitura" no header de
 * Obras): modal de ação com o progresso de cada meta e incluir/editar/excluir.
 */
export function ReadingGoalsDialog({ open, onClose }: ReadingGoalsDialogProps) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ReadingGoal | undefined>();
  const [celebrationId, setCelebrationId] = useState<number | null>(null);
  const { toast } = useToast();
  const { showDelete } = useAlertDialog();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();

  const { data: goals = EMPTY_GOALS, isLoading } = useQuery({
    queryKey: ['reading-goals', currentYear],
    queryFn: async () => {
      try {
        const data = await readingGoalsService.getAll({ year: currentYear });
        const yearGoals = data.filter((g) => g.year === currentYear);

        const completed = yearGoals.find((g) => g.progress_percentage >= 100);
        if (completed) {
          setCelebrationId(completed.id);
          setTimeout(() => setCelebrationId(null), 1200);
        }
        return yearGoals;
      } catch {
        // silently fail — goals are optional
        return EMPTY_GOALS;
      }
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['reading-goals', currentYear] });

  const openNewGoal = () => {
    setEditingGoal(undefined);
    setIsModalOpen(true);
  };

  const openEditGoal = (goal: ReadingGoal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleDeleteGoal = async (goal: ReadingGoal) => {
    const confirmed = await showDelete(
      t('pages.libraryDashboard.readingGoals.deleteConfirm', {
        name:
          goal.name ??
          t('pages.libraryDashboard.readingGoals.goalFallbackName', {
            year: goal.year,
          }),
      })
    );
    if (!confirmed) return;
    try {
      await readingGoalsService.delete(goal.id);
      toast({ title: t('pages.libraryDashboard.readingGoals.deleted') });
      await refresh();
    } catch (error) {
      toast({
        title: t('pages.libraryDashboard.readingGoals.deleteError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (
    data: ReadingGoalFormData,
    ltgDrafts: LiteraryTypeGoalDraft[]
  ) => {
    try {
      setIsSaving(true);

      const saved = editingGoal
        ? await readingGoalsService.update(editingGoal.id, data)
        : await readingGoalsService.create(data);

      const readingGoalId = saved.id;
      const existingLtgs: LiteraryTypeGoal[] = editingGoal?.literary_type_goals ?? [];

      const draftsWithId = ltgDrafts.filter((d) => d.id !== undefined);
      const draftsNew = ltgDrafts.filter((d) => d.id === undefined);
      const draftIds = new Set(draftsWithId.map((d) => d.id));
      const toDelete = existingLtgs.filter((e) => !draftIds.has(e.id));

      await Promise.all([
        ...toDelete.map((e) => literaryTypeGoalsService.delete(e.id)),
        ...draftsWithId.map((d) =>
          literaryTypeGoalsService.update(d.id!, {
            reading_goal: readingGoalId,
            literary_type: d.literary_type,
            goal_count: d.goal_count,
          })
        ),
        ...draftsNew.map((d) =>
          literaryTypeGoalsService.create({
            reading_goal: readingGoalId,
            literary_type: d.literary_type,
            goal_count: d.goal_count,
          })
        ),
      ]);

      await refresh();

      toast({
        title: t('pages.libraryDashboard.readingGoals.saved', {
          count: data.books_goal,
          year: data.year,
        }),
      });
      setIsModalOpen(false);
    } catch (error) {
      toast({
        title: t('pages.libraryDashboard.readingGoals.saveError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open && !isLoading} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle icon={Target}>
              {t('pages.libraryDashboard.readingGoals.title', { year: currentYear })}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.libraryDashboard.readingGoals.title', { year: currentYear })}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {goals.length > 0 ? (
            <PaginatedSlide
              items={goals}
              pageSize={2}
              pinNav={false}
              className="divide-y"
            >
              {(pageGoals) =>
                pageGoals.map((goal) => (
                  <div key={goal.id} className="py-3 first:pt-0 last:pb-0">
                    <GoalPanel
                      goal={goal}
                      onEdit={() => openEditGoal(goal)}
                      onDelete={() => void handleDeleteGoal(goal)}
                      showCelebration={celebrationId === goal.id}
                    />
                  </div>
                ))
              }
            </PaginatedSlide>
          ) : (
            <EmptyState
              icon={<Target />}
              title={t('pages.libraryDashboard.readingGoals.setGoalFor', {
                year: currentYear,
              })}
            />
          )}
          <DialogCloseFooter>
            <Button onClick={openNewGoal}>
              <Plus className="h-4 w-4" />
              {t('pages.libraryDashboard.readingGoals.newTitle')}
            </Button>
          </DialogCloseFooter>
        </DialogContent>
      </Dialog>

      <ReadingGoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        goal={editingGoal}
        isLoading={isSaving}
      />
    </>
  );
}
