import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';

export interface ScenarioForm {
  id: string;
  name: string;
  initial_amount: string;
  monthly_deposit: string;
  annual_rate: string;
  months: string;
}

interface ScenarioCardProps {
  scenario: ScenarioForm;
  index: number;
  onUpdate: (id: string, field: keyof ScenarioForm, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export function ScenarioCard({
  scenario,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: ScenarioCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-sm flex flex-row items-center justify-between">
        <CardTitle className="gap-sm flex items-center text-base">
          <div className="bg-primary/10 text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
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
            aria-label={t('common.actions.remove')}
            variant="ghost"
            size="icon"
            onClick={() => onRemove(scenario.id)}
            className="text-muted-foreground hover:text-destructive h-7 w-7"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="gap-md grid sm:grid-cols-2">
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.vaultSimulator.initialAmount')}</Label>
          <CurrencyInput
            min="0"
            value={scenario.initial_amount}
            onChange={(e) => onUpdate(scenario.id, 'initial_amount', e.target.value)}
          />
        </div>
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.vaultSimulator.monthlyDeposit')}</Label>
          <CurrencyInput
            min="0"
            value={scenario.monthly_deposit}
            onChange={(e) => onUpdate(scenario.id, 'monthly_deposit', e.target.value)}
          />
        </div>
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.vaultSimulator.annualRate')}</Label>
          <DecimalInput
            max={10000}
            unit="%"
            placeholder="12,00"
            aria-label={t('pages.vaultSimulator.annualRate')}
            value={scenario.annual_rate}
            onChange={(v) =>
              onUpdate(scenario.id, 'annual_rate', v === null ? '' : String(v))
            }
          />
        </div>
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.vaultSimulator.termMonths')}</Label>
          <NumberStepper
            min={1}
            max={600}
            optional
            placeholder="12"
            aria-label={t('pages.vaultSimulator.termMonths')}
            value={scenario.months === '' ? null : Number(scenario.months)}
            onChange={(v) =>
              onUpdate(scenario.id, 'months', v === null ? '' : String(v))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
