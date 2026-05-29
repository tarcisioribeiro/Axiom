/* eslint-disable max-lines */
/**
 * Receipt Utility Functions
 *
 * Functions to map financial data to receipt format and generate filenames.
 */

import i18next from 'i18next';

import { autoTranslate, translate } from '@/config/constants';
import type {
  Expense,
  Revenue,
  CreditCardBill,
  CreditCardPurchase,
  CreditCardInstallment,
  BillItem,
  Loan,
  Payable,
  Transfer,
  Vault,
  VaultTransaction,
} from '@/types';
import type { ReceiptData, ReceiptType, ReceiptStatementItem } from '@/types/receipt';
import { RECEIPT_TYPE_LABELS, STATUS_LABELS } from '@/types/receipt';

/**
 * Maps an Expense to ReceiptData
 */
export function mapExpenseToReceipt(expense: Expense, memberName: string): ReceiptData {
  return {
    type: 'expense',
    typeLabel: RECEIPT_TYPE_LABELS.expense,
    description: expense.description,
    value: parseFloat(expense.value),
    date: expense.date,
    time: expense.horary,
    category: expense.category,
    status: expense.payed ? 'payed' : 'pending',
    statusLabel: expense.payed ? STATUS_LABELS.payed : STATUS_LABELS.pending,
    accountName: expense.account_name,
    memberName,
    notes: expense.notes,
    generatedAt: new Date(),
  };
}

/**
 * Maps a Revenue to ReceiptData
 */
export function mapRevenueToReceipt(revenue: Revenue, memberName: string): ReceiptData {
  return {
    type: 'revenue',
    typeLabel: RECEIPT_TYPE_LABELS.revenue,
    description: revenue.description,
    value: parseFloat(revenue.value),
    date: revenue.date,
    time: revenue.horary,
    category: revenue.category,
    status: revenue.received ? 'received' : 'not_received',
    statusLabel: revenue.received ? STATUS_LABELS.received : STATUS_LABELS.not_received,
    accountName: revenue.account_name,
    memberName,
    notes: revenue.notes,
    generatedAt: new Date(),
  };
}

/**
 * Maps a CreditCardBill to ReceiptData
 */
export function mapCreditCardBillToReceipt(
  bill: CreditCardBill,
  memberName: string
): ReceiptData {
  return {
    type: 'credit_card_bill',
    typeLabel: RECEIPT_TYPE_LABELS.credit_card_bill,
    // Use \u00A0 (non-breaking space) for consistent rendering in html2canvas
    description: `${i18next.t('receipt.descriptions.billPrefix')}\u00A0${translate('months', bill.month)}/${bill.year}\u00A0-\u00A0${bill.credit_card_name || i18next.t('receipt.descriptions.cardFallback')}`,
    value: parseFloat(bill.total_amount),
    date: bill.due_date || bill.invoice_ending_date,
    category: 'fatura_cartao',
    status: bill.status,
    statusLabel: STATUS_LABELS[bill.status] || bill.status,
    cardName: bill.credit_card_name,
    accountName: bill.credit_card_associated_account_name,
    memberName,
    generatedAt: new Date(),
  };
}

/**
 * Maps a CreditCardBill with its installments to ReceiptData with statement
 * @deprecated Use mapCreditCardBillWithBillItemsToReceipt for unified bill items
 */
