export type AgentRole = 'user' | 'agent';

export interface IndexedSource {
  index: number;
  title: string;
}

export interface AgentMessage {
  id: number;
  session_id: string;
  role: AgentRole;
  content: string;
  agent_name: string | null;
  created_at: string;
}

export interface AgentHistoryResponse {
  results: AgentMessage[];
  session_id: string;
}

export type AgentName = 'personal' | 'financial' | 'security' | 'intellect';

export interface AgentAskRequest {
  query: string;
  session_id: string;
  date_from?: string;
  date_to?: string;
  forecast_days?: number;
  language?: string;
  agent_name?: AgentName | null;
  book_id?: number | null;
}

export interface AgentAskResponse {
  answer: string;
  agent: string;
  sources: string[];
  indexed_sources?: IndexedSource[];
  session_id: string;
}

export interface AgentStatus {
  available: boolean;
  provider: string;
  models: string[];
}

export interface AgentStreamToken {
  token: string;
  done?: false;
}

export interface AgentStreamDone {
  done: true;
  agent: string;
  sources: string[];
  indexed_sources?: IndexedSource[];
  query_id: string;
  formatted_content?: string;
}

export type AgentStreamEvent = AgentStreamToken | AgentStreamDone;
