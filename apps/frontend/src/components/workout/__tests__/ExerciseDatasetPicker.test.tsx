vi.mock('@/services/workout-service', () => ({
  exerciseService: {
    searchDataset: vi.fn(),
  },
}));

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseDatasetPicker } from '@/components/workout/ExerciseDatasetPicker';
import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import { apiClient } from '@/services/api-client';
import { exerciseService } from '@/services/workout-service';

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

function renderPicker(onSelect = vi.fn()) {
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ExerciseDatasetPicker open onOpenChange={onOpenChange} onSelect={onSelect} />
    </QueryClientProvider>
  );
  return { ...utils, onOpenChange, onSelect };
}

const ENTRY_SQUAT = {
  id: 1,
  dataset_id: '0001',
  name: 'barbell squat',
  category: 'upper legs',
  body_part: 'upper legs',
  thumbnail_url: '/api/v1/personal-planning/exercise-dataset/1/thumbnail/',
  gif_url: '/api/v1/personal-planning/exercise-dataset/1/gif/',
};

const ENTRY_BENCH = {
  id: 2,
  dataset_id: '0002',
  name: 'bench press',
  category: 'chest',
  body_part: 'chest',
  thumbnail_url: '/api/v1/personal-planning/exercise-dataset/2/thumbnail/',
  gif_url: '/api/v1/personal-planning/exercise-dataset/2/gif/',
};

describe('ExerciseDatasetPicker', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.mocked(exerciseService.searchDataset).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [ENTRY_SQUAT, ENTRY_BENCH],
    });
  });

  it('renders search results from the dataset', async () => {
    renderPicker();
    await waitFor(() => {
      expect(screen.getByText('barbell squat')).toBeInTheDocument();
    });
    expect(screen.getByText('bench press')).toBeInTheDocument();
  });

  it('debounces the search query before calling the service', async () => {
    const user = userEvent.setup();
    renderPicker();
    await waitFor(() => {
      expect(exerciseService.searchDataset).toHaveBeenCalledWith({ search: undefined });
    });

    vi.mocked(exerciseService.searchDataset).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [ENTRY_SQUAT],
    });

    const input = screen.getByPlaceholderText(
      'Buscar exercício (em inglês, ex: squat)...'
    );
    await user.type(input, 'squat');

    await waitFor(
      () => {
        expect(exerciseService.searchDataset).toHaveBeenCalledWith({
          search: 'squat',
        });
      },
      { timeout: 2000 }
    );
  });

  it('calls onSelect with the chosen entry', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderPicker(onSelect);
    await waitFor(() => {
      expect(screen.getByText('barbell squat')).toBeInTheDocument();
    });
    await user.click(screen.getByText('barbell squat'));
    expect(onSelect).toHaveBeenCalledWith(ENTRY_SQUAT);
  });

  it('shows an empty state when there are no results', async () => {
    vi.mocked(exerciseService.searchDataset).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    renderPicker();
    await waitFor(() => {
      expect(screen.getByText('Nenhum exercício encontrado')).toBeInTheDocument();
    });
  });

  it('loads the next page via apiClient when "load more" is clicked', async () => {
    vi.mocked(exerciseService.searchDataset).mockResolvedValue({
      count: 2,
      next: 'https://api.test/exercise-dataset/?page=2',
      previous: null,
      results: [ENTRY_SQUAT],
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [ENTRY_BENCH],
    });

    const user = userEvent.setup();
    renderPicker();
    await waitFor(() => {
      expect(screen.getByText('barbell squat')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => {
      expect(screen.getByText('bench press')).toBeInTheDocument();
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      'https://api.test/exercise-dataset/?page=2'
    );
  });
});
