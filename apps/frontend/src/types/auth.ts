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
  is_superuser?: boolean;
  /** Staff: todas as telas do app + painel de permissões no /admin */
  is_staff?: boolean;
  profile_photo?: string | null;
}

export interface Permission {
  app_label: string;
  codename: string;
  name: string;
}
