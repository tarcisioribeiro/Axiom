import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/services/api-client';
import { exerciseService } from '@/services/workout-service';
import type { PaginatedResponse } from '@/types';
import type { ExerciseDatasetEntry } from '@/types/workout';

interface ExerciseDatasetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (entry: ExerciseDatasetEntry) => void;
}

const SKELETON_ITEMS = Array.from({ length: 8 }, (_, i) => i);

export function ExerciseDatasetPicker({
  open,
  onOpenChange,
  onSelect,
}: ExerciseDatasetPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Páginas extras carregadas via "carregar mais" (a página 1 vem
  // reativamente de `data`, abaixo) — evita acumular resultados dentro de
  // um efeito: o clique já é um handler de evento, então o setState aqui
  // não dispara o aviso set-state-in-effect.
  const [extraResults, setExtraResults] = useState<ExerciseDatasetEntry[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce manual (sem lib de debounce no projeto) — mesmo idiom usado
  // em components/library/ReadingQueueTab.tsx.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setExtraResults([]);
      setNextUrl(null);
    }, 400);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery('');
      setDebouncedQuery('');
      setExtraResults([]);
      setNextUrl(null);
    }
    onOpenChange(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['exerciseDataset', 'search', debouncedQuery],
    queryFn: () =>
      exerciseService.searchDataset({ search: debouncedQuery || undefined }),
    enabled: open,
  });

  const firstPage = data?.results ?? [];
  const results = [...firstPage, ...extraResults];
  const hasMore = Boolean((nextUrl ?? data?.next) && results.length > 0);

  const handleLoadMore = async () => {
    const url = nextUrl ?? data?.next;
    if (!url) return;
    setIsLoadingMore(true);
    try {
      const page = await apiClient.get<PaginatedResponse<ExerciseDatasetEntry>>(url);
      setExtraResults((prev) => [...prev, ...page.results]);
      setNextUrl(page.next);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const showSkeleton = isLoading;
  const showEmpty = !showSkeleton && results.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('pages.exercises.picker.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.exercises.picker.description')}
          </DialogDescription>
        </DialogHeader>

        <SearchInput
          value={query}
          onValueChange={handleQueryChange}
          placeholder={t('pages.exercises.picker.searchPlaceholder')}
        />

        <div className="max-h-[55vh] overflow-y-auto">
          {showSkeleton ? (
            <div className="gap-sm grid grid-cols-3 sm:grid-cols-4">
              {SKELETON_ITEMS.map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : showEmpty ? (
            <EmptyState
              title={t('pages.exercises.picker.empty')}
              message={t('pages.exercises.picker.emptyDesc')}
            />
          ) : (
            <div className="gap-sm grid grid-cols-3 sm:grid-cols-4">
              {results.map((entry) => (
                <ExerciseDatasetPickerItem
                  key={entry.id}
                  entry={entry}
                  onSelect={() => onSelect(entry)}
                />
              ))}
            </div>
          )}
        </div>

        {hasMore && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
          >
            {t('pages.exercises.picker.loadMore')}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExerciseDatasetPickerItem({
  entry,
  onSelect,
}: {
  entry: ExerciseDatasetEntry;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const src = (hovered && entry.gif_url) || entry.thumbnail_url;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group border-border/60 hover:border-primary focus:ring-primary gap-xs p-sm flex flex-col items-center rounded-lg border transition-colors focus:ring-2 focus:outline-none"
    >
      <div className="bg-muted flex aspect-square w-full items-center justify-center overflow-hidden rounded-md">
        {src ? (
          <img
            src={src}
            alt={entry.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Dumbbell className="text-muted-foreground h-6 w-6" />
        )}
      </div>
      <span className="text-foreground line-clamp-2 text-center text-xs capitalize">
        {entry.name}
      </span>
    </button>
  );
}
