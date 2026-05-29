/* eslint-disable max-lines */
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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
  start_date: new Date().toISOString().slice(0, 10),
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
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<VaultRecurringContribution | null>(null);
  const [formData, setFormData] =
    useState<VaultRecurringContributionFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadContributions = async () => {
    if (!vault) return;
    setIsLoading(true);
    try {
      setContributions(await vaultsService.getContributions(vault.id));
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = async (isOpen: boolean) => {
    if (isOpen && vault) {
      setIsFormOpen(false);
      setEditing(null);
      await loadContributions();
    }
    onOpenChange(isOpen);
  };

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
          description: t('pages.vaults.recurringContributions.updatedDesc'),
        });
      } else {
        await vaultsService.createContribution(vault.id, formData);
        toast({
          title: t('pages.vaults.recurringContributions.created'),
          description: t('pages.vaults.recurringContributions.createdDesc'),
        });
      }
      setIsFormOpen(false);
      setEditing(null);
      await loadContributions();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
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
        description: t('pages.vaults.recurringContributions.deletedDesc'),
      });
      await loadContributions();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => void handleOpenChange(v)}>
      <DialogContent className="custom-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.vaults.recurringContributions.title')}</DialogTitle>
          <DialogDescription>
            {vault &&
              t('pages.vaults.recurringContributions.desc', {
                name: vault.description,
              })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          {!isFormOpen && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openForm()}>
                <Plus className="mr-xs h-4 w-4" />
                {t('pages.vaults.recurringContributions.newBtn')}
              </Button>
            </div>
          )}
          {isFormOpen && (
            <div className="space-y-3 rounded-md border p-md">
              <h4 className="text-sm font-medium">
                {editing
                  ? t('common.actions.edit')
                  : t('pages.vaults.recurringContributions.newBtn')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="contrib_description">
                    {t('pages.vaults.recurringContributions.fields.description')}
                  </Label>
                  <Input
                    id="contrib_description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Ex: Poupança mensal"
                  />
                </div>
                <div>
                  <Label htmlFor="contrib_amount">
                    {t('pages.vaults.recurringContributions.fields.amount')}
                  </Label>
                  <Input
                    id="contrib_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="contrib_day">
                    {t('pages.vaults.recurringContributions.fields.dayOfMonth')}
                  </Label>
                  <Input
                    id="contrib_day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day_of_month}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        day_of_month: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="contrib_start">
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
                <div>
                  <Label htmlFor="contrib_end">
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
                    clearable
                  />
                </div>
                <div className="col-span-2 flex items-center gap-sm">
                  <Checkbox
                    id="contrib_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked === true })
                    }
                  />
                  <Label htmlFor="contrib_active" className="cursor-pointer">
                    {t('pages.vaults.recurringContributions.fields.isActive')}
                  </Label>
                </div>
              </div>
              <div className="flex justify-end gap-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditing(null);
                  }}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={
                    isSubmitting || !formData.description || formData.amount <= 0
                  }
                >
                  {isSubmitting ? t('common.actions.saving') : t('common.actions.save')}
                </Button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="py-xl text-center text-sm text-muted-foreground">
              {t('common.messages.loading')}
            </div>
          ) : contributions.length === 0 ? (
            <div className="py-xl text-center text-sm text-muted-foreground">
              {t('pages.vaults.recurringContributions.emptyState')}
            </div>
          ) : (
            <div className="space-y-sm">
              {contributions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-sm">
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
                    <div className="mt-0.5 text-sm font-semibold text-success">
                      {formatCurrency(parseFloat(c.amount))}
                    </div>
                    <div className="mt-xs space-y-0.5 text-xs text-muted-foreground">
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
                  <div className="flex shrink-0 gap-xs">
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
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
