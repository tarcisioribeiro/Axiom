import { motion } from 'framer-motion';
import { Target, Pencil, Plus, Trophy, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { ReadingGoalFormData } from '@/lib/validations';
import { readingGoalsService } from '@/services/reading-goals-service';
import type { ReadingGoal } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { ReadingGoalModal } from './ReadingGoalModal';

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
  const progressColor = isCompleted
    ? 'hsl(var(--chart-2))' // green-ish when done
    : 'hsl(var(--primary))';

  return (
    <svg width={size} height={size} className="-rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface ReadingGoalCardProps {
  onGoalChange?: () => void;
}

export function ReadingGoalCard({ onGoalChange }: ReadingGoalCardProps) {
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    void loadGoal();
  }, []);

  const loadGoal = async () => {
    try {
      setIsLoading(true);
      const goals = await readingGoalsService.getAll({ year: currentYear });
      const yearGoal = goals.find((g) => g.year === currentYear) ?? null;
      setGoal(yearGoal);

      if (yearGoal && yearGoal.progress_percentage >= 100) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 1200);
      }
    } catch {
      // silently fail — goal is optional
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: ReadingGoalFormData) => {
    try {
      setIsSaving(true);
      if (goal) {
        const updated = await readingGoalsService.update(goal.id, data);
        setGoal(updated);
      } else {
        const created = await readingGoalsService.create(data);
        setGoal(created);
      }
      toast({
        title: goal ? 'Meta atualizada!' : 'Meta criada!',
        description: `Meta de ${data.books_goal} livros para ${data.year}.`,
      });
      setIsModalOpen(false);
      onGoalChange?.();
    } catch (error) {
      toast({
        title: 'Erro ao salvar meta',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isCompleted = (goal?.progress_percentage ?? 0) >= 100;
  const booksRead = goal?.books_read_this_year ?? 0;
  const booksGoal = goal?.books_goal ?? 0;
  const progress = goal?.progress_percentage ?? 0;
  const pagesRead = goal?.pages_read_this_year ?? 0;

  return (
    <>
      <Card className="relative overflow-hidden">
        {showCelebration && <CelebrationBurst />}

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Meta de Leitura {currentYear}
          </CardTitle>
          <div className="flex items-center gap-1">
            {goal ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsModalOpen(true)}
                title="Editar meta"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsModalOpen(true)}
                title="Definir meta"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex h-[140px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : goal ? (
            <div className="flex flex-col items-center gap-3">
              {/* Circular progress */}
              <div className="relative flex items-center justify-center">
                <CircularProgress percentage={progress} isCompleted={isCompleted} />
                <div className="absolute flex flex-col items-center">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      <Trophy className="h-7 w-7 text-yellow-500" />
                    </motion.div>
                  ) : (
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-xl font-bold leading-tight">
                    {progress.toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {booksRead}/{booksGoal}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                <span>
                  {booksRead === 1 ? '1 livro lido' : `${booksRead} livros lidos`}
                </span>
                <span>{pagesRead.toLocaleString('pt-BR')} páginas</span>
              </div>

              {/* Celebration message */}
              {isCompleted && (
                <motion.p
                  className="text-center text-xs font-medium text-yellow-600 dark:text-yellow-400"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  🎉 Meta atingida! Parabéns!
                </motion.p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <Target className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-center text-sm text-muted-foreground">
                Defina uma meta de leitura para {currentYear}
              </p>
              <Button size="sm" variant="outline" onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Definir meta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ReadingGoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        goal={goal ?? undefined}
        isLoading={isSaving}
      />
    </>
  );
}
