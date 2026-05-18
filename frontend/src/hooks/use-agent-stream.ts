import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { agentService } from '@/services/agent-service';
import type { AgentAskRequest } from '@/types';

interface AgentStreamState {
  isStreaming: boolean;
  accumulatedText: string;
  currentAgent: string | null;
  sources: string[];
  queryId: string | null;
  error: string | null;
}

const INITIAL_STATE: AgentStreamState = {
  isStreaming: false,
  accumulatedText: '',
  currentAgent: null,
  sources: [],
  queryId: null,
  error: null,
};

export function useAgentStream() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<AgentStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (
      query: string,
      sessionId: string,
      extra?: Omit<AgentAskRequest, 'query' | 'session_id'>
    ) => {
      cancel();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        isStreaming: true,
        accumulatedText: '',
        currentAgent: null,
        sources: [],
        queryId: null,
        error: null,
      });

      try {
        const generator = agentService.stream(
          { query, session_id: sessionId, language: i18n.language, ...extra },
          controller.signal
        );

        for await (const event of generator) {
          if (controller.signal.aborted) break;

          if ('done' in event && event.done) {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              currentAgent: event.agent,
              sources: event.sources,
              queryId: event.query_id,
            }));
          } else if ('token' in event) {
            setState((prev) => ({
              ...prev,
              accumulatedText: prev.accumulatedText + event.token,
            }));
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: (err as Error).message ?? 'Streaming error',
        }));
      }
    },
    [cancel, i18n.language]
  );

  return { ...state, send, cancel, reset };
}
