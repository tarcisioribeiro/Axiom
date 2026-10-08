/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, Pencil, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { TagFormDialog } from '@/components/tags/TagFormDialog';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { tagsService } from '@/services/tags-service';
import type { Tag, TagFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const DEFAULT_TAG_COLOR = 'primary';
const TAGS_PAGE_SIZE = 5;

function getDefaultForm(): TagFormData {
  return { name: '', color: DEFAULT_TAG_COLOR };
}

function EmbeddedWrapper({ children }: { children: React.ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function Tags({
  embedded = false,
  newTagRef,
}: {
  embedded?: boolean;
  newTagRef?: RefObject<(() => void) | undefined>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Tag | null>(null);
  const [form, setForm] = useState<TagFormData>(getDefaultForm());

  const { data, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await tagsService.getAll();
      return res.results ?? [];
    },
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const colorOptions = useMemo(
    () => Array.from(new Set((data ?? []).map((tag) => tag.color))).sort(),
    [data]
  );

  const tags = (data ?? []).filter(
    (t) =>
      (colorFilter === 'all' || t.color === colorFilter) &&
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['tags'] });

  const createMutation = useMutation({
    mutationFn: (d: TagFormData) => tagsService.create(d),
    onSuccess: () => {
      toast({
        title: t('pages.tags.created'),
      });
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(e) }),
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TagFormData> }) =>
      tagsService.update(id, data),
    onSuccess: () => {
      toast({
        title: t('pages.tags.updated'),
      });
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(e) }),
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tagsService.delete(id),
    onSuccess: () => {
      toast({
        title: t('pages.tags.deleted'),
      });
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(e) }),
        variant: 'destructive',
      }),
  });

  const handleCreate = () => {
    setSelected(null);
    setForm(getDefaultForm());
    setDialogOpen(true);
  };

  useEffect(() => {
    if (newTagRef) {
      newTagRef.current = handleCreate;
    }
  });

  const handleEdit = (tag: Tag) => {
    setSelected(tag);
    setForm({ name: tag.name, color: tag.color });
    setDialogOpen(true);
  };

  const handleDelete = async (tag: Tag) => {
    const confirmed = await showConfirm({
      title: t('pages.tags.deleteTitle'),
      description: t('pages.tags.deleteDesc'),
      confirmText: t('common.actions.delete'),
      variant: 'destructive',
    });
    if (confirmed) deleteMutation.mutate(tag.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const duplicate = (data ?? []).some(
      (t) =>
        t.id !== selected?.id &&
        t.name.toLowerCase() === form.name.trim().toLowerCase() &&
        t.color.toLowerCase() === form.color.toLowerCase()
    );
    if (duplicate) {
      toast({
        title: t('pages.tags.duplicateError'),
        variant: 'destructive',
      });
      return;
    }

    if (selected) {
      updateMutation.mutate({ id: selected.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <FilterBar
        hasActiveFilters={!!search || colorFilter !== 'all'}
        onClear={() => {
          setSearch('');
          setColorFilter('all');
        }}
        activeFilters={[
          ...(colorFilter !== 'all'
            ? [
                {
                  key: 'color',
                  label: `${t('pages.tags.allColors')}: ${t(`common.colorTokens.${colorFilter}`, colorFilter)}`,
                  onRemove: () => setColorFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')}>
          <SearchInput
            placeholder={`${t('common.actions.search')}...`}
            value={search}
            onValueChange={setSearch}
          />
        </FilterField>
        <FilterField label={t('common.filterLabels.color')}>
          <Select value={colorFilter} onValueChange={setColorFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.tags.allColors')}
              startIcon={<Palette className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.tags.allColors')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.tags.allColors')}</SelectItem>
              {colorOptions.map((color) => (
                <SelectItem
                  key={color}
                  value={color}
                  icon={
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: `hsl(var(--${color}))` }}
                    />
                  }
                >
                  {t(`common.colorTokens.${color}`, color)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? (
        <LoadingState />
      ) : tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-10 w-10" />}
          title={t('pages.tags.emptyState')}
        />
      ) : (
        <PaginatedSlide
          key={`${search}-${colorFilter}`}
          items={tags}
          pageSize={TAGS_PAGE_SIZE}
          centerList
          className="gap-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {(pageItems) =>
            pageItems.map((tag) => (
              <div
                key={tag.id}
                className="gap-sm border-border bg-card px-md py-sm flex items-center justify-between rounded-lg border transition-colors"
              >
                <div className="gap-sm flex min-w-0 flex-1 items-center">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(var(--${tag.color}))` }}
                  />
                  <span
                    className="px-sm truncate rounded-full py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `hsl(var(--${tag.color}) / 0.13)`,
                      color: `hsl(var(--${tag.color}))`,
                    }}
                  >
                    {tag.name}
                  </span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                    {(tag as Tag & { expense_count?: number }).expense_count
                      ? t('pages.tags.expenseCount', {
                          count: (tag as Tag & { expense_count?: number })
                            .expense_count,
                        })
                      : t('pages.tags.noExpenses')}
                  </span>
                </div>
                <div className="gap-xs flex shrink-0">
                  <PlainButton
                    aria-label={t('common.actions.edit')}
                    onClick={() => handleEdit(tag)}
                    className="p-xs text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </PlainButton>
                  <PlainButton
                    aria-label={t('common.actions.delete')}
                    onClick={() => void handleDelete(tag)}
                    className="p-xs text-destructive hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </PlainButton>
                </div>
              </div>
            ))
          }
        </PaginatedSlide>
      )}

      <TagFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selected={selected}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isPending={isPending}
      />
    </Wrapper>
  );
}
