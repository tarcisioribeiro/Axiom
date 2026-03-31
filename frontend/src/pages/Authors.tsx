import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  User,
  UserPen,
  Calendar,
  UserCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { AuthorForm } from '@/components/library/AuthorForm';
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
      <PageHeader
        title={t('pages.authors.title')}
        icon={<UserPen />}
        action={{
          label: t('pages.authors.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder={t('pages.authors.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="flex-1"
        />
      </div>

      {filteredAuthors.length === 0 ? (
        <EmptyState
          icon={<User className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.authors.emptySearch') : t('pages.authors.emptyState')
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAuthors.map((author) => (
            <Card key={author.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {author.photo ? (
                      <img
                        src={author.photo}
                        alt={author.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserCircle className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{author.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {author.nationality_display}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(author)}
                      aria-label={t('common.actions.edit')}
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(author.id)}
                      aria-label={t('common.actions.delete')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(author.birth_year || author.death_year) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {author.birth_year && (
                        <>
                          {author.birth_year} {author.birth_era_display || ''}
                        </>
                      )}
                      {author.death_year && (
                        <>
                          {' - '}
                          {author.death_year} {author.death_era_display || ''}
                        </>
                      )}
                    </span>
                  </div>
                )}
                {author.biography && (
                  <p className="line-clamp-3 text-sm">{author.biography}</p>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">
                    {author.books_count} {author.books_count === 1 ? 'livro' : 'livros'}
                  </span>
                </div>
              </CardContent>
            </Card>
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
