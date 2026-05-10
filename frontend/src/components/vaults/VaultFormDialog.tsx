import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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
        <div className="space-y-md">
          <div>
            <Label htmlFor="description">{t('common.fields.description')} *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Ex: Reserva de Emergência"
            />
          </div>
          <div>
            <Label htmlFor="account">{t('common.fields.account')} *</Label>
            <Select
              value={formData.account.toString()}
              onValueChange={(v) => setFormData({ ...formData, account: parseInt(v) })}
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
          <div>
            <Label htmlFor="annual_yield_rate">
              {t('pages.vaults.yieldRateLabel')}
            </Label>
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
            />
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.vaults.yieldRateHint')}
            </p>
          </div>
          <div>
            <Label htmlFor="notes">{t('common.fields.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Anotações sobre o cofre..."
            />
          </div>
          <div className="flex items-center gap-sm">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked === true })
              }
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              {t('pages.vaults.activeVault')}
            </Label>
          </div>
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
