/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { fixedRevenuesService } from '@/services/fixed-revenues-service';
import type { FixedRevenue } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fixedRevenues: FixedRevenue[];
  onSuccess: () => void;
}

function monthBounds(month: string): { min: Date; max: Date; lastDay: number } {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return {
    min: new Date(year, monthNum - 1, 1),
    max: new Date(year, monthNum - 1, lastDay),
    lastDay,
  };
}

function defaultDateFor(month: string, dueDay: number): string {
  const [year, monthNum] = month.split('-').map(Number);
  const { lastDay } = monthBounds(month);
  return formatLocalDate(new Date(year, monthNum - 1, Math.min(dueDay, lastDay)));
}

export function LaunchRevenuesDialog({
  isOpen,
  onClose,
  fixedRevenues,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [revenueValues, setRevenueValues] = useState<Record<number, number>>({});
  const [revenueDates, setRevenueDates] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: fullyGeneratedMonths = [] } = useQuery({
    queryKey: ['fixed-revenues', 'generatedMonths'],
    queryFn: () => fixedRevenuesService.getFullyGeneratedMonths(),
    enabled: isOpen,
    staleTime: 0,
  });

  // Mês corrente + os próximos 3, removendo os já totalmente lançados.
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      // Constrói o mês a partir do dia 1 para evitar o "roll-over" do JS
      // (ex.: 31/ago + 1 mês => 01/out), que duplicava meses e pulava um.
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        value,
        label: date.toLocaleDateString(i18n.language, {
          month: 'long',
          year: 'numeric',
        }),
      };
    }).filter((opt) => !fullyGeneratedMonths.includes(opt.value));
  }, [i18n.language, fullyGeneratedMonths]);

  // Reinicia valores/seleção quando o dialog abre.
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) {
      const defaults: Record<number, number> = {};
      const ids = new Set<number>();
      fixedRevenues.forEach((r) => {
        defaults[r.id] = parseFloat(r.default_value);
        ids.add(r.id);
      });
      setRevenueValues(defaults);
      setRevenueDates({});
      setSelectedIds(ids);
    }
  }

  // Mantém o mês selecionado válido conforme as opções mudam (convergência
  // durante o render, sem efeito).
  const validMonth =
    monthOptions.find((opt) => opt.value === selectedMonth)?.value ??
    monthOptions[0]?.value ??
    '';
  if (validMonth !== selectedMonth) setSelectedMonth(validMonth);

  const dateFor = (r: FixedRevenue): string =>
    revenueDates[r.id] ?? (validMonth ? defaultDateFor(validMonth, r.due_day) : '');

  const handleSubmit = async () => {
    if (!validMonth || selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const response = await fixedRevenuesService.bulkGenerate({
        month: validMonth,
        revenue_values: Array.from(selectedIds).map((id) => {
          const rev = fixedRevenues.find((r) => r.id === id);
          return {
            fixed_revenue_id: id,
            value: revenueValues[id] ?? 0,
            date: rev ? dateFor(rev) || undefined : undefined,
          };
        }),
      });
      const monthLabel =
        monthOptions.find((m) => m.value === validMonth)?.label || validMonth;
      toast({
        title: t('pages.fixedRevenues.launchDialog.success'),
        description: t('pages.fixedRevenues.launchDialog.successDesc', {
          count: response.created_count,
          month: monthLabel,
        }),
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        title: t('pages.fixedRevenues.launchDialog.error'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bounds = validMonth ? monthBounds(validMonth) : null;
  const noMonthsAvailable = monthOptions.length === 0;
  const selectedCount = fixedRevenues.filter((r) => selectedIds.has(r.id)).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('pages.fixedRevenues.launchDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.fixedRevenues.launchDialog.desc')}
          </DialogDescription>
        </DialogHeader>

        {noMonthsAvailable ? (
          <div className="py-xl text-muted-foreground text-center text-sm">
            {t('pages.fixedRevenues.launchDialog.allGenerated')}
          </div>
        ) : (
          <div className="space-y-md">
            <div className="space-y-sm">
              <Label>{t('pages.fixedRevenues.launchDialog.selectMonth')}</Label>
              <Select value={validMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'pages.fixedRevenues.launchDialog.selectMonthPlaceholder'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-sm">
              <Label>
                {t('pages.fixedRevenues.launchDialog.revenuesLabel', {
                  selected: selectedCount,
                  total: fixedRevenues.length,
                })}
              </Label>
              <ScrollArea className="p-md h-[360px] rounded-md border">
                <div className="space-y-3">
                  {fixedRevenues.map((r) => (
                    <div
                      key={r.id}
                      className={`gap-md flex items-center rounded-lg border p-3 transition-colors ${
                        selectedIds.has(r.id)
                          ? 'bg-background'
                          : 'bg-muted/50 opacity-60'
                      }`}
                    >
                      <Checkbox
                        id={`rev-${r.id}`}
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.description}</p>
                        <p className="text-muted-foreground text-sm">
                          {t('pages.fixedRevenues.launchDialog.dueDate', {
                            day: r.due_day,
                          })}
                        </p>
                      </div>
                      <div className="w-36">
                        <DatePicker
                          value={dateFor(r)}
                          minDate={bounds?.min}
                          maxDate={bounds?.max}
                          clearable={false}
                          disabled={isSubmitting || !selectedIds.has(r.id)}
                          onChange={(date) =>
                            setRevenueDates((prev) => ({
                              ...prev,
                              [r.id]: date ? formatLocalDate(date) : '',
                            }))
                          }
                        />
                      </div>
                      <div className="w-28">
                        {r.allow_value_edit ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={revenueValues[r.id] ?? ''}
                            onChange={(e) =>
                              setRevenueValues((p) => ({
                                ...p,
                                [r.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            disabled={isSubmitting || !selectedIds.has(r.id)}
                          />
                        ) : (
                          <span className="text-success block text-right text-sm font-medium">
                            {formatCurrency(parseFloat(r.default_value))}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.actions.cancel')}
          </Button>
          {!noMonthsAvailable && (
            <Button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !validMonth || selectedCount === 0}
            >
              {isSubmitting
                ? t('pages.fixedRevenues.launchDialog.generating')
                : t('pages.fixedRevenues.launchDialog.generateBtn', {
                    count: selectedCount,
                  })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
