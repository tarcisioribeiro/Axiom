import { Download, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ExportParams {
  export_format: 'csv' | 'pdf';
  date_from?: string;
  date_to?: string;
}

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onExport: (params: ExportParams) => Promise<void>;
  initialDateFrom?: Date;
  initialDateTo?: Date;
}

function toISODate(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().split('T')[0];
}

export function ExportModal({
  open,
  onOpenChange,
  title,
  description,
  onExport,
  initialDateFrom,
  initialDateTo,
}: ExportModalProps) {
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initialDateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(initialDateTo);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  // Sync with parent filters when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDateFrom(initialDateFrom);
      setDateTo(initialDateTo);
      setExportFormat('csv');
    }
    onOpenChange(isOpen);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await onExport({
        export_format: exportFormat,
        date_from: toISODate(dateFrom),
        date_to: toISODate(dateTo),
      });
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-md">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-xs">
              <Label className="text-sm">{t('common.export.dateFrom')}</Label>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder={t('common.export.from')}
                clearable
              />
            </div>
            <div className="space-y-xs">
              <Label className="text-sm">{t('common.export.dateTo')}</Label>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder={t('common.export.to')}
                clearable
              />
            </div>
          </div>

          <div className="space-y-xs">
            <Label className="text-sm">{t('common.export.format')}</Label>
            <Select
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as 'csv' | 'pdf')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('common.export.activeFiltersNote')}
          </p>
        </div>

        <div className="flex justify-end gap-sm pt-sm">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-sm">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('common.actions.export')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