export function mapCreditCardBillWithItemsToReceipt(
  bill: CreditCardBill,
  installments: CreditCardInstallment[],
  memberName: string
): ReceiptData {
  const statementItems: ReceiptStatementItem[] = installments.map((inst) => ({
    description: inst.description || i18next.t('receipt.descriptions.purchaseFallback'),
    category: inst.category || 'others',
    categoryLabel: autoTranslate(inst.category || 'others'),
    value: typeof inst.value === 'string' ? parseFloat(inst.value) : inst.value,
    date: inst.due_date,
    installmentNumber: inst.installment_number,
    totalInstallments: inst.total_installments,
    merchant: inst.merchant,
    payed: inst.payed,
  }));

  const paidItems = statementItems.filter((i) => i.payed).length;

  return {
    type: 'credit_card_bill',
    typeLabel: RECEIPT_TYPE_LABELS.credit_card_bill,
    // Use \u00A0 (non-breaking space) for consistent rendering in html2canvas
    description: `${i18next.t('receipt.descriptions.billPrefix')}\u00A0${translate('months', bill.month)}/${bill.year}\u00A0-\u00A0${bill.credit_card_name || i18next.t('receipt.descriptions.cardFallback')}`,
    value: parseFloat(bill.total_amount),
    date: bill.due_date || bill.invoice_ending_date,
    category: 'fatura_cartao',
    status: bill.status,
    statusLabel: STATUS_LABELS[bill.status] || bill.status,
    cardName: bill.credit_card_name,
    accountName: bill.credit_card_associated_account_name,
    memberName,
    generatedAt: new Date(),
    // Extrato detalhado
    statementItems,
    totalItems: statementItems.length,
    totalPaidItems: paidItems,
    totalPendingItems: statementItems.length - paidItems,
  };
}

/**
 * Maps a CreditCardBill with its unified items (expenses + installments) to ReceiptData with statement
 * This is the preferred method as it includes both legacy expenses and new installments
 */
export function mapCreditCardBillWithBillItemsToReceipt(
  bill: CreditCardBill,
  items: BillItem[],
  memberName: string
): ReceiptData {
  const statementItems: ReceiptStatementItem[] = items.map((item) => ({
    description: item.description || i18next.t('receipt.descriptions.expenseFallback'),
    category: item.category || 'others',
    categoryLabel: autoTranslate(item.category || 'others'),
    value: item.value,
    date: item.date || '',
    installmentNumber: item.installment_number,
    totalInstallments: item.total_installments,
    merchant: item.merchant || undefined,
    payed: item.payed,
  }));

  const paidItems = statementItems.filter((i) => i.payed).length;

  return {
    type: 'credit_card_bill',
    typeLabel: RECEIPT_TYPE_LABELS.credit_card_bill,
    // Use \u00A0 (non-breaking space) for consistent rendering in html2canvas
    description: `${i18next.t('receipt.descriptions.billPrefix')}\u00A0${translate('months', bill.month)}/${bill.year}\u00A0-\u00A0${bill.credit_card_name || i18next.t('receipt.descriptions.cardFallback')}`,
    value: parseFloat(bill.total_amount),
    date: bill.due_date || bill.invoice_ending_date,
    category: 'fatura_cartao',
    status: bill.status,
    statusLabel: STATUS_LABELS[bill.status] || bill.status,
    cardName: bill.credit_card_name,
    accountName: bill.credit_card_associated_account_name,
    memberName,
    generatedAt: new Date(),
    // Extrato detalhado
    statementItems,
    totalItems: statementItems.length,
    totalPaidItems: paidItems,
    totalPendingItems: statementItems.length - paidItems,
  };
}

/**
 * Maps a CreditCardPurchase to ReceiptData
 */
export function mapCreditCardPurchaseToReceipt(
  purchase: CreditCardPurchase,
  memberName: string
): ReceiptData {
  const paidInstallments = purchase.installments?.filter((i) => i.payed).length || 0;
  const isPaid = paidInstallments === purchase.total_installments;

  return {
    type: 'credit_card_purchase',
    typeLabel: RECEIPT_TYPE_LABELS.credit_card_purchase,
    documentTitle: i18next.t('receipt.documentTitles.credit_card_purchase'),
    description: purchase.description,
    value: purchase.total_value,
    date: purchase.purchase_date,
    time: purchase.purchase_time,
    category: purchase.category,
    status: isPaid ? 'paid' : 'pending',
    statusLabel: isPaid ? STATUS_LABELS.paid : STATUS_LABELS.pending,
    cardName: purchase.card_name,
    installments: paidInstallments,
    totalInstallments: purchase.total_installments,
    installmentValue: purchase.installment_value,
    memberName,
    notes: purchase.notes,
    generatedAt: new Date(),
  };
}

