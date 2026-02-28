import { FileText, Image, Loader2 } from 'lucide-react';
import { useRef } from 'react';

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
      <DialogContent
        size="lg"
        className="custom-scrollbar max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Comprovante de {data.typeLabel}</DialogTitle>
        </DialogHeader>

        {/* Receipt Preview (scaled for display) */}
        <div className="custom-scrollbar flex justify-center overflow-auto rounded-lg bg-muted p-4">
          <div className="origin-top scale-[0.65] transform">
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
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Export Buttons */}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleExport('png')}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Image className="mr-2 h-4 w-4" />
            )}
            Exportar PNG
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
