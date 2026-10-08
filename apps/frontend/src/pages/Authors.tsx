/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  User,
  UserPen,
  Calendar,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { AuthorForm } from '@/components/library/AuthorForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
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
import { authorsService } from '@/services/authors-service';
import { NATIONALITIES } from '@/types';
import type { Author, AuthorFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function AuthorCard({
  author,
  onEdit,
  onDelete,
}: {
  author: Author;
  onEdit: (a: Author) => void;
  onDelete: (id: number) => void;
}) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const { t } = useTranslation();
  const hasBioOverflow = author.biography && author.biography.length > 120;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="gap-sm flex items-start justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {author.photo ? (
              <img
                src={author.photo}
                alt={author.name}
                className="ring-border h-16 w-16 shrink-0 rounded-full object-cover ring-2"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="bg-muted ring-border flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-2">
                <UserCircle className="text-muted-foreground h-9 w-9" />
              </div>
            )}
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight">{author.name}</CardTitle>
              <CardDescription className="mt-0.5">
                {author.nationality
                  ? t('pages.authors.nationalities.' + author.nationality, {
                      defaultValue: author.nationality_display,
                    })
                  : author.nationality_display}
              </CardDescription>
            </div>
          </div>
          <div className="gap-xs flex shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(author)}
              aria-label={t('common.actions.edit')}
            >
              <Edit className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-8 w-8"
              onClick={() => onDelete(author.id)}
              aria-label={t('common.actions.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {(author.birth_year || author.death_year) && (
          <div className="gap-sm flex items-center">
            <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <Badge variant="outline" className="text-xs font-normal">
              {author.birth_year && (
                <>
                  {author.birth_year}{' '}
                  {author.birth_era
                    ? t('pages.authors.eras.' + author.birth_era)
                    : author.birth_era_display || ''}
                </>
              )}
              {author.birth_year && author.death_year && (
                <span className="mx-xs text-muted-foreground">·</span>
              )}
              {author.death_year && (
                <>
                  {author.death_year}{' '}
                  {author.death_era
                    ? t('pages.authors.eras.' + author.death_era)
                    : author.death_era_display || ''}
                </>
              )}
            </Badge>
          </div>
        )}

        {author.biography && (
          <div>
            <p
              className={`text-muted-foreground text-sm leading-relaxed ${!bioExpanded ? 'line-clamp-3' : ''}`}
            >
              {author.biography}
            </p>
            {hasBioOverflow && (
              <button
                className="mt-xs gap-xs text-primary flex items-center text-xs hover:underline"
                onClick={() => setBioExpanded((v) => !v)}
              >
                {bioExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> {t('common.actions.seeLess')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> {t('common.actions.seeMore')}
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="pt-sm mt-auto flex items-center justify-between">
          <Link to={`/library/books?search=${encodeURIComponent(author.name)}`}>
            <Badge
              variant="secondary"
              className="gap-sm hover:bg-secondary/70 flex items-center text-xs"
            >
              <BookOpen className="h-3 w-3" />
              {author.books_count === 0
                ? t('pages.authors.booksCountZero')
                : t('pages.authors.booksCount', { count: author.books_count })}
            </Badge>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Authors() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: authors = [], isLoading: loading } = useQuery({
    queryKey: ['authors'],
    queryFn: async () => {
      try {
        return await authorsService.getAll();
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
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.authors.newBtn')}
        </Button>
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
        <SearchInput
          placeholder={t('pages.authors.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
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
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3"
        >
          {(pageItems) =>
            pageItems.map((author) => (
              <AuthorCard
                key={author.id}
                author={author}
                onEdit={handleEdit}
                onDelete={(id) => void handleDelete(id)}
              />
            ))
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader sticky>
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
