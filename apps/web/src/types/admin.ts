export type ConfigCategory =
  'llm' | 'email' | 'backup' | 'app' | 'security' | 'storage';

export interface SystemConfig {
  key: string;
  label: string;
  description: string;
  category: ConfigCategory;
  is_secret: boolean;
  is_editable: boolean;
  requires_restart: boolean;
  masked_value: string | null;
  is_configured: boolean;
  updated_at: string;
  updated_by_username: string | null;
}

export type ServiceStatus =
  'healthy' | 'unhealthy' | 'warning' | 'not_configured' | 'unknown' | 'not_active';

export interface ServiceCheck {
  status: ServiceStatus;
  message?: string;
  message_key?: string;
  models?: string[];
  model_count?: number;
  free_percent?: number;
  smtp_host?: string;
  smtp_port?: number;
}

export interface HealthResponse {
  status: ServiceStatus;
  timestamp: string;
  checks: {
    database: ServiceCheck;
    cache: ServiceCheck;
    storage: ServiceCheck;
    ollama: ServiceCheck;
    email: ServiceCheck;
    disk: ServiceCheck;
  };
}

/** Aviso do sistema de agentes; o texto é montado via i18n a partir do `code`. */
interface LlmWarning {
  code: string;
  role?: 'primary' | 'fallback' | 'embeddings';
  provider?: string;
  [param: string]: string | undefined;
}

export interface IntegrationsResponse {
  database: ServiceCheck;
  cache: ServiceCheck;
  storage: ServiceCheck;
  ollama: ServiceCheck;
  anthropic: ServiceCheck;
  email: ServiceCheck;
  llm_provider: string;
  ollama_model: string;
  anthropic_model: string;
  llm_warnings: LlmWarning[];
}

export interface AdminLog {
  id: number;
  action: string;
  action_display: string;
  model_name: string | null;
  object_id: number | null;
  object_uuid: string | null;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  user: number | null;
  username: string | null;
  created_at: string;
}

export interface AdminLogsResponse {
  count: number;
  page: number;
  page_size: number;
  results: AdminLog[];
}

export interface StaffUser {
  id: number;
  username: string;
  email: string;
  name: string;
  is_active: boolean;
  date_joined: string;
}

/** {chave da tela: ações} — ex.: { 'security.passwords': ['view', 'reveal'] } */
export type ScreenGrants = Record<string, string[]>;

export interface ScreenCatalogModule {
  key: string;
  label: string;
  screens: { key: string; label: string; path: string | null; actions: string[] }[];
}

export interface PermissionUser {
  id: number;
  username: string;
  name: string;
  email: string;
  is_active: boolean;
  screen_count: number;
}
