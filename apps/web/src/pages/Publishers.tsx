/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Building2, Calendar, Globe, Plus, Search } from 'lucide-react';
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
import { PublisherForm } from '@/components/library/PublisherForm';
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
import { publishersService } from '@/services/publishers-service';
import type { Publisher, PublisherFormData } from '@/types';
import { COUNTRIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

/** Avatar com as iniciais da editora, em cor neutra do tema (§9). */
function PublisherInitials({
  name,
  size = 'sm',
}: {
  name: string;
  size?: 'sm' | 'lg';
}) {
  const words = name.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        'bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-lg font-bold select-none',
        size === 'sm' ? 'h-10 w-10 text-sm' : 'h-16 w-16 text-lg'
      )}
    >
      {initials}
    </div>
  );
}

function usePublisherLabels() {
  const { t } = useTranslation();
  const country = (p: Publisher) =>
    p.country
      ? t(`pages.publishers.countries.${p.country}`, {
          defaultValue: p.country_display,
        })
      : p.country_display;
  const books = (p: Publisher) =>
    p.books_count === 0
      ? t('pages.publishers.booksCountZero')
      : t('pages.publishers.booksCount', { count: p.books_count });
  return { country, books };
}

/** Card de grade (§5): iniciais + nome + país + nº de livros; resto no detalhe. */
function PublisherCard({
  publisher,
  onOpen,
  onEdit,
  onDelete,
}: {
  publisher: Publisher;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const labels = usePublisherLabels();
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
        <PublisherInitials name={publisher.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{publisher.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {labels.country(publisher)}
          </p>
        </div>
        <span className="gap-xs text-muted-foreground flex shrink-0 items-center text-xs">
          <BookOpen className="h-3.5 w-3.5" />
          {labels.books(publisher)}
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

function PublisherDetailModal({
  publisher,
  onClose,
}: {
  publisher: Publisher | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const labels = usePublisherLabels();
  return (
    <Dialog open={!!publisher} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        {publisher && (
          <>
            <DialogHeader>
              <DialogTitle icon={Building2}>{publisher.name}</DialogTitle>
              <VisuallyHidden>
                <DialogDescription>
                  {t('pages.publishers.detailDesc')}
                </DialogDescription>
              </VisuallyHidden>
            </DialogHeader>
            <div className="gap-md flex items-start">
              <PublisherInitials name={publisher.name} size="lg" />
              <div className="space-y-sm min-w-0 flex-1 text-sm">
                <p className="gap-xs flex items-center">
                  <Globe className="text-muted-foreground h-4 w-4" />
                  {labels.country(publisher)}
                </p>
                {publisher.founded_year && (
                  <p className="gap-xs flex items-center">
                    <Calendar className="text-muted-foreground h-4 w-4" />
                    {t('pages.publishers.foundedYear', {
                      year: publisher.founded_year,
                    })}
                  </p>
                )}
                {publisher.website && (
                  <a
                    href={publisher.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-xs text-primary flex items-center truncate hover:underline"
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    {publisher.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <p className="gap-xs flex items-center">
                  <BookOpen className="text-muted-foreground h-4 w-4" />
                  {labels.books(publisher)}
                </p>
              </div>
            </div>
            <DialogCloseFooter>
              {publisher.books_count > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigate(
                      `/library/books?search=${encodeURIComponent(publisher.name)}`
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

const EMPTY_PUBLISHERS: Publisher[] = [];

export default function Publishers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailPublisher, setDetailPublisher] = useState<Publisher | undefined>();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: publishers = EMPTY_PUBLISHERS, isLoading: loading } = useQuery({
    queryKey: ['publishers'],
    queryFn: async () => {
      try {
        return await publishersService.getAllPages();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return EMPTY_PUBLISHERS;
      }
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['publishers'] });

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
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
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
        });
      } else {
        await publishersService.create(data);
        toast({
          title: t('pages.publishers.created'),
        });
      }
      setIsDialogOpen(false);
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

  const filteredPublishers = publishers.filter(
    (publisher) =>
      (countryFilter === 'all' || publisher.country === countryFilter) &&
      (publisher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (publisher.country?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.publishers.title')} icon={<Building2 />}>
        <Can action="add">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            {t('pages.publishers.newBtn')}
          </Button>
        </Can>
      </PageHeader>

      <FilterBar
        hasActiveFilters={!!searchTerm || countryFilter !== 'all'}
        onClear={() => {
          setSearchTerm('');
          setCountryFilter('all');
        }}
        activeFilters={[
          ...(countryFilter !== 'all'
            ? [
                {
                  key: 'country',
                  label: `${t('pages.publishers.allCountries')}: ${t(`pages.publishers.countries.${countryFilter}`)}`,
                  onRemove: () => setCountryFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.publishers.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.filterLabels.country')} icon={Globe}>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger
              className="w-44"
              aria-label={t('pages.publishers.allCountries')}
              startIcon={<Globe className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.publishers.allCountries')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.publishers.allCountries')}</SelectItem>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {t(`pages.publishers.countries.${country.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {filteredPublishers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm
              ? t('pages.publishers.emptySearch')
              : t('pages.publishers.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={`${searchTerm}-${countryFilter}`}
          items={filteredPublishers}
          pageSize={GRID_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {(pageItems) =>
            pageItems.map((publisher) => (
              <PublisherCard
                key={publisher.id}
                publisher={publisher}
                onOpen={() => setDetailPublisher(publisher)}
                onEdit={() => handleEdit(publisher)}
                onDelete={() => void handleDelete(publisher.id)}
              />
            ))
          }
        </PaginatedSlide>
      )}

      <PublisherDetailModal
        publisher={detailPublisher}
        onClose={() => setDetailPublisher(undefined)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle mode={selectedPublisher ? 'edit' : 'create'}>
              {selectedPublisher
                ? t('pages.publishers.editTitle')
                : t('pages.publishers.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedPublisher
                  ? t('pages.publishers.editDesc')
                  : t('pages.publishers.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
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