/**
 * Maps a Loan to ReceiptData
 */
export function mapLoanToReceipt(loan: Loan, memberName: string): ReceiptData {
  return {
    type: 'loan',
    typeLabel: RECEIPT_TYPE_LABELS.loan,
    documentTitle: i18next.t('receipt.documentTitles.loan'),
    description: loan.description,
    value: parseFloat(loan.value),
    date: loan.date,
    time: loan.horary,
    category: loan.category,
    status: loan.status,
    statusLabel: STATUS_LABELS[loan.status] || loan.status,
    accountName: loan.account_name,
    benefitedName: loan.benefited_name,
    creditorName: loan.creditor_name,
    memberName,
    notes: loan.notes,
    generatedAt: new Date(),
  };
}

/**
 * Maps a Payable to ReceiptData
 */
export function mapPayableToReceipt(payable: Payable, memberName: string): ReceiptData {
  return {
    type: 'payable',
    typeLabel: RECEIPT_TYPE_LABELS.payable,
    documentTitle: i18next.t('receipt.documentTitles.payable'),
    description: payable.description,
    value: parseFloat(payable.value),
    date: payable.date,
    category: payable.category,
    status: payable.status,
    statusLabel:
      payable.status_display || STATUS_LABELS[payable.status] || payable.status,
    memberName,
    notes: payable.notes,
    generatedAt: new Date(),
  };
}

/**
 * Maps a Transfer to ReceiptData
 */
export function mapTransferToReceipt(
  transfer: Transfer,
  memberName: string
): ReceiptData {
  return {
    type: 'transfer',
    typeLabel: RECEIPT_TYPE_LABELS.transfer,
    description: transfer.description,
    value: parseFloat(transfer.value),
    date: transfer.date,
    time: transfer.horary,
    category: transfer.category,
    status: transfer.transfered ? 'transfered' : 'not_transfered',
    statusLabel: transfer.transfered
      ? STATUS_LABELS.transfered
      : STATUS_LABELS.not_transfered,
    originAccountName: transfer.origin_account_name,
    destinyAccountName: transfer.destiny_account_name,
    memberName,
    generatedAt: new Date(),
  };
}

/**
 * Maps a VaultTransaction (deposit) to ReceiptData
 */
export function mapVaultDepositToReceipt(
  vault: Vault,
  transaction: VaultTransaction,
  memberName: string
): ReceiptData {
  return {
    type: 'vault_deposit',
    typeLabel: RECEIPT_TYPE_LABELS.vault_deposit,
    // Use \u00A0 (non-breaking space) for consistent rendering in html2canvas
    description:
      transaction.description ||
      `${i18next.t('receipt.descriptions.depositPrefix')}\u00A0${vault.description}`,
    value: parseFloat(transaction.amount),
    date: transaction.transaction_date,
    category: 'deposito',
    status: 'completed',
    statusLabel: i18next.t('receipt.descriptions.completedStatus'),
    vaultName: vault.description,
    accountName: vault.account_name,
    balanceAfter: parseFloat(transaction.balance_after),
    memberName,
    generatedAt: new Date(),
  };
}

/**
 * Maps a VaultTransaction (withdrawal) to ReceiptData
 */
