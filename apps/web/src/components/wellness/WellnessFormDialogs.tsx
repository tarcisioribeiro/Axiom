/* eslint-disable max-lines */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Heart, Send, Star, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StepNav } from '@/components/common/StepNav';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { slideVariants } from '@/lib/animations';
import { cn, formatLocalDate } from '@/lib/utils';
import {
  type SelfEsteemAssessment,
  wellnessService,
} from '@/services/wellness-service';

import {
  CHECKIN_SCALES,
  CHECKIN_TEXTS,
  ROSENBERG_OPTION_KEYS,
  ROSENBERG_QUESTION_KEYS,
} from './wellness-constants';

const CHECKIN_STEPS = CHECKIN_SCALES.length + CHECKIN_TEXTS.length;

const CHECKIN_INITIAL = {
  loneliness: 5,
  neediness: 5,
  anxiety: 5,
  sadness: 5,
  motivation: 5,
  energy: 5,
  what_happened: '',
  occupying_thoughts: '',
};

const INTENSITY_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

function ScaleInput({
  label,
  value,
  onChange,
  colorHigh = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colorHigh?: boolean;
}) {
  const good = colorHigh ? value >= 7 : value < 4;
  const bad = colorHigh ? value < 4 : value >= 7;
  const tone = good ? 'success' : bad ? 'destructive' : 'warning';
  const color = INTENSITY_TEXT[tone];

  return (
    <div className="space-y-sm">
      <div className="flex items-center justify-between">
        <span className="text-foreground text-sm font-medium">{label}</span>
        <span className={cn('text-lg font-bold tabular-nums', color)}>{value}</span>
      </div>
      <Slider
        min={0}
        max={10}
        tone={tone}
        aria-label={label}
        value={value}
        onChange={onChange}
      />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>0</span>
        <span>10</span>
      </div>
    </div>
  );
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Data do registro (padrão: hoje). */
  date?: string;
}

// ─── Avaliação de autoestima ──────────────────────────────────────────────────

