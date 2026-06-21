/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  Dumbbell,
  Edit,
  Percent,
  Plus,
  Ruler,
  Scale,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EnhancedTooltip } from '@/components/charts/EnhancedTooltip';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useChartGradientId, useSemanticColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import { bodyMetricService } from '@/services/workout-service';
import type { BodyMetric, BodyMetricFormData } from '@/types/workout';

// ── Tipos ────────────────────────────────────────────────────────────────────

type PeriodKey = '30' | '90' | '180' | 'all';

const METRIC_META = [
  { key: 'weight_kg', labelKey: 'weight', unit: 'kg' },
  { key: 'bmi', labelKey: 'bmi', unit: '' },
  { key: 'waist_cm', labelKey: 'waist', unit: 'cm' },
  { key: 'arm_cm', labelKey: 'arm', unit: 'cm' },
  { key: 'hip_cm', labelKey: 'hip', unit: 'cm' },
  { key: 'body_fat_pct', labelKey: 'bodyFat', unit: '%' },
] as const;

type MetricKey = (typeof METRIC_META)[number]['key'];

// ── Cálculos ──────────────────────────────────────────────────────────────────

function calcBmi(weightKg: number, heightCm: number): number | null {
  if (heightCm <= 0 || weightKg <= 0) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
}

/**
 * Método da Marinha Americana para estimativa de gordura corporal.
 * Homens: circunferência de cintura e pescoço + altura.
 * Mulheres: cintura, quadril, pescoço + altura.
 */
function calcNavyBodyFat(
  sex: string,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm: number | null
): number | null {
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;

  if (sex === 'M') {
    const diff = waistCm - neckCm;
    if (diff <= 0) return null;
    const bf =
      495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) -
      450;
    return bf < 0 ? null : parseFloat(bf.toFixed(2));
  }

  if (sex === 'F') {
    if (!hipCm || hipCm <= 0) return null;
    const diff = waistCm + hipCm - neckCm;
    if (diff <= 0) return null;
    const bf =
      495 / (1.29579 - 0.35004 * Math.log10(diff) + 0.221 * Math.log10(heightCm)) - 450;
    return bf < 0 ? null : parseFloat(bf.toFixed(2));
  }

  return null;
}

function bmiCategory(
  bmi: number,
  t: (k: string) => string
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (bmi < 18.5)
    return { label: t('pages.bodyMetrics.bmiUnder'), variant: 'secondary' };
  if (bmi < 25) return { label: t('pages.bodyMetrics.bmiNormal'), variant: 'default' };
  if (bmi < 30) return { label: t('pages.bodyMetrics.bmiOver'), variant: 'outline' };
  if (bmi < 35)
    return { label: t('pages.bodyMetrics.bmiObesity1'), variant: 'destructive' };
  if (bmi < 40)
    return { label: t('pages.bodyMetrics.bmiObesity2'), variant: 'destructive' };
  return { label: t('pages.bodyMetrics.bmiObesity3'), variant: 'destructive' };
}

