// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Authentication Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  groups: string[];
}

export interface Permission {
  app_label: string;
  codename: string;
  name: string;
}

// Account Types
export interface Account {
  id: number;
  uuid: string;
  account_name: string;
  account_type: string;
  institution: string;
  account_number_masked: string;
  balance: string;
  overdraft_limit?: string;
  created_at: string;
  updated_at: string;
  owner: number;
  owner_name?: string;
}

export interface AccountFormData {
  account_name: string;
  account_type: string;
  institution: string;
  account_number: string;
  balance: number;
  overdraft_limit?: number;
  owner: number;
}

// Expense Types
export interface Expense {
  id: number;
  uuid: string;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  payed: boolean;
  account: number;
  account_name?: string;
  member: number | null;
  member_name?: string;
  merchant?: string;
  location?: string;
  payment_method?: string;
  notes?: string;
  recurring?: boolean;
  frequency?: string;
  related_transfer?: number | null;
  related_transfer_id?: number | null;
  is_transfer_generated?: boolean;
  related_loan?: number | null;
  loan_description?: string;
  related_payable?: number | null;
  payable_description?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  payed: boolean;
  account: number;
  member?: number | null;
  merchant?: string;
  location?: string;
  payment_method?: string;
  notes?: string;
  recurring?: boolean;
  frequency?: string;
  related_loan?: number | null;
  related_payable?: number | null;
}

// Revenue Types
export interface Revenue {
  id: number;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  account: number;
  account_name?: string;
  current_balance?: string;
  received: boolean;
  source?: string;
  tax_amount?: string;
  net_amount?: string;
  member?: number | null;
  member_name?: string;
  receipt?: string | null;
  recurring?: boolean;
  frequency?: string | null;
  notes?: string;
  related_transfer?: number | null;
  related_transfer_id?: number | null;
  is_transfer_generated?: boolean;
  related_loan?: number | null;
  loan_description?: string;
}

export interface RevenueFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  account: number;
  received: boolean;
  source?: string;
  tax_amount?: number;
  member?: number | null;
  receipt?: string | null;
  recurring?: boolean;
  frequency?: string | null;
  notes?: string;
  related_loan?: number | null;
}

