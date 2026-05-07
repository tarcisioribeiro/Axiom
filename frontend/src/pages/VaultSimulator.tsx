import { TrendingUp, Plus, Trash2, Calculator } from 'lucide-react';
import { useState, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useChartColors, useChartGradientId } from '@/lib/chart-colors';
import { axisFormatCurrency, formatCurrencyBR } from '@/lib/chart-formatters';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { SimulatorScenarioResult } from '@/services/vault-simulator-service';
import { vaultSimulatorService } from '@/services/vault-simulator-service';
import { getErrorMessage } from '@/utils/error-utils';

function getProjectedDate(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

interface ScenarioForm {
  id: string;
  name: string;
  initial_amount: string;
  monthly_deposit: string;
  annual_rate: string;
  months: string;
}

const DEFAULT_SCENARIO = (): ScenarioForm => ({
  id: crypto.randomUUID(),
  name: '',
  initial_amount: '',
  monthly_deposit: '',
  annual_rate: '',
  months: '12',
});

function ScenarioCard({
  scenario,
  index,
  onUpdate,
  onRemove,
  canRemove,
  t,
}: {
  scenario: ScenarioForm;
  index: number;
  onUpdate: (id: string, field: keyof ScenarioForm, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {index + 1}
          </div>
          <Badge variant="secondary">
            {t('pages.vaultSimulator.scenarioLabel', { index: index + 1 })}
          </Badge>
          <Input
            value={scenario.name}
            onChange={(e) => onUpdate(scenario.id, 'name', e.target.value)}
            placeholder={t('pages.vaultSimulator.scenarioLabel', { index: index + 1 })}
            className="h-7 w-40 text-sm"
          />
        </CardTitle>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(scenario.id)}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('pages.vaultSimulator.initialAmount')}</Label>
          <Input
            type="number"
            min="0"
            step="100"
            value={scenario.initial_amount}
            onChange={(e) => onUpdate(scenario.id, 'initial_amount', e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('pages.vaultSimulator.monthlyDeposit')}</Label>
          <Input
            type="number"
            min="0"
            step="100"
            value={scenario.monthly_deposit}
            onChange={(e) => onUpdate(scenario.id, 'monthly_deposit', e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('pages.vaultSimulator.annualRate')}</Label>
          <Input
            type="number"
            min="0"
            max="10000"
            step="0.01"
            value={scenario.annual_rate}
            onChange={(e) => onUpdate(scenario.id, 'annual_rate', e.target.value)}
            placeholder="12,00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('pages.vaultSimulator.termMonths')}</Label>
          <Input
            type="number"
            min="1"
            max="600"
            step="1"
            value={scenario.months}
            onChange={(e) => onUpdate(scenario.id, 'months', e.target.value)}
            placeholder="12"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function SimulatorTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatCurrencyBR(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function VaultSimulator() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const chartColors = useChartColors();
  const gradientId = useChartGradientId('vault-sim');
  const formId = useId();

  const [scenarios, setScenarios] = useState<ScenarioForm[]>([DEFAULT_SCENARIO()]);
  const [results, setResults] = useState<SimulatorScenarioResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateScenario = (id: string, field: keyof ScenarioForm, value: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const addScenario = () => {
    if (scenarios.length >= 3) return;
    setScenarios((prev) => [...prev, DEFAULT_SCENARIO()]);
  };

  const removeScenario = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSimulate = async () => {
    const payload = scenarios.map((s, i) => ({
      name: s.name.trim() || t('pages.vaultSimulator.scenarioLabel', { index: i + 1 }),
      initial_amount: parseFloat(s.initial_amount) || 0,
      monthly_deposit: parseFloat(s.monthly_deposit) || 0,
      annual_rate: parseFloat(s.annual_rate) || 0,
      months: parseInt(s.months) || 12,
    }));

    setIsLoading(true);
    try {
      const data = await vaultSimulatorService.simulate(payload);
      setResults(data.scenarios);
    } catch (err) {
      toast({
        title: t('pages.vaultSimulator.simulationError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Build flat chart data from results
  const chartData = useMemo(() => {
    if (!results?.length) return [];
    const points = results[0].data_points;
    return points.map((dp) => {
      const row: Record<string, string | number> = { label: dp.label };
      results.forEach((scenario) => {
        const match = scenario.data_points.find((p) => p.month === dp.month);
        row[scenario.name] = match?.balance ?? 0;
      });
      return row;
    });
  }, [results]);

  // Compute X-axis tick interval to avoid crowding
  const xAxisInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 13) return 0;
    if (len <= 25) return 1;
    if (len <= 61) return 5;
    return 11;
  }, [chartData.length]);

  return (
    <PageContainer>
      <PageHeader title={t('pages.vaultSimulator.title')} icon={<TrendingUp />} />

      {/* Scenario Forms */}
      <div className="space-y-4">
        {scenarios.map((scenario, i) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            index={i}
            onUpdate={updateScenario}
            onRemove={removeScenario}
            canRemove={scenarios.length > 1}
            t={t}
          />
        ))}

        <div className="flex flex-wrap gap-3">
          {scenarios.length < 3 && (
            <Button variant="outline" size="sm" onClick={addScenario}>
              <Plus className="mr-2 h-4 w-4" />
              {t('pages.vaultSimulator.addScenario')}
            </Button>
          )}
          <Button onClick={() => void handleSimulate()} disabled={isLoading}>
            <Calculator className="mr-2 h-4 w-4" />
            {isLoading
              ? t('pages.vaultSimulator.calculating')
              : t('pages.vaultSimulator.calculate')}
          </Button>
        </div>
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Separador temático */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Projeção calculada
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Cards de resultado por cenário */}
          {(() => {
            const bestScenarioName = results.reduce(
              (best, s) =>
                s.final_balance >
                (results.find((r) => r.name === best)?.final_balance ?? 0)
                  ? s.name
                  : best,
              results[0]?.name ?? ''
            );
            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((scenario) => (
                  <Card
                    key={scenario.name}
                    className={cn(
                      'overflow-hidden',
                      scenario.name === bestScenarioName && 'border-amber-500/40'
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {scenario.name}
                        </CardTitle>
                        {scenario.name === bestScenarioName && (
                          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600">
                            🏆 Melhor retorno
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-lg bg-primary/5 p-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          {t('pages.vaultSimulator.accumulation')}
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {formatCurrency(scenario.final_balance)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          em {getProjectedDate(scenario.months)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">
                            {t('pages.vaultSimulator.totalInvested')}
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(scenario.total_invested)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            {t('pages.vaultSimulator.yieldLabel')}
                          </p>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(scenario.total_yield)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}

          {/* Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('pages.vaultSimulator.evolutionChart')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                >
                  <defs>
                    {results.map((_scenario, idx) => (
                      <linearGradient
                        key={gradientId(idx)}
                        id={gradientId(idx)}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={chartColors[idx]}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={chartColors[idx]}
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
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    dy={8}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={axisFormatCurrency}
                    width={70}
                  />
                  <Tooltip content={<SimulatorTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 16 }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-sm text-foreground/80">{value}</span>
                    )}
                  />
                  {results.map((scenario, idx) => (
                    <Area
                      key={scenario.name}
                      type="monotone"
                      dataKey={scenario.name}
                      stroke={chartColors[idx]}
                      strokeWidth={2.5}
                      fill={`url(#${gradientId(idx)})`}
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        fill: chartColors[idx],
                        stroke: 'hsl(var(--background))',
                      }}
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('pages.vaultSimulator.scenarioSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pages.vaultSimulator.columns.scenario')}</TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.initialAmount')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.monthlyDeposit')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.annualRate')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.monthlyRate')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.term')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.totalInvested')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.yield')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('pages.vaultSimulator.columns.finalBalance')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((scenario, idx) => {
                    const yieldPct =
                      scenario.total_invested > 0
                        ? (scenario.total_yield / scenario.total_invested) * 100
                        : 0;
                    return (
                      <TableRow key={`${formId}-${idx}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: chartColors[idx] }}
                            />
                            <span className="font-medium">{scenario.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(scenario.initial_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(scenario.monthly_deposit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {scenario.annual_rate.toFixed(2).replace('.', ',')}%
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {scenario.monthly_rate.toFixed(4).replace('.', ',')}%
                        </TableCell>
                        <TableCell className="text-right">
                          {t('pages.vaultSimulator.monthsValue', {
                            count: scenario.months,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(scenario.total_invested)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">
                          <div>{formatCurrency(scenario.total_yield)}</div>
                          <div className="text-xs text-muted-foreground">
                            +{yieldPct.toFixed(1).replace('.', ',')}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(scenario.final_balance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
