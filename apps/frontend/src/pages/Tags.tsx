import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { TagFormDialog } from '@/components/tags/TagFormDialog';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { tagsService } from '@/services/tags-service';
import type { Tag, TagFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const DEFAULT_TAG_COLOR = '#6366f1';

function getDefaultForm(): TagFormData {
  return { name: '', color: DEFAULT_TAG_COLOR };
}

function EmbeddedWrapper({ children }: { children: React.ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function Tags({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
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

  const tags = (data ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['tags'] });

  const createMutation = useMutation({
    mutationFn: (d: TagFormData) => tagsService.create(d),
    onSuccess: () => {
      toast({
        title: t('pages.tags.created'),
        description: t('pages.tags.createdDesc'),
      });
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TagFormData> }) =>
      tagsService.update(id, data),
    onSuccess: () => {
      toast({
        title: t('pages.tags.updated'),
        description: t('pages.tags.updatedDesc'),
      });
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tagsService.delete(id),
    onSuccess: () => {
      toast({
        title: t('pages.tags.deleted'),
        description: t('pages.tags.deletedDesc'),
      });
      invalidate();
    },
    onError: (e) =>
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(e),
        variant: 'destructive',
      }),
  });

  const handleCreate = () => {
    setSelected(null);
    setForm(getDefaultForm());
    setDialogOpen(true);
  };

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
      <PageHeader title={t('pages.tags.title')} icon={<TagIcon className="h-5 w-5" />}>
        <SearchInput
          placeholder={`${t('common.actions.search')}...`}
          value={search}
          onValueChange={setSearch}
          className="w-48"
        />
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.tags.newBtn')}
        </Button>
      </PageHeader>

      {isLoading ? (
        <LoadingState />
      ) : tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-10 w-10" />}
          title={t('pages.tags.emptyState')}
          action={
            !search
              ? {
                  label: t('pages.tags.newBtn'),
                  icon: <Plus className="mr-xs h-4 w-4" />,
                  onClick: handleCreate,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-sm rounded-lg border border-border bg-card px-md py-sm shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex min-w-0 flex-1 items-center gap-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span
                  className="truncate rounded-full px-sm py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}22`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {(tag as Tag & { expense_count?: number }).expense_count
                    ? t('pages.tags.expenseCount', {
                        count: (tag as Tag & { expense_count?: number }).expense_count,
                      })
                    : t('pages.tags.noExpenses')}
                </span>
              </div>
              <div className="flex shrink-0 gap-xs">
                <button
                  onClick={() => handleEdit(tag)}
                  className="rounded p-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void handleDelete(tag)}
                  className="rounded p-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
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
