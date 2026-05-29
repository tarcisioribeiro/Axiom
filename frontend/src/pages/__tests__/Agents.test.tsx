// Service mocks — hoisted before imports
vi.mock('@/services/agent-service', () => ({
  agentService: {
    getStatus: vi
      .fn()
      .mockResolvedValue({ available: true, provider: 'ollama', models: [] }),
    getHistory: vi.fn().mockResolvedValue({ results: [], session_id: 'default' }),
    newSession: vi.fn().mockResolvedValue({ session_id: 'new-session' }),
    clearHistory: vi.fn().mockResolvedValue(undefined),
  },
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/use-alert-dialog', () => ({
  useAlertDialog: () => ({ showConfirm: vi.fn().mockResolvedValue(false) }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: { id: 1, username: 'test' } }),
}));

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue(undefined),
}));

let streamingState = {
  isStreaming: false,
  accumulatedText: '',
  currentAgent: null as string | null,
  sources: [] as string[],
  queryId: null as string | null,
  error: null as string | null,
};

vi.mock('@/hooks/use-agent-stream', () => ({
  useAgentStream: () => ({
    ...streamingState,
    send: mockSend,
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import Agents from '@/pages/Agents';

queryClient.setDefaultOptions({ queries: { retry: false } });

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderAgents() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Agents />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** Clicks an agent card by its display name to set selectedAgent state. */
async function selectAgent(
  user: ReturnType<typeof userEvent.setup>,
  agentName: string
) {
  const card = await screen.findByText(agentName);
  await user.click(card);
}

describe('Agents page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    mockSend.mockClear();
    streamingState = {
      isStreaming: false,
      accumulatedText: '',
      currentAgent: null,
      sources: [],
      queryId: null,
      error: null,
    };
  });

  it('renders the agent selector on first load', async () => {
    renderAgents();

    await waitFor(() => {
      expect(screen.getByText('Escolha um agente')).toBeInTheDocument();
    });

    expect(screen.getByText('Agente Pessoal')).toBeInTheDocument();
    expect(screen.getByText('Agente Financeiro')).toBeInTheDocument();
    expect(screen.getByText('Agente de Segurança')).toBeInTheDocument();
    expect(screen.getByText('Agente Intelectual')).toBeInTheDocument();
  });

  it('shows chat input after selecting an agent', async () => {
    const user = userEvent.setup();
    renderAgents();

    await selectAgent(user, 'Agente Pessoal');

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Pergunte sobre rotinas/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('input and send button are enabled when agent selected and not streaming', async () => {
    const user = userEvent.setup();
    renderAgents();

    await selectAgent(user, 'Agente Financeiro');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Pergunte sobre gastos/i)).not.toBeDisabled();
    });

    // Send button disabled when query is empty
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('input is disabled while isStreaming=true', async () => {
    streamingState = { ...streamingState, isStreaming: true };

    renderAgents();

    // When streaming is active from the start, showStreamingBubble=true → input visible but disabled
    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('input is enabled when agent is selected and streaming is done', async () => {
    const user = userEvent.setup();
    renderAgents();

    // Select agent first (streaming not active)
    await selectAgent(user, 'Agente Pessoal');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Pergunte sobre rotinas/i)).not.toBeDisabled();
    });
  });

  it('calls send with the typed query and agent_name when Enter is pressed', async () => {
    const user = userEvent.setup();
    renderAgents();

    await selectAgent(user, 'Agente Pessoal');

    const textarea = await screen.findByPlaceholderText(/Pergunte sobre rotinas/i);
    await user.click(textarea);
    await user.type(textarea, 'Quais são minhas rotinas de hoje?');
    await user.keyboard('{Enter}');

    expect(mockSend).toHaveBeenCalledWith(
      'Quais são minhas rotinas de hoje?',
      expect.any(String),
      { agent_name: 'personal' }
    );
  });

  it('shows error toast when error is set', async () => {
    streamingState = { ...streamingState, error: 'network error' };

    renderAgents();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });
});