export function SelfEsteemFormDialog({
  open,
  onOpenChange,
  date,
  onSaved,
}: FormDialogProps & { onSaved?: (result: SelfEsteemAssessment) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  // Direção do deslize entre perguntas: 1 avança, -1 volta
  const [direction, setDirection] = useState(1);
  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  // Reinicia o questionário a cada abertura (padrão "estado da renderização anterior").
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setAnswers({});
      setStep(0);
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      wellnessService.createSelfEsteemAssessment({
        assessed_at: date ?? formatLocalDate(new Date()),
        q1: answers.q1,
        q2: answers.q2,
        q3: answers.q3,
        q4: answers.q4,
        q5: answers.q5,
        q6: answers.q6,
        q7: answers.q7,
        q8: answers.q8,
        q9: answers.q9,
        q10: answers.q10,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      onOpenChange(false);
      onSaved?.(result);
      toast({
        title: t('pages.emotionalWellness.selfEsteem.savedToast', {
          score: result.score,
        }),
      });
    },
    onError: () =>
      toast({
        title: t('pages.emotionalWellness.selfEsteem.saveError'),
        variant: 'destructive',
      }),
  });

  const stepKey = `q${step + 1}`;
  const isLastStep = step === ROSENBERG_QUESTION_KEYS.length - 1;

  // Enviar fica sempre visível: faltando resposta, avisa e vai à primeira pendente.
  function submit() {
    const missing = ROSENBERG_QUESTION_KEYS.findIndex(
      (_, i) => !(`q${i + 1}` in answers)
    );
    if (missing === -1) {
      mutation.mutate();
      return;
    }
    toast({
      title: t('pages.emotionalWellness.selfEsteem.answerAll'),
      variant: 'destructive',
    });
    goToStep(missing);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* altura mínima fixa: o modal não varia com o tamanho do texto da pergunta */}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <Star className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            {t('pages.emotionalWellness.selfEsteem.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.emotionalWellness.selfEsteem.dialogTitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-md min-h-56"
            >
              <p className="text-muted-foreground text-xs">
                {t('pages.emotionalWellness.selfEsteem.questionOf', {
                  current: step + 1,
                  total: ROSENBERG_QUESTION_KEYS.length,
                })}
              </p>
              <p className="text-sm leading-relaxed font-medium">
                {t(
                  `pages.emotionalWellness.selfEsteem.questions.${ROSENBERG_QUESTION_KEYS[step]}`
                )}
              </p>
              <div className="gap-sm grid grid-cols-2">
                {ROSENBERG_OPTION_KEYS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={answers[stepKey] === opt.value}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [stepKey]: opt.value }))
                    }
                    className={cn(
                      'py-sm px-sm rounded-lg border text-center text-xs font-medium transition',
                      answers[stepKey] === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {t(`pages.emotionalWellness.selfEsteem.options.${opt.labelKey}`)}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <StepNav
          onBack={() => goToStep(step - 1)}
          onNext={() => goToStep(step + 1)}
          isFirst={step === 0}
          isLast={isLastStep}
          disabled={mutation.isPending}
        />

        <DialogFooter className="gap-sm">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {!mutation.isPending && <Send className="h-4 w-4" />}
            {mutation.isPending
              ? t('pages.emotionalWellness.selfEsteem.analyzing')
              : t('common.actions.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Check-in emocional ───────────────────────────────────────────────────────

export function CheckinFormDialog({ open, onOpenChange, date }: FormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(CHECKIN_INITIAL);
  const [step, setStep] = useState(0);
  // Direção do deslize entre etapas: 1 avança, -1 volta
  const [direction, setDirection] = useState(1);
  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  // Reinicia o formulário a cada abertura (padrão "estado da renderização anterior").
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setForm(CHECKIN_INITIAL);
      setStep(0);
    }
  }

  const mutation = useMutation({
    mutationFn: wellnessService.createCheckin.bind(wellnessService),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      onOpenChange(false);
      toast({ title: t('pages.emotionalWellness.checkin.savedToast') });
    },
    onError: () =>
      toast({
        title: t('pages.emotionalWellness.checkin.saveError'),
        variant: 'destructive',
      }),
  });

  function handleSubmit() {
    mutation.mutate({
      checked_at: date ?? formatLocalDate(new Date()),
      ...form,
    });
  }

  const scale = CHECKIN_SCALES[step];
  const text = CHECKIN_TEXTS[step - CHECKIN_SCALES.length];
  const isLastStep = step === CHECKIN_STEPS - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* altura reservada (min-h): o modal não varia entre os passos de escala e de texto */}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <Heart className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            {t('pages.emotionalWellness.checkin.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.emotionalWellness.checkin.dialogTitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-md"
            >
              <p className="text-muted-foreground text-xs">
                {t('pages.emotionalWellness.checkin.questionOf', {
                  current: step + 1,
                  total: CHECKIN_STEPS,
                })}
              </p>
              <div className="flex min-h-36 flex-col">
                {scale ? (
                  <ScaleInput
                    label={t(`pages.emotionalWellness.checkin.scales.${scale.key}`)}
                    value={form[scale.key]}
                    onChange={(v) => setForm((p) => ({ ...p, [scale.key]: v }))}
                    colorHigh={scale.colorHigh}
                  />
                ) : (
                  <div className="space-y-sm flex flex-1 flex-col">
                    <label
                      htmlFor={text.key}
                      className="gap-xs text-foreground flex items-center text-sm font-medium"
                    >
                      <text.icon className="text-muted-foreground h-3.5 w-3.5" />
                      {t(`pages.emotionalWellness.checkin.texts.${text.key}.label`)}
                    </label>
                    <Textarea
                      id={text.key}
                      value={form[text.key]}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [text.key]: e.target.value }))
                      }
                      className="flex-1 resize-none"
                      placeholder={t(
                        `pages.emotionalWellness.checkin.texts.${text.key}.placeholder`
                      )}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <StepNav
          onBack={() => goToStep(step - 1)}
          onNext={() => goToStep(step + 1)}
          isFirst={step === 0}
          isLast={isLastStep}
          disabled={mutation.isPending}
        />

        <DialogFooter className="gap-sm">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            {!mutation.isPending && <CheckCircle2 className="h-4 w-4" />}
            {t('pages.emotionalWellness.checkin.registerBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
