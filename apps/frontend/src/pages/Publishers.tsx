/* eslint-disable max-lines */
import { Plus, Edit, Trash2, Building2, Globe, Calendar, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { PublisherForm } from '@/components/library/PublisherForm';
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
import { publishersService } from '@/services/publishers-service';
import type { Publisher, PublisherFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function PublisherInitials({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
      : name.slice(0, 2).toUpperCase();

  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ];
  const colorIndex =
    name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${colors[colorIndex]}`}
    >
      <span className="select-none text-sm font-bold text-white">{initials}</span>
    </div>
  );
}

export default function Publishers() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  useEffect(() => {
    void loadPublishers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPublishers = async () => {
    try {
      setLoading(true);
      const data = await publishersService.getAll();
      setPublishers(data);
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
    setSelectedPublisher(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (publisher: Publisher) => {
    setSelectedPublisher(publisher);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.publishers.deleteTitle'),
      description: t('pages.publishers.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await publishersService.delete(id);
      toast({
        title: t('pages.publishers.deleted'),
        description: t('pages.publishers.deletedDesc'),
      });
      void loadPublishers();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: PublisherFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedPublisher) {
        await publishersService.update(selectedPublisher.id, data);
        toast({
          title: t('pages.publishers.updated'),
          description: t('pages.publishers.updatedDesc'),
        });
      } else {
        await publishersService.create(data);
        toast({
          title: t('pages.publishers.created'),
          description: t('pages.publishers.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadPublishers();
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

  const filteredPublishers = publishers.filter(
    (publisher) =>
      publisher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (publisher.country?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.publishers.title')} icon={<Building2 />}>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.publishers.newBtn')}
        </Button>
      </PageHeader>

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder={t('pages.publishers.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      {filteredPublishers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? t('pages.publishers.emptySearch')
              : t('pages.publishers.emptyState')
          }
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {filteredPublishers.map((publisher) => (
            <Card key={publisher.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PublisherInitials name={publisher.name} />
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">
                        {publisher.name}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        {publisher.country
                          ? t('pages.publishers.countries.' + publisher.country, {
                              defaultValue: publisher.country_display,
                            })
                          : publisher.country_display}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-xs">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(publisher)}
                      aria-label={t('common.actions.edit')}
                      title={t('common.actions.edit')}
                    >
                      <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(publisher.id)}
                      aria-label={t('common.actions.delete')}
                      title={t('common.actions.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3">
                {publisher.founded_year && (
                  <div className="flex items-center gap-sm">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs font-normal">
                      {t('pages.publishers.foundedYear', {
                        year: publisher.founded_year,
                      })}
                    </Badge>
                  </div>
                )}
                {publisher.website && (
                  <div className="flex items-center gap-sm">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={publisher.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {publisher.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="mt-auto pt-sm">
                  <Badge
                    variant="secondary"
                    className="flex w-fit items-center gap-sm text-xs"
                  >
                    <BookOpen className="h-3 w-3" />
                    {t('pages.publishers.booksCount', { count: publisher.books_count })}
                  </Badge>
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
              {selectedPublisher
                ? t('pages.publishers.editTitle')
                : t('pages.publishers.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedPublisher
                ? t('pages.publishers.editDesc')
                : t('pages.publishers.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <PublisherForm
            publisher={selectedPublisher}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
