/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Zap,
  Brain,
  Shield,
  BookOpen,
  BarChart3,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  RefreshCw,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  type CrisisImpulseLog,
  type CrisisImpulseLogCreate,
  type EmotionalState,
  type ImpulseType,
  type InterventionCategory,
  type SelfEsteemAssessment,
  type SelfEsteemAssessmentCreate,
  type WellnessIntervention,
  wellnessService,
} from '@/services/wellness-service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'self-esteem' | 'checkin' | 'crisis' | 'library' | 'report';

// ─── Rosenberg questions ──────────────────────────────────────────────────────

const ROSENBERG_QUESTIONS = [
  'Sinto que sou uma pessoa de valor, pelo menos tanto quanto outras pessoas.',
  'Sinto que tenho várias qualidades boas.',
  'Ao todo, estou inclinado(a) a sentir que sou um(a) fracasso(a).',
  'Sou capaz de fazer as coisas tão bem quanto outras pessoas.',
  'Sinto que não tenho muito do que me orgulhar.',
  'Tenho uma atitude positiva em relação a mim mesmo(a).',
  'No geral, estou satisfeito(a) comigo mesmo(a).',
  'Gostaria de poder ter mais respeito por mim mesmo(a).',
  'Às vezes me sinto inútil.',
  'Às vezes penso que não sirvo para nada.',
];

const ROSENBERG_OPTIONS = [
  { value: 0, label: 'Discordo totalmente' },
  { value: 1, label: 'Discordo' },
  { value: 2, label: 'Concordo' },
  { value: 3, label: 'Concordo totalmente' },
];

const EMOTIONAL_STATES: { value: EmotionalState; label: string }[] = [
  { value: 'loneliness', label: 'Solidão' },
  { value: 'neediness', label: 'Carência' },
  { value: 'anxiety', label: 'Ansiedade' },
  { value: 'boredom', label: 'Tédio' },
  { value: 'frustration', label: 'Frustração' },
  { value: 'anger', label: 'Raiva' },
  { value: 'other', label: 'Outro' },
];

const IMPULSE_TYPES: { value: ImpulseType; label: string }[] = [
  { value: 'pornography', label: 'Pornografia' },
  { value: 'alcohol', label: 'Álcool' },
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'shopping', label: 'Compras' },
  { value: 'procrastination', label: 'Procrastinação' },
  { value: 'other', label: 'Outro' },
];

const CATEGORY_LABELS: Record<InterventionCategory, string> = {
  self_esteem: 'Autoestima',
  loneliness: 'Solidão',
  neediness: 'Carência',
  anxiety: 'Ansiedade',
  emotional_dependency: 'Dependência Emocional',
};

const CATEGORY_COLORS: Record<InterventionCategory, string> = {
  self_esteem: 'bg-primary/10 text-primary border-primary/20',
  loneliness: 'bg-info/10 text-info border-info/20',
  neediness: 'bg-accent/10 text-accent border-accent/20',
  anxiety: 'bg-warning/10 text-warning border-warning/20',
  emotional_dependency: 'bg-success/10 text-success border-success/20',
};

// ─── Score interpretation ─────────────────────────────────────────────────────

function scoreLabel(score: number | null) {
  if (score === null) return { label: '—', color: 'text-muted-foreground' };
  if (score >= 25) return { label: 'Alta', color: 'text-success' };
  if (score >= 15) return { label: 'Média', color: 'text-warning' };
  return { label: 'Baixa', color: 'text-destructive' };
}

