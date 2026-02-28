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

// Receipt type labels in Portuguese
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

// Status labels in Portuguese
export const STATUS_LABELS: Record<string, string> = {
  // Expense/Revenue
  payed: 'Pago',
  pending: 'Pendente',
  received: 'Recebido',
  not_received: 'Não Recebido',

  // Credit Card Bill
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  overdue: 'Vencida',

  // Loan / Payable
  active: 'Ativo',
  completed: 'Quitado',
  cancelled: 'Cancelado',

  // Transfer
  transfered: 'Realizada',
  not_transfered: 'Pendente',

  // Generic/Additional
  processing: 'Processando',
  scheduled: 'Agendado',
  true: 'Sim',
  false: 'Não',
};

// Category labels in Portuguese
export const CATEGORY_LABELS: Record<string, string> = {
  // Common expense categories
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  moradia: 'Moradia',
  saude: 'Saúde',
  educacao: 'Educação',
  lazer: 'Lazer',
  vestuario: 'Vestuário',
  servicos: 'Serviços',
  impostos: 'Impostos',
  outros: 'Outros',

  // Revenue categories
  salario: 'Salário',
  freelance: 'Freelance',
  investimentos: 'Investimentos',
  aluguel: 'Aluguel',
  vendas: 'Vendas',
  bonus: 'Bônus',
  outros_receita: 'Outros',

  // Transfer categories
  transferencia_interna: 'Transferência Interna',
  transferencia_externa: 'Transferência Externa',
  pix: 'PIX',
  ted: 'TED',
  doc: 'DOC',

  // Loan categories
  emprestimo_pessoal: 'Empréstimo Pessoal',
  emprestimo_familiar: 'Empréstimo Familiar',
  financiamento: 'Financiamento',

  // Payable categories
  conta_fixa: 'Conta Fixa',
  conta_variavel: 'Conta Variável',
  assinatura: 'Assinatura',
  parcela: 'Parcela',
};
