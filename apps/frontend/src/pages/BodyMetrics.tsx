/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInYears, format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  Layers,
  PieChart,
  Plus,
  Ratio,
  RefreshCw,
  Ruler,
  Scale,
  Loader2,
  Save,
  X,
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

import { EnhancedPieChart } from '@/components/charts/EnhancedPieChart';
import { EnhancedTooltip } from '@/components/charts/EnhancedTooltip';
import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
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

type NumericFieldKey = Exclude<keyof MetricFormState, 'measured_at' | 'notes'>;

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

/**
 * Protocolo de Pollock (Jackson & Pollock, 1978/1980 — popularizado por
 * Pollock & Wilmore, 1984) de 7 dobras cutâneas.
 * Densidade corporal a partir da soma das 7 dobras (mm) + idade,
 * com equações distintas por sexo; % de gordura via equação de Siri.
 */
function calcPollockBodyFat(sex: string, age: number, sum7: number): number | null {
  if (sum7 <= 0 || age <= 0) return null;

  const bodyDensity =
    sex === 'F'
      ? 1.097 - 0.00046971 * sum7 + 0.00000056 * sum7 ** 2 - 0.00012828 * age
      : 1.112 - 0.00043499 * sum7 + 0.00000055 * sum7 ** 2 - 0.00028826 * age;

  if (bodyDensity <= 0) return null;

  const bf = 495 / bodyDensity - 450;
  return bf < 0 ? null : parseFloat(bf.toFixed(2));
}

function calcWhr(waistCm: number, hipCm: number): number | null {
  if (waistCm <= 0 || hipCm <= 0) return null;
  return waistCm / hipCm;
}

function whrCategory(
  whr: number,
  sex: string,
  t: (k: string) => string
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (sex === 'F') {
    if (whr < 0.8) return { label: t('pages.bodyMetrics.whrLow'), variant: 'default' };
    if (whr < 0.85)
      return { label: t('pages.bodyMetrics.whrModerate'), variant: 'outline' };
    return { label: t('pages.bodyMetrics.whrHigh'), variant: 'destructive' };
  }
  if (whr < 0.9) return { label: t('pages.bodyMetrics.whrLow'), variant: 'default' };
  if (whr < 1.0)
    return { label: t('pages.bodyMetrics.whrModerate'), variant: 'outline' };
  return { label: t('pages.bodyMetrics.whrHigh'), variant: 'destructive' };
}

function whrStatVariant(
  whr: number,
  sex: string
): 'success' | 'warning' | 'danger' | 'default' {
  const high = sex === 'F' ? 0.85 : 1.0;
  const moderate = sex === 'F' ? 0.8 : 0.9;
  if (whr >= high) return 'danger';
  if (whr >= moderate) return 'warning';
  return 'success';
}

function sumFields(m: BodyMetric | null, fields: (keyof BodyMetric)[]): number | null {
  if (!m) return null;
  let sum = 0;
  let hasAny = false;
  for (const field of fields) {
    const raw = m[field];
    if (typeof raw === 'string' && raw !== '') {
      sum += parseFloat(raw);
      hasAny = true;
    }
  }
  return hasAny ? sum : null;
}

const PERIMETRY_FIELDS: (keyof BodyMetric)[] = [
  'neck_cm',
  'shoulders_cm',
  'chest_cm',
  'abdomen_cm',
  'waist_cm',
  'hip_cm',
  'arm_left_cm',
  'arm_right_cm',
  'thigh_left_cm',
  'thigh_right_cm',
  'calf_left_cm',
  'calf_right_cm',
];

const SKINFOLD_FIELDS: (keyof BodyMetric)[] = [
  'skinfold_triceps_mm',
  'skinfold_subscapular_mm',
  'skinfold_suprailiac_mm',
  'skinfold_chest_mm',
  'skinfold_midaxillary_mm',
  'skinfold_abdominal_mm',
  'skinfold_thigh_mm',
];

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

// ── Form state ────────────────────────────────────────────────────────────────

