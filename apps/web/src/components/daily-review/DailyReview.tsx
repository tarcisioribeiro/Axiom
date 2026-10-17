/* eslint-disable max-lines */
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpenCheck,
  CalendarCheck,
  Check,
  CheckCircle2,
  History,
  Plus,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StepNav } from '@/components/common/StepNav';
import { GoalFailureDialog } from '@/components/personal-planning/GoalFailureDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDailyReview } from '@/hooks/use-daily-review';
import { useToast } from '@/hooks/use-toast';
import { DURATION, EASE_OUT, slideVariants, transitions } from '@/lib/animations';
import { formatDate } from '@/lib/formatters';
import { dailyReviewService } from '@/services/daily-review-service';
import { taskInstancesService } from '@/services/task-instances-service';
import type {
  ReviewBacklog,
  ReviewDay,
  ReviewItem,
  ReviewStep,
  ReviewStepKey,
} from '@/types/daily-review';
import { getErrorMessage } from '@/utils/error-utils';

import { DIALOG_STEPS, type RegisterTarget, STEP_ICONS } from './review-steps';
import { ReviewRegisterDialog } from './ReviewRegisterDialog';

// Revisão bloqueante: só fecha concluindo (sem Cancelar, Esc ou clique fora).
const blockClose = {
  onEscapeKeyDown: (e: Event) => e.preventDefault(),
  onInteractOutside: (e: Event) => e.preventDefault(),
};

const ROW_EXIT = { opacity: 0, x: 24 };

