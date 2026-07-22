import { ScanText, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { API_CONFIG } from '@/config/constants';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/api-client';

export interface OCRResult {
  value: string | null;
  date: string | null;
  merchant: string | null;
  error: string | null;
}

interface Props {
  onResult: (result: OCRResult) => void;
}

export function ExpenseOCRUpload({ onResult }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFileChange(selected);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: t('pages.expenseOCR.noImage'), variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const result = await apiClient.post<OCRResult>(
        API_CONFIG.ENDPOINTS.EXPENSE_OCR,
        form
      );
      if (result.error && result.error !== 'null') {
        const msgKey =
          result.error === 'ocr_unavailable'
            ? 'pages.expenseOCR.unavailable'
            : 'pages.expenseOCR.failed';
        toast({ title: t(msgKey), variant: 'destructive' });
      } else {
        toast({
          title: t('pages.expenseOCR.success'),
          description: t('pages.expenseOCR.successDesc'),
        });
        onResult(result);
        setOpen(false);
      }
    } catch {
      toast({ title: t('pages.expenseOCR.failed'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-xs"
        onClick={() => setOpen(true)}
      >
        <ScanText className="h-3.5 w-3.5" />
        {t('pages.expenseOCR.buttonLabel')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.expenseOCR.modalTitle')}</DialogTitle>
            <DialogDescription>{t('pages.expenseOCR.modalDesc')}</DialogDescription>
          </DialogHeader>

          <div
            role="button"
            tabIndex={0}
            className="relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-sm rounded-lg border-2 border-dashed border-border bg-muted/30 p-lg transition-colors hover:bg-muted/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
          >
            {preview ? (
              <>
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-40 rounded object-contain"
                />
                <Badge variant="secondary" className="text-xs">
                  {file?.name}
                </Badge>
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-background p-0.5 shadow"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('pages.expenseOCR.dragHint')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('pages.expenseOCR.accepts')}
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="flex justify-end gap-sm">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!file || uploading}
            >
              {uploading
                ? t('pages.expenseOCR.uploading')
                : t('common.actions.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
