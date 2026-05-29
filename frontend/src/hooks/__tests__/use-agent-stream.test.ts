import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useAgentStream } from '@/hooks/use-agent-stream';
import { agentService } from '@/services/agent-service';
import type { AgentStreamEvent } from '@/types';

vi.mock('@/services/agent-service', () => ({
  agentService: {
    stream: vi.fn(),
  },
}));

async function* makeStream(
  events: AgentStreamEvent[]
): AsyncGenerator<AgentStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('useAgentStream', () => {
  beforeEach(() => {
    vi.mocked(agentService.stream).mockReset();
  });

  it('starts with isStreaming=false and empty state', () => {
    const { result } = renderHook(() => useAgentStream());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.accumulatedText).toBe('');
    expect(result.current.currentAgent).toBeNull();
    expect(result.current.sources).toEqual([]);
    expect(result.current.queryId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('accumulates tokens from the stream', async () => {
    vi.mocked(agentService.stream).mockReturnValue(
      makeStream([
        { token: 'Hello' },
        { token: ' world' },
        { done: true, agent: 'finance_agent', sources: [], query_id: 'q1' },
      ])
    );

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      void result.current.send('test query', 'default');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(result.current.accumulatedText).toBe('Hello world');
  });

  it('sets isStreaming=true while consuming events', async () => {
    let resolve!: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });

    async function* slowStream(): AsyncGenerator<AgentStreamEvent> {
      yield { token: 'Hi' };
      await blocker;
      yield { done: true, agent: 'finance_agent', sources: [], query_id: 'q2' };
    }

    vi.mocked(agentService.stream).mockReturnValue(slowStream());

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      void result.current.send('query', 'default');
    });

    await waitFor(() => expect(result.current.accumulatedText).toBe('Hi'));
    expect(result.current.isStreaming).toBe(true);

    resolve();

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });

  it('sets currentAgent, sources, and queryId from done event', async () => {
    vi.mocked(agentService.stream).mockReturnValue(
      makeStream([
        { token: 'Answer' },
        {
          done: true,
          agent: 'budget_agent',
          sources: ['budget.pdf', 'plan.md'],
          query_id: 'abc-123',
        },
      ])
    );

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      void result.current.send('query', 's1');
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(result.current.currentAgent).toBe('budget_agent');
    expect(result.current.sources).toEqual(['budget.pdf', 'plan.md']);
    expect(result.current.queryId).toBe('abc-123');
  });

  it('sets error and stops streaming on fetch failure', async () => {
    vi.mocked(agentService.stream).mockImplementation(async function* () {
      throw new Error('network error');
      // satisfy TypeScript generator return type
      yield { token: '' };
    });

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      void result.current.send('query', 'default');
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('network error');
  });

  it('clears accumulatedText on a new send call', async () => {
    vi.mocked(agentService.stream).mockReturnValue(
      makeStream([
        { token: 'First answer' },
        { done: true, agent: 'finance_agent', sources: [], query_id: 'q3' },
      ])
    );

    const { result } = renderHook(() => useAgentStream());

    act(() => {
      void result.current.send('first query', 'default');
    });

    await waitFor(() => expect(result.current.accumulatedText).toBe('First answer'));

    vi.mocked(agentService.stream).mockReturnValue(
      makeStream([
        { token: 'Second' },
        { done: true, agent: 'finance_agent', sources: [], query_id: 'q4' },
      ])
    );

    act(() => {
      void result.current.send('second query', 'default');
    });

    await waitFor(() => expect(result.current.accumulatedText).toBe('Second'));
  });
});
