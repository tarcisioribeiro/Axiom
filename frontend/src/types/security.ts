export interface VaultStatus {
  is_configured: boolean;
  is_unlocked: boolean;
  expires_at: string | null;
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

export interface CredentialShareToken {
  id: number;
  token: string;
  token_key?: string;
  password: number;
  password_title: string;
  expires_at: string;
  used_at: string | null;
  use_count: number;
  max_uses: number;
  is_revoked: boolean;
  is_token_valid: boolean;
  is_expired: boolean;
  is_exhausted: boolean;
  created_at: string;
}

export interface CreateShareTokenData {
  ttl_hours: number;
  max_uses: number;
}

export interface SharedCredential {
  title: string;
  username: string;
  password: string;
  site?: string;
  category: string;
  expires_at: string;
  uses_remaining: number;
}

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
  tags?: string[];
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

export interface ActivityLog {
  id: number;
  action: string;
  action_display: string;
  model_name?: string;
  object_id?: number;
  description: string;
  description_key?: string;
  description_params?: Record<string, string | number>;
  ip_address?: string;
  user_agent?: string;
  user?: number;
  username?: string;
  created_at: string;
}
