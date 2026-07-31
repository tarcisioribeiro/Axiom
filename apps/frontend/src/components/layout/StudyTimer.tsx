/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { BookOpen, X, Play, Pause, Square, Timer } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import { booksService } from '@/services/books-service';
import { coursesService, courseSessionsService } from '@/services/courses-service';
import { membersService } from '@/services/members-service';
import { readingsService } from '@/services/readings-service';
import type { Book } from '@/types';
import type { Course } from '@/types/intellect';
import { getErrorMessage } from '@/utils/error-utils';

const SESSION_KEY = 'studyTimer.state';

type TimerMode = 'reading' | 'course';
type TimerPhase = 'idle' | 'running' | 'paused';

interface PersistedState {
  mode: TimerMode;
  bookId: number | null;
  courseId: number | null;
  elapsed: number;
  phase: TimerPhase;
  startedAt: number | null;
}

function loadState(): PersistedState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    // ignore
  }
  return {
    mode: 'reading',
    bookId: null,
    courseId: null,
    elapsed: 0,
    phase: 'idle',
    startedAt: null,
  };
}

function saveState(s: PersistedState) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StudyTimer() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [state, setState] = useState<PersistedState>(loadState);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pagesRead, setPagesRead] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Recover elapsed time from startedAt when phase is 'running' (page reload).
  // Runs once via useQuery — avoids calling setState directly inside a plain
  // useEffect body.
  useQuery({
    queryKey: ['study-timer-recover'],
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
        setState((s) => {
          const next = { ...s, elapsed: s.elapsed + 1 };
          saveState(next);
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.phase]);

  // Persist non-elapsed state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Load books + courses when panel opens
  useEffect(() => {
    if (!isOpen) return;
    void booksService
      .getAll()
      .then((items) => setBooks(items.filter((b) => b.read_status !== 'read')))
      .catch(() => {});
    void coursesService
      .getAll()
      .then((items) => setCourses(items))
      .catch(() => {});
  }, [isOpen]);

  const updateState = useCallback((patch: Partial<PersistedState>) => {
    setState((s) => {
      const next = { ...s, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  const handleStart = () => {
    updateState({ phase: 'running', startedAt: Date.now() });
  };

  const handlePause = () => {
    updateState({ phase: 'paused', startedAt: null });
  };

  const handleStop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    updateState({ phase: 'paused', startedAt: null });
    setShowConfirm(true);
  };

  const handleReset = () => {
    updateState({ phase: 'idle', elapsed: 0, startedAt: null });
    setPagesRead('');
  };

  const handleSave = async () => {
    const { mode, bookId, courseId, elapsed } = stateRef.current;
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));

    try {
      setIsSaving(true);
      const member = await membersService.getCurrentUserMember();
      const today = formatLocalDate(new Date());

      if (mode === 'reading' && bookId) {
        await readingsService.create({
          book: bookId,
          reading_date: today,
          reading_time: durationMinutes,
          pages_read: parseInt(pagesRead || '0', 10) || 1,
          owner: member.id,
        });
      } else if (mode === 'course' && courseId) {
        await courseSessionsService.create({
          course: courseId,
          session_date: today,
          duration_minutes: durationMinutes,
          owner: member.id,
        });
      }

      toast({ title: t('pages.libraryDashboard.studyTimerSaved') });
      setShowConfirm(false);
      handleReset();
      setIsOpen(false);
    } catch (err) {
      toast({
        title: t('common.error'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isActive = state.phase !== 'idle';
  const selectedBook = books.find((b) => b.id === state.bookId);
  const selectedCourse = courses.find((c) => c.id === state.courseId);
  const canStart =
    state.phase === 'idle' &&
    ((state.mode === 'reading' && !!state.bookId) ||
      (state.mode === 'course' && !!state.courseId));

  return (
    <>
      {/* Floating trigger */}
      <div className="gap-sm fixed right-6 bottom-6 z-40 flex flex-col items-end">
        {isOpen && (
          <div className="mb-sm bg-card w-72 rounded-lg border shadow-lg">
            {/* Header */}
            <div className="px-md py-sm flex items-center justify-between border-b">
              <div className="gap-sm flex items-center">
                <Timer className="text-primary h-4 w-4" />
                <span className="text-sm font-semibold">
                  {t('pages.libraryDashboard.studyTimerTitle')}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-xs text-muted-foreground hover:text-foreground rounded"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-sm p-md">
              {/* Mode selector */}
              <div className="gap-xs flex rounded-md border p-0.5">
                {(['reading', 'course'] as TimerMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={isActive}
                    onClick={() =>
                      updateState({ mode: m, bookId: null, courseId: null })
                    }
                    className={`px-sm py-xs flex-1 rounded text-xs transition-colors ${
                      state.mode === m
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground disabled:cursor-not-allowed'
                    }`}
                  >
                    {t(
                      m === 'reading'
                        ? 'pages.libraryDashboard.studyTimerReading'
                        : 'pages.libraryDashboard.studyTimerCourse'
                    )}
                  </button>
                ))}
              </div>

              {/* Resource selector */}
              {state.mode === 'reading' ? (
                <Select
                  disabled={isActive}
                  value={state.bookId ? String(state.bookId) : ''}
                  onValueChange={(v) => updateState({ bookId: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue
                      placeholder={t('pages.libraryDashboard.studyTimerSelectBook')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {books.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  disabled={isActive}
                  value={state.courseId ? String(state.courseId) : ''}
                  onValueChange={(v) => updateState({ courseId: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue
                      placeholder={t('pages.libraryDashboard.studyTimerSelectCourse')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Timer display */}
              <div className="text-center text-3xl font-bold tracking-tight tabular-nums">
                {formatElapsed(state.elapsed)}
              </div>

              {/* Controls */}
              <div className="gap-sm flex items-center justify-center">
                {state.phase === 'idle' && (
                  <Button size="sm" disabled={!canStart} onClick={handleStart}>
                    <Play className="mr-xs h-3.5 w-3.5" />
                    {t('pages.libraryDashboard.studyTimerStart')}
                  </Button>
                )}
                {state.phase === 'running' && (
                  <>
                    <Button size="sm" variant="outline" onClick={handlePause}>
                      <Pause className="mr-xs h-3.5 w-3.5" />
                      {t('pages.libraryDashboard.studyTimerPause')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleStop}>
                      <Square className="mr-xs h-3.5 w-3.5" />
                      {t('pages.libraryDashboard.studyTimerStop')}
                    </Button>
                  </>
                )}
                {state.phase === 'paused' && (
                  <>
                    <Button size="sm" onClick={handleStart}>
                      <Play className="mr-xs h-3.5 w-3.5" />
                      {t('pages.libraryDashboard.studyTimerResume')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleStop}>
                      <Square className="mr-xs h-3.5 w-3.5" />
                      {t('pages.libraryDashboard.studyTimerStop')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label={t('pages.libraryDashboard.studyTimerTitle')}
        >
          {state.phase === 'running' ? (
            <span className="text-xs font-bold tabular-nums">
              {formatElapsed(state.elapsed).split(':').slice(-2).join(':')}
            </span>
          ) : (
            <BookOpen className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!open) setShowConfirm(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('pages.libraryDashboard.studyTimerConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {state.mode === 'reading' && selectedBook
                ? selectedBook.title
                : (selectedCourse?.title ?? '')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-md py-sm">
            <div className="bg-muted px-md py-sm flex items-center justify-between rounded-lg">
              <span className="text-muted-foreground text-sm">
                {t('pages.libraryDashboard.studyTimerDuration')}
              </span>
              <span className="text-sm font-bold">{formatElapsed(state.elapsed)}</span>
            </div>
            {state.mode === 'reading' && (
              <div className="space-y-xs">
                <Label htmlFor="pages-read" className="text-sm">
                  {t('pages.libraryDashboard.studyTimerPagesRead')}
                </Label>
                <Input
                  id="pages-read"
                  type="number"
                  min={1}
                  value={pagesRead}
                  onChange={(e) => setPagesRead(e.target.value)}
                  placeholder="0"
                  className="h-8"
                />
              </div>
            )}
          </div>
          <div className="gap-sm flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowConfirm(false);
                handleReset();
              }}
            >
              {t('pages.libraryDashboard.studyTimerCancel')}
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
              {t('pages.libraryDashboard.studyTimerSave')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
