import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { vaultsService } from '@/services/vaults-service';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function VaultGenerateDialog({
  open,
  onOpenChange,
  onSuccess,
}: VaultGenerateDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [generateMonth, setGenerateMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const result = await vaultsService.generateContributions(generateMonth);
      toast({
        title: t('pages.vaults.recurringContributions.generateSuccess'),
        description: t('pages.vaults.recurringContributions.generateSuccessDesc', {
          count: result.generated_count,
        }),
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('pages.vaults.recurringContributions.generateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('pages.vaults.recurringContributions.generateTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.vaults.recurringContributions.generateDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div>
            <Label htmlFor="generate_month">
              {t('pages.vaults.recurringContributions.generateMonth')}
            </Label>
            <Input
              id="generate_month"
              type="month"
              lang={i18n.language}
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
            {isGenerating
              ? t('common.actions.saving')
              : t('pages.vaults.recurringContributions.generateConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
