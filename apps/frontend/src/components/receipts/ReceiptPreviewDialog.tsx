import { FileText, Image, Loader2, Receipt, X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useReceiptGenerator } from '@/hooks/use-receipt-generator';
import type { ReceiptData, ExportFormat } from '@/types/receipt';

import { ReceiptTemplate } from './ReceiptTemplate';

interface ReceiptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

/**
 * Receipt Preview Dialog
 *
 * Shows a preview of the receipt before exporting.
 * Allows user to choose between PDF and PNG export formats.
 */
export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  data,
}: ReceiptPreviewDialogProps) {
  // Ref for the hidden full-size receipt (used for export)
  const { t } = useTranslation();
  const captureRef = useRef<HTMLDivElement>(null);
  const { isGenerating, error, generateReceipt, clearError } = useReceiptGenerator();

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    // Use the hidden full-size element for capture
    await generateReceipt(captureRef.current, data, format);
    if (!error) {
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      clearError();
    }
    onOpenChange(newOpen);
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader sticky>
          <DialogTitle className="gap-sm flex items-center">
            <Receipt className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            {t('receipt.title', { typeLabel: data.typeLabel })}
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview (scaled for display) */}
        <div className="bg-muted p-md flex justify-center overflow-auto rounded-lg">
          <div style={{ zoom: 0.65 }}>
            <ReceiptTemplate data={data} />
          </div>
        </div>

        {/* Full-size receipt for capture - positioned off-screen but fully rendered */}
        <div
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <ReceiptTemplate ref={captureRef} data={data} forExport />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {error}
          </div>
        )}

        {/* Export Buttons */}
        <DialogFooter className="gap-sm flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:mr-auto sm:w-auto"
          >
            <X className="mr-sm h-4 w-4" />
            {t('common.actions.close')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('png')}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
            ) : (
              <Image className="mr-sm h-4 w-4" />
            )}
            {t('receipt.button.exportPng')}
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-sm h-4 w-4" />
            )}
            {t('receipt.button.exportPdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
