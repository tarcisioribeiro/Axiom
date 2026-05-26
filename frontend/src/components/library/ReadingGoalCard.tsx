/* eslint-disable max-lines */
import { motion } from 'framer-motion';
import { Target, Pencil, Plus, Trophy, BookOpen, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { ReadingGoalFormData } from '@/lib/validations';
import { literaryTypeGoalsService } from '@/services/literary-type-goals-service';
import { readingGoalsService } from '@/services/reading-goals-service';
import type { LiteraryTypeGoal, ReadingGoal } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { ReadingGoalModal, type LiteraryTypeGoalDraft } from './ReadingGoalModal';

// ─── SVG Circular Progress ────────────────────────────────────────────────────

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  isCompleted: boolean;
}

function CircularProgress({
  percentage,
  size = 140,
  strokeWidth = 10,
  isCompleted,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(percentage, 100) / 100);

  const trackColor = 'hsl(var(--muted))';
  const progressColor = isCompleted ? 'hsl(var(--chart-2))' : 'hsl(var(--primary))';

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={progressColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ─── Celebration Particles ────────────────────────────────────────────────────

function CelebrationBurst() {
  const particles = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      {particles.map((i) => {
        const angle = (i / particles.length) * 360;
        const x = Math.cos((angle * Math.PI) / 180) * 60;
        const y = Math.sin((angle * Math.PI) / 180) * 60;
        const colors = [
          'bg-yellow-400',
          'bg-pink-400',
          'bg-blue-400',
          'bg-green-400',
          'bg-purple-400',
        ];
        return (
          <motion.div
            key={i}
            className={`absolute left-1/2 top-1/2 h-2 w-2 rounded-full ${colors[i % colors.length]}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
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
        <span className="text-xs font-medium text-muted-foreground">
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
            className="h-6 w-6"
            onClick={onEdit}
            title={t('pages.libraryDashboard.readingGoals.editTitle')}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={onDelete}
            title={t('pages.libraryDashboard.readingGoals.deleteTitle')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-md">
        <div className="relative flex items-center justify-center">
          <CircularProgress
            percentage={goal.progress_percentage}
            size={100}
            strokeWidth={8}
            isCompleted={isCompleted}
          />
          <div className="absolute flex flex-col items-center">
            {isCompleted ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Trophy className="h-5 w-5 text-yellow-500" />
              </motion.div>
            ) : (
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-base font-bold leading-tight">
              {goal.progress_percentage.toFixed(0)}%
            </span>
            <span className="text-[10px] text-muted-foreground">
              {goal.books_read_this_year}/{goal.books_goal}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-sm">
          <div className="flex justify-between text-xs text-muted-foreground">
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
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t('pages.libraryDashboard.readingGoals.pages')}</span>
                <span>
                  {goal.pages_read_this_year.toLocaleString(i18n.language)} /{' '}
                  {goal.pages_goal.toLocaleString(i18n.language)} (
                  {goal.pages_progress_percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(goal.pages_progress_percentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          {ltgs.length > 0 && (
            <div className="space-y-xs border-t pt-xs">
              {ltgs.map((ltg) => (
                <div key={ltg.id} className="space-y-0.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{t('pages.books.literaryTypes.' + ltg.literary_type)}</span>
                    <span>
                      {ltg.books_read_this_year}/{ltg.goal_count}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(ltg.progress_percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isCompleted && (
        <motion.p
          className="text-center text-xs font-medium text-yellow-600 dark:text-yellow-400"
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

interface ReadingGoalCardProps {
  onGoalChange?: () => void;
}

export function ReadingGoalCard({ onGoalChange }: ReadingGoalCardProps) {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<ReadingGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ReadingGoal | undefined>();
  const [celebrationId, setCelebrationId] = useState<number | null>(null);
  const { toast } = useToast();
  const { showDelete } = useAlertDialog();

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    void loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGoals = async () => {
    try {
      setIsLoading(true);
      const data = await readingGoalsService.getAll({ year: currentYear });
      const yearGoals = data.filter((g) => g.year === currentYear);
      setGoals(yearGoals);

      const completed = yearGoals.find((g) => g.progress_percentage >= 100);
      if (completed) {
        setCelebrationId(completed.id);
        setTimeout(() => setCelebrationId(null), 1200);
      }
    } catch {
      // silently fail — goals are optional
    } finally {
      setIsLoading(false);
    }
  };

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
      await loadGoals();
      onGoalChange?.();
    } catch (error) {
      toast({
        title: t('pages.libraryDashboard.readingGoals.deleteError'),
        description: getErrorMessage(error),
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

      await loadGoals();

      toast({
        title: editingGoal
          ? t('pages.libraryDashboard.readingGoals.updated')
          : t('pages.libraryDashboard.readingGoals.created'),
        description: `Meta de ${data.books_goal} livros para ${data.year}.`,
      });
      setIsModalOpen(false);
      onGoalChange?.();
    } catch (error) {
      toast({
        title: t('pages.libraryDashboard.readingGoals.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
          <CardTitle className="text-sm font-medium">
            {t('pages.libraryDashboard.readingGoals.title', { year: currentYear })}
          </CardTitle>
          <div className="flex items-center gap-xs">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={openNewGoal}
              title={t('pages.libraryDashboard.readingGoals.newTitle')}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex h-[140px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : goals.length > 0 ? (
            <div className="divide-y">
              {goals.map((goal) => (
                <div key={goal.id} className="py-3 first:pt-0 last:pb-0">
                  <GoalPanel
                    goal={goal}
                    onEdit={() => openEditGoal(goal)}
                    onDelete={() => void handleDeleteGoal(goal)}
                    showCelebration={celebrationId === goal.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-md">
              <Target className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-center text-sm text-muted-foreground">
                {t('pages.libraryDashboard.readingGoals.setGoalFor', {
                  year: currentYear,
                })}
              </p>
              <Button size="sm" variant="outline" onClick={openNewGoal}>
                <Plus className="mr-xs h-3.5 w-3.5" />
                {t('pages.libraryDashboard.readingGoals.setGoal')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
