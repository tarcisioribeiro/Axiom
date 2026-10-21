/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  GraduationCap,
  X,
  Play,
  Pause,
  Square,
  Timer,
  RotateCcw,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { AddSessionForm } from '@/components/library/CourseDetailModal';
import { ReadingForm } from '@/components/library/ReadingForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ReadingFormData } from '@/lib/validations';
import { booksService } from '@/services/books-service';
import { coursesService } from '@/services/courses-service';
import { readingsService } from '@/services/readings-service';
import { useAgentWidgetStore } from '@/stores/agent-widget-store';
import type { Book } from '@/types';
import type { Course } from '@/types/intellect';
import { getErrorMessage } from '@/utils/error-utils';

export type StudyTimerMode = 'reading' | 'course';
type TimerPhase = 'idle' | 'running' | 'paused';

interface PersistedState {
  resourceId: number | null;
  elapsed: number;
  phase: TimerPhase;
  startedAt: number | null;
}

const sessionKey = (mode: StudyTimerMode) => `studyTimer.${mode}`;

function loadState(mode: StudyTimerMode): PersistedState {
  try {
    const raw = sessionStorage.getItem(sessionKey(mode));
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    // ignore
  }
  return { resourceId: null, elapsed: 0, phase: 'idle', startedAt: null };
}

function saveState(mode: StudyTimerMode, s: PersistedState) {
  try {
    sessionStorage.setItem(sessionKey(mode), JSON.stringify(s));
  } catch {
    // ignore
  }
}

const COURSE_STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  paused: 1,
  not_started: 2,
};

