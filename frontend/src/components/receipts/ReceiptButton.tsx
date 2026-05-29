import { FileText, Image, Receipt, Eye, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReceiptGenerator } from '@/hooks/use-receipt-generator';
import { logger } from '@/lib/logger';
import {
  mapExpenseToReceipt,
  mapRevenueToReceipt,
  mapCreditCardBillToReceipt,
  mapCreditCardBillWithBillItemsToReceipt,
  mapCreditCardPurchaseToReceipt,
  mapLoanToReceipt,
  mapPayableToReceipt,
  mapTransferToReceipt,
  mapVaultDepositToReceipt,
  mapVaultWithdrawalToReceipt,
} from '@/lib/receipt-utils';
import { creditCardBillsService } from '@/services/credit-card-bills-service';
import type {
  Expense,
  Revenue,
  CreditCardBill,
  CreditCardPurchase,
  BillItem,
  Loan,
  Payable,
  Transfer,
  Vault,
  VaultTransaction,
} from '@/types';
import type { ReceiptData, ExportFormat } from '@/types/receipt';

import { ReceiptPreviewDialog } from './ReceiptPreviewDialog';
import { ReceiptTemplate } from './ReceiptTemplate';

// Type for different data sources
type ReceiptSourceData =
  | { type: 'expense'; data: Expense }
  | { type: 'revenue'; data: Revenue }
  | { type: 'credit_card_bill'; data: CreditCardBill }
  | { type: 'credit_card_purchase'; data: CreditCardPurchase }
  | { type: 'loan'; data: Loan }
  | { type: 'payable'; data: Payable }
  | { type: 'transfer'; data: Transfer }
  | { type: 'vault_deposit'; data: { vault: Vault; transaction: VaultTransaction } }
  | { type: 'vault_withdrawal'; data: { vault: Vault; transaction: VaultTransaction } };

interface ReceiptButtonProps {
  source: ReceiptSourceData;
  memberName: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
}

/**
 * Receipt Button Component
 *
 * A button with dropdown menu for generating receipts in PDF or PNG format.
 * Also includes option to preview before exporting.
 */
export function ReceiptButton({
  source,
  memberName,
  variant = 'ghost',
  size = 'icon',
}: ReceiptButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { isGenerating, generateReceipt } = useReceiptGenerator();

  // Load all items (expenses + installments) for credit card bills
  const loadBillItems = useCallback(async () => {
    if (source.type === 'credit_card_bill' && billItems.length === 0) {
      setIsLoadingItems(true);
      try {
        const response = await creditCardBillsService.getBillItems(source.data.id);
        setBillItems(response.items);
      } catch (error) {
        logger.error('Erro ao carregar itens da fatura:', error);
      } finally {
        setIsLoadingItems(false);
      }
    }
  }, [source, billItems.length]);

  // Convert source data to ReceiptData
  const getReceiptData = useCallback((): ReceiptData => {
    switch (source.type) {
      case 'expense':
        return mapExpenseToReceipt(source.data, memberName);
      case 'revenue':
        return mapRevenueToReceipt(source.data, memberName);
      case 'credit_card_bill':
        // Use version with bill items if available (includes both expenses and installments)
        if (billItems.length > 0) {
          return mapCreditCardBillWithBillItemsToReceipt(
            source.data,
            billItems,
            memberName
          );
        }
        return mapCreditCardBillToReceipt(source.data, memberName);
      case 'credit_card_purchase':
        return mapCreditCardPurchaseToReceipt(source.data, memberName);
      case 'loan':
        return mapLoanToReceipt(source.data, memberName);
      case 'payable':
        return mapPayableToReceipt(source.data, memberName);
      case 'transfer':
        return mapTransferToReceipt(source.data, memberName);
      case 'vault_deposit':
        return mapVaultDepositToReceipt(
          source.data.vault,
          source.data.transaction,
          memberName
        );
      case 'vault_withdrawal':
        return mapVaultWithdrawalToReceipt(
          source.data.vault,
          source.data.transaction,
          memberName
        );
    }
  }, [source, memberName, billItems]);

  const receiptData = getReceiptData();

  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false);
    // Wait for popover to close and hidden receipt to render
    await new Promise((resolve) => setTimeout(resolve, 100));
    await generateReceipt(receiptRef.current, receiptData, format);
  };

  const handlePreview = () => {
    setIsOpen(false);
    setShowPreview(true);
  };

  return (
    <>
      {/* Hidden receipt template for direct export */}
      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <ReceiptTemplate ref={receiptRef} data={receiptData} forExport />
      </div>

      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open) {
            void loadBillItems();
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={isGenerating}
            title={t('receipt.button.tooltip')}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-sm" align="end">
          {isLoadingItems ? (
            <div className="flex items-center justify-center py-md">
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                {t('receipt.button.loading')}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-xs">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={handlePreview}
              >
                <Eye className="mr-sm h-4 w-4" />
                {t('receipt.button.preview')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handleExport('pdf')}
              >
                <FileText className="mr-sm h-4 w-4" />
                {t('receipt.button.exportPdf')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handleExport('png')}
              >
                <Image className="mr-sm h-4 w-4" />
                {t('receipt.button.exportPng')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Preview Dialog */}
      <ReceiptPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        data={receiptData}
      />
    </>
  );
}
