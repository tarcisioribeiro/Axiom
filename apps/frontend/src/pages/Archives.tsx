/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveIcon,
  Calendar,
  Copy,
  Download,
  Eye,
  File,
  FileText,
  Plus,
  Search,
  Shapes,
  Star,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { ArchiveDetailModal } from '@/components/security/ArchiveDetailModal';
import { ArchiveForm } from '@/components/security/ArchiveForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultItemCard } from '@/components/security/VaultItemCard';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { ARCHIVE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useCurrentScreen } from '@/hooks/use-screen-access';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatFileSize } from '@/lib/formatters';
import { cn, copyToClipboard } from '@/lib/utils';
import { archivesService } from '@/services/archives-service';
import { membersService } from '@/services/members-service';
import type { Archive, ArchiveFormData, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const TYPE_CONFIG: Record<string, { icon: string }> = {
  text: { icon: 'bg-info/10 text-info' },
  pdf: { icon: 'bg-destructive/10 text-destructive' },
  image: { icon: 'bg-success/10 text-success' },
  document: { icon: 'bg-primary/10 text-primary' },
  other: { icon: 'bg-warning/10 text-warning' },
};

const ARCHIVE_CATEGORY_KEYS = [
  'personal',
  'financial',
  'legal',
  'medical',
  'tax',
  'work',
  'other',
] as const;

const ARCHIVE_TYPE_KEYS = ['text', 'pdf', 'image', 'document', 'other'] as const;

function ArchivesContent() {
  const { can } = useCurrentScreen();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<Archive | undefined>();
  const [detailArchive, setDetailArchive] = useState<Archive | null>(null);
  const [revealedContent, setRevealedContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  // #197 — inline preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const { data, isLoading } = useQuery({
    queryKey: ['archives'],
    queryFn: async () => {
      try {
        const [archivesData, membersData] = await Promise.all([
          archivesService.getAll(),
          membersService.getAll(),
        ]);
        return { archives: archivesData, members: membersData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return { archives: [] as Archive[], members: [] as Member[] };
      }
    },
  });
  const archives = data?.archives ?? [];
  const members = data?.members ?? [];

  const handleCreate = () => {
    setSelectedArchive(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = async (archive: Archive) => {
    // Se for arquivo de texto, carregar o conteúdo descriptografado
    if (archive.archive_type === 'text' && archive.has_text) {
      try {
        const data = await archivesService.reveal(archive.id);
        if (data.error) {
          toast({
            title: t('pages.archives.loadContentError', { reason: data.error }),
            variant: 'destructive',
          });
          setSelectedArchive(archive);
        } else {
          setSelectedArchive({
            ...archive,
            text_content: data.text_content ?? undefined,
          });
        }
      } catch (error: unknown) {
        toast({
          title: t('pages.archives.loadContentError', {
            reason: getErrorMessage(error),
          }),
          variant: 'destructive',
        });
        setSelectedArchive(archive);
      }
    } else {
      setSelectedArchive(archive);
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.archives.deleteTitle'),
      description: t('pages.archives.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await archivesService.delete(id);
      toast({
        title: t('pages.archives.deleted'),
      });
      void queryClient.invalidateQueries({ queryKey: ['archives'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  // #197 — inline preview for images and PDFs
  const handlePreview = async (archive: Archive) => {
    const { archive_type: type } = archive;
    if (type !== 'image' && type !== 'pdf') return;
    try {
      const { url } = await archivesService.getDownloadUrl(archive.id);
      const response = await fetch(url);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(body?.detail ?? response.statusText);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setPreviewType(type);
    } catch (error: unknown) {
      toast({
        title: t('pages.archives.downloadError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleRevealContent = async (archive: Archive) => {
    if (archive.archive_type !== 'text') {
      toast({
        title: t('pages.archives.onlyTextViewable'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSelectedArchive(archive);
      const data = await archivesService.reveal(archive.id);

      if (data.error) {
        toast({
          title: data.error,
          variant: 'destructive',
        });
        return;
      }

      if (data.text_content == null) {
        toast({
          title: t('pages.archives.emptyContent'),
          variant: 'destructive',
        });
        return;
      }

      setRevealedContent(data.text_content);
      setIsContentDialogOpen(true);
      toast({
        title: t('pages.archives.contentRevealed'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.archives.revealContentError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (archive: Archive) => {
    if (archive.archive_type === 'text') {
      // Para texto, revelar conteúdo ao invés de download
      void handleRevealContent(archive);
      return;
    }

    try {
      const { url, filename } = await archivesService.getDownloadUrl(archive.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || archive.file_name || `${archive.title}.bin`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: t('pages.archives.downloadStarted'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.archives.downloadError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: ArchiveFormData & { file?: File }) => {
    try {
      setIsSubmitting(true);
      if (selectedArchive) {
        await archivesService.update(selectedArchive.id, data);
        toast({
          title: t('pages.archives.updated'),
        });
      } else {
        await archivesService.create(data);
        toast({
          title: t('pages.archives.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['archives'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const updated = await archivesService.toggleFavorite(id);
      queryClient.setQueryData<typeof data>(['archives'], (prev) =>
        prev
          ? { ...prev, archives: prev.archives.map((a) => (a.id === id ? updated : a)) }
          : prev
      );
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const filteredArchives = archives.filter((arc) => {
    if (showFavoritesOnly && !arc.is_favorite) return false;
    if (categoryFilter !== 'all' && arc.category !== categoryFilter) return false;
    if (typeFilter !== 'all' && arc.archive_type !== typeFilter) return false;
    if (!searchTerm) return true;
    return (
      arc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      arc.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      arc.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <>
      <PageContainer>
        <PageHeader title={t('pages.archives.title')} icon={<ArchiveIcon />}>
          {can('add') && (
            <Button onClick={handleCreate} className="gap-sm">
              <Plus className="h-4 w-4" />
              {t('pages.archives.newBtn')}
            </Button>
          )}
        </PageHeader>

        <FilterBar
          hasActiveFilters={
            !!searchTerm ||
            showFavoritesOnly ||
            categoryFilter !== 'all' ||
            typeFilter !== 'all'
          }
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
            setCategoryFilter('all');
            setTypeFilter('all');
          }}
          activeFilters={[
            ...(categoryFilter !== 'all'
              ? [
                  {
                    key: 'category',
                    label: `${t('common.fields.category')}: ${t(`pages.archives.categories.${categoryFilter}`)}`,
                    onRemove: () => setCategoryFilter('all'),
                  },
                ]
              : []),
            ...(typeFilter !== 'all'
              ? [
                  {
                    key: 'type',
                    label: `${t('common.fields.type')}: ${t(`pages.archives.types.${typeFilter}`)}`,
                    onRemove: () => setTypeFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.archives.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-52 sm:w-64"
            />
          </FilterField>
          <FilterField label={t('common.fields.category')} icon={Tag}>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-40"
                aria-label={t('pages.archives.allCategories')}
                startIcon={<Tag className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.archives.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.archives.allCategories')}</SelectItem>
                {ARCHIVE_CATEGORY_KEYS.map((key) => {
                  const Icon = ARCHIVE_CATEGORY_ICONS[key];
                  return (
                    <SelectItem
                      key={key}
                      value={key}
                      icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                    >
                      {t(`pages.archives.categories.${key}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.type')} icon={Shapes}>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-36"
                aria-label={t('pages.archives.allTypes')}
                startIcon={<FileText className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.archives.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.archives.allTypes')}</SelectItem>
                {ARCHIVE_TYPE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`pages.archives.types.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('common.actions.favorites')}
          </Button>
        </FilterBar>

        {filteredArchives.length === 0 ? (
          <EmptyState
            icon={<ArchiveIcon className="text-muted-foreground h-12 w-12" />}
            title={
              searchTerm
                ? t('pages.archives.emptySearch')
                : t('pages.archives.emptyState')
            }
          />
        ) : (
          <PaginatedSlide
            key={`${searchTerm}-${categoryFilter}-${typeFilter}-${showFavoritesOnly}`}
            items={filteredArchives}
            pageSize={GRID_PAGE_SIZE}
            className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {(pageItems) =>
              pageItems.map((arc) => {
                const isText = arc.archive_type === 'text';
                const TypeIcon = isText ? FileText : File;
                return (
                  <VaultItemCard
                    key={arc.id}
                    avatar={
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                          (TYPE_CONFIG[arc.archive_type] ?? TYPE_CONFIG.other).icon
                        )}
                      >
                        <TypeIcon className="h-5 w-5" />
                      </div>
                    }
                    title={arc.title}
                    subtitle={t(`pages.archives.categories.${arc.category}`)}
                    badge={
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {t(`pages.archives.types.${arc.archive_type}`)}
                      </Badge>
                    }
                    metric={
                      <span className="gap-xs text-muted-foreground flex items-center text-xs">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(arc.created_at)}
                        {arc.file_size ? ` · ${formatFileSize(arc.file_size)}` : ''}
                      </span>
                    }
                    isFavorite={arc.is_favorite}
                    onOpen={() => setDetailArchive(arc)}
                    onFavorite={() => void handleToggleFavorite(arc.id)}
                    onEdit={() => void handleEdit(arc)}
                    onDelete={() => void handleDelete(arc.id)}
                    menuActions={[
                      {
                        icon: isText ? Eye : Download,
                        label: isText
                          ? t('pages.archives.viewContent')
                          : t('pages.archives.downloadFile'),
                        onClick: () => void handleDownload(arc),
                        color: isText ? ('preview' as const) : ('download' as const),
                        action: 'reveal',
                      },
                      ...(arc.archive_type === 'image' || arc.archive_type === 'pdf'
                        ? [
                            {
                              icon: Eye,
                              label: t('pages.archives.preview', {
                                defaultValue: 'Pré-visualizar',
                              }),
                              onClick: () => void handlePreview(arc),
                              color: 'preview' as const,
                              action: 'reveal',
                            },
                          ]
                        : []),
                    ]}
                  />
                );
              })
            }
          </PaginatedSlide>
        )}

        <ArchiveDetailModal
          archive={detailArchive}
          onOpenContent={(arc) => void handleDownload(arc)}
          onPreview={(arc) => void handlePreview(arc)}
          onClose={() => setDetailArchive(null)}
        />

        {/* Dialog para criar/editar arquivo */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle mode={selectedArchive ? 'edit' : 'create'}>
                {selectedArchive
                  ? t('pages.archives.editTitle')
                  : t('pages.archives.newTitle')}
              </DialogTitle>
              <DialogDescription>
                {selectedArchive
                  ? t('pages.archives.editDesc')
                  : t('pages.archives.newDesc')}
              </DialogDescription>
            </DialogHeader>
            <ArchiveForm
              archive={selectedArchive}
              members={members}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog para visualizar conteúdo de texto */}
        <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle icon={FileText}>{selectedArchive?.title}</DialogTitle>
              <DialogDescription>
                {t('pages.archives.decryptedContentDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-md">
              <Textarea
                value={revealedContent}
                readOnly
                rows={20}
                className="text-sm"
              />
            </div>
            <DialogCloseFooter>
              <Button
                variant="outline"
                onClick={() => {
                  void copyToClipboard(revealedContent);
                  toast({
                    title: t('common.messages.copied'),
                  });
                }}
              >
                <Copy className="h-4 w-4" />
                {t('common.actions.copy')}
              </Button>
            </DialogCloseFooter>
          </DialogContent>
        </Dialog>

        {/* #197 — Inline preview dialog for images and PDFs */}
        <Dialog
          open={!!previewUrl}
          onOpenChange={(open) => {
            if (!open) {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
              setPreviewType(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle icon={Eye}>
                {t('pages.archives.preview', { defaultValue: 'Pré-visualização' })}
              </DialogTitle>
              <DialogDescription>
                {t('pages.archives.preview', { defaultValue: 'Pré-visualização' })}
              </DialogDescription>
            </DialogHeader>
            {previewType === 'image' && previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            ) : previewType === 'pdf' && previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-[70vh] w-full rounded-md border"
                title="PDF Preview"
              />
            ) : null}
            <DialogCloseFooter />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </>
  );
}

// Os dados do cofre só são buscados depois do desbloqueio (o conteúdo monta dentro do guard).
export default function Archives() {
  return (
    <VaultGuard>
      <ArchivesContent />
    </VaultGuard>
  );
}
