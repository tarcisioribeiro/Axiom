/* eslint-disable max-lines */
import { FileText, Landmark, Percent, Power, TrendingUp, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { vaultsService } from '@/services/vaults-service';
import type { Account, Vault, VaultFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVault: Vault | undefined;
  accounts: Account[];
  onSuccess: () => void;
}

const makeDefaultForm = (accounts: Account[]): VaultFormData => ({
  description: '',
  account: accounts[0]?.id || 0,
  annual_yield_rate: 0,
  is_active: true,
  notes: '',
});

export function VaultFormDialog({
  open,
  onOpenChange,
  selectedVault,
  accounts,
  onSuccess,
}: VaultFormDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState<VaultFormData>(makeDefaultForm(accounts));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedVault) {
      setFormData({
        description: selectedVault.description,
        account: selectedVault.account,
        annual_yield_rate: selectedVault.annual_yield_rate_percentage,
        is_active: selectedVault.is_active,
        notes: selectedVault.notes || '',
      });
    } else {
      setFormData(makeDefaultForm(accounts));
    }
  }, [selectedVault, accounts, open]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const data = { ...formData, annual_yield_rate: formData.annual_yield_rate / 100 };
      if (selectedVault) {
        await vaultsService.update(selectedVault.id, data);
        toast({
          title: t('pages.vaults.updated'),
          description: t('pages.vaults.updatedDesc'),
        });
      } else {
        await vaultsService.create(data);
        toast({
          title: t('pages.vaults.created'),
          description: t('pages.vaults.createdDesc'),
        });
      }
      onOpenChange(false);
      onSuccess();
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

  const selectedAccount = accounts.find((a) => a.id === formData.account);
  const accountBalance = selectedAccount ? parseFloat(selectedAccount.balance) : 0;
  const estimatedAnnualYield = accountBalance * (formData.annual_yield_rate / 100);
  const estimatedMonthlyYield = estimatedAnnualYield / 12;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selectedVault ? t('pages.vaults.editTitle') : t('pages.vaults.newTitle')}
          </DialogTitle>
          <DialogDescription>
            {selectedVault ? t('pages.vaults.editDesc') : t('pages.vaults.newDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-lg">
          {/* Seção: Identificação */}
          <FormSection title={t('common.form.sections.basicInfo')} icon={Landmark}>
            <div className="space-y-md">
              <div className="space-y-sm">
                <Label htmlFor="description" className="flex items-center gap-xs">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('common.fields.description')} *
                </Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder={t('pages.vaults.form.descriptionPlaceholder')}
                />
              </div>

              <div className="space-y-sm">
                <Label htmlFor="account" className="flex items-center gap-xs">
                  <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('common.fields.account')} *
                </Label>
                <Select
                  value={formData.account.toString()}
                  onValueChange={(v) =>
                    setFormData({ ...formData, account: parseInt(v) })
                  }
                  disabled={!!selectedVault}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.fields.selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          {/* Seção: Configuração */}
          <FormSection title={t('common.form.sections.configuration')} icon={Percent}>
            <div className="space-y-md">
              <div className="space-y-sm">
                <Label htmlFor="annual_yield_rate" className="flex items-center gap-xs">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.vaults.yieldRateLabel')}
                </Label>
                <div className="relative">
                  <Input
                    id="annual_yield_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.annual_yield_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        annual_yield_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Ex: 12.00"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('pages.vaults.yieldRateHint')}
                </p>
              </div>

              {/* Calculadora de rendimento estimado */}
              {formData.annual_yield_rate > 0 && accountBalance > 0 && (
                <div className="rounded-lg border border-success/30 bg-success/5 p-sm">
                  <div className="mb-xs flex items-center gap-xs text-xs font-semibold text-success">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {t('pages.vaults.estimatedYield')}
                  </div>
                  <div className="grid grid-cols-2 gap-sm text-xs">
                    <div>
                      <p className="text-muted-foreground">
                        {t('pages.vaults.monthlyYield')}
                      </p>
                      <p className="font-semibold text-success">
                        {formatCurrency(estimatedMonthlyYield)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t('pages.vaults.annualYield')}
                      </p>
                      <p className="font-semibold text-success">
                        {formatCurrency(estimatedAnnualYield)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Toggle is_active */}
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, is_active: !formData.is_active })
                }
                className={`flex w-full items-start gap-sm rounded-lg border p-sm text-left transition-all ${
                  formData.is_active
                    ? 'border-success/50 bg-success/5 ring-1 ring-success/20'
                    : 'border-border/60 bg-muted/20 opacity-70'
                }`}
              >
                <div
                  className={`mt-0.5 rounded-full p-1 ${
                    formData.is_active
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('pages.vaults.activeVault')}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formData.is_active
                      ? t('pages.vaults.activeVaultDesc')
                      : t('pages.vaults.inactiveVaultDesc')}
                  </p>
                </div>
              </button>

              <div className="space-y-sm">
                <Label htmlFor="notes" className="flex items-center gap-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('common.fields.notes')}
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('pages.vaults.form.notesPlaceholder')}
                  rows={3}
                />
              </div>
            </div>
          </FormSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !formData.description}
          >
            {isSubmitting
              ? t('common.actions.saving')
              : selectedVault
                ? t('common.actions.save')
                : t('common.actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
