// Receipt/Voucher Types for Financial Documents

export type ReceiptType =
  | 'expense'
  | 'revenue'
  | 'credit_card_bill'
  | 'credit_card_purchase'
  | 'loan'
  | 'payable'
  | 'transfer'
  | 'vault_deposit'
  | 'vault_withdrawal';

export type ExportFormat = 'pdf' | 'png';

/**
 * Item de extrato para faturas de cartão de crédito
 */
export interface ReceiptStatementItem {
  description: string;
  category: string;
  categoryLabel: string;
  value: number;
  date: string;
  installmentNumber?: number;
  totalInstallments?: number;
  merchant?: string;
  payed: boolean;
}

export interface ReceiptData {
  // Type of receipt
  type: ReceiptType;
  typeLabel: string;
  /** Custom document title. When set, replaces the default "Comprovante de {typeLabel}". */
  documentTitle?: string;

  // Main information
  description: string;
  value: number;
  date: string;
  time?: string;

  // Optional fields depending on type
  category?: string;
  status?: string;
  statusLabel?: string;
  accountName?: string;
  cardName?: string;

  // For transfers
  originAccountName?: string;
  destinyAccountName?: string;

  // For loans
  benefitedName?: string;
  creditorName?: string;

  // For credit card purchases
  installments?: number;
  totalInstallments?: number;
  installmentValue?: number;

  // For vaults
  vaultName?: string;
  balanceAfter?: number;

  // Member who generated the receipt
  memberName: string;

  // Additional notes
  notes?: string;

  // For credit card bill statement (extrato detalhado)
  statementItems?: ReceiptStatementItem[];
  totalItems?: number;
  totalPaidItems?: number;
  totalPendingItems?: number;

  // Generation metadata
  generatedAt: Date;
}

// Receipt type labels — used for filename generation (keep in PT-BR)
export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  expense: 'Despesa',
  revenue: 'Receita',
  credit_card_bill: 'Fatura de Cartão',
  credit_card_purchase: 'Compra no Cartão',
  loan: 'Empréstimo',
  payable: 'Conta a Pagar',
  transfer: 'Transferência',
  vault_deposit: 'Depósito em Cofre',
  vault_withdrawal: 'Saque de Cofre',
};

// Status labels — used as fallback when i18n key is missing
export const STATUS_LABELS: Record<string, string> = {
  payed: 'Pago',
  pending: 'Pendente',
  received: 'Recebido',
  not_received: 'Não Recebido',
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  overdue: 'Vencida',
  active: 'Ativo',
  completed: 'Quitado',
  cancelled: 'Cancelado',
  transfered: 'Realizada',
  not_transfered: 'Pendente',
  processing: 'Processando',
  scheduled: 'Agendado',
  true: 'Sim',
  false: 'Não',
};
