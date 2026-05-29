import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      <CardHeader className="flex flex-row items-center justify-between pb-sm">
        <CardTitle className="flex items-center gap-sm text-base">
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
      <CardContent className="grid gap-md sm:grid-cols-2">
        <div className="space-y-xs">
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
        <div className="space-y-xs">
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
        <div className="space-y-xs">
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
        <div className="space-y-xs">
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
