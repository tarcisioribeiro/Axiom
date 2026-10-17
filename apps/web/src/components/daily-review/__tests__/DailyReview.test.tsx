import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DailyReview } from '@/components/daily-review/DailyReview';
import ptBR from '@/i18n/locales/pt-BR.json';
import type { DailyReviewState } from '@/types/daily-review';

const { mockToast, service } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  service: {
    get: vi.fn(),
    resolveBacklog: vi.fn(),
    complete: vi.fn(),
  },
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));
vi.mock('@/services/daily-review-service', () => ({ dailyReviewService: service }));

// Select nativo no lugar do Radix (que não abre no happy-dom)
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="justificativa"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

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

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const DAY: DailyReviewState = {
  backlog: null,
  days: [
    {
      date: '2026-10-15',
      steps: [
        {
          key: 'reflection',
          can_register: false,
          justifications: ['forgot', 'no_time'],
          items: [{ key: '', label: '' }],
        },
      ],
    },
  ],
};

function renderReview() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DailyReview />
    </QueryClientProvider>
  );
}

describe('DailyReview', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    service.complete.mockResolvedValue(undefined);
    service.resolveBacklog.mockResolvedValue(undefined);
  });

  it('does not finish the day while an item is unresolved', async () => {
    service.get.mockResolvedValue(DAY);
    renderReview();

    fireEvent.click(await screen.findByRole('button', { name: /Concluir dia/ }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
    expect(service.complete).not.toHaveBeenCalled();
  });

  it('sends the justification and completes the day', async () => {
    service.get
      .mockResolvedValueOnce(DAY)
      .mockResolvedValue({ backlog: null, days: [] });
    renderReview();

    // As camadas invisíveis que reservam a altura repetem a etapa; a ativa é a última
    const selects = await screen.findAllByLabelText('justificativa');
    fireEvent.change(selects[selects.length - 1], {
      target: { value: 'no_time' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Concluir dia/ }));

    await waitFor(() =>
      expect(service.complete).toHaveBeenCalledWith('2026-10-15', [
        { step: 'reflection', item_key: '', justification: 'no_time' },
      ])
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Concluir dia/ })).toBeNull()
    );
  });

  it('justifies old days in bulk, one choice per step', async () => {
    service.get.mockResolvedValueOnce({
      backlog: {
        start: '2026-09-01',
        end: '2026-10-08',
        days: 38,
        steps: [{ key: 'checkin', justifications: ['forgot'] }],
      },
      days: [],
    });
    service.get.mockResolvedValue({ backlog: null, days: [] });
    renderReview();

    fireEvent.change(await screen.findByLabelText('justificativa'), {
      target: { value: 'forgot' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() =>
      expect(service.resolveBacklog).toHaveBeenCalledWith({ checkin: 'forgot' })
    );
  });
});
