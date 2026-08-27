export interface Account {
  id: number;
  uuid: string;
  account_name: string;
  account_type: string;
  institution: string;
  account_number_masked: string;
  balance: string;
  available_balance: string;
  deposited_in_vaults: string;
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