// ─── Scale slider ─────────────────────────────────────────────────────────────

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
  const color = colorHigh
    ? value >= 7
      ? 'text-success'
      : value >= 4
        ? 'text-warning'
        : 'text-destructive'
    : value >= 7
      ? 'text-destructive'
      : value >= 4
        ? 'text-warning'
        : 'text-success';

  return (
    <div className="space-y-sm">
      <div className="flex items-center justify-between">
        <span className="text-foreground text-sm font-medium">{label}</span>
        <span className={cn('text-lg font-bold tabular-nums', color)}>{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-muted accent-primary h-2 w-full cursor-pointer appearance-none rounded-full"
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
    <Card className="border-border/50 relative overflow-hidden">
      <CardContent className="p-5">
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

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Visão Geral', icon: BarChart3 },
  { id: 'self-esteem', label: 'Autoestima', icon: Star },
  { id: 'checkin', label: 'Check-in', icon: Heart },
  { id: 'crisis', label: 'Modo Crise', icon: Shield },
  { id: 'library', label: 'Intervenções', icon: BookOpen },
  { id: 'report', label: 'Relatório IA', icon: Sparkles },
];

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab() {
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
  const sl = scoreLabel(d.self_esteem.current_score);
  const history = historyData?.results ?? [];

  return (
    <div className="space-y-lg">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <WellnessStatCard
          title="Autoestima"
          value={
            d.self_esteem.current_score !== null
              ? `${d.self_esteem.current_score}/30`
              : null
          }
          subtitle={sl.label}
          icon={Star}
        />
        <WellnessStatCard
          title="Solidão (média)"
          value={
            d.emotional.avg_loneliness !== null ? d.emotional.avg_loneliness : null
          }
          subtitle="esta semana"
          icon={Heart}
        />
        <WellnessStatCard
          title="Ansiedade (média)"
          value={d.emotional.avg_anxiety !== null ? d.emotional.avg_anxiety : null}
          subtitle="esta semana"
          icon={Brain}
        />
        <WellnessStatCard
          title="Tarefas concluídas"
          value={d.interventions.completed_this_week}
          subtitle="esta semana"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <WellnessStatCard
          title="Motivação (média)"
          value={
            d.emotional.avg_motivation !== null ? d.emotional.avg_motivation : null
          }
          subtitle="esta semana"
          icon={Zap}
        />
        <WellnessStatCard
          title="Check-ins"
          value={d.emotional.checkins_this_week}
          subtitle="esta semana"
          icon={TrendingUp}
        />
        <WellnessStatCard
          title="Impulsos superados"
          value={`${d.impulses.resolved_this_week}/${d.impulses.count_this_week}`}
          subtitle="esta semana"
          icon={Shield}
        />
      </div>

      {/* History chart placeholder */}
      {history.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Histórico de Autoestima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-sm">
              {history.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-24 shrink-0 text-xs">
                    {format(new Date(a.assessed_at), 'dd/MM/yyyy')}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${(a.score / 30) * 100}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'w-10 text-right text-xs font-bold',
                      scoreLabel(a.score).color
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
          title="Nenhum dado ainda"
          description="Comece com um check-in emocional ou faça a avaliação de autoestima."
        />
      )}
    </div>
  );
}

// ─── Self-esteem tab ──────────────────────────────────────────────────────────

function SelfEsteemTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<SelfEsteemAssessment | null>(null);
  const [showForm, setShowForm] = useState(false);
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
        title: 'Avaliação registrada!',
        description: `Pontuação: ${result.score}/30`,
      });
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const allAnswered = ROSENBERG_QUESTIONS.every((_, i) => `q${i + 1}` in answers);

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
    <div className="space-y-5">
      {!showForm && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground font-semibold">Escala de Rosenberg</h2>
            <p className="text-muted-foreground text-sm">
              10 perguntas sobre como você se vê
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setShowForm(true);
              setSubmitted(null);
              setAiParsed(null);
            }}
          >
            Nova avaliação
          </Button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Responda com sinceridade</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {ROSENBERG_QUESTIONS.map((q, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-md space-y-3">
                  <p className="text-sm leading-relaxed font-medium">
                    {i + 1}. {q}
                  </p>
                  <div className="gap-sm grid grid-cols-2 sm:grid-cols-4">
                    {ROSENBERG_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [`q${i + 1}`]: opt.value }))
                        }
                        className={cn(
                          'py-sm rounded-lg border px-3 text-center text-xs font-medium transition-all',
                          answers[`q${i + 1}`] === opt.value
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!allAnswered || mutation.isPending}
            >
              {mutation.isPending ? 'Analisando...' : 'Enviar e obter análise da IA'}
            </Button>
          </motion.div>
        )}

        {submitted && aiParsed && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-md"
          >
            <div className="space-y-xs py-md text-center">
              <div
                className={cn('text-5xl font-black', scoreLabel(submitted.score).color)}
              >
                {submitted.score}
                <span className="text-muted-foreground text-2xl font-light">/30</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Autoestima {scoreLabel(submitted.score).label}
              </p>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-md space-y-3">
                <p className="text-foreground text-sm leading-relaxed">
                  {aiParsed.analysis}
                </p>
              </CardContent>
            </Card>

            {aiParsed.strengths?.length > 0 && (
              <Card className="border-success/20">
                <CardHeader className="px-md pb-sm pt-md">
                  <CardTitle className="text-success text-sm">
                    Pontos fortes identificados
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
              <Card className="border-warning/20">
                <CardHeader className="px-md pb-sm pt-md">
                  <CardTitle className="text-warning text-sm">
                    Crenças para trabalhar
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
              <Card className="border-primary/20">
                <CardHeader className="px-md pb-sm pt-md">
                  <CardTitle className="text-primary text-sm">
                    Sugestões para esta semana
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

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSubmitted(null);
                setAiParsed(null);
              }}
            >
              Ver histórico
            </Button>
          </motion.div>
        )}

        {!showForm && !submitted && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {history?.results?.length === 0 ? (
              <EmptyState
                icon={<Star />}
                title="Nenhuma avaliação ainda"
                description="Faça sua primeira avaliação de autoestima para começar a acompanhar sua evolução."
              />
            ) : (
              <div className="space-y-3">
                {history?.results?.map((a) => {
                  const sl = scoreLabel(a.score);
                  return (
                    <Card key={a.id} className="border-border/50">
                      <CardContent className="gap-md p-md flex items-center">
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
                          <Badge variant="outline" className="mt-xs text-xs">
                            {sl.label}
                          </Badge>
                        </div>
                        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${(a.score / 30) * 100}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Check-in tab ─────────────────────────────────────────────────────────────

function CheckinTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    loneliness: 5,
    neediness: 5,
    anxiety: 5,
    sadness: 5,
    motivation: 5,
    energy: 5,
    what_happened: '',
    occupying_thoughts: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const { data: history } = useQuery({
    queryKey: ['wellness', 'checkins', 30],
    queryFn: () => wellnessService.getCheckins(30),
  });

  const mutation = useMutation({
    mutationFn: wellnessService.createCheckin.bind(wellnessService),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      setSubmitted(true);
      toast({ title: 'Check-in registrado!' });
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  function handleSubmit() {
    mutation.mutate({
      checked_at: format(new Date(), 'yyyy-MM-dd'),
      ...form,
    });
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-md flex flex-col items-center justify-center py-12 text-center"
      >
        <div className="bg-success/10 flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle2 className="text-success h-8 w-8" />
        </div>
        <h2 className="text-lg font-semibold">Check-in registrado</h2>
        <p className="text-muted-foreground max-w-xs text-sm">
          Ótimo trabalho em reservar um momento para se conectar com você mesmo.
        </p>
        <Button onClick={() => setSubmitted(false)}>Fazer outro check-in</Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-lg">
      <div>
        <h2 className="font-semibold">Como você está agora?</h2>
        <p className="text-muted-foreground text-sm">
          Responda com honestidade — só você vai ver.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ScaleInput
          label="Solidão"
          value={form.loneliness}
          onChange={(v) => setForm((p) => ({ ...p, loneliness: v }))}
        />
        <ScaleInput
          label="Carência"
          value={form.neediness}
          onChange={(v) => setForm((p) => ({ ...p, neediness: v }))}
        />
        <ScaleInput
          label="Ansiedade"
          value={form.anxiety}
          onChange={(v) => setForm((p) => ({ ...p, anxiety: v }))}
        />
        <ScaleInput
          label="Tristeza"
          value={form.sadness}
          onChange={(v) => setForm((p) => ({ ...p, sadness: v }))}
        />
        <ScaleInput
          label="Motivação"
          value={form.motivation}
          onChange={(v) => setForm((p) => ({ ...p, motivation: v }))}
          colorHigh
        />
        <ScaleInput
          label="Energia"
          value={form.energy}
          onChange={(v) => setForm((p) => ({ ...p, energy: v }))}
          colorHigh
        />
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="what-happened"
            className="mb-xs.5 text-foreground block text-sm font-medium"
          >
            O que aconteceu hoje?
          </label>
          <textarea
            id="what-happened"
            value={form.what_happened}
            onChange={(e) => setForm((p) => ({ ...p, what_happened: e.target.value }))}
            className="border-border bg-background py-sm text-foreground placeholder:text-muted-foreground focus:ring-primary min-h-[80px] w-full resize-none rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none"
            placeholder="Pode ser algo simples ou complexo..."
          />
        </div>
        <div>
          <label
            htmlFor="occupying-thoughts"
            className="mb-xs.5 text-foreground block text-sm font-medium"
          >
            Existe algo ocupando seus pensamentos?{' '}
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            id="occupying-thoughts"
            value={form.occupying_thoughts}
            onChange={(e) =>
              setForm((p) => ({ ...p, occupying_thoughts: e.target.value }))
            }
            className="border-border bg-background py-sm text-foreground placeholder:text-muted-foreground focus:ring-primary min-h-[70px] w-full resize-none rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none"
            placeholder="Uma preocupação, uma pessoa, um pensamento recorrente..."
          />
        </div>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? 'Salvando...' : 'Registrar check-in'}
      </Button>

      {history && history.results.length > 0 && (
        <div className="space-y-sm border-border/50 pt-sm border-t">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Últimos check-ins
          </p>
          {history.results.slice(0, 3).map((c) => (
            <Card key={c.id} className="border-border/50">
              <CardContent className="flex items-center justify-between p-3">
                <p className="text-muted-foreground text-xs">
                  {format(new Date(c.checked_at), 'dd/MM')}
                </p>
                <div className="text-muted-foreground flex gap-3 text-xs">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Crisis tab ───────────────────────────────────────────────────────────────

function CrisisTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'form' | 'result'>('idle');
  const [emotionalState, setEmotionalState] = useState<EmotionalState | null>(null);
  const [otherEmotion, setOtherEmotion] = useState('');
  const [impulseType, setImpulseType] = useState<ImpulseType | null>(null);
  const [otherImpulse, setOtherImpulse] = useState('');
  const [result, setResult] = useState<CrisisImpulseLog | null>(null);
  const [aiParsed, setAiParsed] = useState<{
    validation: string;
    explanation: string;
    action_plan: { '5min': string[]; '10min': string[]; '20min': string[] };
    affirmation: string;
  } | null>(null);

  const { data: logs } = useQuery({
    queryKey: ['wellness', 'crisis'],
    queryFn: () => wellnessService.getCrisisLogs(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CrisisImpulseLogCreate) => wellnessService.createCrisisLog(data),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      setResult(r);
      if (r.ai_response) {
        try {
          setAiParsed(
            JSON.parse(r.ai_response) as {
              validation: string;
              explanation: string;
              action_plan: { '5min': string[]; '10min': string[]; '20min': string[] };
              affirmation: string;
            }
          );
        } catch {
          /* noop */
        }
      }
      setStep('result');
    },
    onError: () => toast({ title: 'Erro ao processar', variant: 'destructive' }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => wellnessService.resolveCrisisLog(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness'] });
      toast({ title: 'Impulso superado! Parabéns.' });
      setStep('idle');
      setResult(null);
      setAiParsed(null);
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

  if (step === 'idle') {
    return (
      <div className="space-y-lg">
        <div className="space-y-md py-lg text-center">
          <div className="border-destructive/20 bg-destructive/10 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border">
            <Shield className="text-destructive h-10 w-10" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Modo Crise</h2>
            <p className="mt-xs text-muted-foreground mx-auto max-w-xs text-sm">
              Quando um impulso aparecer, este espaço é para você. Sem julgamento.
            </p>
          </div>
          <Button
            size="lg"
            variant="destructive"
            className="w-full max-w-xs"
            onClick={() => setStep('form')}
          >
            Estou com um impulso agora
          </Button>
        </div>

        {logs && logs.results.length > 0 && (
          <div className="space-y-sm border-border/50 pt-md border-t">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Histórico
            </p>
            {logs.results.slice(0, 5).map((log) => (
              <Card key={log.id} className="border-border/50">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{log.impulse_type_display}</p>
                    <p className="text-muted-foreground text-xs">
                      {log.emotional_state_display} ·{' '}
                      {format(new Date(log.logged_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                  {log.resolved ? (
                    <Badge className="border-success/20 bg-success/10 text-success text-xs">
                      Superado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Registrado
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setStep('idle')}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold">O que você está sentindo?</h2>
        </div>

        <div>
          <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Estado emocional
          </p>
          <div className="gap-sm grid grid-cols-2 sm:grid-cols-3">
            {EMOTIONAL_STATES.map((e) => (
              <button
                key={e.value}
                onClick={() => setEmotionalState(e.value)}
                className={cn(
                  'py-sm.5 rounded-lg border px-3 text-left text-sm font-medium transition-all',
                  emotionalState === e.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
          {emotionalState === 'other' && (
            <input
              className="mt-sm border-border bg-background py-sm focus:ring-primary w-full rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none"
              placeholder="Descreva o que está sentindo"
              value={otherEmotion}
              onChange={(e) => setOtherEmotion(e.target.value)}
            />
          )}
        </div>

        <div>
          <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Qual impulso você está tentando evitar?
          </p>
          <div className="gap-sm grid grid-cols-2 sm:grid-cols-3">
            {IMPULSE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setImpulseType(t.value)}
                className={cn(
                  'py-sm.5 rounded-lg border px-3 text-left text-sm font-medium transition-all',
                  impulseType === t.value
                    ? 'border-destructive bg-destructive text-destructive-foreground'
                    : 'border-border text-muted-foreground hover:border-destructive/50 hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {impulseType === 'other' && (
            <input
              className="mt-sm border-border bg-background py-sm focus:ring-primary w-full rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none"
              placeholder="Descreva o impulso"
              value={otherImpulse}
              onChange={(e) => setOtherImpulse(e.target.value)}
            />
          )}
        </div>

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!emotionalState || !impulseType || createMutation.isPending}
        >
          {createMutation.isPending ? 'Buscando suporte...' : 'Quero ajuda agora'}
        </Button>
      </div>
    );
  }

  // step === 'result'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-md"
    >
      {aiParsed ? (
        <>
          <Card className="border-primary/20">
            <CardContent className="space-y-xs p-md">
              <p className="text-primary text-xs font-medium tracking-wider uppercase">
                Validação
              </p>
              <p className="text-sm leading-relaxed">{aiParsed.validation}</p>
            </CardContent>
          </Card>

          <Card className="border-warning/20">
            <CardContent className="space-y-xs p-md">
              <p className="text-warning text-xs font-medium tracking-wider uppercase">
                Contexto
              </p>
              <p className="text-sm leading-relaxed">{aiParsed.explanation}</p>
            </CardContent>
          </Card>

          <div className="space-y-sm">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Plano de ação imediato
            </p>
            {(['5min', '10min', '20min'] as const).map((duration) => (
              <Card key={duration} className="border-border/50">
                <CardHeader className="px-md pb-sm pt-3">
                  <CardTitle className="gap-xs.5 text-muted-foreground flex items-center text-xs">
                    <Clock className="h-3.5 w-3.5" /> {duration}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-xs.5 px-md pb-3">
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

          <Card className="border-success/20">
            <CardContent className="p-md">
              <p className="text-success text-center text-sm italic">
                "{aiParsed.affirmation}"
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-md">
            <p className="text-muted-foreground text-sm">
              Impulso registrado. A análise da IA estará disponível em breve.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="gap-sm pt-sm flex">
        <Button
          className="flex-1"
          variant="outline"
          onClick={() => {
            setStep('idle');
            setResult(null);
            setAiParsed(null);
          }}
        >
          Voltar
        </Button>
        {result && !result.resolved && (
          <Button
            className="flex-1"
            onClick={() => resolveMutation.mutate(result.id)}
            disabled={resolveMutation.isPending}
          >
            <CheckCircle2 className="mr-xs.5 h-4 w-4" />
            Superei o impulso
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Library tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
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
      toast({ title: 'Intervenção concluída!' });
    },
    onError: () => {
      setCompletingId(null);
      toast({ title: 'Erro ao registrar', variant: 'destructive' });
    },
  });

  const categories: Array<{ value: InterventionCategory | 'all'; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'self_esteem', label: 'Autoestima' },
    { value: 'loneliness', label: 'Solidão' },
    { value: 'neediness', label: 'Carência' },
    { value: 'anxiety', label: 'Ansiedade' },
    { value: 'emotional_dependency', label: 'Dep. Emocional' },
  ];

  const difficultyColor: Record<string, string> = {
    easy: 'text-success',
    medium: 'text-warning',
    hard: 'text-destructive',
  };

  return (
    <div className="space-y-md">
      <div className="-mx-xs gap-sm px-xs pb-xs flex overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setSelectedCategory(c.value)}
            className={cn(
              'py-xs.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-all',
              selectedCategory === c.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Nenhuma intervenção"
          description="Selecione outra categoria."
        />
      ) : (
        <div className="space-y-3">
          {data?.results?.map((item: WellnessIntervention) => {
            const done = completedIds.has(item.id);
            return (
              <Card
                key={item.id}
                className={cn('border-border/50 transition-all', done && 'opacity-70')}
              >
                <CardContent className="p-md space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-xs flex-1">
                      <div className="gap-sm flex flex-wrap items-center">
                        <span
                          className={cn(
                            'px-sm rounded-full border py-0.5 text-xs font-medium',
                            CATEGORY_COLORS[item.category]
                          )}
                        >
                          {CATEGORY_LABELS[item.category]}
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
                      </div>
                      <h3 className="text-foreground font-medium">{item.title}</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="border-border/50 pt-xs flex items-center justify-between border-t">
                    <p className="gap-xs text-muted-foreground flex items-center text-xs">
                      <TrendingUp className="h-3 w-3" /> {item.expected_benefit}
                    </p>
                    <Button
                      size="sm"
                      variant={done ? 'outline' : 'default'}
                      className="h-7 text-xs"
                      disabled={completeMutation.isPending && completingId === item.id}
                      onClick={() => {
                        if (done) return;
                        setCompletingId(item.id);
                        completeMutation.mutate(item.id);
                      }}
                    >
                      {done ? (
                        <>
                          <CheckCircle2 className="mr-xs text-success h-3 w-3" /> Feito
                        </>
                      ) : completeMutation.isPending && completingId === item.id ? (
                        'Salvando...'
                      ) : (
                        'Fazer agora'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Report tab ───────────────────────────────────────────────────────────────

function ReportTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['wellness', 'weekly-reports'],
    queryFn: () => wellnessService.getWeeklyReports(),
  });

  const generateMutation = useMutation({
    mutationFn: () => wellnessService.generateWeeklyReport(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wellness', 'weekly-reports'] });
      toast({ title: 'Relatório gerado!' });
    },
    onError: () => toast({ title: 'Erro ao gerar relatório', variant: 'destructive' }),
  });

  const latest = reports?.results?.[0];

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Relatório Semanal</h2>
          <p className="text-muted-foreground text-sm">
            Análise dos seus padrões emocionais
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <RefreshCw
            className={cn(
              'mr-xs.5 h-3.5 w-3.5',
              generateMutation.isPending && 'animate-spin'
            )}
          />
          {generateMutation.isPending ? 'Gerando...' : 'Gerar agora'}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !latest ? (
        <EmptyState
          icon={<Sparkles />}
          title="Nenhum relatório ainda"
          description="Clique em 'Gerar agora' para obter uma análise semanal personalizada da IA."
        />
      ) : (
        <div className="space-y-md">
          <Card className="border-border/50">
            <CardHeader className="px-md pb-sm pt-md">
              <CardTitle className="text-muted-foreground text-xs">
                Semana {format(new Date(latest.week_start), 'dd/MM')} –{' '}
                {format(new Date(latest.week_end), 'dd/MM/yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-md pb-md">
              <p className="text-sm leading-relaxed">{latest.ai_summary}</p>
            </CardContent>
          </Card>

          {latest.attention_points?.length > 0 && (
            <Card className="border-warning/20">
              <CardHeader className="px-md pb-sm pt-md">
                <CardTitle className="text-warning text-sm">
                  Pontos de atenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-sm px-md pb-md">
                {latest.attention_points.map((p, i) => (
                  <div key={i} className="gap-sm flex items-start">
                    <AlertCircle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-sm">{p}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {latest.suggestions?.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="px-md pb-sm pt-md">
                <CardTitle className="text-primary text-sm">
                  Sugestões para a próxima semana
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-sm px-md pb-md">
                {latest.suggestions.map((s, i) => (
                  <div key={i} className="gap-sm flex items-start">
                    <ChevronRight className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-sm">{s}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="gap-sm grid grid-cols-3">
            {[
              { label: 'Solidão', value: latest.avg_loneliness },
              { label: 'Ansiedade', value: latest.avg_anxiety },
              { label: 'Motivação', value: latest.avg_motivation },
            ].map(({ label, value }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="text-foreground text-xl font-bold">
                    {value ? Number(value).toFixed(1) : '—'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmotionalWellness() {
  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title="Centro de Bem-Estar"
          description="Autoconhecimento, equilíbrio emocional e crescimento pessoal"
        />

        <Tabs defaultValue="dashboard">
          <TabsList className="mb-lg w-full overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="gap-xs.5 flex-1">
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="self-esteem">
            <SelfEsteemTab />
          </TabsContent>
          <TabsContent value="checkin">
            <CheckinTab />
          </TabsContent>
          <TabsContent value="crisis">
            <CrisisTab />
          </TabsContent>
          <TabsContent value="library">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="report">
            <ReportTab />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AnimatedPage>
  );
}
