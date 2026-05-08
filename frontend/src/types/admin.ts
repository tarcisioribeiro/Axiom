export type ConfigCategory =
  | 'llm'
  | 'email'
  | 'backup'
  | 'app'
  | 'security'
  | 'storage';

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
  | 'healthy'
  | 'unhealthy'
  | 'warning'
  | 'not_configured'
  | 'unknown'
  | 'not_active';

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