interface MetricFormState {
  measured_at: Date | undefined;
  weight_kg: string;
  height_cm: string;
  waist_cm: string;
  neck_cm: string;
  hip_cm: string;
  shoulders_cm: string;
  chest_cm: string;
  abdomen_cm: string;
  arm_left_cm: string;
  arm_right_cm: string;
  thigh_left_cm: string;
  thigh_right_cm: string;
  calf_left_cm: string;
  calf_right_cm: string;
  skinfold_triceps_mm: string;
  skinfold_subscapular_mm: string;
  skinfold_suprailiac_mm: string;
  skinfold_chest_mm: string;
  skinfold_midaxillary_mm: string;
  skinfold_abdominal_mm: string;
  skinfold_thigh_mm: string;
  notes: string;
}

const emptyForm: MetricFormState = {
  measured_at: new Date(),
  weight_kg: '',
  height_cm: '',
  waist_cm: '',
  neck_cm: '',
  hip_cm: '',
  shoulders_cm: '',
  chest_cm: '',
  abdomen_cm: '',
  arm_left_cm: '',
  arm_right_cm: '',
  thigh_left_cm: '',
  thigh_right_cm: '',
  calf_left_cm: '',
  calf_right_cm: '',
  skinfold_triceps_mm: '',
  skinfold_subscapular_mm: '',
  skinfold_suprailiac_mm: '',
  skinfold_chest_mm: '',
  skinfold_midaxillary_mm: '',
  skinfold_abdominal_mm: '',
  skinfold_thigh_mm: '',
  notes: '',
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function BodyMetrics() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const semanticColors = useSemanticColors();
  const getGradientId = useChartGradientId('body-metrics');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [recalcMode, setRecalcMode] = useState(false);
  // Registro cujos valores preenchem os campos em branco no modo recálculo
  // (o último registro geral).
  const [recalcSource, setRecalcSource] = useState<BodyMetric | null>(null);
  const [form, setForm] = useState<MetricFormState>(emptyForm);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set<MetricKey>(METRIC_META.map((m) => m.key))
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

  const sex = member?.sex ?? 'M';
  const ownerId = member?.id ?? 0;
  const age = member?.birth_date
    ? differenceInYears(new Date(), parseISO(member.birth_date))
    : null;
  const isSaving = createMutation.isPending;

  // Ordenado por -measured_at no backend (Meta.ordering do BodyMetric).
  const lastMetric = metrics[0] ?? null;

  function effectiveValue(key: NumericFieldKey): string {
    if (form[key]) return form[key];
    if (recalcMode && recalcSource?.[key]) return recalcSource[key];
    return '';
  }

  // ── Cálculo em tempo real no formulário ────────────────────────────────────

  const liveHeight = parseFloat(effectiveValue('height_cm')) || 0;
  const liveWaist = parseFloat(effectiveValue('waist_cm')) || 0;
  const liveNeck = parseFloat(effectiveValue('neck_cm')) || 0;
  const liveHip = parseFloat(effectiveValue('hip_cm')) || 0;

  const skinfoldValues = [
    effectiveValue('skinfold_triceps_mm'),
    effectiveValue('skinfold_subscapular_mm'),
    effectiveValue('skinfold_suprailiac_mm'),
    effectiveValue('skinfold_chest_mm'),
    effectiveValue('skinfold_midaxillary_mm'),
    effectiveValue('skinfold_abdominal_mm'),
    effectiveValue('skinfold_thigh_mm'),
  ].map((v) => parseFloat(v) || 0);
  const hasAllSkinfolds = skinfoldValues.every((v) => v > 0);
  const liveSum7 = skinfoldValues.reduce((sum, v) => sum + v, 0);

  const livePollockBodyFat =
    hasAllSkinfolds && age !== null ? calcPollockBodyFat(sex, age, liveSum7) : null;
  const liveNavyBodyFat = calcNavyBodyFat(
    sex,
    liveHeight,
    liveWaist,
    liveNeck,
    liveHip > 0 ? liveHip : null
  );

  const liveBodyFat = livePollockBodyFat ?? liveNavyBodyFat;
  const liveBodyFatMethod: 'pollock' | 'navy' | null =
    livePollockBodyFat !== null ? 'pollock' : liveNavyBodyFat !== null ? 'navy' : null;

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  function openCreate() {
    setRecalcMode(false);
    setRecalcSource(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openRecalculate() {
    setRecalcMode(true);
    setRecalcSource(lastMetric);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.measured_at) return;

    const bfPct = liveBodyFat !== null ? String(liveBodyFat) : null;

    const payload: BodyMetricFormData = {
      measured_at: format(form.measured_at, 'yyyy-MM-dd'),
      weight_kg: effectiveValue('weight_kg') || null,
      height_cm: effectiveValue('height_cm') || null,
      waist_cm: effectiveValue('waist_cm') || null,
      neck_cm: effectiveValue('neck_cm') || null,
      hip_cm: effectiveValue('hip_cm') || null,
      shoulders_cm: effectiveValue('shoulders_cm') || null,
      chest_cm: effectiveValue('chest_cm') || null,
      abdomen_cm: effectiveValue('abdomen_cm') || null,
      arm_left_cm: effectiveValue('arm_left_cm') || null,
      arm_right_cm: effectiveValue('arm_right_cm') || null,
      thigh_left_cm: effectiveValue('thigh_left_cm') || null,
      thigh_right_cm: effectiveValue('thigh_right_cm') || null,
      calf_left_cm: effectiveValue('calf_left_cm') || null,
      calf_right_cm: effectiveValue('calf_right_cm') || null,
      skinfold_triceps_mm: effectiveValue('skinfold_triceps_mm') || null,
      skinfold_subscapular_mm: effectiveValue('skinfold_subscapular_mm') || null,
      skinfold_suprailiac_mm: effectiveValue('skinfold_suprailiac_mm') || null,
      skinfold_chest_mm: effectiveValue('skinfold_chest_mm') || null,
      skinfold_midaxillary_mm: effectiveValue('skinfold_midaxillary_mm') || null,
      skinfold_abdominal_mm: effectiveValue('skinfold_abdominal_mm') || null,
      skinfold_thigh_mm: effectiveValue('skinfold_thigh_mm') || null,
      body_fat_method: liveBodyFatMethod,
      body_fat_pct: bfPct,
      notes: form.notes,
      owner: ownerId,
    };

    createMutation.mutate(payload);
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

  const chartData: ({ date: string } & Record<MetricKey, number | null>)[] =
    filteredMetrics.map((m) => {
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

  // Medidas corporais mudam devagar e têm unidades diferentes (kg, cm, %, IMC).
  // Para caberem numa escala única e ainda revelar pequenas variações reais,
  // cada série é normalizada como variação % em relação ao primeiro valor do período.
  const metricBaselines = METRIC_META.reduce(
    (acc, { key }) => {
      const firstValid = chartData.find((d) => d[key] !== null)?.[key] ?? null;
      acc[key] = firstValid && firstValid !== 0 ? firstValid : null;
      return acc;
    },
    {} as Record<MetricKey, number | null>
  );

  const chartDataNormalized = chartData.map((d) => {
    const pctRow = {} as Record<string, number | null>;
    for (const { key } of METRIC_META) {
      const raw = d[key];
      const baseline = metricBaselines[key];
      pctRow[`${key}_pct`] =
        raw !== null && baseline !== null
          ? parseFloat((((raw - baseline) / baseline) * 100).toFixed(2))
          : null;
    }
    return { ...d, ...pctRow };
  });

  const latest = metrics[0] ?? null;

  const latestWhr =
    latest?.waist_cm && latest?.hip_cm
      ? calcWhr(parseFloat(latest.waist_cm), parseFloat(latest.hip_cm))
      : null;
  const sumPerimetryVal = sumFields(latest, PERIMETRY_FIELDS);
  const sumSkinfoldVal = sumFields(latest, SKINFOLD_FIELDS);

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

  function setNumber(field: NumericFieldKey) {
    return (v: number | null) =>
      setForm((f) => ({ ...f, [field]: v === null ? '' : String(v) }));
  }

  function placeholderFor(key: NumericFieldKey, fallback?: string): string | undefined {
    if (recalcMode && recalcSource?.[key]) {
      return t('pages.bodyMetrics.recalcPlaceholder', { value: recalcSource[key] });
    }
    return fallback;
  }

  if (isLoading) return <LoadingState />;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.bodyMetrics.title')}
          icon={<Scale />}
          actions={
            <div className="gap-sm flex">
              {metrics.length > 0 && (
                <Button variant="outline" className="gap-sm" onClick={openRecalculate}>
                  <RefreshCw className="h-4 w-4" />
                  {t('pages.bodyMetrics.recalcBtn')}
                </Button>
              )}
              <Button className="gap-sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t('pages.bodyMetrics.newBtn')}
              </Button>
            </div>
          }
        />

        {metrics.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-8 w-8" />}
            title={t('pages.bodyMetrics.empty')}
          />
        ) : (
          <>
            <div className="gap-md grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="gap-md pb-sm flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {t('pages.bodyMetrics.chartTitle')}
                  </CardTitle>
                  <div className="gap-sm flex items-center">
                    <span className="text-muted-foreground text-xs">
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
                  <div className="mb-md gap-xs flex flex-wrap">
                    {chartMetrics.map(({ key, labelKey, color, unit }) => {
                      const isActive = activeMetrics.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleMetric(key)}
                          className={cn(
                            'gap-xs px-sm py-xs duration-normal inline-flex items-center rounded-full border text-xs font-medium transition',
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
                    <EmptyState
                      title={t('pages.bodyMetrics.noDataForChart')}
                      icon={<Activity />}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <AreaChart
                        data={chartDataNormalized}
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
                              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
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
                          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                        />
                        <Tooltip
                          content={
                            <EnhancedTooltip
                              formatter={(value, entry) => {
                                const pct = Number(value);
                                const pctStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                                if (!entry) return pctStr;
                                const baseKey = entry.dataKey.replace(
                                  /_pct$/,
                                  ''
                                ) as MetricKey;
                                const meta = METRIC_META.find((m) => m.key === baseKey);
                                const raw = entry.payload[baseKey] as
                                  number | null | undefined;
                                const rawStr =
                                  raw !== null && raw !== undefined
                                    ? `${raw.toFixed(1)}${meta?.unit ? ` ${meta.unit}` : ''}`
                                    : '—';
                                return `${rawStr} (${pctStr})`;
                              }}
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
                                dataKey={`${key}_pct`}
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
              {(() => {
                const latestWeight = latest?.weight_kg
                  ? parseFloat(latest.weight_kg)
                  : null;
                const latestFatPct = latest?.body_fat_pct
                  ? parseFloat(latest.body_fat_pct)
                  : null;
                const hasComposition = latestWeight !== null && latestFatPct !== null;
                const fatMassKg = hasComposition
                  ? latestWeight * (latestFatPct / 100)
                  : 0;
                const leanMassKg = hasComposition ? latestWeight - fatMassKg : 0;

                const pieData = [
                  {
                    name: t('pages.bodyMetrics.leanMass'),
                    value: hasComposition
                      ? parseFloat((100 - latestFatPct).toFixed(1))
                      : 0,
                    kg: leanMassKg,
                    color: semanticColors.success,
                  },
                  {
                    name: t('pages.bodyMetrics.fatMassKg'),
                    value: hasComposition ? parseFloat(latestFatPct.toFixed(1)) : 0,
                    kg: fatMassKg,
                    color: semanticColors.warning,
                  },
                ];

                return (
                  <Card>
                    <CardHeader className="pb-sm">
                      <CardTitle className="gap-xs flex items-center text-base">
                        <PieChart className="text-muted-foreground h-4 w-4" />
                        {t('pages.bodyMetrics.massChartTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {hasComposition ? (
                        <>
                          <div className="mb-md gap-xl flex flex-wrap items-center justify-center">
                            {pieData.map((item) => (
                              <div key={item.name} className="gap-sm flex items-center">
                                <span
                                  className="h-8 w-1 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <div>
                                  <p className="text-muted-foreground text-xs">
                                    {item.name}
                                  </p>
                                  <p className="text-foreground text-sm font-bold">
                                    {item.value.toFixed(1)}% · {item.kg.toFixed(1)} kg
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <EnhancedPieChart
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            colors={pieData.map((d) => d.color)}
                            formatter={(v) => `${Number(v).toFixed(1)}%`}
                            showLegend={false}
                            showSliceLabels
                            height={320}
                          />
                        </>
                      ) : (
                        <EmptyState
                          title={t('pages.bodyMetrics.noDataForComposition')}
                          icon={<PieChart />}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {latest && (
              <Card className="mt-md">
                <CardHeader className="pb-sm">
                  <CardTitle className="text-base">
                    {t('pages.bodyMetrics.resultsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
                    <StatCard
                      title={t('pages.bodyMetrics.whr')}
                      value={latestWhr !== null ? latestWhr.toFixed(2) : '—'}
                      icon={<Ratio className="h-4 w-4" />}
                      variant={
                        latestWhr !== null ? whrStatVariant(latestWhr, sex) : 'default'
                      }
                      description={
                        latestWhr !== null
                          ? whrCategory(latestWhr, sex, t).label
                          : undefined
                      }
                    />
                    <StatCard
                      title={t('pages.bodyMetrics.sumPerimetryLabel')}
                      value={fmt(sumPerimetryVal, 'cm')}
                      icon={<Ruler className="h-4 w-4" />}
                    />
                    <StatCard
                      title={t('pages.bodyMetrics.sumSkinfoldsLabel')}
                      value={fmt(sumSkinfoldVal, 'mm')}
                      icon={<Layers className="h-4 w-4" />}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── Dialog de formulário ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader sticky>
              <DialogTitle mode="create">
                {recalcMode
                  ? t('pages.bodyMetrics.recalcTitle')
                  : t('pages.bodyMetrics.newTitle')}
              </DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {recalcMode
                    ? t('pages.bodyMetrics.recalcDesc')
                    : t('pages.bodyMetrics.newDesc')}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-md">
              {recalcMode && age === null && (
                <p className="text-warning bg-warning/10 px-md py-sm rounded-md text-xs font-medium">
                  {t('pages.bodyMetrics.pollockMissingBirthDate')}
                </p>
              )}

              <div className="space-y-xs">
                <Label>{t('pages.bodyMetrics.measuredAt')}</Label>
                <DatePicker
                  value={form.measured_at}
                  onChange={(d) => setForm((f) => ({ ...f, measured_at: d }))}
                />
              </div>

              {/* ── Peso e Altura → IMC ── */}
              <FormSection title={t('pages.bodyMetrics.sectionWeightHeight')}>
                <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.weight')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="kg"
                      aria-label={t('pages.bodyMetrics.weight')}
                      placeholder={placeholderFor('weight_kg', 'Ex: 75,5')}
                      value={form.weight_kg}
                      onChange={setNumber('weight_kg')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.height')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.height')}
                      placeholder={placeholderFor('height_cm', 'Ex: 175')}
                      value={form.height_cm}
                      onChange={setNumber('height_cm')}
                    />
                  </div>
                </div>
              </FormSection>

              {/* ── Perimetria (circunferências) ── */}
              <FormSection title={t('pages.bodyMetrics.sectionPerimetry')} icon={Ruler}>
                <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.neck')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.neck')}
                      placeholder={placeholderFor('neck_cm', 'Ex: 38')}
                      value={form.neck_cm}
                      onChange={setNumber('neck_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.shoulders')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.shoulders')}
                      placeholder={placeholderFor('shoulders_cm')}
                      value={form.shoulders_cm}
                      onChange={setNumber('shoulders_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.chest')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.chest')}
                      placeholder={placeholderFor('chest_cm')}
                      value={form.chest_cm}
                      onChange={setNumber('chest_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.abdomen')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.abdomen')}
                      placeholder={placeholderFor('abdomen_cm')}
                      value={form.abdomen_cm}
                      onChange={setNumber('abdomen_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.waist')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.waist')}
                      placeholder={placeholderFor('waist_cm', 'Ex: 80')}
                      value={form.waist_cm}
                      onChange={setNumber('waist_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>
                      {t('pages.bodyMetrics.hip')}
                      {sex === 'F' && (
                        <span className="ml-xs text-muted-foreground text-xs">*</span>
                      )}
                    </Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.hip')}
                      placeholder={placeholderFor('hip_cm', 'Ex: 95')}
                      value={form.hip_cm}
                      onChange={setNumber('hip_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.armLeft')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.armLeft')}
                      placeholder={placeholderFor('arm_left_cm')}
                      value={form.arm_left_cm}
                      onChange={setNumber('arm_left_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.armRight')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.armRight')}
                      placeholder={placeholderFor('arm_right_cm')}
                      value={form.arm_right_cm}
                      onChange={setNumber('arm_right_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.thighLeft')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.thighLeft')}
                      placeholder={placeholderFor('thigh_left_cm')}
                      value={form.thigh_left_cm}
                      onChange={setNumber('thigh_left_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.thighRight')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.thighRight')}
                      placeholder={placeholderFor('thigh_right_cm')}
                      value={form.thigh_right_cm}
                      onChange={setNumber('thigh_right_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.calfLeft')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.calfLeft')}
                      placeholder={placeholderFor('calf_left_cm')}
                      value={form.calf_left_cm}
                      onChange={setNumber('calf_left_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.calfRight')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="cm"
                      aria-label={t('pages.bodyMetrics.calfRight')}
                      placeholder={placeholderFor('calf_right_cm')}
                      value={form.calf_right_cm}
                      onChange={setNumber('calf_right_cm')}
                    />
                  </div>
                </div>
              </FormSection>

              {/* ── Dobras Cutâneas → Gordura Corporal (Método Pollock 7 Dobras) ── */}
              <FormSection
                title={t('pages.bodyMetrics.sectionSkinfolds')}
                icon={Layers}
              >
                <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldTriceps')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldTriceps')}
                      placeholder={placeholderFor('skinfold_triceps_mm')}
                      value={form.skinfold_triceps_mm}
                      onChange={setNumber('skinfold_triceps_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldSubscapular')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldSubscapular')}
                      placeholder={placeholderFor('skinfold_subscapular_mm')}
                      value={form.skinfold_subscapular_mm}
                      onChange={setNumber('skinfold_subscapular_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldSuprailiac')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldSuprailiac')}
                      placeholder={placeholderFor('skinfold_suprailiac_mm')}
                      value={form.skinfold_suprailiac_mm}
                      onChange={setNumber('skinfold_suprailiac_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldChest')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldChest')}
                      placeholder={placeholderFor('skinfold_chest_mm')}
                      value={form.skinfold_chest_mm}
                      onChange={setNumber('skinfold_chest_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldMidaxillary')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldMidaxillary')}
                      placeholder={placeholderFor('skinfold_midaxillary_mm')}
                      value={form.skinfold_midaxillary_mm}
                      onChange={setNumber('skinfold_midaxillary_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldAbdominal')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldAbdominal')}
                      placeholder={placeholderFor('skinfold_abdominal_mm')}
                      value={form.skinfold_abdominal_mm}
                      onChange={setNumber('skinfold_abdominal_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldThigh')}</Label>
                    <DecimalInput
                      decimals={1}
                      unit="mm"
                      aria-label={t('pages.bodyMetrics.skinfoldThigh')}
                      placeholder={placeholderFor('skinfold_thigh_mm')}
                      value={form.skinfold_thigh_mm}
                      onChange={setNumber('skinfold_thigh_mm')}
                    />
                  </div>
                </div>

                {hasAllSkinfolds && age === null ? (
                  <p className="mt-sm text-warning bg-warning/10 px-md py-sm rounded-md text-xs font-medium">
                    {t('pages.bodyMetrics.pollockMissingBirthDate')}
                  </p>
                ) : liveBodyFat === null &&
                  skinfoldValues.some((v) => v > 0) &&
                  !hasAllSkinfolds ? (
                  <p className="mt-sm text-muted-foreground text-xs">
                    {t('pages.bodyMetrics.pollockMethodIncomplete')}
                  </p>
                ) : liveBodyFat === null && (liveWaist > 0 || liveNeck > 0) ? (
                  <p className="mt-sm text-muted-foreground text-xs">
                    {t('pages.bodyMetrics.navyMethodIncomplete')}
                  </p>
                ) : null}
              </FormSection>

              <div className="dialog-footer gap-sm pt-sm flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  <X className="mr-sm h-4 w-4" />
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={isSaving || !form.measured_at}>
                  {isSaving ? (
                    <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-sm h-4 w-4" />
                  )}
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
