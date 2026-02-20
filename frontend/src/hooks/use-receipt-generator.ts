import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useState, useCallback, useRef } from 'react';

import { generateReceiptFilename } from '@/lib/receipt-utils';
import type { ReceiptData, ExportFormat } from '@/types/receipt';

interface UseReceiptGeneratorReturn {
  isGenerating: boolean;
  error: string | null;
  generateReceipt: (
    elementRef: HTMLElement | null,
    data: ReceiptData,
    format: ExportFormat
  ) => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for generating receipt documents from HTML elements
 *
 * Uses html2canvas to capture the HTML element as an image,
 * then either saves it as PNG or converts it to PDF using jsPDF.
 *
 * @example
 * const { isGenerating, generateReceipt } = useReceiptGenerator();
 *
 * // When user clicks download
 * await generateReceipt(receiptRef.current, receiptData, 'pdf');
 */
export function useReceiptGenerator(): UseReceiptGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generatingRef = useRef(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generateReceipt = useCallback(
    async (
      elementRef: HTMLElement | null,
      data: ReceiptData,
      format: ExportFormat
    ): Promise<void> => {
      // Prevent double generation
      if (generatingRef.current || !elementRef) {
        return;
      }

      generatingRef.current = true;
      setIsGenerating(true);
      setError(null);

      try {
        // Generate canvas from HTML element
        const canvas = await html2canvas(elementRef, {
          scale: 2, // Higher quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        // Generate filename
        const filename = generateReceiptFilename(
          data.type,
          data.description,
          data.date,
          format
        );

        if (format === 'png') {
          // Export as PNG
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataUrl;
          link.click();
        } else {
          // Export as PDF
          const imgData = canvas.toDataURL('image/png');

          // Calculate dimensions to fit A4 or smaller
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;

          // A4 dimensions in mm: 210 x 297
          // We'll use a smaller format for receipts
          const pdfWidth = 150; // mm (receipt width)
          const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

          const pdf = new jsPDF({
            orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
            unit: 'mm',
            format: [pdfWidth, pdfHeight],
          });

          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(filename);
        }
      } catch (err) {
        console.error('Error generating receipt:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao gerar comprovante. Tente novamente.'
        );
      } finally {
        generatingRef.current = false;
        setIsGenerating(false);
      }
    },
    []
  );

  return {
    isGenerating,
    error,
    generateReceipt,
    clearError,
  };
}
