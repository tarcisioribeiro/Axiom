/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInYears, format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  BarChart3,
  Dumbbell,
  Edit,
  Layers,
  Percent,
  PieChart,
  Plus,
  Ratio,
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

import { EnhancedBarChart } from '@/components/charts/EnhancedBarChart';
import { EnhancedPieChart } from '@/components/charts/EnhancedPieChart';
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

function trendData(
  current: string | null,
  previous: string | null,
  period: string
): { value: number; isPositive: boolean; period: string } | undefined {
  if (!current || !previous) return undefined;
  const curr = parseFloat(current);
  const prev = parseFloat(previous);
  if (prev === 0) return undefined;
  const pctChange = ((curr - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pctChange) < 0.05) return undefined;
  return { value: parseFloat(pctChange.toFixed(1)), isPositive: pctChange > 0, period };
}

function armDisplay(m: BodyMetric | null): string | null {
  if (!m) return null;
  const l = m.arm_left_cm ? parseFloat(m.arm_left_cm) : null;
  const r = m.arm_right_cm ? parseFloat(m.arm_right_cm) : null;
  if (l !== null && r !== null) return ((l + r) / 2).toFixed(1);
  if (l !== null) return l.toFixed(1);
  if (r !== null) return r.toFixed(1);
  return m.arm_cm;
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

function toFormState(m: BodyMetric): MetricFormState {
  return {
    measured_at: parseISO(m.measured_at + 'T00:00:00'),
    weight_kg: m.weight_kg ?? '',
    height_cm: m.height_cm ?? '',
    waist_cm: m.waist_cm ?? '',
    neck_cm: m.neck_cm ?? '',
    hip_cm: m.hip_cm ?? '',
    shoulders_cm: m.shoulders_cm ?? '',
    chest_cm: m.chest_cm ?? '',
    abdomen_cm: m.abdomen_cm ?? '',
    arm_left_cm: m.arm_left_cm ?? '',
    arm_right_cm: m.arm_right_cm ?? '',
    thigh_left_cm: m.thigh_left_cm ?? '',
    thigh_right_cm: m.thigh_right_cm ?? '',
    calf_left_cm: m.calf_left_cm ?? '',
    calf_right_cm: m.calf_right_cm ?? '',
    skinfold_triceps_mm: m.skinfold_triceps_mm ?? '',
    skinfold_subscapular_mm: m.skinfold_subscapular_mm ?? '',
    skinfold_suprailiac_mm: m.skinfold_suprailiac_mm ?? '',
    skinfold_chest_mm: m.skinfold_chest_mm ?? '',
    skinfold_midaxillary_mm: m.skinfold_midaxillary_mm ?? '',
    skinfold_abdominal_mm: m.skinfold_abdominal_mm ?? '',
    skinfold_thigh_mm: m.skinfold_thigh_mm ?? '',
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
  const age = member?.birth_date
    ? differenceInYears(new Date(), parseISO(member.birth_date))
    : null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Cálculo em tempo real no formulário ────────────────────────────────────

  const liveWeight = parseFloat(form.weight_kg) || 0;
  const liveHeight = parseFloat(form.height_cm) || 0;
  const liveWaist = parseFloat(form.waist_cm) || 0;
  const liveNeck = parseFloat(form.neck_cm) || 0;
  const liveHip = parseFloat(form.hip_cm) || 0;

  const liveBmi = calcBmi(liveWeight, liveHeight);

  const skinfoldValues = [
    form.skinfold_triceps_mm,
    form.skinfold_subscapular_mm,
    form.skinfold_suprailiac_mm,
    form.skinfold_chest_mm,
    form.skinfold_midaxillary_mm,
    form.skinfold_abdominal_mm,
    form.skinfold_thigh_mm,
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
      hip_cm: form.hip_cm || null,
      shoulders_cm: form.shoulders_cm || null,
      chest_cm: form.chest_cm || null,
      abdomen_cm: form.abdomen_cm || null,
      arm_left_cm: form.arm_left_cm || null,
      arm_right_cm: form.arm_right_cm || null,
      thigh_left_cm: form.thigh_left_cm || null,
      thigh_right_cm: form.thigh_right_cm || null,
      calf_left_cm: form.calf_left_cm || null,
      calf_right_cm: form.calf_right_cm || null,
      skinfold_triceps_mm: form.skinfold_triceps_mm || null,
      skinfold_subscapular_mm: form.skinfold_subscapular_mm || null,
      skinfold_suprailiac_mm: form.skinfold_suprailiac_mm || null,
      skinfold_chest_mm: form.skinfold_chest_mm || null,
      skinfold_midaxillary_mm: form.skinfold_midaxillary_mm || null,
      skinfold_abdominal_mm: form.skinfold_abdominal_mm || null,
      skinfold_thigh_mm: form.skinfold_thigh_mm || null,
      body_fat_method: liveBodyFatMethod,
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

  const latestWhr =
    latest?.waist_cm && latest?.hip_cm
      ? calcWhr(parseFloat(latest.waist_cm), parseFloat(latest.hip_cm))
      : null;
  const sumPerimetryVal = sumFields(latest, PERIMETRY_FIELDS);
  const sumSkinfoldVal = sumFields(latest, SKINFOLD_FIELDS);

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
              <div className="mb-lg gap-md grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  title={t('pages.bodyMetrics.weight')}
                  value={fmt(latest.weight_kg, 'kg')}
                  icon={<Scale className="h-4 w-4" />}
                  accentColor="purple"
                  trend={trendData(
                    latest.weight_kg,
                    previous?.weight_kg ?? null,
                    t('pages.bodyMetrics.vsPrevious')
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
                  progressBar={
                    latestBmi !== null
                      ? {
                          value: latestBmi,
                          max: 40,
                          color:
                            bmiStatVariant(latestBmi) === 'success'
                              ? 'success'
                              : bmiStatVariant(latestBmi) === 'warning'
                                ? 'warning'
                                : 'danger',
                        }
                      : undefined
                  }
                />
                <StatCard
                  title={t('pages.bodyMetrics.bodyFat')}
                  value={fmt(latest.body_fat_pct, '%')}
                  icon={<Percent className="h-4 w-4" />}
                  accentColor="blue"
                  trend={trendData(
                    latest.body_fat_pct,
                    previous?.body_fat_pct ?? null,
                    t('pages.bodyMetrics.vsPrevious')
                  )}
                />
                <StatCard
                  title={t('pages.bodyMetrics.waist')}
                  value={fmt(latest.waist_cm, 'cm')}
                  icon={<Ruler className="h-4 w-4" />}
                  accentColor="orange"
                  trend={trendData(
                    latest.waist_cm,
                    previous?.waist_cm ?? null,
                    t('pages.bodyMetrics.vsPrevious')
                  )}
                />
                <StatCard
                  title={t('pages.bodyMetrics.arm')}
                  value={fmt(armDisplay(latest), 'cm')}
                  icon={<Dumbbell className="h-4 w-4" />}
                  accentColor="green"
                  trend={trendData(
                    armDisplay(latest),
                    armDisplay(previous),
                    t('pages.bodyMetrics.vsPrevious')
                  )}
                />
                <StatCard
                  title={t('pages.bodyMetrics.hip')}
                  value={fmt(latest.hip_cm, 'cm')}
                  icon={<Ruler className="h-4 w-4" />}
                  accentColor="red"
                  trend={trendData(
                    latest.hip_cm,
                    previous?.hip_cm ?? null,
                    t('pages.bodyMetrics.vsPrevious')
                  )}
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
                              'gap-xs px-sm py-xs inline-flex items-center rounded-full border text-xs font-medium transition-all duration-200',
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
                      <div className="py-xl flex flex-col items-center justify-center text-center">
                        <Activity className="mb-sm text-muted-foreground/40 h-8 w-8" />
                        <p className="text-muted-foreground text-sm">
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
                            latestWhr !== null
                              ? whrStatVariant(latestWhr, sex)
                              : 'default'
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
                    },
                    {
                      name: t('pages.bodyMetrics.fatMass'),
                      value: hasComposition ? parseFloat(latestFatPct.toFixed(1)) : 0,
                    },
                  ];
                  const barData = [
                    {
                      name: t('pages.bodyMetrics.leanMass'),
                      value: parseFloat(leanMassKg.toFixed(1)),
                    },
                    {
                      name: t('pages.bodyMetrics.fatMassKg'),
                      value: parseFloat(fatMassKg.toFixed(1)),
                    },
                  ];

                  const renderLegendRow = (
                    items: { label: string; value: string; color: string }[]
                  ) => (
                    <div className="mb-md gap-xl flex flex-wrap items-center justify-center">
                      {items.map((item) => (
                        <div key={item.label} className="gap-sm flex items-center">
                          <span
                            className="h-8 w-1 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {item.label}
                            </p>
                            <p className="text-foreground text-sm font-bold">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );

                  return (
                    <div className="mt-md gap-md grid grid-cols-1 lg:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-sm">
                          <CardTitle className="gap-xs flex items-center text-base">
                            <PieChart className="text-muted-foreground h-4 w-4" />
                            {t('pages.bodyMetrics.fatPctChartTitle')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {hasComposition ? (
                            <>
                              {renderLegendRow([
                                {
                                  label: t('pages.bodyMetrics.leanMass'),
                                  value: `${pieData[0].value.toFixed(1)}%`,
                                  color: semanticColors.success,
                                },
                                {
                                  label: t('pages.bodyMetrics.fatMass'),
                                  value: `${pieData[1].value.toFixed(1)}%`,
                                  color: semanticColors.warning,
                                },
                              ])}
                              <EnhancedPieChart
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                colors={[
                                  semanticColors.success,
                                  semanticColors.warning,
                                ]}
                                formatter={(v) => `${Number(v).toFixed(1)}%`}
                                showLegend={false}
                                showSliceLabels
                                height={280}
                              />
                            </>
                          ) : (
                            <div className="py-xl flex flex-col items-center justify-center text-center">
                              <PieChart className="mb-sm text-muted-foreground/40 h-8 w-8" />
                              <p className="text-muted-foreground text-sm">
                                {t('pages.bodyMetrics.noDataForComposition')}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-sm">
                          <CardTitle className="gap-xs flex items-center text-base">
                            <BarChart3 className="text-muted-foreground h-4 w-4" />
                            {t('pages.bodyMetrics.massChartTitle')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {hasComposition ? (
                            <>
                              {renderLegendRow([
                                {
                                  label: t('pages.bodyMetrics.leanMass'),
                                  value: `${barData[0].value.toFixed(1)} kg`,
                                  color: semanticColors.success,
                                },
                                {
                                  label: t('pages.bodyMetrics.fatMassKg'),
                                  value: `${barData[1].value.toFixed(1)} kg`,
                                  color: semanticColors.warning,
                                },
                              ])}
                              <EnhancedBarChart
                                data={barData}
                                dataKey="value"
                                nameKey="name"
                                layout="horizontal"
                                colors={[
                                  semanticColors.success,
                                  semanticColors.warning,
                                ]}
                                formatter={(v) => `${Number(v).toFixed(1)} kg`}
                                nameFormatter={() => null}
                                showValueLabels
                                showCategoryAxisLabels={false}
                                height={280}
                              />
                            </>
                          ) : (
                            <div className="py-xl flex flex-col items-center justify-center text-center">
                              <BarChart3 className="mb-sm text-muted-foreground/40 h-8 w-8" />
                              <p className="text-muted-foreground text-sm">
                                {t('pages.bodyMetrics.noDataForComposition')}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}
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
                        <CardContent className="gap-md p-md flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-sm gap-sm flex flex-wrap items-center">
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
                            <div className="gap-x-md gap-y-xs text-muted-foreground flex flex-wrap text-sm">
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
                              {[
                                ['shoulders_cm', 'shoulders'],
                                ['chest_cm', 'chest'],
                                ['abdomen_cm', 'abdomen'],
                                ['arm_left_cm', 'armLeft'],
                                ['arm_right_cm', 'armRight'],
                                ['thigh_left_cm', 'thighLeft'],
                                ['thigh_right_cm', 'thighRight'],
                                ['calf_left_cm', 'calfLeft'],
                                ['calf_right_cm', 'calfRight'],
                              ].map(([field, labelKey]) => {
                                const val = metric[field as keyof BodyMetric] as
                                  string | null;
                                if (!val) return null;
                                return (
                                  <span key={field}>
                                    {t(`pages.bodyMetrics.${labelKey}`)}:{' '}
                                    <strong className="text-foreground">
                                      {fmt(val, 'cm')}
                                    </strong>
                                  </span>
                                );
                              })}
                              {metric.body_fat_pct && (
                                <span>
                                  {t('pages.bodyMetrics.bodyFat')}:{' '}
                                  <strong className="text-foreground">
                                    {fmt(metric.body_fat_pct, '%')}
                                  </strong>
                                  {metric.body_fat_method && (
                                    <Badge variant="outline" className="ml-xs text-xs">
                                      {metric.body_fat_method === 'pollock'
                                        ? t('pages.bodyMetrics.pollockMethod')
                                        : t('pages.bodyMetrics.navyMethod')}
                                    </Badge>
                                  )}
                                </span>
                              )}
                            </div>
                            {metric.notes && (
                              <p className="mt-xs text-muted-foreground text-xs">
                                {metric.notes}
                              </p>
                            )}
                          </div>
                          <div className="gap-xs flex shrink-0">
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
                              className="text-destructive hover:text-destructive h-7 w-7"
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
                <div className="gap-md grid grid-cols-2">
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
                  <div className="mt-sm gap-sm bg-muted/40 px-md py-sm flex items-center rounded-md border text-sm">
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

              {/* ── Perimetria (circunferências) ── */}
              <FormSection title={t('pages.bodyMetrics.sectionPerimetry')} icon={Ruler}>
                <p className="mb-sm text-muted-foreground text-xs">
                  {t('pages.bodyMetrics.perimetryHint')}
                </p>
                <div className="gap-md grid grid-cols-2">
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
                    <Label>{t('pages.bodyMetrics.shoulders')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.shoulders_cm}
                      onChange={setField('shoulders_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.chest')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.chest_cm}
                      onChange={setField('chest_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.abdomen')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.abdomen_cm}
                      onChange={setField('abdomen_cm')}
                    />
                  </div>
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
                    <Label>
                      {t('pages.bodyMetrics.hip')} (cm)
                      {sex === 'F' && (
                        <span className="ml-xs text-muted-foreground text-xs">*</span>
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
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.armLeft')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.arm_left_cm}
                      onChange={setField('arm_left_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.armRight')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.arm_right_cm}
                      onChange={setField('arm_right_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.thighLeft')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.thigh_left_cm}
                      onChange={setField('thigh_left_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.thighRight')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.thigh_right_cm}
                      onChange={setField('thigh_right_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.calfLeft')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.calf_left_cm}
                      onChange={setField('calf_left_cm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.calfRight')} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.calf_right_cm}
                      onChange={setField('calf_right_cm')}
                    />
                  </div>
                </div>
              </FormSection>

              {/* ── Dobras Cutâneas → Gordura Corporal (Método Pollock 7 Dobras) ── */}
              <FormSection
                title={t('pages.bodyMetrics.sectionSkinfolds')}
                icon={Layers}
              >
                <p className="mb-sm text-muted-foreground text-xs">
                  {t('pages.bodyMetrics.pollockMethodHint')}
                </p>
                <div className="gap-md grid grid-cols-2">
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldTriceps')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_triceps_mm}
                      onChange={setField('skinfold_triceps_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldSubscapular')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_subscapular_mm}
                      onChange={setField('skinfold_subscapular_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldSuprailiac')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_suprailiac_mm}
                      onChange={setField('skinfold_suprailiac_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldChest')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_chest_mm}
                      onChange={setField('skinfold_chest_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldMidaxillary')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_midaxillary_mm}
                      onChange={setField('skinfold_midaxillary_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldAbdominal')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_abdominal_mm}
                      onChange={setField('skinfold_abdominal_mm')}
                    />
                  </div>
                  <div className="space-y-xs">
                    <Label>{t('pages.bodyMetrics.skinfoldThigh')} (mm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.skinfold_thigh_mm}
                      onChange={setField('skinfold_thigh_mm')}
                    />
                  </div>
                </div>

                {liveBodyFat !== null ? (
                  <div className="mt-sm gap-sm border-success/30 bg-success/10 px-md py-sm flex items-center rounded-md border text-sm">
                    <span className="text-muted-foreground">
                      {t('pages.bodyMetrics.bodyFat')}:
                    </span>
                    <strong>{liveBodyFat.toFixed(1)}%</strong>
                    <span className="text-muted-foreground text-xs">
                      (
                      {liveBodyFatMethod === 'pollock'
                        ? t('pages.bodyMetrics.pollockMethod')
                        : t('pages.bodyMetrics.navyMethod')}
                      )
                    </span>
                  </div>
                ) : hasAllSkinfolds && age === null ? (
                  <p className="mt-sm text-muted-foreground text-xs">
                    {t('pages.bodyMetrics.pollockMissingBirthDate')}
                  </p>
                ) : skinfoldValues.some((v) => v > 0) && !hasAllSkinfolds ? (
                  <p className="mt-sm text-muted-foreground text-xs">
                    {t('pages.bodyMetrics.pollockMethodIncomplete')}
                  </p>
                ) : liveWaist > 0 || liveNeck > 0 ? (
                  <p className="mt-sm text-muted-foreground text-xs">
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

              <div className="gap-sm pt-sm flex justify-end">
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
