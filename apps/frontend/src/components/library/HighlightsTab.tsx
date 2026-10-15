import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Highlighter, Pencil, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { HIGHLIGHT_TYPE_KEY, highlightBg } from '@/lib/highlight-colors';
import { cn } from '@/lib/utils';
import { bookHighlightsService } from '@/services/book-highlights-service';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import type { Book, BookHighlight, BookHighlightFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { HighlightForm } from './HighlightForm';

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  quote: 'default',
  note: 'secondary',
  idea: 'outline',
};

interface HighlightsTabProps {
  isCreateOpen: boolean;
  onCreateClose: () => void;
}

const EMPTY_HIGHLIGHTS: BookHighlight[] = [];
const EMPTY_BOOKS: Book[] = [];

export function HighlightsTab({ isCreateOpen, onCreateClose }: HighlightsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingHighlight, setEditingHighlight] = useState<BookHighlight | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['highlights-tab'],
    queryFn: async () => {
      try {
        const [highlightsData, booksData, member] = await Promise.all([
          bookHighlightsService.getAllPages(),
          booksService.getAllPages(),
          membersService.getCurrentUserMember(),
        ]);
        return { highlights: highlightsData, books: booksData, ownerId: member.id };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return { highlights: EMPTY_HIGHLIGHTS, books: EMPTY_BOOKS, ownerId: 0 };
      }
    },
  });
  const highlights = pageData?.highlights ?? EMPTY_HIGHLIGHTS;
  const books = pageData?.books ?? EMPTY_BOOKS;
  const ownerId = pageData?.ownerId ?? 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['highlights-tab'] });

  // Incluir (botão do header) e editar (ícone da linha) abrem o mesmo modal (§2.2).
  const isFormOpen = isCreateOpen || !!editingHighlight;
  const closeForm = () => {
    onCreateClose();
    setEditingHighlight(undefined);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.highlights.deleteTitle'),
      description: t('pages.highlights.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await bookHighlightsService.delete(id);
      toast({ title: t('pages.highlights.deleted') });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: BookHighlightFormData) => {
    try {
      setIsSubmitting(true);
      if (editingHighlight) {
        await bookHighlightsService.update(editingHighlight.id, data);
        toast({ title: t('pages.highlights.updated') });
      } else {
        await bookHighlightsService.create(data);
        toast({ title: t('pages.highlights.saved') });
      }
      closeForm();
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const q = searchTerm.toLowerCase();
  const filtered = searchTerm
    ? highlights.filter(
        (h) =>
          h.text.toLowerCase().includes(q) ||
          h.book_title.toLowerCase().includes(q) ||
          (h.chapter ?? '').toLowerCase().includes(q)
      )
    : highlights;

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-md">
      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.highlights.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
        </FilterField>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Highlighter className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm
              ? t('pages.highlights.emptySearch')
              : t('pages.highlights.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={searchTerm}
          items={filtered}
          pageSize={LIST_PAGE_SIZE}
          className="space-y-sm"
        >
          {(pageItems) =>
            pageItems.map((h) => (
              <div
                key={h.id}
                className={cn('px-md py-sm rounded-lg border', highlightBg(h.color))}
              >
                <div className="gap-sm flex items-center justify-between">
                  <div className="gap-sm flex min-w-0 flex-wrap items-center">
                    <Badge variant={TYPE_VARIANT[h.highlight_type] ?? 'default'}>
                      {t(HIGHLIGHT_TYPE_KEY[h.highlight_type] ?? '', {
                        defaultValue: h.highlight_type_display,
                      })}
                    </Badge>
                    {h.page_number && (
                      <span className="text-muted-foreground text-xs">
                        {t('pages.highlights.pageShort', { page: h.page_number })}
                      </span>
                    )}
                    {h.chapter && (
                      <span className="text-muted-foreground text-xs">{h.chapter}</span>
                    )}
                    <span className="text-muted-foreground truncate text-xs font-medium">
                      {h.book_title}
                    </span>
                  </div>
                  <div className="gap-xs flex shrink-0">
                    <Can action="change">
                      <Button
                        aria-label={t('common.actions.edit')}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingHighlight(h)}
                      >
                        <Pencil className={cn('h-4 w-4', ACTION_COLOR.edit)} />
                      </Button>
                    </Can>
                    <Can action="delete">
                      <Button
                        aria-label={t('common.actions.delete')}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void handleDelete(h.id)}
                      >
                        <Trash2 className={cn('h-4 w-4', ACTION_COLOR.delete)} />
                      </Button>
                    </Can>
                  </div>
                </div>
                <p
                  className="mt-xs line-clamp-3 text-sm leading-relaxed"
                  title={h.text}
                >
                  {h.text}
                </p>
              </div>
            ))
          }
        </PaginatedSlide>
      )}

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle mode={editingHighlight ? 'edit' : 'create'}>
              {editingHighlight
                ? t('pages.highlights.editTitle')
                : t('pages.highlights.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {editingHighlight
                  ? t('pages.highlights.editDesc')
                  : t('pages.highlights.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <HighlightForm
            key={editingHighlight?.id ?? 'new'}
            highlight={editingHighlight}
            books={books}
            ownerId={ownerId}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
