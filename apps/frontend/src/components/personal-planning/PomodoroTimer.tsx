import {
  PauseIcon as Pause,
  PlayIcon as Play,
  ArrowUturnLeftIcon as RotateCcw,
  XMarkIcon as X,
  ClockIcon as Timer,
} from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Phase = 'work' | 'break';

interface PomodoroTimerProps {
  taskName?: string;
  workMinutes?: number;
  breakMinutes?: number;
  onComplete?: () => void;
  onClose?: () => void;
}

export function PomodoroTimer({
  taskName,
  workMinutes = 25,
  breakMinutes = 5,
  onComplete,
  onClose,
}: PomodoroTimerProps) {
  const workSeconds = workMinutes * 60;
  const breakSeconds = breakMinutes * 60;

  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(workSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = phase === 'work' ? workSeconds : breakSeconds;
  const progress = 1 - secondsLeft / totalSeconds;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            if (phase === 'work') {
              setCycles((c) => c + 1);
              onComplete?.();
              setPhase('break');
              setSecondsLeft(breakSeconds);
            } else {
              setPhase('work');
              setSecondsLeft(workSeconds);
            }
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, phase, workSeconds, breakSeconds, onComplete]);

  const toggle = () => setIsRunning((r) => !r);

  const reset = () => {
    setIsRunning(false);
    setPhase('work');
    setSecondsLeft(workSeconds);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Rendered via portal: this card is mounted inside a draggable Kanban card
  // (Framer Motion + dnd-kit both apply a CSS `transform` to that ancestor),
  // which turns `position: fixed` into "fixed relative to that ancestor"
  // instead of the viewport — making the panel drift with the card's own
  // hover/drag transform. Portaling to document.body escapes that transformed
  // containing block so the panel stays fixed to the viewport as intended.
  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      // right-24 (not right-6) — clears the global StudyTimer trigger, which
      // anchors at bottom-6 right-6 and would otherwise sit hidden directly
      // underneath this panel.
      className="bg-card fixed right-24 bottom-6 z-50 w-64 rounded-2xl border shadow-2xl"
    >
      <div
        className={cn(
          'px-md py-sm rounded-t-2xl text-center text-xs font-semibold tracking-wider uppercase transition-colors',
          phase === 'work' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
        )}
      >
        {phase === 'work' ? 'Foco' : 'Pausa'}
        {cycles > 0 && <span className="ml-sm opacity-60">#{cycles + 1}</span>}
      </div>

      <div className="p-md">
        {taskName && (
          <p className="mb-sm text-muted-foreground truncate text-center text-xs">
            {taskName}
          </p>
        )}

        <div className="mb-md relative mx-auto flex h-28 w-28 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 112 112">
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted/20"
            />
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className={phase === 'work' ? 'text-primary' : 'text-success'}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="relative font-mono text-3xl font-bold tabular-nums">
            {timeStr}
          </span>
        </div>

        <div className="gap-sm flex items-center justify-center">
          <Button size="sm" variant="outline" onClick={reset} aria-label="Reiniciar">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={toggle}
            className={cn(
              'w-20',
              phase === 'work'
                ? 'bg-primary'
                : 'bg-success text-success-foreground hover:bg-success/90'
            )}
          >
            {isRunning ? (
              <Pause className="mr-xs h-3.5 w-3.5" />
            ) : (
              <Play className="mr-xs h-3.5 w-3.5" />
            )}
            {isRunning ? 'Pausar' : 'Iniciar'}
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Fechar">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

interface PomodoroTriggerButtonProps {
  taskName?: string;
  onComplete?: () => void;
}

export function PomodoroTriggerButton({
  taskName,
  onComplete,
}: PomodoroTriggerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        title="Iniciar Foco (Pomodoro)"
        aria-label="Iniciar Foco"
        className="shrink-0"
      >
        <Timer className="h-3.5 w-3.5" />
      </Button>
      <AnimatePresence>
        {isOpen && (
          <PomodoroTimer
            taskName={taskName}
            onComplete={onComplete}
            onClose={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
