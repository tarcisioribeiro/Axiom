import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import { useToast } from '@/hooks/use-toast';

interface UseOptimisticDeleteOptions<T> {
  queryKey: unknown[];
  deleteFn: (id: number | string) => Promise<void>;
  getItemId: (item: T) => number | string;
  resourceName: string;
  onSuccess?: (id: number | string) => void;
}

interface UseOptimisticDeleteReturn {
  deletingIds: Set<number | string>;
  handleDelete: (id: number | string) => Promise<void>;
}

/**
 * Provides optimistic delete UX for TanStack Query list pages.
 *
 * On delete:
 *  1. Marks the row as "deleting" (for fade animation)
 *  2. Removes the item from cache immediately
 *  3. If the network call fails, restores the item and shows an error toast
 */
export function useOptimisticDelete<T>({
  queryKey,
  deleteFn,
  getItemId,
  resourceName,
  onSuccess,
}: UseOptimisticDeleteOptions<T>): UseOptimisticDeleteReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingIds, setDeletingIds] = useState<Set<number | string>>(new Set());

  const handleDelete = useCallback(
    async (id: number | string) => {
      setDeletingIds((prev) => new Set(prev).add(id));

      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData<T[]>(queryKey);

      if (snapshot) {
        queryClient.setQueryData<T[]>(
          queryKey,
          snapshot.filter((item) => getItemId(item) !== id)
        );
      }

      try {
        await deleteFn(id);
        onSuccess?.(id);
      } catch {
        if (snapshot) {
          queryClient.setQueryData<T[]>(queryKey, snapshot);
        }
        toast({
          title: `Erro ao excluir ${resourceName}`,
          description: 'A alteração foi revertida.',
          variant: 'destructive',
        });
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient, queryKey, deleteFn, getItemId, resourceName, onSuccess, toast]
  );

  return { deletingIds, handleDelete };
}
