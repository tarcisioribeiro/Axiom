export interface WebhookEvent {
  value: string;
  label: string;
}

export interface Webhook {
  id: number;
  uuid: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  timeout_seconds: number;
  max_retries: number;
  delivery_count: number;
  last_delivery_status: 'pending' | 'success' | 'failed' | 'retrying' | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookFormData {
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  timeout_seconds: number;
  max_retries: number;
}

export interface WebhookDelivery {
  id: number;
  uuid: string;
  event: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  response_status_code: number | null;
  attempt_number: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}
