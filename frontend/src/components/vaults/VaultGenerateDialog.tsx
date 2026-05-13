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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translate } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { vaultsService } from '@/services/vaults-service';
import { getErrorMessage } from '@/utils/error-utils';

interface VaultGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MONTH_KEYS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function VaultGenerateDialog({
  open,
  onOpenChange,
  onSuccess,
}: VaultGenerateDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

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
            <Label>{t('pages.vaults.recurringContributions.generateMonth')}</Label>
            <div className="mt-xs flex gap-sm">
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(Number(v))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_KEYS.map((key, idx) => (
                    <SelectItem key={key} value={String(idx + 1)}>
                      {translate('months', key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
