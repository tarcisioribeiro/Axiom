/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Globe,
  Plus,
  Search,
  User,
  UserCircle,
  UserPen,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Can } from '@/components/common/Can';
import { CardActions } from '@/components/common/CardActions';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { AuthorForm } from '@/components/library/AuthorForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { cn } from '@/lib/utils';
import { authorsService } from '@/services/authors-service';
import { NATIONALITIES } from '@/types';
import type { Author, AuthorFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function AuthorAvatar({ author, size }: { author: Author; size: 'sm' | 'lg' }) {
  const box = size === 'sm' ? 'h-10 w-10' : 'h-20 w-20';
  return author.photo ? (
    <img
      src={author.photo}
      alt={author.name}
      className={cn('ring-border shrink-0 rounded-full object-cover ring-2', box)}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div
      className={cn(
        'bg-muted ring-border flex shrink-0 items-center justify-center rounded-full ring-2',
        box
      )}
    >
      <UserCircle className="text-muted-foreground h-1/2 w-1/2" />
    </div>
  );
}

function useAuthorLabels() {
  const { t } = useTranslation();
  const nationality = (a: Author) =>
    a.nationality
      ? t(`pages.authors.nationalities.${a.nationality}`, {
          defaultValue: a.nationality_display,
        })
      : a.nationality_display;
  const years = (a: Author) =>
    [
      a.birth_year &&
        `${a.birth_year} ${a.birth_era ? t(`pages.authors.eras.${a.birth_era}`) : ''}`,
      a.death_year &&
        `${a.death_year} ${a.death_era ? t(`pages.authors.eras.${a.death_era}`) : ''}`,
    ]
      .filter(Boolean)
      .join(' · ');
  const books = (a: Author) =>
    a.books_count === 0
      ? t('pages.authors.booksCountZero')
      : t('pages.authors.booksCount', { count: a.books_count });
  return { nationality, years, books };
}

/**
 * Card de grade (§5): foto + nome + nacionalidade + nº de livros. Anos e
 * biografia ficam no modal de detalhe.
 */
function AuthorCard({
  author,
  onOpen,
  onEdit,
  onDelete,
}: {
  author: Author;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const labels = useAuthorLabels();
  return (
    <div
      role="button"
      tabIndex={0}
      className="bg-card border-border flex cursor-pointer flex-col rounded-lg border"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      <div className="gap-sm px-md py-sm flex flex-1 items-center">
        <AuthorAvatar author={author} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{author.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {labels.nationality(author)}
          </p>
        </div>
        <span className="gap-xs text-muted-foreground flex shrink-0 items-center text-xs">
          <BookOpen className="h-3.5 w-3.5" />
          {labels.books(author)}
        </span>
      </div>
      <div
        role="presentation"
        className="gap-xs px-sm py-xs flex items-center justify-end border-t"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <CardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

function AuthorDetailModal({
  author,
  onClose,
}: {
  author: Author | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const labels = useAuthorLabels();
  return (
    <Dialog open={!!author} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        {author && (
          <>
            <DialogHeader>
              <DialogTitle icon={UserPen}>{author.name}</DialogTitle>
              <VisuallyHidden>
                <DialogDescription>{t('pages.authors.detailDesc')}</DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <div className="gap-md flex items-start">
              <AuthorAvatar author={author} size="lg" />
              <div className="space-y-sm min-w-0 flex-1 text-sm">
                <p className="gap-xs flex items-center">
                  <Globe className="text-muted-foreground h-4 w-4" />
                  {labels.nationality(author)}
                </p>
                {labels.years(author) && (
                  <p className="gap-xs flex items-center">
                    <Calendar className="text-muted-foreground h-4 w-4" />
                    {labels.years(author)}
                  </p>
                )}
                <p className="gap-xs flex items-center">
                  <BookOpen className="text-muted-foreground h-4 w-4" />
                  {labels.books(author)}
                </p>
              </div>
            </div>
            {author.biography && (
              <p
                className="text-muted-foreground line-clamp-[10] text-sm leading-relaxed"
                title={author.biography}
              >
                {author.biography}
              </p>
            )}
            <DialogCloseFooter>
              {author.books_count > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigate(
                      `/library/books?search=${encodeURIComponent(author.name)}`
                    )
                  }
                >
                  <BookOpen className={cn('h-4 w-4', ACTION_COLOR.preview)} />
                  {t('pages.authors.viewBooks')}
                </Button>
              )}
            </DialogCloseFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Authors() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [detailAuthor, setDetailAuthor] = useState<Author | undefined>();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: authors = [], isLoading: loading } = useQuery({
    queryKey: ['authors'],
    queryFn: async () => {
      try {
        return await authorsService.getAllPages();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return [] as Author[];
      }
    },
  });

  const handleCreate = () => {
    setSelectedAuthor(undefined);
    setPendingPhotoFile(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (author: Author) => {
    setSelectedAuthor(author);
    setPendingPhotoFile(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.authors.deleteTitle'),
      description: t('pages.authors.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await authorsService.delete(id);
      toast({
        title: t('pages.authors.deleted'),
      });
      void queryClient.invalidateQueries({ queryKey: ['authors'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: AuthorFormData) => {
    try {
      setIsSubmitting(true);
      let author: Author;
      if (selectedAuthor) {
        author = await authorsService.update(selectedAuthor.id, data);
        toast({
          title: t('pages.authors.updated'),
        });
      } else {
        author = await authorsService.create(data);
        toast({
          title: t('pages.authors.created'),
        });
      }
      if (pendingPhotoFile) {
        await authorsService.uploadPhoto(author.id, pendingPhotoFile);
      }
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['authors'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAuthors = authors.filter((author) => {
    if (nationalityFilter !== 'all' && author.nationality !== nationalityFilter) {
      return false;
    }
    return (
      author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (author.nationality?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.authors.title')} icon={<UserPen />}>
        <Can action="add">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            {t('pages.authors.newBtn')}
          </Button>
        </Can>
      </PageHeader>

      <FilterBar
        hasActiveFilters={!!searchTerm || nationalityFilter !== 'all'}
        onClear={() => {
          setSearchTerm('');
          setNationalityFilter('all');
        }}
        activeFilters={[
          ...(nationalityFilter !== 'all'
            ? [
                {
                  key: 'nationality',
                  label: `${t('pages.authors.nationalityFilterLabel')}: ${t(`pages.authors.nationalities.${nationalityFilter}`)}`,
                  onRemove: () => setNationalityFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.authors.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.filterLabels.nationality')} icon={Globe}>
          <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
            <SelectTrigger
              className="w-48"
              aria-label={t('pages.authors.allNationalities')}
              startIcon={<Globe className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.authors.allNationalities')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.authors.allNationalities')}</SelectItem>
              {NATIONALITIES.map((nat) => (
                <SelectItem key={nat.value} value={nat.value}>
                  {t(`pages.authors.nationalities.${nat.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {filteredAuthors.length === 0 ? (
        <EmptyState
          icon={<User className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm ? t('pages.authors.emptySearch') : t('pages.authors.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={`${searchTerm}-${nationalityFilter}`}
          items={filteredAuthors}
          pageSize={GRID_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {(pageItems) =>
            pageItems.map((author) => (
              <AuthorCard
                key={author.id}
                author={author}
                onOpen={() => setDetailAuthor(author)}
                onEdit={() => handleEdit(author)}
                onDelete={() => void handleDelete(author.id)}
              />
            ))
          }
        </PaginatedSlide>
      )}

      <AuthorDetailModal
        author={detailAuthor}
        onClose={() => setDetailAuthor(undefined)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle mode={selectedAuthor ? 'edit' : 'create'}>
              {selectedAuthor
                ? t('pages.authors.editTitle')
                : t('pages.authors.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedAuthor
                  ? t('pages.authors.editDesc')
                  : t('pages.authors.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <AuthorForm
            author={selectedAuthor}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            onPhotoSelect={setPendingPhotoFile}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
