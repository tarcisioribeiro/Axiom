/* eslint-disable max-lines */
import {
  CalendarClock,
  CalendarDays,
  FileText,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { vaultsService } from '@/services/vaults-service';
import type {
  Vault,
  VaultRecurringContribution,
  VaultRecurringContributionFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const DEFAULT_FORM: VaultRecurringContributionFormData = {
  amount: 0,
  day_of_month: 10,
  is_active: true,
  start_date: formatLocalDate(new Date()),
  end_date: undefined,
  description: '',
};

interface VaultContributionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | undefined;
}

export function VaultContributionsDialog({
  open,
  onOpenChange,
  vault,
}: VaultContributionsDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [contributions, setContributions] = useState<VaultRecurringContribution[]>([]);
  // Cofre cujos dados já chegaram: o modal só abre depois disso, senão abre
  // vazio e cresce até a lista (efeito de "modal fantasma").
  const [loadedFor, setLoadedFor] = useState<number>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<VaultRecurringContribution | null>(null);
  const [formData, setFormData] =
    useState<VaultRecurringContributionFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadContributions = async () => {
    if (!vault) return;
    try {
      setContributions(await vaultsService.getContributions(vault.id));
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setLoadedFor(vault.id);
    }
  };

  // Radix's Dialog only calls onOpenChange for user-driven close interactions
  // (Esc, overlay click, close button) — not when the parent programmatically
  // sets `open` to true. Load fresh data here instead, keyed to the dialog
  // actually being open, so newly generated contributions always show up.
  useEffect(() => {
    if (!open || !vault) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch triggered by dialog opening, not a derived-state update
    void loadContributions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vault?.id]);

  // Reset transient form state when the dialog opens (or switches vault)
  // during render rather than in an effect — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const openKey = open ? vault?.id : undefined;
  const [prevOpenKey, setPrevOpenKey] = useState(openKey);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (openKey !== undefined) {
      setIsFormOpen(false);
      setEditing(null);
    } else {
      setLoadedFor(undefined);
    }
  }

  const openForm = (contribution?: VaultRecurringContribution) => {
    if (contribution) {
      setEditing(contribution);
      setFormData({
        amount: parseFloat(contribution.amount),
        day_of_month: contribution.day_of_month,
        is_active: contribution.is_active,
        start_date: contribution.start_date,
        end_date: contribution.end_date,
        description: contribution.description,
      });
    } else {
      setEditing(null);
      setFormData(DEFAULT_FORM);
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!vault) return;
    try {
      setIsSubmitting(true);
      if (editing) {
        await vaultsService.updateContribution(editing.id, formData);
        toast({
          title: t('pages.vaults.recurringContributions.updated'),
        });
      } else {
        await vaultsService.createContribution(vault.id, formData);
        toast({
          title: t('pages.vaults.recurringContributions.created'),
        });
      }
      setIsFormOpen(false);
      setEditing(null);
      await loadContributions();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (c: VaultRecurringContribution) => {
    const confirmed = await showConfirm({
      title: t('pages.vaults.recurringContributions.deleteTitle'),
      description: t('pages.vaults.recurringContributions.deleteDesc'),
    });
    if (!confirmed) return;
    try {
      await vaultsService.deleteContribution(c.id);
      toast({
        title: t('pages.vaults.recurringContributions.deleted'),
      });
      await loadContributions();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open && loadedFor === vault?.id} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <CalendarClock className="text-primary h-4 w-4" aria-hidden="true" />
            {t('pages.vaults.recurringContributions.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('pages.vaults.recurringContributions.title')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          {!isFormOpen && (
            <div className="flex justify-end">
              <Button onClick={() => openForm()}>
                <Plus className="h-4 w-4" />
                {t('pages.vaults.recurringContributions.newBtn')}
              </Button>
            </div>
          )}
          {isFormOpen && (
            <div className="p-md space-y-3 rounded-md border">
              <h4 className="text-sm font-medium">
                {editing
                  ? t('common.actions.edit')
                  : t('pages.vaults.recurringContributions.newBtn')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-sm col-span-2">
                  <Label
                    className="gap-xs flex items-center"
                    htmlFor="contrib_description"
                  >
                    <FileText className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.vaults.recurringContributions.fields.description')}
                  </Label>
                  <Input
                    id="contrib_description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder={t(
                      'pages.vaults.recurringContributions.fields.descriptionPlaceholder'
                    )}
                  />
                </div>
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center" htmlFor="contrib_amount">
                    <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.vaults.recurringContributions.fields.amount')}
                  </Label>
                  <CurrencyInput
                    id="contrib_amount"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center" htmlFor="contrib_day">
                    <Hash className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.vaults.recurringContributions.fields.dayOfMonth')}
                  </Label>
                  <NumberStepper
                    id="contrib_day"
                    min={1}
                    max={31}
                    value={formData.day_of_month}
                    onChange={(v) => setFormData({ ...formData, day_of_month: v ?? 1 })}
                  />
                </div>
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center" htmlFor="contrib_start">
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.vaults.recurringContributions.fields.startDate')}
                  </Label>
                  <DatePicker
                    value={formData.start_date}
                    onChange={(date) =>
                      setFormData({
                        ...formData,
                        start_date: date ? formatLocalDate(date) : '',
                      })
                    }
                  />
                </div>
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center" htmlFor="contrib_end">
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.vaults.recurringContributions.fields.endDate')}
                  </Label>
                  <DatePicker
                    value={formData.end_date ?? ''}
                    onChange={(date) =>
                      setFormData({
                        ...formData,
                        end_date: date ? formatLocalDate(date) : undefined,
                      })
                    }
                  />
                </div>
                <div className="gap-sm col-span-2 flex items-center">
                  <Checkbox
                    id="contrib_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked === true })
                    }
                  />
                  <Label
                    htmlFor="contrib_active"
                    className="gap-xs flex cursor-pointer items-center"
                  >
                    <Power className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.vaults.recurringContributions.fields.isActive')}
                  </Label>
                </div>
              </div>
              <div className="gap-sm flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditing(null);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={
                    isSubmitting || !formData.description || formData.amount <= 0
                  }
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isSubmitting ? t('common.actions.saving') : t('common.actions.save')}
                </Button>
              </div>
            </div>
          )}
          {!isFormOpen && contributions.length === 0 ? (
            <EmptyState title={t('pages.vaults.recurringContributions.emptyState')} />
          ) : (
            <div className="space-y-sm">
              {contributions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="gap-sm flex items-center">
                      <span className="truncate text-sm font-medium">
                        {c.description}
                      </span>
                      <Badge
                        variant={c.is_active ? 'default' : 'secondary'}
                        className="shrink-0 text-xs"
                      >
                        {c.is_active
                          ? t('pages.vaults.recurringContributions.active')
                          : t('pages.vaults.recurringContributions.inactive')}
                      </Badge>
                    </div>
                    <div className="text-success mt-0.5 text-sm font-semibold">
                      {formatCurrency(parseFloat(c.amount))}
                    </div>
                    <div className="mt-xs text-muted-foreground space-y-0.5 text-xs">
                      <div>
                        {t('pages.vaults.columns.date')}: {c.day_of_month} &bull;{' '}
                        {c.start_date}
                        {c.end_date && ` → ${c.end_date}`}
                      </div>
                      {c.next_contribution_date && c.is_active && (
                        <div>
                          {t('pages.vaults.recurringContributions.nextDate')}{' '}
                          {new Date(c.next_contribution_date).toLocaleDateString(
                            i18n.language
                          )}
                        </div>
                      )}
                      {c.last_generated_month && (
                        <div>
                          {t('pages.vaults.recurringContributions.lastGenerated')}{' '}
                          {c.last_generated_month}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="gap-xs flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openForm(c)}
                      aria-label={t('common.actions.edit')}
                      title={t('common.actions.edit')}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(c)}
                      aria-label={t('common.actions.delete')}
                      title={t('common.actions.delete')}
                    >
                      <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