function sortCoursesByStatus(courses: Course[]): Course[] {
  return courses
    .filter((c) => c.status in COURSE_STATUS_ORDER)
    .sort((a, b) => COURSE_STATUS_ORDER[a.status] - COURSE_STATUS_ORDER[b.status]);
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StudyTimer({ mode }: { mode: StudyTimerMode }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isReading = mode === 'reading';

  const hiddenByNav = useAgentWidgetStore((s) => s.hiddenByNav);

  const [isOpen, setIsOpen] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [state, setState] = useState<PersistedState>(() => loadState(mode));
  // Recurso recarregado ao encerrar — alimenta o modal com dados atuais
  // (páginas já lidas / aulas concluídas).
  const [confirmBook, setConfirmBook] = useState<Book | null>(null);
  const [confirmCourse, setConfirmCourse] = useState<Course | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recover elapsed time from startedAt when phase is 'running' (page reload).
  // Runs once via useQuery — avoids calling setState directly inside a plain
  // useEffect body.
  useQuery({
    queryKey: ['study-timer-recover', mode],
    queryFn: () => {
      if (state.phase === 'running' && state.startedAt) {
        const recovered = Math.floor((Date.now() - state.startedAt) / 1000);
        setState((s) => ({
          ...s,
          elapsed: s.elapsed + recovered,
          startedAt: Date.now(),
        }));
      }
      return true;
    },
  });

  // Tick
  useEffect(() => {
    if (state.phase === 'running') {
      intervalRef.current = setInterval(() => {
        setState((s) => ({ ...s, elapsed: s.elapsed + 1 }));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.phase]);

  useEffect(() => {
    saveState(mode, state);
  }, [mode, state]);

  // Load books ("Lendo") or courses ("Em andamento") when panel opens
  useEffect(() => {
    if (!isOpen) return;
    if (isReading) {
      void booksService
        .getAll()
        .then((items) => setBooks(items.filter((b) => b.read_status === 'reading')))
        .catch(() => {});
    } else {
      void coursesService
        .getAll()
        .then((items) => setCourses(sortCoursesByStatus(items)))
        .catch(() => {});
    }
  }, [isOpen, isReading]);

  const updateState = useCallback((patch: Partial<PersistedState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // Curso precisa existir e ter módulos com aulas cadastradas.
  const loadValidCourse = async (id: number): Promise<Course | null> => {
    try {
      const course = await coursesService.getById(id);
      if (course.total_lessons > 0) return course;
      toast({
        title: t('pages.libraryDashboard.studyTimerNoLessons'),
        variant: 'destructive',
      });
    } catch {
      toast({
        title: t('pages.libraryDashboard.studyTimerCourseNotFound'),
        variant: 'destructive',
      });
    }
    return null;
  };

  const handleStart = async () => {
    if (!isReading && state.phase === 'idle' && state.resourceId) {
      setIsBusy(true);
      const course = await loadValidCourse(state.resourceId);
      setIsBusy(false);
      if (!course) return;
    }
    updateState({ phase: 'running', startedAt: Date.now() });
  };

  const handlePause = () => {
    updateState({ phase: 'paused', startedAt: null });
  };

  const handleStop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    updateState({ phase: 'paused', startedAt: null });
    if (!state.resourceId) return;
    setIsBusy(true);
    try {
      if (isReading) {
        setConfirmBook(await booksService.getById(state.resourceId));
      } else {
        setConfirmCourse(await loadValidCourse(state.resourceId));
      }
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = () => {
    updateState({ phase: 'idle', elapsed: 0, startedAt: null });
  };

  const closeConfirm = () => {
    setConfirmBook(null);
    setConfirmCourse(null);
  };

  const finish = () => {
    closeConfirm();
    handleReset();
    setIsOpen(false);
  };

  const handleReadingSubmit = async (data: ReadingFormData) => {
    try {
      setIsBusy(true);
      await readingsService.create(data);
      toast({ title: t('pages.libraryDashboard.studyTimerSaved') });
      finish();
    } catch (err) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const durationMinutes = Math.max(1, Math.round(state.elapsed / 60));
  const isActive = state.phase !== 'idle';
  const canStart = state.phase === 'idle' && !!state.resourceId && !isBusy;
  const title = t(
    isReading
      ? 'pages.libraryDashboard.readingTimerTitle'
      : 'pages.libraryDashboard.studyTimerTitle'
  );
  const Icon = isReading ? BookOpen : GraduationCap;
  const options = isReading
    ? books.map((b) => ({ id: b.id, label: b.title }))
    : courses.map((c) => ({ id: c.id, label: c.title }));

  return (
    <>
      {/* Floating trigger */}
      <div
        className={cn(
          'gap-sm fixed right-6 bottom-6 z-40 flex flex-col items-end transition',
          // Fica fora do caminho quando o mouse está perto da paginação de
          // uma lista (ver stores/agent-widget-store.ts), exceto com o
          // painel aberto.
          hiddenByNav && !isOpen && 'pointer-events-none scale-75 opacity-0'
        )}
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="mb-sm bg-card w-72 rounded-lg border shadow-lg"
            >
              {/* Header */}
              <div className="px-md py-sm flex items-center justify-between border-b">
                <div className="gap-sm flex items-center">
                  <Timer className="text-category-intellect h-4 w-4" />
                  <span className="text-sm font-semibold">{title}</span>
                </div>
                <PlainButton
                  onClick={() => setIsOpen(false)}
                  className="p-xs text-muted-foreground hover:text-foreground rounded"
                  aria-label={t('common.actions.close')}
                >
                  <X className="h-4 w-4" />
                </PlainButton>
              </div>

              <div className="space-y-sm p-md">
                {/* Resource selector */}
                <Select
                  disabled={isActive}
                  value={state.resourceId ? String(state.resourceId) : ''}
                  onValueChange={(v) => updateState({ resourceId: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue
                      placeholder={t(
                        isReading
                          ? 'pages.libraryDashboard.studyTimerSelectBook'
                          : 'pages.libraryDashboard.studyTimerSelectCourse'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Timer display */}
                <div className="text-center text-3xl font-bold tracking-tight tabular-nums">
                  {formatElapsed(state.elapsed)}
                </div>

                {/* Controls */}
                <div className="gap-sm flex items-center justify-center overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    {state.phase === 'idle' && (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="gap-sm flex items-center justify-center"
                      >
                        <Button
                          size="sm"
                          disabled={!canStart}
                          onClick={() => void handleStart()}
                          className="bg-category-intellect hover:bg-category-intellect/90 text-white dark:text-black"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {t('pages.libraryDashboard.studyTimerStart')}
                        </Button>
                      </motion.div>
                    )}
                    {state.phase === 'running' && (
                      <motion.div
                        key="running"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="gap-sm flex items-center justify-center"
                      >
                        <Button size="sm" variant="outline" onClick={handlePause}>
                          <Pause className="h-3.5 w-3.5" />
                          {t('pages.libraryDashboard.studyTimerPause')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isBusy}
                          onClick={() => void handleStop()}
                        >
                          <Square className="h-3.5 w-3.5" />
                          {t('pages.libraryDashboard.studyTimerStop')}
                        </Button>
                      </motion.div>
                    )}
                    {state.phase === 'paused' && (
                      <motion.div
                        key="paused"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="gap-sm flex items-center justify-center"
                      >
                        <Button
                          size="sm"
                          onClick={() => void handleStart()}
                          className="bg-category-intellect hover:bg-category-intellect/90 text-white dark:text-black"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {t('pages.libraryDashboard.studyTimerResume')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isBusy}
                          onClick={() => void handleStop()}
                        >
                          <Square className="h-3.5 w-3.5" />
                          {t('pages.libraryDashboard.studyTimerStop')}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-foreground w-full"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('pages.libraryDashboard.studyTimerCancel')}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button */}
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="bg-category-intellect hoverable:hover:scale-105 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 dark:text-black"
          aria-label={title}
        >
          {state.phase === 'running' ? (
            <span className="text-xs font-bold tabular-nums">
              {formatElapsed(state.elapsed).split(':').slice(-2).join(':')}
            </span>
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Registro da leitura (reaproveita ReadingForm) */}
      <Dialog open={!!confirmBook} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle mode="create">{t('pages.readings.newTitle')}</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>{confirmBook?.title}</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {confirmBook && (
            <ReadingForm
              books={[confirmBook]}
              defaultReadingTime={durationMinutes}
              lockSession
              onSubmit={(data) => void handleReadingSubmit(data)}
              onCancel={closeConfirm}
              isLoading={isBusy}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Registro da sessão de estudo (reaproveita AddSessionForm) */}
      <Dialog open={!!confirmCourse} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle icon={Timer}>
              {t('pages.libraryDashboard.studyTimerConfirmTitle')}
            </DialogTitle>
            <DialogDescription>{confirmCourse?.title}</DialogDescription>
          </DialogHeader>
          {confirmCourse && (
            <AddSessionForm
              course={confirmCourse}
              defaultMinutes={durationMinutes}
              onSaved={finish}
              onCancel={closeConfirm}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
