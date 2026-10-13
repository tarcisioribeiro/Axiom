import {
  Calculator,
  Percent,
  PiggyBank,
  Timer,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
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
        title: t('pages.vaultSimulator.simulationError', {
          reason: getErrorMessage(err),
        }),
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            {t('pages.vaultSimulator.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('pages.vaults.simulatorDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="gap-md grid sm:grid-cols-2">
          <div className="space-y-xs">
            <Label className="gap-xs flex items-center text-xs">
              <Wallet className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaultSimulator.initialAmount')}
            </Label>
            <CurrencyInput
              min="0"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label className="gap-xs flex items-center text-xs">
              <PiggyBank className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaultSimulator.monthlyDeposit')}
            </Label>
            <CurrencyInput
              min="0"
              value={monthlyDeposit}
              onChange={(e) => setMonthlyDeposit(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label className="gap-xs flex items-center justify-center text-xs">
              <Percent className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaultSimulator.annualRate')}
            </Label>
            <DecimalInput
              unit="%"
              placeholder="12,00"
              aria-label={t('pages.vaultSimulator.annualRate')}
              value={annualRate}
              onChange={(v) => setAnnualRate(v === null ? '' : String(v))}
              className="mx-auto"
            />
          </div>
          <div className="space-y-xs">
            <Label className="gap-xs flex items-center text-xs">
              <Timer className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.vaultSimulator.termMonths')}
            </Label>
            <NumberStepper
              min={1}
              max={600}
              optional
              placeholder="12"
              aria-label={t('pages.vaultSimulator.termMonths')}
              value={months === '' ? null : Number(months)}
              onChange={(v) => setMonths(v === null ? '' : String(v))}
            />
          </div>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => void handleSimulate()} disabled={isSimulating}>
            <Calculator className="h-4 w-4" aria-hidden="true" />
            {isSimulating
              ? t('pages.vaultSimulator.calculating')
              : t('pages.vaultSimulator.calculate')}
          </Button>
        </div>
        {results && results.length > 0 && (
          <div className="p-md space-y-3 rounded-lg border">
            {results.map((s, idx) => (
              <div
                key={`${simFormId}-${idx}`}
                className="gap-sm grid grid-cols-2 text-sm"
              >
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t('pages.vaultSimulator.columns.totalInvested')}
                  </p>
                  <p className="font-semibold">{formatCurrency(s.total_invested)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t('pages.vaultSimulator.columns.yield')}
                  </p>
                  <p className="text-success font-semibold">
                    {formatCurrency(s.total_yield)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t('pages.vaultSimulator.columns.finalBalance')}
                  </p>
                  <p className="text-primary text-lg font-bold">
                    {formatCurrency(s.final_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
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
                <p className="text-muted-foreground text-xs">
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
                          className="bg-primary/60 hover:bg-primary flex-1 rounded-sm transition-colors"
                          style={{ height: `${pct}%`, minHeight: '2px' }}
                        />
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