const formatLiters = (ml: number) =>
  (ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/**
 * Revisão do(s) dia(s) anterior(es), aberta ao entrar no app: dias além dos
 * últimos 7 são justificados em lote; os demais, um modal por dia, etapa por
 * etapa. Cada item pendente é registrado ou justificado.
 */
export function DailyReview() {
  const { data } = useDailyReview();
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [doneDays, setDoneDays] = useState(0);

  if (!data) return null;
  if (data.backlog) return <BacklogDialog backlog={data.backlog} />;

  const date = activeDate ?? data.days[0]?.date;
  if (!date) return null;
  // Fixa o dia em revisão: ao resolver tudo, ele some da resposta da API, mas
  // o modal continua nele até "Concluir dia".
  if (activeDate === null) setActiveDate(date);

  const remaining = data.days.filter((d) => d.date >= date).length || 1;
  return (
    <DayDialog
      key={date}
      date={date}
      day={data.days.find((d) => d.date === date)}
      position={{ current: doneDays + 1, total: doneDays + remaining }}
      onCompleted={() => {
        setDoneDays((n) => n + 1);
        setActiveDate(null);
      }}
    />
  );
}

// ─── Dia ──────────────────────────────────────────────────────────────────────

function DayDialog({
  date,
  day,
  position,
  onCompleted,
}: {
  date: string;
  day: ReviewDay | undefined;
  position: { current: number; total: number };
  onCompleted: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Etapas fixadas na abertura; os itens vêm sempre da resposta mais recente.
  const [steps] = useState<ReviewStep[]>(() => day?.steps ?? []);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [showInvalid, setShowInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [register, setRegister] = useState<RegisterTarget | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const items = day?.steps.find((s) => s.key === step?.key)?.items ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['daily-review'] });

  const goTo = (next: number) => {
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  // Concluir tarefa direto (as demais etapas abrem um formulário)
  const completeTask = async (item: ReviewItem) => {
    try {
      await taskInstancesService.updateStatus(item.id!, 'completed');
      void queryClient.invalidateQueries({ queryKey: ['task-instances'] });
      await refresh();
    } catch (error) {
      toast({ title: getErrorMessage(error), variant: 'destructive' });
    }
  };

  // Justificativas de todas as etapas vão juntas: Próximo/Voltar só navegam.
  const completeDay = async () => {
    const pending = steps.map((st) =>
      (day?.steps.find((s) => s.key === st.key)?.items ?? []).map((item) => ({
        step: st.key,
        item,
        justification: choices[`${st.key}:${item.key}`],
      }))
    );
    const firstMissing = pending.findIndex((list) =>
      list.some((p) => !p.justification)
    );
    if (firstMissing !== -1) {
      const count = pending.flat().filter((p) => !p.justification).length;
      setShowInvalid(true);
      toast({
        title: t('dailyReview.pendingItems', { count }),
        variant: 'destructive',
      });
      if (firstMissing !== index) {
        setDirection(firstMissing > index ? 1 : -1);
        setIndex(firstMissing);
      }
      return;
    }
    setSaving(true);
    try {
      await dailyReviewService.complete(
        date,
        pending.flat().map((p) => ({
          step: p.step,
          item_key: p.item.key,
          justification: p.justification,
        }))
      );
      // Recarrega antes de sair: com a resposta antiga o mesmo dia reabriria.
      await refresh();
      toast({ title: t('dailyReview.dayDone', { date: formatDate(date) }) });
      onCompleted();
    } catch (error) {
      toast({ title: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!step) return null;
  const renderStep = (
    st: ReviewStep,
    stIndex: number,
    stItems: ReviewItem[],
    sizer: boolean
  ) => {
    const Icon = STEP_ICONS[st.key];
    const keyOf = (item: ReviewItem) => `${st.key}:${item.key}`;
    return (
      <>
        <div className="gap-sm flex items-center justify-between">
          <h3 className="gap-sm flex items-center text-sm font-semibold">
            <Icon className="text-primary h-4 w-4" aria-hidden="true" />
            {t(`dailyReview.steps.${st.key}.title`)}
          </h3>
          <span className="text-muted-foreground text-xs">
            {t('dailyReview.position', {
              day: position.current,
              days: position.total,
              step: stIndex + 1,
              steps: steps.length,
            })}
          </span>
        </div>

        {/* Item resolvido sai deslizando e os de baixo sobem; com o último, a
            lista sai e entra o "Etapa concluída". */}
        <AnimatePresence mode="wait" initial={false}>
          {stItems.length === 0 ? (
            <div key="empty" className="animate-pop-in">
              <EmptyState icon={<CheckCircle2 />} title={t('dailyReview.stepDone')} />
            </div>
          ) : (
            <motion.div key="list" exit={ROW_EXIT} transition={transitions.fast}>
              <PaginatedSlide
                items={stItems}
                pageSize={LIST_PAGE_SIZE}
                pinNav={false}
                className="gap-sm flex flex-col"
              >
                {(pageItems) => (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {pageItems.map((item) => (
                      <motion.div
                        key={item.key || st.key}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={ROW_EXIT}
                        transition={{
                          ...transitions.fast,
                          layout: { duration: DURATION.medium, ease: EASE_OUT },
                        }}
                      >
                        <ItemRow
                          step={st}
                          item={item}
                          date={date}
                          choice={choices[keyOf(item)]}
                          invalid={showInvalid && !choices[keyOf(item)]}
                          onChoose={(code) =>
                            !sizer && setChoices((c) => ({ ...c, [keyOf(item)]: code }))
                          }
                          onRegister={() => {
                            if (sizer) return;
                            if (DIALOG_STEPS.includes(st.key)) {
                              setRegister({ step: st.key, item, date });
                            } else {
                              void completeTask(item);
                            }
                          }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </PaginatedSlide>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  const title = t('dailyReview.title', { date: formatDate(date) });

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent size="lg" {...blockClose}>
        <DialogHeader>
          <DialogTitle icon={CalendarCheck}>{title}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        {/* Camadas invisíveis na mesma célula do grid reservam a altura da maior
            etapa (itens da abertura) e do "Etapa concluída": o modal não muda
            de tamanho ao trocar de etapa nem ao registrar itens. */}
        <div className="grid overflow-hidden">
          {[...steps, { ...step, items: [] }].map((st, n) => (
            <div key={n} className="space-y-md invisible [grid-area:1/1]" inert>
              {renderStep(st, Math.min(n, index), st.items, true)}
            </div>
          ))}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step.key}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-md self-center [grid-area:1/1]"
            >
              {renderStep(step, index, items, false)}
            </motion.div>
          </AnimatePresence>
        </div>

        <StepNav
          onBack={() => goTo(index - 1)}
          onNext={() => goTo(index + 1)}
          isFirst={index === 0}
          isLast={isLast}
          disabled={saving}
        />

        <DialogFooter className="gap-sm">
          <Button onClick={() => void completeDay()} loading={saving}>
            {!saving && <CheckCircle2 className="h-4 w-4" />}
            {t('dailyReview.completeDay')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <GoalFailureDialog
        goal={register?.step === 'goals' ? { id: register.item.id! } : undefined}
        defaultDate={date}
        onClose={() => setRegister(null)}
        onRegistered={() => {
          setRegister(null);
          void queryClient.invalidateQueries({ queryKey: ['goals'] });
          void refresh();
        }}
      />
      {register && register.step !== 'goals' && (
        <ReviewRegisterDialog target={register} onClose={() => setRegister(null)} />
      )}
    </Dialog>
  );
}

function ItemRow({
  step,
  item,
  date,
  choice,
  invalid,
  onChoose,
  onRegister,
}: {
  step: ReviewStep;
  item: ReviewItem;
  date: string;
  choice: string | undefined;
  invalid: boolean;
  onChoose: (code: string) => void;
  onRegister: () => void;
}) {
  const { t } = useTranslation();
  const label =
    item.label ||
    t(`dailyReview.steps.${step.key}.item`, {
      date: formatDate(date),
      count: item.count,
    });
  const detail = item.time
    ? t('dailyReview.at', { time: item.time })
    : item.plan ||
      (item.target_ml != null
        ? t('dailyReview.hydrationDetail', {
            total: formatLiters(item.total_ml ?? 0),
            target: formatLiters(item.target_ml),
          })
        : null);

  const action =
    step.key === 'tasks'
      ? { icon: Check, label: t('dailyReview.register.complete') }
      : step.key === 'goals'
        ? { icon: XCircle, label: t('dailyReview.register.failure') }
        : { icon: Plus, label: t('dailyReview.register.action') };

  return (
    <div className="border-border bg-card px-md py-sm gap-md flex items-center rounded-lg border">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={label}>
          {label}
        </p>
        {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
      </div>
      {step.can_register && (
        <Button variant="outline" size="sm" onClick={onRegister}>
          <action.icon className="h-4 w-4" />
          {action.label}
        </Button>
      )}
      <Select value={choice ?? ''} onValueChange={onChoose}>
        <SelectTrigger
          className="w-56 shrink-0"
          aria-label={t('dailyReview.justify')}
          aria-invalid={invalid}
        >
          <SelectValue placeholder={t('dailyReview.justify')} />
        </SelectTrigger>
        <SelectContent>
          {step.justifications.map((code) => (
            <SelectItem key={code} value={code}>
              {t(`dailyReview.justifications.${step.key}.${code}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Dias antigos (lote) ──────────────────────────────────────────────────────

function BacklogDialog({ backlog }: { backlog: ReviewBacklog }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [choices, setChoices] = useState<Partial<Record<ReviewStepKey, string>>>({});
  const [showInvalid, setShowInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const missing = backlog.steps.filter((s) => !choices[s.key]);
    if (missing.length) {
      setShowInvalid(true);
      toast({
        title: t('dailyReview.pendingItems', { count: missing.length }),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await dailyReviewService.resolveBacklog(choices);
      await queryClient.invalidateQueries({ queryKey: ['daily-review'] });
    } catch (error) {
      toast({ title: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const title = t('dailyReview.backlog.title');
  const end = formatDate(backlog.end);
  const range = `${formatDate(backlog.start).slice(0, 5)} - ${end}`;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent size="lg" {...blockClose}>
        <DialogHeader>
          <DialogTitle icon={History}>{title}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          {t('dailyReview.backlog.range', { range, count: backlog.days })}
        </p>

        <PaginatedSlide
          items={backlog.steps}
          pageSize={LIST_PAGE_SIZE}
          pinNav={false}
          className="space-y-sm"
        >
          {(pageSteps) =>
            pageSteps.map((step) => {
              const Icon = STEP_ICONS[step.key];
              return (
                <div
                  key={step.key}
                  className="border-border bg-card px-md py-sm gap-md flex items-center rounded-lg border"
                >
                  <Icon className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t(`dailyReview.steps.${step.key}.title`)}
                  </p>
                  <Select
                    value={choices[step.key] ?? ''}
                    onValueChange={(code) =>
                      setChoices((c) => ({ ...c, [step.key]: code }))
                    }
                  >
                    <SelectTrigger
                      className="w-56 shrink-0"
                      aria-label={t('dailyReview.justify')}
                      aria-invalid={showInvalid && !choices[step.key]}
                    >
                      <SelectValue placeholder={t('dailyReview.justify')} />
                    </SelectTrigger>
                    <SelectContent>
                      {step.justifications.map((code) => (
                        <SelectItem key={code} value={code}>
                          {t(`dailyReview.justifications.${step.key}.${code}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })
          }
        </PaginatedSlide>

        <DialogFooter className="gap-sm">
          <Button onClick={() => void submit()} loading={saving}>
            {!saving && <BookOpenCheck className="h-4 w-4" />}
            {t('common.actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
