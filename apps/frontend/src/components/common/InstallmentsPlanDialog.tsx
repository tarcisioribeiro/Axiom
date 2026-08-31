/* eslint-disable max-lines */
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { getErrorMessage } from '@/utils/error-utils';

export interface InstallmentRow {
  id: number;
  installment_number: number;
  value: string;
  due_date: string;
  payed: boolean;
}

export interface RecalcPreviewRow {
  number: number;
  new_value: string;
  due_date: string;
}

interface Props {
  open: boolean;
  title: string;
  description?: string;
  installments: InstallmentRow[];
  isLoading: boolean;
  /** Namespace i18n: `pages.payables.installments` | `pages.loans.installments` */
  i18nBase: string;
  onClose: () => void;
  saveInstallment: (
    installmentNumber: number,
    data: { value?: number; due_date?: string }
  ) => Promise<void>;
  recalculate: (
    count: number,
    dryRun: boolean
  ) => Promise<{ installments_preview: RecalcPreviewRow[] }>;
  onChanged: () => void;
}

type Draft = { value: string; due_date: string };

export function InstallmentsPlanDialog({
  open,
  title,
  description,
  installments,
  isLoading,
  i18nBase,
  onClose,
  saveInstallment,
  recalculate,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [recalcCount, setRecalcCount] = useState('');
  const [recalcPreview, setRecalcPreview] = useState<RecalcPreviewRow[] | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const openInstallments = useMemo(
    () => installments.filter((i) => !i.payed),
    [installments]
  );

  // Reinicia o estado de edição quando o dialog abre/fecha.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    setIsEditing(false);
    setDrafts({});
    setRecalcCount(String(openInstallments.length || ''));
    setRecalcPreview(null);
  }

  const tr = (key: string) => t(`${i18nBase}.${key}`);

  const draftFor = (inst: InstallmentRow): Draft =>
    drafts[inst.installment_number] ?? {
      value: inst.value,
      due_date: inst.due_date,
    };

  const setDraft = (num: number, patch: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [num]: { ...(prev[num] ?? { value: '', due_date: '' }), ...patch },
    }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changed = openInstallments.filter((inst) => {
        const d = drafts[inst.installment_number];
        return (
          d &&
          (parseFloat(d.value) !== parseFloat(inst.value) ||
            d.due_date !== inst.due_date)
        );
      });
      for (const inst of changed) {
        const d = drafts[inst.installment_number];
        await saveInstallment(inst.installment_number, {
          value: parseFloat(d.value),
          due_date: d.due_date,
        });
      }
      toast({ title: tr('planUpdated') });
      setIsEditing(false);
      setDrafts({});
      onChanged();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalcPreview = async () => {
    const count = parseInt(recalcCount, 10);
    if (!count || count < 1) return;
    setIsRecalculating(true);
    try {
      const res = await recalculate(count, true);
      setRecalcPreview(res.installments_preview);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalcApply = async () => {
    const count = parseInt(recalcCount, 10);
    if (!count || count < 1) return;
    setIsRecalculating(true);
    try {
      await recalculate(count, false);
      toast({ title: tr('planUpdated') });
      setRecalcPreview(null);
      setIsEditing(false);
      onChanged();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const canEdit = openInstallments.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="custom-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {isLoading ? (
          <div className="py-xl text-muted-foreground text-center text-sm">
            {t('common.actions.loading')}
          </div>
        ) : installments.length === 0 ? (
          <div className="py-xl text-muted-foreground text-center text-sm">
            {tr('emptyState')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="pb-sm pr-md">{tr('number')}</th>
                    <th className="pb-sm pr-md">{tr('dueDate')}</th>
                    <th className="pb-sm pr-md text-right">{tr('value')}</th>
                    <th className="pb-sm">{tr('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => {
                    const editable = isEditing && !inst.payed;
                    const d = draftFor(inst);
                    return (
                      <tr key={inst.id} className="border-b last:border-0">
                        <td className="py-sm pr-md align-middle">
                          {inst.installment_number}
                        </td>
                        <td className="py-sm pr-md align-middle">
                          {editable ? (
                            <div className="w-36">
                              <DatePicker
                                value={d.due_date}
                                clearable={false}
                                onChange={(date) =>
                                  setDraft(inst.installment_number, {
                                    due_date: date ? formatLocalDate(date) : '',
                                  })
                                }
                              />
                            </div>
                          ) : (
                            formatDate(inst.due_date, 'dd/MM/yyyy')
                          )}
                        </td>
                        <td className="py-sm pr-md text-right align-middle">
                          {editable ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-28"
                              value={d.value}
                              onChange={(e) =>
                                setDraft(inst.installment_number, {
                                  value: e.target.value,
                                })
                              }
                            />
                          ) : (
                            formatCurrency(inst.value)
                          )}
                        </td>
                        <td className="py-sm align-middle">
                          <Badge variant={inst.payed ? 'secondary' : 'outline'}>
                            {inst.payed ? tr('paid') : tr('pending')}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isEditing && (
              <div className="space-y-sm pt-md border-t">
                <p className="text-muted-foreground text-xs">{tr('editHint')}</p>
                <div className="space-y-xs">
                  <Label>{tr('recalcCountLabel')}</Label>
                  <div className="gap-sm flex items-center">
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={recalcCount}
                      onChange={(e) => {
                        setRecalcCount(e.target.value);
                        setRecalcPreview(null);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRecalcPreview()}
                      disabled={isRecalculating}
                    >
                      {tr('recalcApply')}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">{tr('recalcHint')}</p>
                </div>

                {recalcPreview && (
                  <div className="bg-muted/50 space-y-xs rounded-md p-3">
                    {recalcPreview.map((row) => (
                      <div key={row.number} className="flex justify-between text-xs">
                        <span>
                          {tr('number')} {row.number} —{' '}
                          {formatDate(row.due_date, 'dd/MM/yyyy')}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(row.new_value)}
                        </span>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      className="mt-sm w-full"
                      onClick={() => void handleRecalcApply()}
                      disabled={isRecalculating}
                    >
                      {t('common.actions.confirm')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setDrafts({});
                      setRecalcPreview(null);
                    }}
                    disabled={isSaving}
                  >
                    {t('common.actions.cancel')}
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={isSaving}>
                    {isSaving ? t('common.actions.saving') : t('common.actions.save')}
                  </Button>
                </>
              ) : (
                canEdit && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-sm h-4 w-4" />
                    {tr('editPlan')}
                  </Button>
                )
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
