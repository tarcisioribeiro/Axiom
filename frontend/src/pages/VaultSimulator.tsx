import { TrendingUp, Plus, Trash2, Calculator } from 'lucide-react';
import { useState, useId, useMemo } from 'react';
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
import type { SimulatorScenarioResult } from '@/services/vault-simulator-service';
import { vaultSimulatorService } from '@/services/vault-simulator-service';
import { getErrorMessage } from '@/utils/error-utils';

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
}: {
  scenario: ScenarioForm;
  index: number;
  onUpdate: (id: string, field: keyof ScenarioForm, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge variant="secondary">Cenário {index + 1}</Badge>
          <Input
            value={scenario.name}
            onChange={(e) => onUpdate(scenario.id, 'name', e.target.value)}
            placeholder={`Cenário ${index + 1}`}
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
          <Label className="text-xs">Valor Inicial (R$)</Label>
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
          <Label className="text-xs">Aporte Mensal (R$)</Label>
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
          <Label className="text-xs">Taxa Anual (%)</Label>
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
          <Label className="text-xs">Prazo (meses)</Label>
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
      name: s.name.trim() || `Cenário ${i + 1}`,
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
        title: 'Erro na simulação',
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
      <PageHeader title="Simulador de Cofre" icon={<TrendingUp />} />

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
          />
        ))}

        <div className="flex flex-wrap gap-3">
          {scenarios.length < 3 && (
            <Button variant="outline" size="sm" onClick={addScenario}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Cenário
            </Button>
          )}
          <Button onClick={() => void handleSimulate()} disabled={isLoading}>
            <Calculator className="mr-2 h-4 w-4" />
            {isLoading ? 'Calculando...' : 'Simular'}
          </Button>
        </div>
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do Saldo</CardTitle>
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
              <CardTitle className="text-base">Resumo dos Cenários</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cenário</TableHead>
                    <TableHead className="text-right">Valor Inicial</TableHead>
                    <TableHead className="text-right">Aporte Mensal</TableHead>
                    <TableHead className="text-right">Taxa Anual</TableHead>
                    <TableHead className="text-right">Taxa Mensal</TableHead>
                    <TableHead className="text-right">Prazo</TableHead>
                    <TableHead className="text-right">Total Investido</TableHead>
                    <TableHead className="text-right">Rendimento</TableHead>
                    <TableHead className="text-right">Saldo Final</TableHead>
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
                          {scenario.months} meses
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