// Credit Card Types
export interface CreditCard {
  id: number;
  uuid: string;
  name: string;
  on_card_name: string;
  card_number_masked: string;
  flag: string;
  validation_date: string;
  credit_limit: string;
  max_limit: string;
  due_day: number;
  closing_day: number;
  associated_account: number;
  associated_account_name?: string;
  used_credit?: number;
  available_credit?: number;
  is_active: boolean;
  interest_rate?: string;
  annual_fee?: string;
  owner?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCardFormData {
  name: string;
  on_card_name: string;
  card_number: string;
  flag: string;
  security_code: string;
  validation_date: string;
  credit_limit: number;
  max_limit: number;
  due_day: number;
  closing_day: number;
  associated_account: number;
  is_active?: boolean;
  interest_rate?: number;
  annual_fee?: number;
  owner?: number;
  notes?: string;
}

// Credit Card Bill Types
export interface CreditCardBill {
  id: number;
  uuid: string;
  credit_card: number;
  credit_card_name?: string;
  credit_card_on_card_name?: string;
  credit_card_number_masked?: string;
  credit_card_flag?: string;
  credit_card_associated_account_name?: string;
  year: string;
  month: string;
  invoice_beginning_date: string;
  invoice_ending_date: string;
  closed: boolean;
  total_amount: string;
  minimum_payment: string;
  due_date: string | null;
  paid_amount: string;
  payment_date: string | null;
  interest_charged: string;
  late_fee: string;
  status: 'open' | 'closed' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface CreditCardBillFormData {
  credit_card: number;
  year: string;
  month: string;
  invoice_beginning_date: string;
  invoice_ending_date: string;
  closed: boolean;
  total_amount: number;
  minimum_payment: number;
  due_date?: string;
  paid_amount?: number;
  payment_date?: string;
  interest_charged?: number;
  late_fee?: number;
  status?: 'open' | 'closed' | 'paid' | 'overdue';
}

// Bill Payment Types
export interface BillPaymentFormData {
  amount: number;
  payment_date: string;
  notes?: string;
}

export interface BillPaymentResponse {
  message: string;
  payment: {
    amount: string;
    payment_date: string;
    expense_id: number;
  };
  bill: {
    id: number;
    total_amount: string;
    paid_amount: string;
    remaining: string;
    status: string;
    closed: boolean;
  };
  card: {
    id: number;
    name: string;
    credit_limit: string;
    max_limit: string;
  };
  account: {
    id: number;
    name: string;
    balance: string;
  };
}

// Credit Card Bill Item Types (unified view of expenses + installments)
export interface BillItem {
  id: number;
  type: 'expense' | 'installment';
  description: string;
  value: number;
  date: string | null;
  category: string;
  installment_number: number;
  total_installments: number;
  merchant?: string | null;
  payed: boolean;
  member_id?: number | null;
  member_name?: string | null;
  notes?: string | null;
  purchase_date?: string;
}

export interface BillItemsResponse {
  bill_id: number;
  bill_month: string;
  bill_year: string;
  total_items: number;
  total_value: number;
  total_paid: number;
  total_pending: number;
  paid_count: number;
  pending_count: number;
  items: BillItem[];
}

// Credit Card Expense Types
export interface CreditCardExpense {
  id: number;
  uuid: string;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  card: number;
  card_name?: string;
  installment: number;
  payed: boolean;
  total_installments: number;
  merchant?: string;
  transaction_id?: string;
  location?: string;
  bill?: number | null;
  bill_info?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  receipt?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCardExpenseFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  card: number;
  installment?: number;
  payed?: boolean;
  total_installments: number;
  bill?: number | null;
  member?: number | null;
  notes?: string;
}

// Credit Card Purchase Types (New Model)
export interface CreditCardPurchase {
  id: number;
  uuid: string;
  description: string;
  total_value: number;
  installment_value: number;
  purchase_date: string;
  purchase_time: string;
  category: string;
  card: number;
  card_name?: string;
  card_flag?: string;
  card_number_masked?: string;
  total_installments: number;
  merchant?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  receipt?: string | null;
  installments: CreditCardInstallmentNested[];
  created_at: string;
  updated_at: string;
}

export interface CreditCardPurchaseFormData {
  description: string;
  total_value: number;
  purchase_date: string;
  purchase_time: string;
  category: string;
  card: number;
  total_installments: number;
  merchant?: string;
  member?: number | null;
  notes?: string;
}

// Credit Card Installment Types (New Model)
export interface CreditCardInstallment {
  id: number;
  uuid: string;
  purchase: number;
  installment_number: number;
  value: number;
  due_date: string;
  bill?: number | null;
  payed: boolean;
  // Fields from purchase
  description?: string;
  category?: string;
  card_id?: number;
  card_name?: string;
  total_installments?: number;
  merchant?: string;
  member_id?: number | null;
  member_name?: string;
  purchase_date?: string;
  // Fields from bill
  bill_month?: string;
  bill_year?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditCardInstallmentNested {
  id: number;
  installment_number: number;
  value: number;
  due_date: string;
  bill?: number | null;
  payed: boolean;
  bill_month?: string;
  bill_year?: string;
}

export interface CreditCardInstallmentUpdateData {
  bill?: number | null;
  payed?: boolean;
  value?: number;
}

// Credit Card Expenses by Category (Dashboard)
export interface CreditCardExpensesByCategory {
  category: string;
  total: number;
  count: number;
}

// Transfer Types
export interface Transfer {
  id: number;
  uuid: string;
  description: string;
  value: string;
  date: string;
  horary: string;
  category: string;
  transfered: boolean;
  origin_account: number;
  origin_account_name?: string;
  destiny_account: number;
  destiny_account_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TransferFormData {
  description: string;
  value: number;
  date: string;
  horary: string;
  category: string;
  transfered: boolean;
  origin_account: number;
  destiny_account: number;
}

// Loan Types
export interface Loan {
  id: number;
  uuid: string;
  description: string;
  value: string;
  payed_value: string;
  date: string;
  horary: string;
  category: string;
  account: number;
  account_name?: string;
  benefited: number;
  benefited_name?: string;
  creditor: number;
  creditor_name?: string;
  payed: boolean;
  interest_rate?: string;
  installments: number;
  due_date?: string;
  contract_document?: string | null;
  payment_frequency: string;
  late_fee: string;
  guarantor?: number | null;
  guarantor_name?: string;
  notes?: string;
  status: string;
  remaining_balance?: string;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

export interface LoanFormData {
  description: string;
  value: number;
  payed_value: number;
  date: string;
  horary: string;
  category: string;
  account: number;
  benefited: number;
  creditor: number;
  payed: boolean;
  interest_rate?: number;
  installments?: number;
  due_date?: string;
  contract_document?: File | null;
  payment_frequency?: string;
  late_fee?: number;
  guarantor?: number | null;
  notes?: string;
  status?: string;
}

// Payable Types
export interface Payable {
  id: number;
  uuid: string;
  description: string;
  value: string;
  paid_value: string;
  date: string;
  due_date?: string;
  category: string;
  category_display?: string;
  member?: number | null;
  member_name?: string;
  notes?: string;
  status: 'active' | 'paid' | 'overdue' | 'cancelled';
  status_display?: string;
  remaining_value?: string;
  created_at: string;
  updated_at: string;
}

export interface PayableFormData {
  description: string;
  value: number;
  paid_value?: number;
  date: string;
  due_date?: string;
  category: string;
  member?: number | null;
  notes?: string;
  status?: 'active' | 'paid' | 'overdue' | 'cancelled';
}

// Member Types
export interface Member {
  id: number;
  uuid: string;
  name: string;
  document: string;
  phone: string;
  email?: string | null;
  sex: string;
  user?: number | null;
  is_creditor: boolean;
  is_benefited: boolean;
  active: boolean;
  birth_date?: string | null;
  address?: string | null;
  profile_photo?: string | null;
  emergency_contact?: string | null;
  monthly_income?: string | null;
  occupation?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberFormData {
  name: string;
  document: string;
  phone: string;
  sex: string;
  email?: string;
  is_creditor?: boolean;
  is_benefited?: boolean;
  birth_date?: string;
  address?: string;
  emergency_contact?: string;
  monthly_income?: number;
  occupation?: string;
  notes?: string;
}

// API Error Types
export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}

// Dashboard/Analytics Types
export interface DashboardStats {
  total_balance: number;
  total_expenses: number;
  total_revenues: number;
  total_credit_limit: number;
  used_credit_limit: number;
  available_credit_limit: number;
  accounts_count: number;
  credit_cards_count: number;
}

export interface AccountBalance {
  id: number;
  account_name: string;
  institution_name: string;
  current_balance: number;
  pending_revenues: number;
  pending_expenses: number;
  future_balance: number;
}

export interface BalanceForecast {
  current_total_balance: number;
  forecast_balance: number;
  pending_expenses: number;
  pending_revenues: number;
  pending_card_bills: number;
  loans_to_receive: number;
  loans_to_pay: number;
  pending_payables: number;
  summary: {
    total_income: number;
    total_outcome: number;
    net_change: number;
  };
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TimeSeriesData {
  date: string;
  expenses: number;
  revenues: number;
}

// ============================================================================
// SECURITY MODULE TYPES
// ============================================================================

// Vault Config Types
export interface VaultStatus {
  is_configured: boolean;
  is_unlocked: boolean;
}

export interface VaultSetupData {
  master_password: string;
  confirm_master_password: string;
}

export interface VaultUnlockData {
  master_password: string;
}

export interface VaultChangePasswordData {
  current_master_password: string;
  new_master_password: string;
  confirm_new_master_password: string;
}

// Password Types
export interface Password {
  id: number;
  uuid: string;
  title: string;
  site?: string;
  username: string;
  category: string;
  category_display: string;
  notes?: string;
  last_password_change: string;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface PasswordFormData {
  title: string;
  site?: string;
  username: string;
  password: string;
  category: string;
  notes?: string;
  owner: number;
}

export interface PasswordReveal {
  id: number;
  title: string;
  username: string;
  password: string;
}

// Stored Credit Card Types
export interface StoredCreditCard {
  id: number;
  uuid: string;
  name: string;
  card_number_masked: string;
  last_four_digits?: string;
  cardholder_name: string;
  expiration_month: number;
  expiration_year: number;
  flag: string;
  flag_display: string;
  notes?: string;
  owner: number;
  owner_name: string;
  finance_card?: number | null;
  finance_card_name?: string;
  created_at: string;
  updated_at: string;
}

export interface StoredCreditCardFormData {
  name: string;
  card_number: string;
  security_code: string;
  cardholder_name: string;
  expiration_month: number;
  expiration_year: number;
  flag: string;
  notes?: string;
  owner: number;
  finance_card?: number | null;
}

export interface StoredCreditCardReveal {
  id: number;
  name: string;
  card_number: string;
  security_code: string;
  cardholder_name: string;
  expiration_month: number;
  expiration_year: number;
}

// Stored Bank Account Types
export interface StoredBankAccount {
  id: number;
  uuid: string;
  name: string;
  institution_name: string;
  account_type: string;
  account_type_display: string;
  account_number?: string;
  account_number_masked: string;
  agency?: string;
  notes?: string;
  owner: number;
  owner_name: string;
  finance_account?: number | null;
  finance_account_name?: string;
  created_at: string;
  updated_at: string;
}

export interface StoredBankAccountFormData {
  name: string;
  institution_name: string;
  account_type: string;
  account_number: string;
  agency?: string;
  password?: string;
  digital_password?: string;
  notes?: string;
  owner: number;
  finance_account?: number | null;
}

export interface StoredBankAccountReveal {
  id: number;
  name: string;
  institution_name: string;
  account_number: string;
  agency?: string;
  password?: string;
  password2?: string;
  digital_password?: string;
}

// Archive Types
export interface Archive {
  id: number;
  uuid: string;
  title: string;
  category: string;
  category_display: string;
  archive_type: string;
  archive_type_display: string;
  text_content?: string;
  file_name?: string;
  file_size?: number;
  notes?: string;
  tags?: string;
  has_text: boolean;
  has_file: boolean;
  encrypted_file?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface ArchiveFormData {
  title: string;
  category: string;
  archive_type: string;
  text_content?: string;
  encrypted_file?: File | null;
  notes?: string;
  tags?: string;
  owner: number;
}

export interface ArchiveReveal {
  id: number;
  title: string;
  text_content?: string | null;
  error?: string | null;
  error_type?: 'no_content' | 'decryption_failed' | null;
}

// Password Generator Types
export interface PasswordGenerateRequest {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  special_characters?: boolean;
  exclude_ambiguous?: boolean;
}

export interface PasswordGenerateResponse {
  password: string;
  length: number;
  strength: string;
}

// Activity Log Types
export interface ActivityLog {
  id: number;
  action: string;
  action_display: string;
  model_name?: string;
  object_id?: number;
  description: string;
  ip_address?: string;
  user_agent?: string;
  user?: number;
  username?: string;
  created_at: string;
}

// Security Module Constants
export const PASSWORD_CATEGORIES = [
  { value: 'social', label: 'Redes Sociais' },
  { value: 'email', label: 'E-mail' },
  { value: 'banking', label: 'Bancário' },
  { value: 'work', label: 'Trabalho' },
  { value: 'entertainment', label: 'Entretenimento' },
  { value: 'shopping', label: 'Compras' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'gaming', label: 'Games' },
  { value: 'other', label: 'Outro' },
];

export const CARD_FLAGS = [
  { value: 'MSC', label: 'Mastercard' },
  { value: 'VSA', label: 'Visa' },
  { value: 'ELO', label: 'Elo' },
  { value: 'EXP', label: 'American Express' },
  { value: 'HCD', label: 'Hipercard' },
  { value: 'DIN', label: 'Diners Club' },
  { value: 'OTHER', label: 'Outro' },
];

export const ACCOUNT_TYPES = [
  { value: 'CC', label: 'Conta Corrente' },
  { value: 'CS', label: 'Conta Salário' },
  { value: 'CP', label: 'Conta Poupança' },
  { value: 'CI', label: 'Conta Investimento' },
  { value: 'OTHER', label: 'Outro' },
];

export const ARCHIVE_CATEGORIES = [
  { value: 'personal', label: 'Pessoal' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'legal', label: 'Jurídico' },
  { value: 'medical', label: 'Médico' },
  { value: 'tax', label: 'Impostos' },
  { value: 'work', label: 'Trabalho' },
  { value: 'other', label: 'Outro' },
];

export const ARCHIVE_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagem' },
  { value: 'document', label: 'Documento' },
  { value: 'other', label: 'Outro' },
];

// ============================================================================
// LIBRARY MODULE TYPES
// ============================================================================

// Era types for historical dates
export type Era = 'AC' | 'DC';

export const ERAS = [
  { value: 'DC' as Era, label: 'Depois de Cristo (DC)' },
  { value: 'AC' as Era, label: 'Antes de Cristo (AC)' },
];

// Author Types
export interface Author {
  id: number;
  uuid: string;
  name: string;
  birth_year?: number | null;
  birth_era?: Era;
  birth_era_display?: string;
  death_year?: number | null;
  death_era?: Era | null;
  death_era_display?: string;
  birth_display?: string | null;
  death_display?: string | null;
  nationality?: string;
  nationality_display?: string;
  biography?: string;
  books_count: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorFormData {
  name: string;
  birth_year?: number | null | undefined;
  birth_era: Era;
  death_year?: number | null | undefined;
  death_era?: Era | null | undefined;
  nationality: string;
  biography?: string;
  owner: number;
}

// Publisher Types
export interface Publisher {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  website?: string;
  country?: string;
  country_display?: string;
  founded_year?: number;
  books_count: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface PublisherFormData {
  name: string;
  description?: string;
  website?: string;
  country?: string;
  founded_year?: number;
  owner: number;
}

// Book Types
export interface Book {
  id: number;
  uuid: string;
  title: string;
  authors?: number[];
  authors_names: string[];
  pages: number;
  publisher: number;
  publisher_name: string;
  language: string;
  language_display: string;
  genre: string;
  genre_display: string;
  literarytype: string;
  literarytype_display: string;
  publish_date?: string;
  synopsis: string;
  edition: string;
  media_type?: string;
  media_type_display?: string;
  rating: number | null;
  read_status: string;
  read_status_display: string;
  has_summary: boolean;
  total_pages_read: number;
  reading_progress: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface BookFormData {
  title: string;
  authors: number[];
  pages: number;
  publisher: number;
  language: string;
  genre: string;
  literarytype: string;
  publish_date?: string;
  synopsis: string;
  edition: string;
  media_type?: string;
  rating: number | null;
  read_status: string;
  owner: number;
}

// Summary Types
export interface Summary {
  id: number;
  uuid: string;
  title: string;
  book: number;
  book_title: string;
  text: string;
  is_vectorized: boolean;
  vectorization_date?: string;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryFormData {
  title: string;
  book: number;
  text: string;
  owner: number;
}

// Reading Types
export interface Reading {
  id: number;
  uuid: string;
  book: number;
  book_title: string;
  reading_date: string;
  reading_time: number;
  pages_read: number;
  notes?: string;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingFormData {
  book: number;
  reading_date: string;
  reading_time: number;
  pages_read: number;
  notes?: string;
  owner: number;
}

// Library Module Constants
export const NATIONALITIES = [
  { value: 'USA', label: 'Americana' },
  { value: 'BRA', label: 'Brasileira' },
  { value: 'SUI', label: 'Suíça' },
  { value: 'ALE', label: 'Alemã' },
  { value: 'CZE', label: 'Checa' },
  { value: 'ISR', label: 'Israelense' },
  { value: 'AUS', label: 'Austríaca' },
  { value: 'ROM', label: 'Romana' },
  { value: 'GRE', label: 'Grega' },
  { value: 'FRA', label: 'Francesa' },
  { value: 'ING', label: 'Inglesa' },
  { value: 'CUB', label: 'Cubana' },
  { value: 'MEX', label: 'Mexicana' },
  { value: 'ESP', label: 'Espanhola' },
];

export const COUNTRIES = [
  { value: 'BRA', label: 'Brasil' },
  { value: 'USA', label: 'Estados Unidos da América' },
  { value: 'UK', label: 'Reino Unido' },
  { value: 'POR', label: 'Portugal' },
];

export const BOOK_LANGUAGES = [
  { value: 'Por', label: 'Português' },
  { value: 'Ing', label: 'Inglês' },
  { value: 'Esp', label: 'Espanhol' },
];

export const BOOK_GENRES = [
  { value: 'Philosophy', label: 'Filosofia' },
  { value: 'History', label: 'História' },
  { value: 'Psychology', label: 'Psicologia' },
  { value: 'Fiction', label: 'Ficção' },
  { value: 'Policy', label: 'Política' },
  { value: 'Technology', label: 'Tecnologia' },
  { value: 'Theology', label: 'Teologia' },
];

export const LITERARY_TYPES = [
  { value: 'book', label: 'Livro' },
  { value: 'collection', label: 'Coletânea' },
  { value: 'magazine', label: 'Revista' },
  { value: 'article', label: 'Artigo' },
  { value: 'essay', label: 'Ensaio' },
];

export const MEDIA_TYPES = [
  { value: 'Dig', label: 'Digital' },
  { value: 'Phi', label: 'Física' },
];

export const READ_STATUS = [
  { value: 'to_read', label: 'Para ler' },
  { value: 'reading', label: 'Lendo' },
  { value: 'read', label: 'Lido' },
];

// ============================================================================
// PERSONAL PLANNING MODULE TYPES
// ============================================================================

// Task Category Choices
export const TASK_CATEGORIES = [
  { value: 'health', label: 'Saúde' },
  { value: 'studies', label: 'Estudos' },
  { value: 'spiritual', label: 'Espiritual' },
  { value: 'exercise', label: 'Exercício Físico' },
  { value: 'nutrition', label: 'Nutrição' },
  { value: 'meditation', label: 'Meditação' },
  { value: 'reading', label: 'Leitura' },
  { value: 'writing', label: 'Escrita' },
  { value: 'work', label: 'Trabalho' },
  { value: 'leisure', label: 'Lazer' },
  { value: 'family', label: 'Família' },
  { value: 'social', label: 'Social' },
  { value: 'finance', label: 'Finanças' },
  { value: 'household', label: 'Casa' },
  { value: 'personal_care', label: 'Cuidado Pessoal' },
  { value: 'other', label: 'Outros' },
] as const;

export const PERIODICITY_CHOICES = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekdays', label: 'Dias Úteis' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export const WEEKDAY_CHOICES = [
  { value: 0, label: 'Segunda-feira' },
  { value: 1, label: 'Terça-feira' },
  { value: 2, label: 'Quarta-feira' },
  { value: 3, label: 'Quinta-feira' },
  { value: 4, label: 'Sexta-feira' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
] as const;

export const GOAL_TYPE_CHOICES = [
  { value: 'consecutive_days', label: 'Dias Consecutivos' },
  { value: 'total_days', label: 'Total de Dias' },
  { value: 'avoid_habit', label: 'Evitar Hábito' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export const GOAL_STATUS_CHOICES = [
  { value: 'active', label: 'Ativo' },
  { value: 'completed', label: 'Concluído' },
  { value: 'failed', label: 'Falhou' },
  { value: 'cancelled', label: 'Cancelado' },
] as const;

export const MOOD_CHOICES = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bom' },
  { value: 'neutral', label: 'Neutro' },
  { value: 'bad', label: 'Ruim' },
  { value: 'terrible', label: 'Péssimo' },
] as const;

// Routine Task Types
export interface RoutineTask {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  category: string;
  category_display: string;
  icon?: string | null;
  periodicity: string;
  periodicity_display: string;
  weekday?: number;
  weekday_display?: string;
  day_of_month?: number;
  custom_weekdays?: number[] | null;
  custom_month_days?: number[] | null;
  times_per_week?: number | null;
  times_per_month?: number | null;
  interval_days?: number | null;
  interval_start_date?: string | null;
  // Campos de agendamento de horário
  default_time?: string | null;
  daily_occurrences: number;
  interval_hours?: number | null;
  scheduled_times?: string[] | null;
  is_active: boolean;
  target_quantity: number;
  unit: string;
  completion_rate: number;
  total_completions: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineTaskFormData {
  name: string;
  description?: string;
  category: string;
  icon?: string | null;
  periodicity: string;
  weekday?: number;
  day_of_month?: number;
  custom_weekdays?: number[] | null;
  custom_month_days?: number[] | null;
  times_per_week?: number | null;
  times_per_month?: number | null;
  interval_days?: number | null;
  interval_start_date?: string | null;
  // Campos de agendamento de horário
  default_time?: string | null;
  daily_occurrences?: number;
  interval_hours?: number | null;
  scheduled_times?: string[] | null;
  is_active: boolean;
  target_quantity: number;
  unit: string;
  owner: number;
}

// Kanban Types
export type KanbanStatus = 'todo' | 'doing' | 'done';

export interface TaskCard {
  id: string; // unique ID for the card (instance_id or task_id + index)
  task_id: number; // instance ID (or original task ID for legacy)
  task_name: string;
  description?: string;
  category: string;
  category_display: string;
  icon?: string | null;
  unit: string;
  index: number; // index for tasks with multiple instances (0-based)
  total_instances: number; // total instances from same template
  status: KanbanStatus;
  notes?: string;
  record_id?: number;
  scheduled_time?: string; // Horário programado (HH:MM)
}

// Goal Types
export interface Goal {
  id: number;
  uuid: string;
  title: string;
  description?: string;
  goal_type: string;
  goal_type_display: string;
  related_task?: number;
  related_task_name?: string;
  target_value: number;
  current_value: number;
  calculated_current_value?: number;
  start_date: string;
  end_date?: string;
  status: string;
  status_display: string;
  progress_percentage: number;
  days_active: number;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface GoalFormData {
  title: string;
  description?: string;
  goal_type: string;
  related_task?: number;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date?: string;
  status: string;
  owner: number;
}

// Daily Reflection Types
export interface DailyReflection {
  id: number;
  uuid: string;
  date: string;
  reflection: string;
  mood?: string;
  mood_display?: string;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReflectionFormData {
  date: string;
  reflection: string;
  mood?: string;
  owner: number;
}

// ============================================================================
// TASK INSTANCE TYPES
// ============================================================================

export const INSTANCE_STATUS_CHOICES = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'skipped', label: 'Pulada' },
  { value: 'cancelled', label: 'Cancelada' },
] as const;

export type InstanceStatus = (typeof INSTANCE_STATUS_CHOICES)[number]['value'];

export interface TaskInstance {
  id: number;
  uuid: string;
  template?: number | null;
  template_name?: string | null;
  task_name: string;
  task_description?: string | null;
  category: string;
  category_display: string;
  icon?: string | null;
  scheduled_date: string;
  scheduled_time?: string | null;
  time_display?: string | null;
  occurrence_index: number;
  status: InstanceStatus;
  status_display: string;
  target_quantity: number;
  quantity_completed: number;
  unit: string;
  notes?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  is_overdue: boolean;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface TaskInstanceFormData {
  task_name: string;
  task_description?: string;
  category: string;
  scheduled_date: string;
  scheduled_time?: string;
  target_quantity?: number;
  unit?: string;
  owner: number;
}

export interface TaskInstanceUpdateData {
  status?: InstanceStatus;
  quantity_completed?: number;
  notes?: string;
}

export interface InstancesForDateResponse {
  date: string;
  instances: TaskInstance[];
  summary: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    skipped: number;
    completion_rate: number;
  };
}

export interface TaskInstanceBulkUpdate {
  id: number;
  status: InstanceStatus;
  notes?: string;
}

export interface TaskInstanceBulkUpdateResponse {
  updated_count: number;
  updated: TaskInstance[];
  errors: Array<{ id: number; error: string }>;
}

// Dashboard Stats
export interface PersonalPlanningDashboardStats {
  total_tasks: number;
  active_tasks: number;
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  completion_rate_7d: number;
  completion_rate_30d: number;
  current_streak: number;
  best_streak: number;
  tasks_by_category: Array<{
    category: string;
    category_display: string;
    count: number;
  }>;
  weekly_progress: Array<{
    date: string;
    total: number;
    completed: number;
    rate: number;
  }>;
  active_goals_progress: Array<{
    title: string;
    progress_percentage: number;
    current_value: number;
    target_value: number;
    days_active: number;
  }>;
  total_tasks_today: number;
  completed_tasks_today: number;
  active_routine_tasks: RoutineTask[];
  recent_reflections: DailyReflection[];
}

// Fixed Expense Types
export interface FixedExpense {
  id: number;
  uuid: string;
  description: string;
  default_value: string;
  category: string;
  account?: number;
  account_name?: string;
  credit_card?: number;
  credit_card_name?: string;
  due_day: number;
  merchant?: string;
  payment_method?: string;
  notes?: string;
  member?: number | null;
  member_name?: string;
  is_active: boolean;
  allow_value_edit: boolean;
  last_generated_month?: string | null;
  total_generated: number;
  created_at: string;
  updated_at: string;
}

export interface FixedExpenseFormData {
  description: string;
  default_value: number;
  category: string;
  account?: number;
  credit_card?: number;
  due_day: number;
  merchant?: string;
  payment_method?: string;
  notes?: string;
  member?: number | null;
  is_active: boolean;
  allow_value_edit: boolean;
}

export interface FixedExpenseValue {
  fixed_expense_id: number;
  value: number;
}

export interface BulkGenerateRequest {
  month: string;
  expense_values: FixedExpenseValue[];
}

export interface BulkGenerateResponse {
  success: boolean;
  created_count: number;
  month: string;
  expenses: Expense[];
}

export interface FixedExpenseStats {
  active_templates: number;
  current_month: {
    month: string;
    total_value: number;
    paid_count: number;
    pending_count: number;
    total_count: number;
  };
  previous_month: {
    month: string;
    total_value: number;
  };
  comparison: {
    difference: number;
    percentage_change: number;
  };
  category_breakdown: Array<{
    category: string;
    total: number;
    count: number;
  }>;
}

// ============================================================================
// VAULTS MODULE TYPES (Cofres)
// ============================================================================

export const VAULT_TRANSACTION_TYPES = [
  { value: 'deposit', label: 'Depósito' },
  { value: 'withdrawal', label: 'Saque' },
  { value: 'yield', label: 'Rendimento' },
] as const;

export const FINANCIAL_GOAL_CATEGORIES = [
  { value: 'savings', label: 'Poupança' },
  { value: 'investment', label: 'Investimento' },
  { value: 'emergency', label: 'Reserva de Emergência' },
  { value: 'travel', label: 'Viagem' },
  { value: 'education', label: 'Educação' },
  { value: 'property', label: 'Imóvel' },
  { value: 'vehicle', label: 'Veículo' },
  { value: 'retirement', label: 'Aposentadoria' },
  { value: 'health', label: 'Saúde' },
  { value: 'other', label: 'Outro' },
] as const;

export interface VaultTransaction {
  id: number;
  uuid: string;
  vault: number;
  vault_description: string;
  transaction_type: 'deposit' | 'withdrawal' | 'yield';
  transaction_type_display: string;
  amount: string;
  balance_after: string;
  description?: string;
  transaction_date: string;
  created_at: string;
  created_by?: number;
}

export interface Vault {
  id: number;
  uuid: string;
  description: string;
  account: number;
  account_name: string;
  account_balance: string;
  institution_name: string;
  current_balance: string;
  accumulated_yield: string;
  yield_rate: string;
  yield_rate_percentage: number;
  annual_yield_rate: string;
  annual_yield_rate_percentage: number;
  daily_yield_rate: number;
  daily_yield_rate_percentage: number;
  last_yield_date?: string;
  pending_yield: number;
  is_active: boolean;
  notes?: string;
  total_deposits: number;
  total_withdrawals: number;
  recent_transactions: VaultTransaction[];
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

export interface VaultFormData {
  description: string;
  account: number;
  yield_rate?: number;
  annual_yield_rate: number;
  is_active: boolean;
  notes?: string;
}

export interface VaultTransactionUpdateData {
  amount?: number;
  description?: string;
  transaction_date?: string;
}

export interface VaultTransactionUpdateResponse {
  message: string;
  transaction: VaultTransaction;
  vault: Vault;
  adjustment: {
    old_amount: number;
    new_amount: number;
    difference: number;
  };
}

export interface VaultTransactionDeleteResponse {
  message: string;
  vault: Vault;
  reversed_amount: number;
}

export interface VaultDepositData {
  amount: number;
  description?: string;
}

export interface VaultWithdrawData {
  amount: number;
  description?: string;
}

export interface VaultYieldUpdateData {
  yield_rate?: number;
  accumulated_yield?: number;
  recalculate?: boolean;
  from_date?: string;
}

export interface VaultOperationResponse {
  message: string;
  transaction: VaultTransaction;
  vault: Vault;
}

export interface VaultYieldResponse {
  message: string;
  yield_applied: number;
  vault: Vault;
}

export interface VaultYieldUpdateResponse {
  message: string;
  yield_rate_changed?: {
    old: number;
    new: number;
  };
  accumulated_yield_changed?: {
    old: number;
    new: number;
    balance_adjustment: number;
  };
  recalculation?: {
    reversed_amount: number;
    new_yield_amount: number;
    difference: number;
  };
  vault: Vault;
}

// Financial Goal Types
export interface VaultSummary {
  id: number;
  uuid: string;
  description: string;
  current_balance: number;
  accumulated_yield: number;
  account_name: string;
  contribution_percentage: number;
}

export interface FinancialGoal {
  id: number;
  uuid: string;
  description: string;
  category: string;
  category_display: string;
  target_value: string;
  current_value: string;
  progress_percentage: string;
  remaining_value: string;
  vaults: number[];
  vaults_count: number;
  vaults_summary: VaultSummary[];
  target_date?: string;
  days_remaining?: number;
  monthly_required?: string;
  is_active: boolean;
  is_completed: boolean;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

export interface FinancialGoalListItem {
  id: number;
  uuid: string;
  description: string;
  category: string;
  category_display: string;
  target_value: string;
  current_value: string;
  progress_percentage: string;
  vaults_count: number;
  target_date?: string;
  is_active: boolean;
  is_completed: boolean;
  created_at: string;
}

export interface FinancialGoalFormData {
  description: string;
  category: string;
  target_value: number;
  vaults: number[];
  target_date?: string;
  is_active: boolean;
  notes?: string;
}

export interface FinancialGoalCheckResponse {
  message: string;
  is_completed: boolean;
  current_value: number;
  target_value: number;
  progress_percentage: number;
  goal: FinancialGoal;
}

export interface FinancialGoalVaultsRequest {
  vault_ids: number[];
}

export interface FinancialGoalVaultsResponse {
  message: string;
  goal: FinancialGoal;
}

// ============================================================================
// AI ASSISTANT MODULE TYPES
// ============================================================================

export interface AiAgent {
  key: string;
  name: string;
  icon: string;
  description: string;
  suggestions: string[];
}

export interface AiAgentsResponse {
  agents: AiAgent[];
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayType?: string;
  data?: Record<string, unknown>[];
  module?: string;
  agent?: string;
  timestamp?: string;
}

export interface AiResponse {
  resposta: string;
  display_type: string;
  data: Record<string, unknown>[];
  module: string;
  agent?: string;
  count: number;
  description: string;
  success: boolean;
}

export interface AiHistoryItem {
  id: number;
  question: string;
  response: string;
  module: string;
  agent?: string;
  display_type: string;
  success: boolean;
  created_at: string;
}

export interface AiHistoryResponse {
  conversations: AiHistoryItem[];
  count: number;
}

export interface AiHealthResponse {
  ollama: 'healthy' | 'unavailable';
  database: 'healthy' | 'unavailable';
  model: string;
  healthy: boolean;
}

// ============================================================================
// NOTIFICATIONS MODULE TYPES
// ============================================================================

export type NotificationType =
  | 'task_today'
  | 'task_overdue'
  | 'payable_due_soon'
  | 'payable_overdue'
  | 'loan_due_soon'
  | 'loan_overdue'
  | 'bill_due_soon'
  | 'bill_overdue';

export interface Notification {
  id: number;
  uuid: string;
  notification_type: NotificationType;
  notification_type_display: string;
  title: string;
  message: string;
  is_read: boolean;
  due_date: string | null;
  content_type: string;
  object_id: number;
  created_at: string;
}

export interface NotificationSummary {
  unread_count: number;
}
