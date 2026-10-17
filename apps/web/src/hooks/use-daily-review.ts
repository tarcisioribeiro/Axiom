import { useQuery } from '@tanstack/react-query';

import { dailyReviewService } from '@/services/daily-review-service';

const FIVE_MINUTES = 5 * 60_000;

/** Pendências da revisão diária (dias anteriores ainda não revisados). */
export const useDailyReview = () =>
  useQuery({
    queryKey: ['daily-review'],
    queryFn: () => dailyReviewService.get(),
    staleTime: FIVE_MINUTES,
  });

/** A revisão está (ou pode estar, enquanto carrega) pendente? */
export function useReviewPending(): boolean {
  const { data } = useDailyReview();
  return data ? !!data.backlog || data.days.length > 0 : true;
}

export const useUserPreferences = () =>
  useQuery({
    queryKey: ['me', 'preferences'],
    queryFn: () => dailyReviewService.getPreferences(),
    staleTime: FIVE_MINUTES,
  });
