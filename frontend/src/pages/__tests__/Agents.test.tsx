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

  it('renders the chat input and send button', async () => {
    renderAgents();

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /faça uma pergunta/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('input and send button are enabled when not streaming', async () => {
    renderAgents();

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /faça uma pergunta/i })
      ).not.toBeDisabled();
    });

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled(); // disabled because query is empty
  });

  it('input and send button are disabled while isStreaming=true', async () => {
    streamingState = { ...streamingState, isStreaming: true };

    renderAgents();

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /faça uma pergunta/i })
      ).toBeDisabled();
    });

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('input is enabled after streaming is done (isStreaming=false)', async () => {
    streamingState = {
      isStreaming: false,
      accumulatedText: 'Resposta do agente',
      currentAgent: 'finance_agent',
      sources: [],
      queryId: 'q1',
      error: null,
    };

    renderAgents();

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /faça uma pergunta/i })
      ).not.toBeDisabled();
    });
  });

  it('calls send with the typed query when Enter is pressed', async () => {
    const user = userEvent.setup();
    renderAgents();

    const textarea = await screen.findByRole('textbox', { name: /faça uma pergunta/i });
    await user.click(textarea);
    await user.type(textarea, 'Qual meu saldo?');
    await user.keyboard('{Enter}');

    expect(mockSend).toHaveBeenCalledWith('Qual meu saldo?', 'default');
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
