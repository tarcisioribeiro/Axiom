/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type { TFunction } from 'i18next';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Minus,
  Play,
  Plus,
  Send,
  Shield,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { INTERVENTION_CATEGORY_ICONS } from '@/config/icons';
import { useTabRoute } from '@/hooks/use-tab-route';
import { useToast } from '@/hooks/use-toast';
import { slideVariants } from '@/lib/animations';
import { cn, formatLocalDate } from '@/lib/utils';
import {
  type CrisisImpulseLog,
  type CrisisImpulseLogCreate,
  type EmotionalCheckin,
  type EmotionalState,
  type ImpulseType,
  type InterventionCategory,
  type SelfEsteemAssessment,
  type SelfEsteemAssessmentCreate,
  type WellnessIntervention,
  wellnessService,
} from '@/services/wellness-service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'self-esteem' | 'checkin' | 'crisis' | 'library';

// ─── Rosenberg questions ──────────────────────────────────────────────────────

const ROSENBERG_QUESTION_KEYS = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
  'q9',
  'q10',
] as const;

const ROSENBERG_OPTION_KEYS = [
  { value: 0, labelKey: 'stronglyDisagree' },
  { value: 1, labelKey: 'disagree' },
  { value: 2, labelKey: 'agree' },
  { value: 3, labelKey: 'stronglyAgree' },
] as const;

const EMOTIONAL_STATE_VALUES: EmotionalState[] = [
  'loneliness',
  'neediness',
  'anxiety',
  'boredom',
  'frustration',
  'anger',
  'other',
];

const IMPULSE_TYPE_VALUES: ImpulseType[] = [
  'pornography',
  'alcohol',
  'social_media',
  'shopping',
  'procrastination',
  'other',
];

const CATEGORY_COLORS: Record<InterventionCategory, string> = {
  self_esteem: 'bg-primary/10 text-primary border-primary/20',
  loneliness: 'bg-info/10 text-info border-info/20',
  neediness: 'bg-accent/10 text-accent border-accent/20',
  anxiety: 'bg-warning/10 text-warning border-warning/20',
  emotional_dependency: 'bg-success/10 text-success border-success/20',
};

// ─── Score interpretation ─────────────────────────────────────────────────────

function scoreLabel(score: number | null, t: TFunction) {
  if (score === null) return { label: '—', color: 'text-muted-foreground' };
  if (score >= 25)
    return {
      label: t('pages.emotionalWellness.scoreLabel.high'),
      color: 'text-success',
    };
  if (score >= 15)
    return {
      label: t('pages.emotionalWellness.scoreLabel.medium'),
      color: 'text-warning',
    };
  return {
    label: t('pages.emotionalWellness.scoreLabel.low'),
    color: 'text-destructive',
  };
}

// ─── Scale slider ─────────────────────────────────────────────────────────────

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

// ─── Stat card ────────────────────────────────────────────────────────────────

function WellnessStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number | null;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-lg pt-lg">
        <div className="flex items-start justify-between">
          <div className="space-y-xs">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {title}
            </p>
            <p className="text-foreground text-2xl font-bold">{value ?? '—'}</p>
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          <div className="gap-sm flex flex-col items-end">
            <div className="bg-primary/10 p-sm rounded-lg">
              <Icon className="text-primary h-4 w-4" />
            </div>
            {trend && <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS: { id: Tab; labelKey: string; icon: React.ElementType }[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: BarChart3 },
  { id: 'self-esteem', labelKey: 'selfEsteem', icon: Star },
  { id: 'checkin', labelKey: 'checkin', icon: Heart },
  { id: 'crisis', labelKey: 'crisis', icon: Shield },
  { id: 'library', labelKey: 'library', icon: BookOpen },
];

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['wellness', 'dashboard'],
    queryFn: () => wellnessService.getDashboard(),
  });

  const { data: historyData } = useQuery({
    queryKey: ['wellness', 'self-esteem'],
    queryFn: () => wellnessService.getSelfEsteemHistory(),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  const d = data;
  const sl = scoreLabel(d.self_esteem.current_score, t);
  const history = historyData?.results ?? [];

  return (
    <div className="page-fill space-y-lg flex flex-1 flex-col justify-center">
      {/* Stats grid */}
      <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.selfEsteemStat')}
          value={
            d.self_esteem.current_score !== null
              ? `${d.self_esteem.current_score}/30`
              : null
          }
          subtitle={sl.label}
          icon={Star}
        />
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.lonelinessAvgStat')}
          value={
            d.emotional.avg_loneliness !== null ? d.emotional.avg_loneliness : null
          }
          subtitle={t('pages.emotionalWellness.dashboard.thisWeek')}
          icon={Heart}
        />
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.anxietyAvgStat')}
          value={d.emotional.avg_anxiety !== null ? d.emotional.avg_anxiety : null}
          subtitle={t('pages.emotionalWellness.dashboard.thisWeek')}
          icon={Brain}
        />
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.tasksCompletedStat')}
          value={d.interventions.completed_this_week}
          subtitle={t('pages.emotionalWellness.dashboard.thisWeek')}
          icon={CheckCircle2}
        />
      </div>

      <div className="gap-sm grid sm:grid-cols-3">
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.motivationAvgStat')}
          value={
            d.emotional.avg_motivation !== null ? d.emotional.avg_motivation : null
          }
          subtitle={t('pages.emotionalWellness.dashboard.thisWeek')}
          icon={Zap}
        />
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.checkinsStat')}
          value={d.emotional.checkins_this_week}
          subtitle={t('pages.emotionalWellness.dashboard.thisWeek')}
          icon={TrendingUp}
        />
        <WellnessStatCard
          title={t('pages.emotionalWellness.dashboard.impulsesOvercomeStat')}
          value={`${d.impulses.resolved_this_week}/${d.impulses.count_this_week}`}
          subtitle={t('pages.emotionalWellness.dashboard.thisWeek')}
          icon={Shield}
        />
      </div>

      {/* History chart placeholder */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-medium">
              {t('pages.emotionalWellness.dashboard.historyTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-sm">
              {history.slice(0, 5).map((a) => (
                <div key={a.id} className="gap-sm flex items-center">
                  <span className="text-muted-foreground w-24 shrink-0 text-xs">
                    {format(new Date(a.assessed_at), 'dd/MM/yyyy')}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-[width]"
                      style={{ width: `${(a.score / 30) * 100}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'w-10 text-right text-xs font-bold',
                      scoreLabel(a.score, t).color
                    )}
                  >
                    {a.score}/30
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length === 0 && d.emotional.checkins_this_week === 0 && (
        <EmptyState
          icon={<Heart />}
          title={t('pages.emotionalWellness.dashboard.emptyTitle')}
        />
      )}
    </div>
  );
}

// ─── Self-esteem tab ──────────────────────────────────────────────────────────

function SelfEsteemTab({
  showForm,
  setShowForm,
}: {
  showForm: boolean;
  setShowForm: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<SelfEsteemAssessment | null>(null);
  const [step, setStep] = useState(0);
  // Direção do deslize entre perguntas: 1 avança, -1 volta
  const [direction, setDirection] = useState(1);
  const goToStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  const [selected, setSelected] = useState<SelfEsteemAssessment | null>(null);
  // Reinicia o questionário a cada abertura (padrão "estado da renderização anterior").
  const [wasOpen, setWasOpen] = useState(showForm);
  if (wasOpen !== showForm) {
    setWasOpen(showForm);
    if (showForm) {
      setAnswers({});
      setStep(0);
    }
  }
  const [aiParsed, setAiParsed] = useState<{
    analysis: string;
    strengths: string[];
    limiting_beliefs: string[];
    weekly_suggestions: string[];
  } | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['wellness', 'self-esteem'],
    queryFn: () => wellnessService.getSelfEsteemHistory(),
  });

  const mutation = useMutation({
    mutationFn: (data: SelfEsteemAssessmentCreate) =>
      wellnessService.createSelfEsteemAssessment(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      setSubmitted(result);
      setShowForm(false);
      setAiParsed(null);
      if (result.ai_analysis) {
        try {
          const parsed = JSON.parse(result.ai_analysis) as {
            analysis: string;
            strengths: string[];
            limiting_beliefs: string[];
            weekly_suggestions: string[];
          };
          setAiParsed(parsed);
        } catch {
          // ai analysis não é JSON válido ainda
        }
      }
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

  const allAnswered = ROSENBERG_QUESTION_KEYS.every((_, i) => `q${i + 1}` in answers);
  const stepKey = `q${step + 1}`;
  const isLastStep = step === ROSENBERG_QUESTION_KEYS.length - 1;

  function handleSubmit() {
    if (!allAnswered) return;
    mutation.mutate({
      assessed_at: format(new Date(), 'yyyy-MM-dd'),
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
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-lg flex flex-1 flex-col">
      <Dialog open={showForm} onOpenChange={setShowForm}>
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

          <DialogFooter className="gap-sm">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            {step > 0 && (
              <Button variant="outline" onClick={() => goToStep(step - 1)}>
                <ChevronLeft className="h-4 w-4" />
                {t('common.actions.back')}
              </Button>
            )}
            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || mutation.isPending}
              >
                <Send className="h-4 w-4" />
                {mutation.isPending
                  ? t('pages.emotionalWellness.selfEsteem.analyzing')
                  : t('common.actions.send')}
              </Button>
            ) : (
              <Button
                onClick={() => goToStep(step + 1)}
                disabled={!(stepKey in answers)}
              >
                <ChevronRight className="h-4 w-4" />
                {t('common.actions.confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent size="sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="gap-sm flex items-center">
                  <Star className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('pages.emotionalWellness.selfEsteem.detailTitle', {
                    date: format(new Date(selected.assessed_at), 'dd/MM/yyyy'),
                  })}
                  <Badge variant="outline" className="text-xs">
                    {scoreLabel(selected.score, t).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {t('pages.emotionalWellness.selfEsteem.scoreOf', {
                    score: selected.score,
                  })}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm font-medium">
                {t('pages.emotionalWellness.selfEsteem.scoreOf', {
                  score: selected.score,
                })}
              </p>
              <ol className="space-y-sm">
                {ROSENBERG_QUESTION_KEYS.map((qKey, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-muted-foreground">
                      {i + 1}.{' '}
                      {t(`pages.emotionalWellness.selfEsteem.questions.${qKey}`)}
                    </p>
                    <p className="text-foreground font-medium">
                      {(() => {
                        const opt = ROSENBERG_OPTION_KEYS.find(
                          (o) =>
                            o.value ===
                            selected[`q${i + 1}` as keyof SelfEsteemAssessment]
                        );
                        return opt
                          ? t(
                              `pages.emotionalWellness.selfEsteem.options.${opt.labelKey}`
                            )
                          : '—';
                      })()}
                    </p>
                  </li>
                ))}
              </ol>
              <DialogCloseFooter />
            </>
          )}
        </DialogContent>
      </Dialog>

      <AnimatePresence mode="wait">
        {submitted && aiParsed && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-md"
          >
            <div className="space-y-xs py-md text-center">
              <div
                className={cn(
                  'text-5xl font-black',
                  scoreLabel(submitted.score, t).color
                )}
              >
                {submitted.score}
                <span className="text-muted-foreground text-2xl font-light">/30</span>
              </div>
              <p className="text-muted-foreground text-sm">
                {t('pages.emotionalWellness.selfEsteem.resultScoreLabel', {
                  label: scoreLabel(submitted.score, t).label,
                })}
              </p>
            </div>

            <Card>
              <CardContent className="px-md py-md pt-md space-y-sm">
                <p className="text-foreground text-sm leading-relaxed">
                  {aiParsed.analysis}
                </p>
              </CardContent>
            </Card>

            <div className="gap-md grid items-stretch lg:grid-cols-3">
              {aiParsed.strengths?.length > 0 && (
                <Card className="h-full">
                  <CardHeader className="px-md pb-sm pt-md">
                    <CardTitle className="text-success text-sm">
                      {t('pages.emotionalWellness.selfEsteem.strengthsTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-sm px-md pb-md">
                    {aiParsed.strengths.map((s, i) => (
                      <div key={i} className="gap-sm flex items-start">
                        <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-foreground text-sm">{s}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {aiParsed.limiting_beliefs?.length > 0 && (
                <Card className="h-full">
                  <CardHeader className="px-md pb-sm pt-md">
                    <CardTitle className="text-warning text-sm">
                      {t('pages.emotionalWellness.selfEsteem.limitingBeliefsTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-sm px-md pb-md">
                    {aiParsed.limiting_beliefs.map((b, i) => (
                      <div key={i} className="gap-sm flex items-start">
                        <AlertCircle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-foreground text-sm">{b}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {aiParsed.weekly_suggestions?.length > 0 && (
                <Card className="h-full">
                  <CardHeader className="px-md pb-sm pt-md">
                    <CardTitle className="text-primary text-sm">
                      {t('pages.emotionalWellness.selfEsteem.suggestionsTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-sm px-md pb-md">
                    {aiParsed.weekly_suggestions.map((s, i) => (
                      <div key={i} className="gap-sm flex items-start">
                        <ChevronRight className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-foreground text-sm">{s}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSubmitted(null);
                setAiParsed(null);
              }}
            >
              <History aria-hidden="true" />
              {t('pages.emotionalWellness.selfEsteem.viewHistoryBtn')}
            </Button>
          </motion.div>
        )}

        {!(submitted && aiParsed) && (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col"
          >
            {history?.results?.length === 0 ? (
              <EmptyState
                icon={<Star />}
                title={t('pages.emotionalWellness.selfEsteem.emptyTitle')}
              />
            ) : (
              <PaginatedSlide
                items={history?.results ?? []}
                pageSize={5}
                centerList
                className="space-y-sm"
              >
                {(pageItems) =>
                  pageItems.map((a) => {
                    const sl = scoreLabel(a.score, t);
                    return (
                      <Card
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => setSelected(a)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(a);
                          }
                        }}
                      >
                        <CardContent className="px-md py-md pt-md">
                          <div className="gap-md flex items-center">
                            <div>
                              <p className="text-muted-foreground text-xs">
                                {format(new Date(a.assessed_at), 'dd/MM/yyyy')}
                              </p>
                              <p className={cn('text-2xl font-bold', sl.color)}>
                                {a.score}
                                <span className="text-muted-foreground text-sm font-normal">
                                  /30
                                </span>
                              </p>
                            </div>
                            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${(a.score / 30) * 100}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                }
              </PaginatedSlide>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Check-in tab ─────────────────────────────────────────────────────────────

const CHECKIN_SCALES = [
  { key: 'loneliness', colorHigh: false },
  { key: 'neediness', colorHigh: false },
  { key: 'anxiety', colorHigh: false },
  { key: 'sadness', colorHigh: false },
  { key: 'motivation', colorHigh: true },
  { key: 'energy', colorHigh: true },
] as const;

const CHECKIN_TEXTS = [
  { key: 'what_happened', icon: MessageSquare },
  { key: 'occupying_thoughts', icon: Brain },
] as const;

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

function CheckinTab({
  showForm,
  setShowForm,
}: {
  showForm: boolean;
  setShowForm: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(CHECKIN_INITIAL);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<EmotionalCheckin | null>(null);
  // Reinicia o formulário a cada abertura (padrão "estado da renderização anterior").
  const [wasOpen, setWasOpen] = useState(showForm);
  if (wasOpen !== showForm) {
    setWasOpen(showForm);
    if (showForm) {
      setForm(CHECKIN_INITIAL);
      setStep(0);
    }
  }

  const { data: history, isLoading } = useQuery({
    queryKey: ['wellness', 'checkins', 30],
    queryFn: () => wellnessService.getCheckins(30),
  });

  const [checkinStartDate, setCheckinStartDate] = useState<Date | undefined>(undefined);
  const [checkinEndDate, setCheckinEndDate] = useState<Date | undefined>(undefined);
  const hasCheckinFilters = !!checkinStartDate || !!checkinEndDate;
  const filteredHistory = (history?.results ?? []).filter((c) => {
    const d = c.checked_at.slice(0, 10);
    if (checkinStartDate && d < formatLocalDate(checkinStartDate)) return false;
    if (checkinEndDate && d > formatLocalDate(checkinEndDate)) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: wellnessService.createCheckin.bind(wellnessService),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      setShowForm(false);
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
      checked_at: format(new Date(), 'yyyy-MM-dd'),
      ...form,
    });
  }

  const scale = CHECKIN_SCALES[step];
  const text = CHECKIN_TEXTS[step - CHECKIN_SCALES.length];
  const isLastStep = step === CHECKIN_STEPS - 1;

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-lg flex flex-1 flex-col">
      <Dialog open={showForm} onOpenChange={setShowForm}>
        {/* altura fixa: o modal não varia entre os passos de escala e de texto */}
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

          <p className="text-muted-foreground text-xs">
            {t('pages.emotionalWellness.checkin.questionOf', {
              current: step + 1,
              total: CHECKIN_STEPS,
            })}
          </p>
          <div key={step} className="animate-fade-in flex h-36 flex-col">
            {scale ? (
              <ScaleInput
                label={t(`pages.emotionalWellness.checkin.scales.${scale.key}`)}
                value={form[scale.key]}
                onChange={(v) => setForm((p) => ({ ...p, [scale.key]: v }))}
                colorHigh={scale.colorHigh}
              />
            ) : (
              <div className="space-y-sm flex h-full flex-col">
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

          <DialogFooter className="gap-sm">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            {isLastStep ? (
              <Can action="add">
                <Button onClick={handleSubmit} disabled={mutation.isPending}>
                  <CheckCircle2 className="h-4 w-4" />
                  {mutation.isPending
                    ? t('common.actions.saving')
                    : t('pages.emotionalWellness.checkin.registerBtn')}
                </Button>
              </Can>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>
                <ChevronRight className="h-4 w-4" />
                {t('common.actions.confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent size="sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="gap-sm flex items-center">
                  <Heart className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('pages.emotionalWellness.checkin.detailTitle', {
                    date: format(new Date(selected.checked_at), 'dd/MM/yyyy'),
                  })}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>
                    {t('pages.emotionalWellness.checkin.detailDesc')}
                  </DialogDescription>
                </VisuallyHidden>
              </DialogHeader>
              <div className="space-y-md text-sm">
                <dl className="gap-sm grid grid-cols-2 sm:grid-cols-3">
                  {CHECKIN_SCALES.map((s) => (
                    <div key={s.key}>
                      <dt className="text-muted-foreground">
                        {t(`pages.emotionalWellness.checkin.scales.${s.key}`)}
                      </dt>
                      <dd className="text-foreground font-medium">
                        {selected[s.key]}/10
                      </dd>
                    </div>
                  ))}
                </dl>
                {CHECKIN_TEXTS.map((txt) => (
                  <div key={txt.key}>
                    <p className="text-muted-foreground">
                      {t(`pages.emotionalWellness.checkin.texts.${txt.key}.label`)}
                    </p>
                    <p className="text-foreground font-medium whitespace-pre-wrap">
                      {selected[txt.key] || '—'}
                    </p>
                  </div>
                ))}
              </div>
              <DialogCloseFooter />
            </>
          )}
        </DialogContent>
      </Dialog>

      {history?.results?.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title={t('pages.emotionalWellness.checkin.emptyTitle')}
        />
      ) : (
        <>
          <FilterBar
            hasActiveFilters={hasCheckinFilters}
            onClear={() => {
              setCheckinStartDate(undefined);
              setCheckinEndDate(undefined);
            }}
            activeFilters={[
              ...(checkinStartDate
                ? [
                    {
                      key: 'startDate',
                      label: `${t('common.fields.from')}: ${format(checkinStartDate, 'dd/MM/yyyy')}`,
                      onRemove: () => setCheckinStartDate(undefined),
                    },
                  ]
                : []),
              ...(checkinEndDate
                ? [
                    {
                      key: 'endDate',
                      label: `${t('common.fields.to')}: ${format(checkinEndDate, 'dd/MM/yyyy')}`,
                      onRemove: () => setCheckinEndDate(undefined),
                    },
                  ]
                : []),
            ]}
          >
            <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
              <DateRangeFilter
                startDate={checkinStartDate}
                endDate={checkinEndDate}
                onStartChange={setCheckinStartDate}
                onEndChange={setCheckinEndDate}
              />
            </FilterField>
          </FilterBar>

          {filteredHistory.length === 0 ? (
            <EmptyState
              icon={<Heart />}
              title={t('pages.emotionalWellness.checkin.emptyFilteredTitle')}
            />
          ) : (
            <PaginatedSlide
              key={`${checkinStartDate ? formatLocalDate(checkinStartDate) : ''}|${checkinEndDate ? formatLocalDate(checkinEndDate) : ''}`}
              items={filteredHistory}
              pageSize={LIST_PAGE_SIZE}
              centerList
              className="space-y-sm"
            >
              {(pageItems) =>
                pageItems.map((c) => (
                  <Card
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(c);
                      }
                    }}
                  >
                    <CardContent className="px-md py-md pt-md">
                      <div className="gap-md flex items-center">
                        <p className="text-muted-foreground text-xs">
                          {format(new Date(c.checked_at), 'dd/MM/yyyy')}
                        </p>
                        <div className="text-muted-foreground gap-sm flex flex-1 text-xs">
                          <span className="gap-xs flex items-center">
                            <Heart className="text-info h-3 w-3" />
                            {c.loneliness}
                          </span>
                          <span className="gap-xs flex items-center">
                            <Brain className="text-warning h-3 w-3" />
                            {c.anxiety}
                          </span>
                          <span className="gap-xs flex items-center">
                            <Zap className="text-success h-3 w-3" />
                            {c.motivation}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              }
            </PaginatedSlide>
          )}
        </>
      )}
    </div>
  );
}

// ─── Crisis tab ───────────────────────────────────────────────────────────────

type CrisisAiResponse = {
  validation: string;
  explanation: string;
  action_plan: { '5min': string[]; '10min': string[]; '20min': string[] };
  affirmation: string;
};

const CRISIS_STEPS = 3;

function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="gap-sm grid grid-cols-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'py-sm px-sm rounded-lg border text-left text-sm font-medium transition',
            value === o.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CrisisTab({
  showForm,
  setShowForm,
}: {
  showForm: boolean;
  setShowForm: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [emotionalState, setEmotionalState] = useState<EmotionalState | null>(null);
  const [otherEmotion, setOtherEmotion] = useState('');
  const [impulseType, setImpulseType] = useState<ImpulseType | null>(null);
  const [otherImpulse, setOtherImpulse] = useState('');
  const [result, setResult] = useState<CrisisImpulseLog | null>(null);
  const [aiParsed, setAiParsed] = useState<CrisisAiResponse | null>(null);
  // Reinicia o registro a cada abertura (padrão "estado da renderização anterior").
  const [wasOpen, setWasOpen] = useState(showForm);
  if (wasOpen !== showForm) {
    setWasOpen(showForm);
    if (showForm) {
      setStep(0);
      setEmotionalState(null);
      setOtherEmotion('');
      setImpulseType(null);
      setOtherImpulse('');
      setResult(null);
      setAiParsed(null);
    }
  }

  const { data: logs, isLoading } = useQuery({
    queryKey: ['wellness', 'crisis'],
    queryFn: () => wellnessService.getCrisisLogs(),
  });

  const [crisisStartDate, setCrisisStartDate] = useState<Date | undefined>(undefined);
  const [crisisEndDate, setCrisisEndDate] = useState<Date | undefined>(undefined);
  const hasCrisisFilters = !!crisisStartDate || !!crisisEndDate;
  const filteredLogs = (logs?.results ?? []).filter((log) => {
    const d = log.logged_at.slice(0, 10);
    if (crisisStartDate && d < formatLocalDate(crisisStartDate)) return false;
    if (crisisEndDate && d > formatLocalDate(crisisEndDate)) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (data: CrisisImpulseLogCreate) => wellnessService.createCrisisLog(data),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      setResult(r);
      if (r.ai_response) {
        try {
          setAiParsed(JSON.parse(r.ai_response) as CrisisAiResponse);
        } catch {
          /* noop */
        }
      }
      setStep(2);
    },
    onError: () =>
      toast({
        title: t('pages.emotionalWellness.crisis.processError'),
        variant: 'destructive',
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => wellnessService.resolveCrisisLog(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      toast({ title: t('pages.emotionalWellness.crisis.overcameToast') });
      setShowForm(false);
    },
  });

  function handleSubmit() {
    if (!emotionalState || !impulseType) return;
    createMutation.mutate({
      emotional_state: emotionalState,
      emotional_state_other: otherEmotion,
      impulse_type: impulseType,
      impulse_type_other: otherImpulse,
    });
  }

  const emotionalStateOptions = EMOTIONAL_STATE_VALUES.map((value) => ({
    value,
    label: t(`pages.emotionalWellness.crisis.emotions.${value}`),
  }));
  const impulseTypeOptions = IMPULSE_TYPE_VALUES.map((value) => ({
    value,
    label: t(`pages.emotionalWellness.crisis.impulses.${value}`),
  }));

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-lg flex flex-1 flex-col">
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              {step === 2 ? (
                <ListChecks
                  className="text-primary h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Shield className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {step === 0
                ? t('pages.emotionalWellness.crisis.step0Title')
                : step === 1
                  ? t('pages.emotionalWellness.crisis.step1Title')
                  : t('pages.emotionalWellness.crisis.step2Title')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.emotionalWellness.crisis.stepOf', {
                current: step + 1,
                total: CRISIS_STEPS,
              })}
            </DialogDescription>
          </DialogHeader>

          <div key={step} className="animate-fade-in space-y-md">
            {step < 2 && (
              <p className="text-muted-foreground text-xs">
                {t('pages.emotionalWellness.crisis.stepOf', {
                  current: step + 1,
                  total: CRISIS_STEPS,
                })}
              </p>
            )}
            {step === 0 && (
              <>
                <ChoiceGrid
                  options={emotionalStateOptions}
                  value={emotionalState}
                  onChange={setEmotionalState}
                />
                {emotionalState === 'other' && (
                  <Input
                    placeholder={t(
                      'pages.emotionalWellness.crisis.otherEmotionPlaceholder'
                    )}
                    value={otherEmotion}
                    onChange={(e) => setOtherEmotion(e.target.value)}
                  />
                )}
              </>
            )}

            {step === 1 && (
              <>
                <ChoiceGrid
                  options={impulseTypeOptions}
                  value={impulseType}
                  onChange={setImpulseType}
                />
                {impulseType === 'other' && (
                  <Input
                    placeholder={t(
                      'pages.emotionalWellness.crisis.otherImpulsePlaceholder'
                    )}
                    value={otherImpulse}
                    onChange={(e) => setOtherImpulse(e.target.value)}
                  />
                )}
              </>
            )}

            {step === 2 &&
              (aiParsed ? (
                <>
                  <div className="space-y-xs">
                    <p className="text-primary text-xs font-medium tracking-wider uppercase">
                      {t('pages.emotionalWellness.crisis.validationTitle')}
                    </p>
                    <p className="text-sm leading-relaxed">{aiParsed.validation}</p>
                  </div>
                  <div className="space-y-xs">
                    <p className="text-warning text-xs font-medium tracking-wider uppercase">
                      {t('pages.emotionalWellness.crisis.contextTitle')}
                    </p>
                    <p className="text-sm leading-relaxed">{aiParsed.explanation}</p>
                  </div>
                  <div className="space-y-sm">
                    <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      {t('pages.emotionalWellness.crisis.actionPlanTitle')}
                    </p>
                    {(['5min', '10min', '20min'] as const).map((duration) => (
                      <Card key={duration}>
                        <CardHeader className="px-md pb-sm pt-sm">
                          <CardTitle className="gap-xs text-muted-foreground flex items-center text-xs">
                            <Clock className="h-3.5 w-3.5" /> {duration}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-xs px-md pb-sm">
                          {aiParsed.action_plan[duration]?.map((action, i) => (
                            <div key={i} className="gap-sm flex items-start">
                              <ChevronRight className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <p className="text-sm">{action}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <p className="text-success text-center text-sm italic">
                    "{aiParsed.affirmation}"
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Impulso registrado. A análise da IA estará disponível em breve.
                </p>
              ))}
          </div>

          {step < 2 && (
            <DialogFooter className="gap-sm">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
                {t('common.actions.cancel')}
              </Button>
              {step === 0 && (
                <Button onClick={() => setStep(1)} disabled={!emotionalState}>
                  <ChevronRight className="h-4 w-4" />
                  {t('common.actions.confirm')}
                </Button>
              )}
              {step === 1 && (
                <Button
                  onClick={handleSubmit}
                  disabled={!impulseType || createMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                  {createMutation.isPending
                    ? t('pages.emotionalWellness.crisis.sending')
                    : t('pages.emotionalWellness.crisis.requestHelpBtn')}
                </Button>
              )}
            </DialogFooter>
          )}
          {step === 2 && (
            <DialogCloseFooter>
              {result && !result.resolved && (
                <Button
                  onClick={() => resolveMutation.mutate(result.id)}
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('pages.emotionalWellness.crisis.overcameBtn')}
                </Button>
              )}
            </DialogCloseFooter>
          )}
        </DialogContent>
      </Dialog>

      {logs?.results?.length === 0 ? (
        <EmptyState
          icon={<Shield />}
          title={t('pages.emotionalWellness.crisis.emptyTitle')}
        />
      ) : (
        <>
          <FilterBar
            hasActiveFilters={hasCrisisFilters}
            onClear={() => {
              setCrisisStartDate(undefined);
              setCrisisEndDate(undefined);
            }}
            activeFilters={[
              ...(crisisStartDate
                ? [
                    {
                      key: 'startDate',
                      label: `${t('common.fields.from')}: ${format(crisisStartDate, 'dd/MM/yyyy')}`,
                      onRemove: () => setCrisisStartDate(undefined),
                    },
                  ]
                : []),
              ...(crisisEndDate
                ? [
                    {
                      key: 'endDate',
                      label: `${t('common.fields.to')}: ${format(crisisEndDate, 'dd/MM/yyyy')}`,
                      onRemove: () => setCrisisEndDate(undefined),
                    },
                  ]
                : []),
            ]}
          >
            <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
              <DateRangeFilter
                startDate={crisisStartDate}
                endDate={crisisEndDate}
                onStartChange={setCrisisStartDate}
                onEndChange={setCrisisEndDate}
              />
            </FilterField>
          </FilterBar>

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<Shield />}
              title={t('pages.emotionalWellness.crisis.emptyFilteredTitle')}
            />
          ) : (
            <PaginatedSlide
              key={`${crisisStartDate ? formatLocalDate(crisisStartDate) : ''}|${crisisEndDate ? formatLocalDate(crisisEndDate) : ''}`}
              items={filteredLogs}
              pageSize={LIST_PAGE_SIZE}
              centerList
              className="space-y-sm"
            >
              {(pageItems) =>
                pageItems.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-sm pt-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {log.impulse_type_display}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {log.emotional_state_display} ·{' '}
                          {format(new Date(log.logged_at), 'dd/MM HH:mm')}
                        </p>
                      </div>
                      {log.resolved ? (
                        <Badge className="border-success/20 bg-success/10 text-success text-xs">
                          {t('pages.emotionalWellness.crisis.resolvedBadge')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {t('pages.emotionalWellness.crisis.registeredBadge')}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))
              }
            </PaginatedSlide>
          )}
        </>
      )}
    </div>
  );
}

// ─── Library tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<
    InterventionCategory | 'all'
  >('all');
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['wellness', 'interventions', selectedCategory],
    queryFn: () =>
      wellnessService.getInterventions(
        selectedCategory !== 'all' ? { category: selectedCategory } : undefined
      ),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) =>
      wellnessService.completeIntervention({
        intervention: id,
        completed_at: new Date().toISOString(),
      }),
    onSuccess: (_, id) => {
      setCompletedIds((prev) => new Set(prev).add(id));
      setCompletingId(null);
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      toast({ title: t('pages.emotionalWellness.library.completedToast') });
    },
    onError: () => {
      setCompletingId(null);
      toast({
        title: t('pages.emotionalWellness.library.registerError'),
        variant: 'destructive',
      });
    },
  });

  const categories: Array<{ value: InterventionCategory | 'all'; label: string }> = [
    { value: 'all', label: t('pages.emotionalWellness.library.categoryOptions.all') },
    {
      value: 'self_esteem',
      label: t('pages.emotionalWellness.library.categoryOptions.self_esteem'),
    },
    {
      value: 'loneliness',
      label: t('pages.emotionalWellness.library.categoryOptions.loneliness'),
    },
    {
      value: 'neediness',
      label: t('pages.emotionalWellness.library.categoryOptions.neediness'),
    },
    {
      value: 'anxiety',
      label: t('pages.emotionalWellness.library.categoryOptions.anxiety'),
    },
    {
      value: 'emotional_dependency',
      label: t('pages.emotionalWellness.library.categoryOptions.emotional_dependency'),
    },
  ];

  const difficultyColor: Record<string, string> = {
    easy: 'text-success',
    medium: 'text-warning',
    hard: 'text-destructive',
  };

  return (
    <div className="space-y-md">
      <FilterBar
        hasActiveFilters={selectedCategory !== 'all'}
        onClear={() => setSelectedCategory('all')}
        activeFilters={[
          ...(selectedCategory !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('pages.emotionalWellness.library.categoryLabel')}: ${categories.find((c) => c.value === selectedCategory)?.label ?? selectedCategory}`,
                  onRemove: () => setSelectedCategory('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.fields.category')} icon={Tag}>
          <Select
            value={selectedCategory}
            onValueChange={(v) =>
              setSelectedCategory(v as InterventionCategory | 'all')
            }
          >
            <SelectTrigger
              className="w-48"
              aria-label={t('pages.emotionalWellness.library.categoryLabel')}
              startIcon={<BookOpen className="h-3.5 w-3.5" />}
            >
              <SelectValue
                placeholder={t('pages.emotionalWellness.library.categoryLabel')}
              />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => {
                const CategoryIcon = INTERVENTION_CATEGORY_ICONS[c.value];
                return (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    icon={
                      CategoryIcon ? <CategoryIcon className="h-4 w-4" /> : undefined
                    }
                  >
                    {c.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title={t('pages.emotionalWellness.library.emptyTitle')}
        />
      ) : (
        <PaginatedSlide
          key={String(selectedCategory)}
          items={data?.results ?? []}
          pageSize={LIST_PAGE_SIZE}
          centerList
          className="space-y-sm"
        >
          {(pageItems) =>
            pageItems.map((item: WellnessIntervention) => {
              const done = completedIds.has(item.id);
              return (
                <Card key={item.id} className={cn('transition', done && 'opacity-70')}>
                  <CardContent className="px-md py-md pt-md space-y-xs">
                    {/* Categoria, tempo, dificuldade e título à esquerda; benefício no centro; ação à direita */}
                    <div className="gap-xs sm:gap-md grid items-center sm:grid-cols-[1fr_auto_1fr]">
                      <div className="gap-sm flex flex-wrap items-center">
                        <span
                          className={cn(
                            'px-sm rounded-full border py-0.5 text-xs font-medium',
                            CATEGORY_COLORS[item.category]
                          )}
                        >
                          {t(
                            `pages.emotionalWellness.library.categories.${item.category}`
                          )}
                        </span>
                        <span className="gap-xs text-muted-foreground flex items-center text-xs">
                          <Clock className="h-3 w-3" /> {item.duration_minutes}min
                        </span>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            difficultyColor[item.difficulty]
                          )}
                        >
                          {item.difficulty_display}
                        </span>
                        <h3 className="text-foreground font-medium">{item.title}</h3>
                      </div>
                      <p className="gap-xs text-muted-foreground flex items-center justify-center text-center text-xs">
                        <TrendingUp className="h-3 w-3 shrink-0" />
                        {item.expected_benefit}
                      </p>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant={done ? 'outline' : 'default'}
                          className="h-7 shrink-0 text-xs"
                          disabled={
                            completeMutation.isPending && completingId === item.id
                          }
                          onClick={() => {
                            if (done) return;
                            setCompletingId(item.id);
                            completeMutation.mutate(item.id);
                          }}
                        >
                          {done ? (
                            <>
                              <CheckCircle2 className="text-success h-3 w-3" />{' '}
                              {t('pages.emotionalWellness.library.doneBtn')}
                            </>
                          ) : completeMutation.isPending && completingId === item.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {t('pages.emotionalWellness.library.savingLabel')}
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" />
                              {t('pages.emotionalWellness.library.doNowBtn')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          }
        </PaginatedSlide>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmotionalWellness() {
  const { t } = useTranslation();
  const [tab, setTab] = useTabRoute(
    '/planning/emotional-wellness',
    TABS.map((x) => x.id),
    'dashboard'
  );
  const activeTab = TABS.find((x) => x.id === tab) ?? TABS[0];
  const ActiveIcon = activeTab.icon;
  const [selfEsteemFormOpen, setSelfEsteemFormOpen] = useState(false);
  const [checkinFormOpen, setCheckinFormOpen] = useState(false);
  const [crisisFormOpen, setCrisisFormOpen] = useState(false);
  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t(`pages.emotionalWellness.tabs.${activeTab.labelKey}`)}
          icon={<ActiveIcon />}
          actions={
            tab === 'self-esteem' ? (
              <Can action="add">
                <Button onClick={() => setSelfEsteemFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('pages.emotionalWellness.selfEsteem.newAssessmentBtn')}
                </Button>
              </Can>
            ) : tab === 'checkin' ? (
              <Can action="add">
                <Button onClick={() => setCheckinFormOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('pages.emotionalWellness.checkin.registerBtn')}
                </Button>
              </Can>
            ) : (
              tab === 'crisis' && (
                <Button onClick={() => setCrisisFormOpen(true)}>
                  <Shield className="h-4 w-4" />
                  {t('pages.emotionalWellness.crisis.modeBtn')}
                </Button>
              )
            )
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-lg w-full overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="gap-xs flex-1">
                  <Icon className="h-3.5 w-3.5" />
                  {t(`pages.emotionalWellness.tabs.${tab.labelKey}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="self-esteem">
            <SelfEsteemTab
              showForm={selfEsteemFormOpen}
              setShowForm={setSelfEsteemFormOpen}
            />
          </TabsContent>
          <TabsContent value="checkin">
            <CheckinTab showForm={checkinFormOpen} setShowForm={setCheckinFormOpen} />
          </TabsContent>
          <TabsContent value="crisis">
            <CrisisTab showForm={crisisFormOpen} setShowForm={setCrisisFormOpen} />
          </TabsContent>
          <TabsContent value="library">
            <LibraryTab />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AnimatedPage>
  );
}
