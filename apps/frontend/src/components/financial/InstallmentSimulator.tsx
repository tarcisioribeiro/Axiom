import { Calculator } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface SimulationResult {
  installments: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
}

function simulateInstallments(
  principal: number,
  annualRate: number,
  installments: number
): SimulationResult {
  if (annualRate === 0) {
    const monthly = principal / installments;
    return {
      installments,
      monthlyPayment: monthly,
      totalPaid: monthly * installments,
      totalInterest: 0,
    };
  }
  const monthlyRate = annualRate / 100 / 12;
  // Price (SAC-like equal installments with compound interest)
  const monthly =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, installments)) /
    (Math.pow(1 + monthlyRate, installments) - 1);
  const total = monthly * installments;
  return {
    installments,
    monthlyPayment: monthly,
    totalPaid: total,
    totalInterest: total - principal,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallmentSimulator({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  const [principal, setPrincipal] = useState('');
  const [annualRate, setAnnualRate] = useState('');

  const principalNum = parseFloat(principal.replace(',', '.')) || 0;
  const rateNum = parseFloat(annualRate.replace(',', '.')) || 0;

  const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60];

  const results = useMemo<SimulationResult[]>(() => {
    if (!principalNum || principalNum <= 0) return [];
    return INSTALLMENT_OPTIONS.map((n) =>
      simulateInstallments(principalNum, rateNum, n)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principalNum, rateNum]);

  const noInterestResult = results.find((r) => r.installments === 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-sm">
            <Calculator className="h-5 w-5" />
            {t('components.installmentSimulator.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-xs">
              <Label htmlFor="sim-principal">
                {t('components.installmentSimulator.purchaseValue')}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  id="sim-principal"
                  placeholder="0,00"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="pl-8"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="space-y-xs">
              <Label htmlFor="sim-rate">
                {t('components.installmentSimulator.annualRate')}
              </Label>
              <div className="relative">
                <Input
                  id="sim-rate"
                  placeholder="0,00"
                  value={annualRate}
                  onChange={(e) => setAnnualRate(e.target.value)}
                  className="pr-8"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('components.installmentSimulator.rateHint')}
              </p>
            </div>
          </div>

          {results.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-md py-sm font-medium">
                      {t('components.installmentSimulator.installments')}
                    </th>
                    <th className="px-md py-sm font-medium">
                      {t('components.installmentSimulator.monthly')}
                    </th>
                    <th className="px-md py-sm font-medium">
                      {t('components.installmentSimulator.total')}
                    </th>
                    <th className="px-md py-sm font-medium">
                      {t('components.installmentSimulator.interest')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const extraCost = r.totalInterest;
                    const pct =
                      noInterestResult && r.installments > 1
                        ? (extraCost / principalNum) * 100
                        : 0;
                    return (
                      <tr
                        key={r.installments}
                        className="border-t border-border transition-colors hover:bg-muted/30"
                      >
                        <td className="px-md py-sm font-medium">
                          {r.installments === 1
                            ? t('components.installmentSimulator.cash')
                            : `${r.installments}x`}
                        </td>
                        <td className="px-md py-sm">
                          {r.installments === 1
                            ? '—'
                            : formatCurrency(r.monthlyPayment)}
                        </td>
                        <td className="px-md py-sm font-semibold">
                          {formatCurrency(r.totalPaid)}
                        </td>
                        <td className="px-md py-sm">
                          {extraCost > 0 ? (
                            <span
                              className={cn(
                                'text-xs',
                                pct > 20
                                  ? 'text-destructive'
                                  : pct > 10
                                    ? 'text-warning'
                                    : 'text-muted-foreground'
                              )}
                            >
                              +{formatCurrency(extraCost)}{' '}
                              <span className="opacity-70">({pct.toFixed(1)}%)</span>
                            </span>
                          ) : (
                            <span className="text-xs text-success">
                              {t('components.installmentSimulator.noInterest')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!principalNum && (
            <p className="text-center text-sm text-muted-foreground">
              {t('components.installmentSimulator.enterValue')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