export function mapVaultWithdrawalToReceipt(
  vault: Vault,
  transaction: VaultTransaction,
  memberName: string
): ReceiptData {
  return {
    type: 'vault_withdrawal',
    typeLabel: RECEIPT_TYPE_LABELS.vault_withdrawal,
    // Use \u00A0 (non-breaking space) for consistent rendering in html2canvas
    description:
      transaction.description ||
      `${i18next.t('receipt.descriptions.withdrawalPrefix')}\u00A0${vault.description}`,
    value: parseFloat(transaction.amount),
    date: transaction.transaction_date,
    category: 'saque',
    status: 'completed',
    statusLabel: i18next.t('receipt.descriptions.completedStatus'),
    vaultName: vault.description,
    accountName: vault.account_name,
    balanceAfter: parseFloat(transaction.balance_after),
    memberName,
    generatedAt: new Date(),
  };
}

/**
 * Generates a filename for the receipt export
 *
 * @param type - Receipt type
 * @param description - Description of the item
 * @param date - Date of the item
 * @param format - Export format (pdf or png)
 * @returns Sanitized filename
 *
 * @example
 * generateReceiptFilename('expense', 'Supermercado', '2025-01-15', 'pdf')
 * // "comprovante_despesa_supermercado_15-01-2025.pdf"
 */
const DECLARATION_TYPES: Partial<Record<ReceiptType, string>> = {
  loan: 'declaracao_emprestimo',
  payable: 'declaracao_conta_a_pagar',
  credit_card_purchase: 'declaracao_compra',
};

export function generateReceiptFilename(
  type: ReceiptType,
  description: string,
  date: string,
  format: 'pdf' | 'png'
): string {
  // Sanitize description: remove special chars, lowercase, replace spaces with underscore
  const sanitizedDescription = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Replace spaces with underscore
    .substring(0, 30); // Limit length

  // Format date as DD-MM-YYYY
  const [year, month, day] = date.split('-');
  const formattedDate = `${day}-${month}-${year}`;

  const declarationSlug = DECLARATION_TYPES[type];
  if (declarationSlug) {
    return `${declarationSlug}_${sanitizedDescription}_${formattedDate}.${format}`;
  }

  // Get type label in Portuguese
  const typeSlug = RECEIPT_TYPE_LABELS[type]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return `comprovante_${typeSlug}_${sanitizedDescription}_${formattedDate}.${format}`;
}

/**
 * Formats currency value in Brazilian Real format
 *
 * @param value - Numeric value
 * @returns Formatted string (e.g., "R$ 1.234,56")
 */
export function formatReceiptCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats date in Brazilian format
 *
 * @param date - Date string (YYYY-MM-DD)
 * @returns Formatted string (e.g., "15/01/2025")
 */
export function formatReceiptDate(date: string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formats time for display
 *
 * @param time - Time string (HH:MM:SS or HH:MM)
 * @returns Formatted string (e.g., "14:30")
 */
export function formatReceiptTime(time?: string): string {
  if (!time) return '';
  // Handle both HH:MM:SS and HH:MM formats
  const parts = time.split(':');
  return `${parts[0]}:${parts[1]}`;
}

/**
 * Formats datetime for the "Generated at" field
 *
 * @param date - Date object
 * @returns Formatted string (e.g., "15/01/2025 às 14:30")
 * Uses non-breaking spaces for better html2canvas rendering
 */
export function formatGeneratedAt(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  // Use \u00A0 (non-breaking space) for consistent rendering in html2canvas
  return `${day}/${month}/${year}\u00A0às\u00A0${hours}:${minutes}`;
}

/**
 * Gets the display name for a member/user
 *
 * @param memberName - Name from the record (e.g., expense.member_name)
 * @param user - Current user object
 * @returns Best available display name
 */
export function getMemberDisplayName(
  memberName?: string | null,
  user?: { first_name?: string; last_name?: string; username?: string } | null
): string {
  // First priority: member_name from the record
  if (memberName?.trim()) {
    return memberName;
  }

  // Second priority: full name from user (first + last)
  if (user) {
    const firstName = user.first_name?.trim() || '';
    const lastName = user.last_name?.trim() || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      return fullName;
    }

    // Third priority: just username
    if (user.username) {
      return user.username;
    }
  }

  return i18next.t('receipt.user');
}
