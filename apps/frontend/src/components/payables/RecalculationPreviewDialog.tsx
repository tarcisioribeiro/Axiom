import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { RecalculationPreview } from '@/types';

interface RecalculationPreviewDialogProps {
  open: boolean;
  title: string;
  description: string;
  preview: RecalculationPreview | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RecalculationPreviewDialog({
  open,
  title,
  description,
  preview,
  isLoading,
  onConfirm,
  onCancel,
}: RecalculationPreviewDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="custom-scrollbar max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="py-xl text-muted-foreground text-center text-sm">
            {t('common.actions.loading')}
          </div>
        ) : (
          <div className="space-y-md">
            <div className="gap-sm bg-muted/40 p-sm grid grid-cols-2 rounded-md text-sm">
              <div>
                <p className="text-muted-foreground text-xs">
                  {t('pages.payables.form.newValueLabel')}
                </p>
                <p className="font-semibold">
                  {formatCurrency(preview.remaining_value)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">
                  {t('pages.payables.form.installmentsCountLabel')}
                </p>
                <p className="font-semibold">
                  {preview.old_installment_count} → {preview.new_installment_count}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="pb-sm pr-md">
                      {t('pages.payables.installments.number')}
                    </th>
                    <th className="pb-sm pr-md">
                      {t('pages.payables.installments.dueDate')}
                    </th>
                    <th className="pb-sm text-right">
                      {t('pages.payables.installments.value')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.installments_preview.map((item) => (
                    <tr key={item.number} className="border-b last:border-0">
                      <td className="py-sm pr-md">{item.number}</td>
                      <td className="py-sm pr-md">
                        {formatDate(item.due_date, 'dd/MM/yyyy')}
                      </td>
                      <td className="py-sm text-right">
                        {item.old_value && item.old_value !== item.new_value && (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground mr-sm line-through"
                          >
                            {formatCurrency(item.old_value)}
                          </Badge>
                        )}
                        <span className="font-semibold">
                          {formatCurrency(item.new_value)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isLoading || !preview}>
            {isLoading ? (
              <>
                <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                {t('common.actions.saving')}
              </>
            ) : (
              t('common.actions.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
