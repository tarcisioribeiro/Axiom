/* eslint-disable max-lines */
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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
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
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { authorsService } from '@/services/authors-service';
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
        <div className="flex items-start justify-between gap-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {author.photo ? (
              <img
                src={author.photo}
                alt={author.name}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-border">
                <UserCircle className="h-9 w-9 text-muted-foreground" />
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
          <div className="flex shrink-0 gap-xs">
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
              className="h-8 w-8 text-destructive hover:text-destructive"
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
          <div className="flex items-center gap-sm">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
              className={`text-sm leading-relaxed text-muted-foreground ${!bioExpanded ? 'line-clamp-3' : ''}`}
            >
              {author.biography}
            </p>
            {hasBioOverflow && (
              <button
                className="mt-xs flex items-center gap-xs text-xs text-primary hover:underline"
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

        <div className="mt-auto flex items-center justify-between pt-sm">
          <Badge variant="secondary" className="flex items-center gap-sm text-xs">
            <BookOpen className="h-3 w-3" />
            {t('pages.authors.booksCount', { count: author.books_count })}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Authors() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  useEffect(() => {
    void loadAuthors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAuthors = async () => {
    try {
      setLoading(true);
      const data = await authorsService.getAll();
      setAuthors(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
        description: t('pages.authors.deletedDesc'),
      });
      void loadAuthors();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
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
          description: t('pages.authors.updatedDesc'),
        });
      } else {
        author = await authorsService.create(data);
        toast({
          title: t('pages.authors.created'),
          description: t('pages.authors.createdDesc'),
        });
      }
      if (pendingPhotoFile) {
        await authorsService.uploadPhoto(author.id, pendingPhotoFile);
      }
      setIsDialogOpen(false);
      void loadAuthors();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAuthors = authors.filter(
    (author) =>
      author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (author.nationality?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder={t('pages.authors.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      {filteredAuthors.length === 0 ? (
        <EmptyState
          icon={<User className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.authors.emptySearch') : t('pages.authors.emptyState')
          }
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {filteredAuthors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAuthor
                ? t('pages.authors.editTitle')
                : t('pages.authors.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedAuthor
                ? t('pages.authors.editDesc')
                : t('pages.authors.newDesc')}
            </DialogDescription>
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
