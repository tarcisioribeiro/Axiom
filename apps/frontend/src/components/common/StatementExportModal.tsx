import { FileText, Loader2, Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useStatementPdf } from '@/hooks/use-statement-pdf';
import { useToast } from '@/hooks/use-toast';

interface StatementExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toISODate(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().split('T')[0];
}

export function StatementExportModal({
  open,
  onOpenChange,
}: StatementExportModalProps) {
  const { t } = useTranslation();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dateFrom, setDateFrom] = useState<Date | undefined>(firstDayOfMonth);
  const [dateTo, setDateTo] = useState<Date | undefined>(today);

  const { isGenerating, generateStatement } = useStatementPdf();
  const { toast } = useToast();

  const handleExport = async () => {
    const from = toISODate(dateFrom);
    const to = toISODate(dateTo);

    if (!from || !to) {
      toast({
        title: t('pages.dashboard.statementModal.invalidPeriodTitle'),
        description: t('pages.dashboard.statementModal.invalidPeriodDesc'),
        variant: 'destructive',
      });
      return;
    }

    if (from > to) {
      toast({
        title: t('pages.dashboard.statementModal.invalidPeriodTitle'),
        description: t('pages.dashboard.statementModal.invalidRangeDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await generateStatement({ dateFrom: from, dateTo: to });
      onOpenChange(false);
      toast({
        title: t('pages.dashboard.statementModal.successTitle'),
        description: t('pages.dashboard.statementModal.successDesc'),
      });
    } catch {
      toast({
        title: t('pages.dashboard.statementModal.errorTitle'),
        description: t('pages.dashboard.statementModal.errorDesc'),
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDateFrom(firstDayOfMonth);
      setDateTo(today);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="gap-sm flex items-center">
            <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>{t('pages.dashboard.statementModal.title')}</DialogTitle>
              <DialogDescription className="text-xs">
                {t('pages.dashboard.statementModal.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-xs">
              <Label className="text-sm">
                {t('pages.dashboard.statementModal.dateFrom')}
              </Label>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder={t('pages.dashboard.statementModal.dateFromPlaceholder')}
                clearable
              />
            </div>
            <div className="space-y-xs">
              <Label className="text-sm">
                {t('pages.dashboard.statementModal.dateTo')}
              </Label>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder={t('pages.dashboard.statementModal.dateToPlaceholder')}
                clearable
              />
            </div>
          </div>

          <div className="space-y-xs border-border/60 bg-muted/20 py-sm text-muted-foreground rounded-lg border px-3 text-xs">
            <p className="text-foreground/70 font-medium">
              {t('pages.dashboard.statementModal.includesTitle')}
            </p>
            <ul className="list-none space-y-0.5">
              <li>· {t('pages.dashboard.statementModal.includesItem1')}</li>
              <li>· {t('pages.dashboard.statementModal.includesItem2')}</li>
              <li>· {t('pages.dashboard.statementModal.includesItem3')}</li>
            </ul>
          </div>
        </div>

        <div className="gap-sm pt-sm flex justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            {t('pages.dashboard.statementModal.cancelBtn')}
          </Button>
          <Button onClick={handleExport} disabled={isGenerating} className="gap-sm">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('pages.dashboard.statementModal.generatingBtn')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {t('pages.dashboard.statementModal.exportBtn')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
