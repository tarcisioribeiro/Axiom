import { Calculator, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { ScenarioCard, type ScenarioForm } from '@/components/vaults/ScenarioCard';
import { SimulatorResults } from '@/components/vaults/SimulatorResults';
import { useToast } from '@/hooks/use-toast';
import type { SimulatorScenarioResult } from '@/services/vault-simulator-service';
import { vaultSimulatorService } from '@/services/vault-simulator-service';
import { getErrorMessage } from '@/utils/error-utils';

const DEFAULT_SCENARIO = (): ScenarioForm => ({
  id: crypto.randomUUID(),
  name: '',
  initial_amount: '',
  monthly_deposit: '',
  annual_rate: '',
  months: '12',
});

export default function VaultSimulator() {
  const { t } = useTranslation();
  const { toast } = useToast();

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

  return (
    <PageContainer>
      <PageHeader title={t('pages.vaultSimulator.title')} icon={<TrendingUp />} />

      <div className="space-y-md">
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
              <Plus className="mr-sm h-4 w-4" />
              {t('pages.vaultSimulator.addScenario')}
            </Button>
          )}
          <Button onClick={() => void handleSimulate()} disabled={isLoading}>
            <Calculator className="mr-sm h-4 w-4" />
            {isLoading
              ? t('pages.vaultSimulator.calculating')
              : t('pages.vaultSimulator.calculate')}
          </Button>
        </div>
      </div>

      {results && results.length > 0 && <SimulatorResults results={results} />}
    </PageContainer>
  );
}