function bmiStatVariant(bmi: number): 'success' | 'warning' | 'danger' | 'default' {
  if (bmi < 18.5) return 'warning';
  if (bmi < 25) return 'success';
  if (bmi < 30) return 'warning';
  return 'danger';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(
  value: string | number | null | undefined,
  unit: string,
  decimals = 1
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`;
}

function varDesc(
  current: string | null,
  previous: string | null,
  unit: string
): string | undefined {
  if (!current || !previous) return undefined;
  const diff = parseFloat(current) - parseFloat(previous);
  if (Math.abs(diff) < 0.01) return undefined;
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)} ${unit} vs. anterior`;
}

// ── Form state ────────────────────────────────────────────────────────────────

interface MetricFormState {
  measured_at: Date | undefined;
  weight_kg: string;
  height_cm: string;
  waist_cm: string;
  neck_cm: string;
  arm_cm: string;
  hip_cm: string;
  notes: string;
}

const emptyForm: MetricFormState = {
  measured_at: new Date(),
  weight_kg: '',
  height_cm: '',
  waist_cm: '',
  neck_cm: '',
  arm_cm: '',
  hip_cm: '',
  notes: '',
};

function toFormState(m: BodyMetric): MetricFormState {
  return {
    measured_at: parseISO(m.measured_at + 'T00:00:00'),
    weight_kg: m.weight_kg ?? '',
    height_cm: m.height_cm ?? '',
    waist_cm: m.waist_cm ?? '',
    neck_cm: m.neck_cm ?? '',
    arm_cm: m.arm_cm ?? '',
    hip_cm: m.hip_cm ?? '',
    notes: m.notes,
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function BodyMetrics() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const semanticColors = useSemanticColors();
  const getGradientId = useChartGradientId('body-metrics');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BodyMetric | null>(null);
  const [form, setForm] = useState<MetricFormState>(emptyForm);
  const [period, setPeriod] = useState<PeriodKey>('90');
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set<MetricKey>(['weight_kg', 'bmi', 'body_fat_pct'])
  );

  const chartMetrics = [
    { ...METRIC_META[0], color: semanticColors.primary },
    { ...METRIC_META[1], color: semanticColors.caution },
    { ...METRIC_META[2], color: semanticColors.warning },
    { ...METRIC_META[3], color: semanticColors.success },
    { ...METRIC_META[4], color: semanticColors.danger },
    { ...METRIC_META[5], color: semanticColors.info },
  ];

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['body-metrics'],
    queryFn: () => bodyMetricService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['body-metrics'] });

  const createMutation = useMutation({
    mutationFn: (data: BodyMetricFormData) => bodyMetricService.create(data),
    onSuccess: () => {
      void invalidate();
      setDialogOpen(false);
      toast({
        title: t('pages.bodyMetrics.created'),
        description: t('pages.bodyMetrics.createdDesc'),
      });
    },
    onError: () => {
      toast({ title: t('pages.bodyMetrics.saveError'), variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BodyMetricFormData }) =>
      bodyMetricService.update(id, data),
    onSuccess: () => {
      void invalidate();
      setDialogOpen(false);
      toast({
        title: t('pages.bodyMetrics.updated'),
        description: t('pages.bodyMetrics.updatedDesc'),
      });
    },
    onError: () => {
      toast({ title: t('pages.bodyMetrics.saveError'), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bodyMetricService.delete(id),
    onSuccess: () => {
      void invalidate();
      toast({
        title: t('pages.bodyMetrics.deleted'),
        description: t('pages.bodyMetrics.deletedDesc'),
      });
    },
    onError: () => {
      toast({ title: t('pages.bodyMetrics.deleteError'), variant: 'destructive' });
    },
  });

  const sex = member?.sex ?? 'M';
  const ownerId = member?.id ?? 0;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Cálculo em tempo real no formulário ────────────────────────────────────

  const liveWeight = parseFloat(form.weight_kg) || 0;
  const liveHeight = parseFloat(form.height_cm) || 0;
  const liveWaist = parseFloat(form.waist_cm) || 0;
  const liveNeck = parseFloat(form.neck_cm) || 0;
  const liveHip = parseFloat(form.hip_cm) || 0;

  const liveBmi = calcBmi(liveWeight, liveHeight);
  const liveBodyFat = calcNavyBodyFat(
    sex,
    liveHeight,
    liveWaist,
    liveNeck,
    liveHip > 0 ? liveHip : null
  );

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(metric: BodyMetric) {
    setEditing(metric);
    setForm(toFormState(metric));
    setDialogOpen(true);
  }

  async function handleDelete(metric: BodyMetric) {
    const ok = await showConfirm({
      title: t('pages.bodyMetrics.deleteTitle'),
      description: t('pages.bodyMetrics.deleteDesc'),
      confirmText: t('common.actions.delete'),
      variant: 'destructive',
    });
    if (ok) deleteMutation.mutate(metric.id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.measured_at) return;

    const bfPct = liveBodyFat !== null ? String(liveBodyFat) : null;

    const payload: BodyMetricFormData = {
      measured_at: format(form.measured_at, 'yyyy-MM-dd'),
      weight_kg: form.weight_kg || null,
      height_cm: form.height_cm || null,
      waist_cm: form.waist_cm || null,
      neck_cm: form.neck_cm || null,
      arm_cm: form.arm_cm || null,
      hip_cm: form.hip_cm || null,
      body_fat_pct: bfPct,
      notes: form.notes,
      owner: ownerId,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ── Dados do gráfico ───────────────────────────────────────────────────────

  const filteredMetrics = (() => {
    if (period === 'all') return [...metrics].reverse();
    const days = parseInt(period, 10);
    const cutoff = subDays(new Date(), days);
    return [...metrics]
      .filter((m) => parseISO(m.measured_at + 'T00:00:00') >= cutoff)
      .reverse();
  })();

  const chartData = filteredMetrics.map((m) => {
    const w = m.weight_kg ? parseFloat(m.weight_kg) : null;
    const h = m.height_cm ? parseFloat(m.height_cm) : null;
    const bmi = w && h ? calcBmi(w, h) : null;
    return {
      date: format(parseISO(m.measured_at + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
      weight_kg: w,
      bmi: bmi !== null ? parseFloat(bmi.toFixed(1)) : null,
      waist_cm: m.waist_cm ? parseFloat(m.waist_cm) : null,
      arm_cm: m.arm_cm ? parseFloat(m.arm_cm) : null,
      hip_cm: m.hip_cm ? parseFloat(m.hip_cm) : null,
      body_fat_pct: m.body_fat_pct ? parseFloat(m.body_fat_pct) : null,
    };
  });

  const latestTwo = metrics.slice(0, 2);
  const latest = latestTwo[0] ?? null;
  const previous = latestTwo[1] ?? null;

  const latestBmi =
    latest?.weight_kg && latest?.height_cm
      ? calcBmi(parseFloat(latest.weight_kg), parseFloat(latest.height_cm))
      : null;

  const locale = i18n.language === 'pt-BR' ? ptBR : undefined;

  function toggleMetric(key: MetricKey) {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setField(field: keyof MetricFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  if (isLoading) return <LoadingState />;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.bodyMetrics.title')}
          description={t('pages.bodyMetrics.subtitle')}
          action={{
            label: t('pages.bodyMetrics.newBtn'),
            icon: <Plus className="h-4 w-4" />,
            onClick: openCreate,
          }}
        />

        {metrics.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-8 w-8" />}
            title={t('pages.bodyMetrics.empty')}
            description={t('pages.bodyMetrics.emptyDesc')}
            action={{
              label: t('pages.bodyMetrics.emptyAction'),
              icon: <Plus className="mr-xs h-4 w-4" />,
              onClick: openCreate,
            }}
          />
        ) : (
          <>
            {/* ── Cards de resumo ── */}
            {latest && (
              <div className="mb-lg grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  title={t('pages.bodyMetrics.weight')}
                  value={fmt(latest.weight_kg, 'kg')}
                  icon={<Scale className="h-4 w-4" />}
                  accentColor="purple"
                  description={varDesc(
                    latest.weight_kg,
                    previous?.weight_kg ?? null,
                    'kg'
                  )}
                />
                <StatCard
                  title={t('pages.bodyMetrics.bmiLabel')}
                  value={latestBmi !== null ? latestBmi.toFixed(1) : '—'}
                  icon={<Activity className="h-4 w-4" />}
                  variant={latestBmi !== null ? bmiStatVariant(latestBmi) : 'default'}
                  description={
                    latestBmi !== null ? bmiCategory(latestBmi, t).label : undefined
                  }
                />
                <StatCard
                  title={t('pages.bodyMetrics.bodyFat')}
                  value={fmt(latest.body_fat_pct, '%')}
                  icon={<Percent className="h-4 w-4" />}
                  accentColor="blue"
                  description={varDesc(
                    latest.body_fat_pct,
                    previous?.body_fat_pct ?? null,
                    '%'
                  )}
                />
                <StatCard
                  title={t('pages.bodyMetrics.waist')}
                  value={fmt(latest.waist_cm, 'cm')}
                  icon={<Ruler className="h-4 w-4" />}
                  accentColor="orange"
                  description={varDesc(
                    latest.waist_cm,
                    previous?.waist_cm ?? null,
                    'cm'
                  )}
                />
                <StatCard
                  title={t('pages.bodyMetrics.arm')}
                  value={fmt(latest.arm_cm, 'cm')}
                  icon={<Dumbbell className="h-4 w-4" />}
                  accentColor="green"
                  description={varDesc(latest.arm_cm, previous?.arm_cm ?? null, 'cm')}
                />
                <StatCard
                  title={t('pages.bodyMetrics.hip')}
                  value={fmt(latest.hip_cm, 'cm')}
                  icon={<Ruler className="h-4 w-4" />}
                  accentColor="red"
                  description={varDesc(latest.hip_cm, previous?.hip_cm ?? null, 'cm')}
                />
              </div>
            )}

            <Tabs defaultValue="chart">
              <TabsList className="mb-md">
                <TabsTrigger value="chart">
                  {t('pages.bodyMetrics.tabChart')}
                </TabsTrigger>
                <TabsTrigger value="history">
                  {t('pages.bodyMetrics.tabHistory')}
                </TabsTrigger>
              </TabsList>

              {/* ── Gráfico ── */}
              <TabsContent value="chart">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-md pb-sm">
                    <CardTitle className="text-base">
                      {t('pages.bodyMetrics.chartTitle')}
                    </CardTitle>
                    <div className="flex items-center gap-sm">
                      <span className="text-xs text-muted-foreground">
                        {t('pages.bodyMetrics.chartPeriod')}:
                      </span>
                      <Select
                        value={period}
                        onValueChange={(v) => setPeriod(v as PeriodKey)}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">
                            {t('pages.bodyMetrics.last30')}
                          </SelectItem>
                          <SelectItem value="90">
                            {t('pages.bodyMetrics.last90')}
                          </SelectItem>
                          <SelectItem value="180">
                            {t('pages.bodyMetrics.last180')}
                          </SelectItem>
                          <SelectItem value="all">
                            {t('pages.bodyMetrics.allTime')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-md flex flex-wrap gap-xs">
                      {chartMetrics.map(({ key, labelKey, color, unit }) => {
                        const isActive = activeMetrics.has(key);
                        return (
                          <button
                            key={key}
                            onClick={() => toggleMetric(key)}
                            className={cn(
                              'inline-flex items-center gap-xs rounded-full border px-sm py-1 text-xs font-medium transition-all duration-200',
                              isActive ? 'shadow-sm' : 'hover:opacity-70'
                            )}
                            style={{
                              borderColor: color,
                              color: isActive ? color : 'hsl(var(--muted-foreground))',
                              backgroundColor: isActive ? `${color}1a` : 'transparent',
                              opacity: isActive ? 1 : 0.5,
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: isActive
                                  ? color
                                  : 'hsl(var(--muted-foreground))',
                              }}
                            />
                            {t(`pages.bodyMetrics.${labelKey}`)}
                            {unit ? ` (${unit})` : ''}
                          </button>
                        );
                      })}
                    </div>

                    {chartData.length < 2 ? (
                      <div className="flex flex-col items-center justify-center py-xl text-center">
                        <Activity className="mb-sm h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          {t('pages.bodyMetrics.noDataForChart')}
                        </p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={360}>
                        <AreaChart
                          data={chartData}
                          margin={{ top: 8, right: 8, left: -10, bottom: 4 }}
                        >
                          <defs>
                            {chartMetrics.map(({ key, color }, idx) => (
                              <linearGradient
                                key={`grad-${key}`}
                                id={getGradientId(idx)}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={color}
                                  stopOpacity={0.25}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={color}
                                  stopOpacity={0.02}
                                />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            opacity={0.4}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tick={{
                              fontSize: 11,
                              fill: 'hsl(var(--muted-foreground))',
                            }}
                            tickLine={false}
                            axisLine={{ stroke: 'hsl(var(--border))' }}
                            dy={8}
                          />
                          <YAxis
                            tick={{
                              fontSize: 11,
                              fill: 'hsl(var(--muted-foreground))',
                            }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                          />
                          <Tooltip
                            content={
                              <EnhancedTooltip
                                formatter={(v) => Number(v).toFixed(1)}
                              />
                            }
                            cursor={{
                              stroke: 'hsl(var(--muted-foreground))',
                              strokeWidth: 1,
                              strokeDasharray: '4 4',
                            }}
                          />
                          {chartMetrics
                            .filter(({ key }) => activeMetrics.has(key))
                            .map(({ key, labelKey, color, unit }) => {
                              const gradIdx = chartMetrics.findIndex(
                                (m) => m.key === key
                              );
                              return (
                                <Area
                                  key={key}
                                  type="monotone"
                                  dataKey={key}
                                  stroke={color}
                                  strokeWidth={2.5}
                                  fill={`url(#${getGradientId(gradIdx)})`}
                                  dot={{
                                    r: 3,
                                    strokeWidth: 2,
                                    fill: 'hsl(var(--background))',
                                    stroke: color,
                                  }}
                                  activeDot={{
                                    r: 6,
                                    strokeWidth: 2,
                                    fill: color,
                                    stroke: 'hsl(var(--background))',
                                    style: {
                                      filter: `drop-shadow(0 0 4px ${color})`,
                                    },
                                  }}
                                  connectNulls
                                  animationDuration={600}
                                  animationEasing="ease-out"
                                  name={String(
                                    `${t(`pages.bodyMetrics.${labelKey}`)}${unit ? ` (${unit})` : ''}`
                                  )}
                                />
                              );
                            })}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Histórico ── */}
              <TabsContent value="history">
                <div className="space-y-sm">
                  {metrics.map((metric) => {
                    const date = parseISO(metric.measured_at + 'T00:00:00');
                    const bmi =
                      metric.weight_kg && metric.height_cm
                        ? calcBmi(
                            parseFloat(metric.weight_kg),
                            parseFloat(metric.height_cm)
                          )
                        : null;
                    return (
                      <Card key={metric.id}>
                        <CardContent className="flex items-start justify-between gap-md p-md">
                          <div className="min-w-0 flex-1">
                            <div className="mb-sm flex flex-wrap items-center gap-sm">
                              <span className="font-medium">
                                {format(date, "dd 'de' MMMM 'de' yyyy", { locale })}
                              </span>
                              {bmi !== null && (
                                <Badge
                                  variant={bmiCategory(bmi, t).variant}
                                  className="text-xs"
                                >
                                  IMC {bmi.toFixed(1)} · {bmiCategory(bmi, t).label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-md gap-y-xs text-sm text-muted-foreground">
                              {metric.weight_kg && (
                                <span>
                                  {t('pages.bodyMetrics.weight')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.weight_kg, 'kg')}
                                  </strong>
                                </span>
                              )}
                              {metric.height_cm && (
                                <span>
                                  {t('pages.bodyMetrics.height')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.height_cm, 'cm')}
                                  </strong>
                                </span>
                              )}
                              {metric.waist_cm && (
                                <span>
                                  {t('pages.bodyMetrics.waist')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.waist_cm, 'cm')}
                                  </strong>
                                </span>
                              )}
                              {metric.neck_cm && (
                                <span>
                                  {t('pages.bodyMetrics.neck')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.neck_cm, 'cm')}
                                  </strong>
                                </span>
                              )}
                              {metric.arm_cm && (
                                <span>
                                  {t('pages.bodyMetrics.arm')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.arm_cm, 'cm')}
                                  </strong>
                                </span>
                              )}
                              {metric.hip_cm && (
                                <span>
                                  {t('pages.bodyMetrics.hip')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.hip_cm, 'cm')}
                                  </strong>
                                </span>
                              )}
                              {metric.body_fat_pct && (
                                <span>
                                  {t('pages.bodyMetrics.bodyFat')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.body_fat_pct, '%')}
                                  </strong>
                                </span>
                              )}
                            </div>
                            {metric.notes && (
                              <p className="mt-xs text-xs text-muted-foreground">
                                {metric.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-xs">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(metric)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => void handleDelete(metric)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* ── Dialog de formulário ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? t('pages.bodyMetrics.editTitle')
                  : t('pages.bodyMetrics.newTitle')}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? t('pages.bodyMetrics.editDesc')
                  : t('pages.bodyMetrics.newDesc')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-md">
              <div className="space-y-xs">
                <Label>{t('pages.bodyMetrics.measuredAt')}</Label>
                <DatePicker
                  value={form.measured_at}
                  onChange={(d) => setForm((f) => ({ ...f, measured_at: d }))}
                />
              </div>

              {/* ── Peso e Altura → IMC ── */}
              <FormSection title={t('pages.bodyMetrics.sectionWeightHeight')}>
                <div className="grid grid-cols-2 gap-md">
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.weight')} (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 75.5"
                      value={form.weight_kg}
                      onChange={setField('weight_kg')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.height')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 175"
                      value={form.height_cm}
                      onChange={setField('height_cm')}
                    />
                  </div>
                </div>
                {liveBmi !== null && (
                  <div className="mt-sm flex items-center gap-sm rounded-md border bg-muted/40 px-md py-sm text-sm">
                    <span className="text-muted-foreground">
                      {t('pages.bodyMetrics.bmiLabel')}:
                    </span>
                    <strong>{liveBmi.toFixed(1)}</strong>
                    <Badge
                      variant={bmiCategory(liveBmi, t).variant}
                      className="text-xs"
                    >
                      {bmiCategory(liveBmi, t).label}
                    </Badge>
                  </div>
                )}
              </FormSection>

              {/* ── Circunferências → Gordura Corporal (Método Marinha) ── */}
              <FormSection title={t('pages.bodyMetrics.sectionCircumferences')}>
                <p className="mb-sm text-xs text-muted-foreground">
                  {t('pages.bodyMetrics.navyMethodHint')}
                </p>
                <div className="grid grid-cols-2 gap-md">
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.waist')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 80"
                      value={form.waist_cm}
                      onChange={setField('waist_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.neck')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 38"
                      value={form.neck_cm}
                      onChange={setField('neck_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.arm')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 35"
                      value={form.arm_cm}
                      onChange={setField('arm_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>
                      {t('pages.bodyMetrics.hip')} (cm)
                      {sex === 'F' && (
                        <span className="ml-xs text-xs text-muted-foreground">*</span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ex: 95"
                      value={form.hip_cm}
                      onChange={setField('hip_cm')}
                    />
                  </div>
                </div>
                {liveBodyFat !== null ? (
                  <div className="mt-sm flex items-center gap-sm rounded-md border border-success/30 bg-success/10 px-md py-sm text-sm">
                    <span className="text-muted-foreground">
                      {t('pages.bodyMetrics.bodyFat')}:
                    </span>
                    <strong>{liveBodyFat.toFixed(1)}%</strong>
                    <span className="text-xs text-muted-foreground">
                      ({t('pages.bodyMetrics.navyMethod')})
                    </span>
                  </div>
                ) : liveWaist > 0 || liveNeck > 0 ? (
                  <p className="mt-sm text-xs text-muted-foreground">
                    {t('pages.bodyMetrics.navyMethodIncomplete')}
                  </p>
                ) : null}
              </FormSection>

              <div className="space-y-xs">
                <Label>{t('pages.bodyMetrics.notes')}</Label>
                <Textarea
                  placeholder={t('pages.bodyMetrics.notesPlaceholder')}
                  value={form.notes}
                  onChange={setField('notes')}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-sm pt-sm">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={isSaving || !form.measured_at}>
                  {isSaving ? t('common.actions.saving') : t('common.actions.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}
