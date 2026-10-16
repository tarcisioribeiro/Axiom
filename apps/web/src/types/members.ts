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
  email_verified?: boolean;
  password_strength?: number | null;
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
  birth_date?: string | null;
  address?: string;
  emergency_contact?: string;
  monthly_income?: number;
  occupation?: string;
  notes?: string;
}
