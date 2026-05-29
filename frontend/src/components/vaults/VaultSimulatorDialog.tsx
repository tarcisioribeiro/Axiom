import { Calculator, TrendingUp } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import type { SimulatorScenarioResult } from '@/services/vault-simulator-service';
import { vaultSimulatorService } from '@/services/vault-simulator-service';
import type { Vault } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultSimulatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | null;
}

export function VaultSimulatorDialog({
  open,
  onOpenChange,
  vault,
}: VaultSimulatorDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const simFormId = useId();

  const [initialAmount, setInitialAmount] = useState('');
  const [monthlyDeposit, setMonthlyDeposit] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [months, setMonths] = useState('12');
  const [results, setResults] = useState<SimulatorScenarioResult[] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && vault) {
      setInitialAmount(vault.current_balance);
      setMonthlyDeposit('');
      setAnnualRate(String(vault.annual_yield_rate_percentage.toFixed(2)));
      setMonths('12');
      setResults(null);
    }
    onOpenChange(isOpen);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const data = await vaultSimulatorService.simulate([
        {
          name: vault?.description || 'Simulação',
          initial_amount: parseFloat(initialAmount) || 0,
          monthly_deposit: parseFloat(monthlyDeposit) || 0,
          annual_rate: parseFloat(annualRate) || 0,
          months: parseInt(months) || 12,
        },
      ]);
      setResults(data.scenarios);
    } catch (err) {
      toast({
        title: t('pages.vaultSimulator.simulationError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const chartData = useMemo(() => {
    if (!results?.length) return [];
    return results[0].data_points.map((dp) => ({ label: dp.label, value: dp.balance }));
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-sm">
            <TrendingUp className="h-5 w-5" />
            {t('pages.vaultSimulator.title')} — {vault?.description}
          </DialogTitle>
          <DialogDescription>{t('pages.vaults.simulatorDesc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <Label className="text-xs">{t('pages.vaultSimulator.initialAmount')}</Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-xs">
            <Label className="text-xs">
              {t('pages.vaultSimulator.monthlyDeposit')}
            </Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={monthlyDeposit}
              onChange={(e) => setMonthlyDeposit(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-xs">
            <Label className="text-xs">{t('pages.vaultSimulator.annualRate')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
              placeholder="12,00"
            />
          </div>
          <div className="space-y-xs">
            <Label className="text-xs">{t('pages.vaultSimulator.termMonths')}</Label>
            <Input
              type="number"
              min="1"
              max="600"
              step="1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              placeholder="12"
            />
          </div>
        </div>
        <Button onClick={() => void handleSimulate()} disabled={isSimulating}>
          <Calculator className="mr-sm h-4 w-4" />
          {isSimulating
            ? t('pages.vaultSimulator.calculating')
            : t('pages.vaultSimulator.calculate')}
        </Button>
        {results && results.length > 0 && (
          <div className="space-y-3 rounded-lg border p-md">
            {results.map((s, idx) => (
              <div
                key={`${simFormId}-${idx}`}
                className="grid grid-cols-2 gap-sm text-sm"
              >
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.vaultSimulator.columns.totalInvested')}
                  </p>
                  <p className="font-semibold">{formatCurrency(s.total_invested)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.vaultSimulator.columns.yield')}
                  </p>
                  <p className="font-semibold text-success">
                    {formatCurrency(s.total_yield)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.vaultSimulator.columns.finalBalance')}
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(s.final_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.vaultSimulator.columns.term')}
                  </p>
                  <p className="font-semibold">
                    {t('pages.vaultSimulator.monthsValue', { count: s.months })}
                  </p>
                </div>
              </div>
            ))}
            {chartData.length > 0 && (
              <div className="space-y-xs">
                <p className="text-xs text-muted-foreground">
                  {t('pages.vaults.simulatorFinalBalance', {
                    months: results[0].months,
                  })}
                </p>
                <div className="flex h-16 items-end gap-0.5">
                  {chartData
                    .filter(
                      (_, i) => i % Math.max(1, Math.floor(chartData.length / 20)) === 0
                    )
                    .map((d, i) => {
                      const max = Math.max(...chartData.map((x) => x.value));
                      const pct = max > 0 ? (d.value / max) * 100 : 0;
                      return (
                        <div
                          key={i}
                          title={`${d.label}: ${formatCurrency(d.value)}`}
                          className="flex-1 rounded-sm bg-primary/60 transition-colors hover:bg-primary"
                          style={{ height: `${pct}%`, minHeight: '2px' }}
                        />
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
