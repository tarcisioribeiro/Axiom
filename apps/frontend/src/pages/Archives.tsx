/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Download,
  Star,
  FileText,
  File,
  Archive as ArchiveIcon,
  Calendar,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { ArchiveForm } from '@/components/security/ArchiveForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { cn, copyToClipboard } from '@/lib/utils';
import { archivesService } from '@/services/archives-service';
import { membersService } from '@/services/members-service';
import type { Archive, ArchiveFormData, Member } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const TYPE_CONFIG: Record<string, { icon: string; border: string }> = {
  text: { icon: 'bg-info/10 text-info', border: 'border-l-info/60' },
  file: { icon: 'bg-warning/10 text-warning', border: 'border-l-warning/60' },
};

export default function Archives() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<Archive | undefined>();
  const [revealedContent, setRevealedContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // #197 — inline preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
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
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
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
            title: t('pages.archives.loadContentError'),
            description: data.error,
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
          title: t('pages.archives.loadContentError'),
          description: getErrorMessage(error),
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
        description: t('pages.archives.deletedDesc'),
      });
      void queryClient.invalidateQueries({ queryKey: ['archives'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // #197 — inline preview for images and PDFs
  const handlePreview = async (archive: Archive) => {
    const { archive_type: type } = archive;
    if (type !== 'image' && type !== 'pdf') return;
    try {
      setIsPreviewLoading(true);
      const { url } = await archivesService.getDownloadUrl(archive.id);
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setPreviewType(type);
    } catch (error: unknown) {
      toast({
        title: t('pages.archives.downloadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleRevealContent = async (archive: Archive) => {
    if (archive.archive_type !== 'text') {
      toast({
        title: t('pages.archives.actionNotAvailable'),
        description: t('pages.archives.onlyTextViewable'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsRevealing(true);
      setSelectedArchive(archive);
      const data = await archivesService.reveal(archive.id);

      if (data.error) {
        const title =
          data.error_type === 'decryption_failed'
            ? t('pages.archives.decryptionError')
            : t('pages.archives.contentUnavailable');
        toast({
          title,
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      if (data.text_content == null) {
        toast({
          title: t('pages.archives.emptyContentTitle'),
          description: t('pages.archives.emptyContent'),
          variant: 'destructive',
        });
        return;
      }

      setRevealedContent(data.text_content);
      setIsContentDialogOpen(true);
      toast({
        title: t('pages.archives.contentRevealed'),
        description: t('pages.archives.contentRevealedDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.archives.revealContentError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsRevealing(false);
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
        description: t('pages.archives.downloadDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.archives.downloadError'),
        description: getErrorMessage(error),
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
          description: t('pages.archives.updatedDesc'),
        });
      } else {
        await archivesService.create(data);
        toast({
          title: t('pages.archives.created'),
          description: t('pages.archives.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['archives'] });
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
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const filteredArchives = archives.filter((arc) => {
    if (showFavoritesOnly && !arc.is_favorite) return false;
    return (
      arc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      arc.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      arc.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.archives.title')} icon={<ArchiveIcon />}>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.archives.newBtn')}
          </Button>
        </PageHeader>

        <FilterBar
          hasActiveFilters={!!searchTerm || showFavoritesOnly}
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
          }}
        >
          <SearchInput
            placeholder={t('pages.archives.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
            title={t('common.actions.favorites')}
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('common.actions.favorites')}
          </Button>
        </FilterBar>

        {filteredArchives.length === 0 ? (
          <EmptyState
            icon={<ArchiveIcon className="text-muted-foreground h-12 w-12" />}
            message={
              searchTerm
                ? t('pages.archives.emptySearch')
                : t('pages.archives.emptyState')
            }
          />
        ) : (
          <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
            {filteredArchives.map((arc) => {
              const typeConfig = TYPE_CONFIG[arc.archive_type] ?? {
                icon: 'bg-muted text-muted-foreground',
                border: 'border-l-border',
              };
              return (
                <Card
                  key={arc.id}
                  className={cn('overflow-hidden border-l-2', typeConfig.border)}
                >
                  <CardHeader className="pb-sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-xs gap-sm flex items-center">
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                              typeConfig.icon
                            )}
                          >
                            {arc.archive_type === 'text' ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <File className="h-4 w-4" />
                            )}
                          </div>
                          <CardTitle className="truncate text-base">
                            {arc.title}
                          </CardTitle>
                        </div>
                        <div className="gap-sm flex flex-wrap items-center">
                          <Badge>
                            {t(`pages.archives.categories.${arc.category}`)}
                          </Badge>
                          <Badge variant="outline">
                            {t(`pages.archives.types.${arc.archive_type}`)}
                          </Badge>
                        </div>
                      </div>
                      <div className="gap-xs flex flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            arc.archive_type === 'text'
                              ? handleRevealContent(arc)
                              : handleDownload(arc)
                          }
                          disabled={isRevealing}
                          aria-label={
                            arc.archive_type === 'text'
                              ? t('pages.archives.viewContent')
                              : t('pages.archives.downloadFile')
                          }
                          title={
                            arc.archive_type === 'text'
                              ? t('pages.archives.viewContent')
                              : t('pages.archives.downloadFile')
                          }
                        >
                          {arc.archive_type === 'text' ? (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                        {(arc.archive_type === 'image' ||
                          arc.archive_type === 'pdf') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => void handlePreview(arc)}
                            disabled={isPreviewLoading}
                            aria-label={t('pages.archives.preview', {
                              defaultValue: 'Pré-visualizar',
                            })}
                            title={t('pages.archives.preview', {
                              defaultValue: 'Pré-visualizar',
                            })}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn('h-8 w-8', arc.is_favorite && 'text-warning')}
                          onClick={() => void handleToggleFavorite(arc.id)}
                          aria-label={t('common.actions.favorite')}
                          title={t('common.actions.favorite')}
                        >
                          <Star
                            className={cn('h-4 w-4', arc.is_favorite && 'fill-current')}
                            aria-hidden="true"
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(arc)}
                          aria-label={t('common.actions.edit')}
                          title={t('common.actions.edit')}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(arc.id)}
                          aria-label={t('common.actions.delete')}
                          title={t('common.actions.delete')}
                        >
                          <Trash2
                            className="text-destructive h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-sm">
                    <div className="flex items-center justify-between text-sm">
                      <div className="gap-sm flex items-center">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(arc.created_at, 'dd/MM/yyyy')}</span>
                      </div>
                      <span>{formatFileSize(arc.file_size)}</span>
                    </div>
                    {arc.tags && arc.tags.length > 0 && (
                      <div className="gap-sm flex items-center">
                        <Tag className="h-4 w-4 flex-shrink-0" />
                        <div className="gap-xs flex flex-wrap">
                          {arc.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {arc.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{arc.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog para criar/editar arquivo */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
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
          <DialogContent className="custom-scrollbar max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedArchive?.title}</DialogTitle>
              <DialogDescription>
                {t('pages.archives.decryptedContentDesc')} -{' '}
                {selectedArchive?.category
                  ? t(`pages.archives.categories.${selectedArchive.category}`)
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-md">
              <Textarea
                value={revealedContent}
                readOnly
                rows={20}
                className="font-mono text-sm"
              />
              <div className="gap-sm flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    void copyToClipboard(revealedContent);
                    toast({
                      title: t('common.messages.copied'),
                      description: t('pages.archives.copiedDesc'),
                    });
                  }}
                >
                  {t('common.actions.copy')}
                </Button>
                <Button onClick={() => setIsContentDialogOpen(false)}>
                  {t('common.actions.close')}
                </Button>
              </div>
            </div>
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
              <DialogTitle>
                {t('pages.archives.preview', { defaultValue: 'Pré-visualização' })}
              </DialogTitle>
            </DialogHeader>
            {isPreviewLoading ? (
              <div className="flex h-64 items-center justify-center">
                <span className="text-muted-foreground text-sm">
                  {t('common.actions.loading')}
                </span>
              </div>
            ) : previewType === 'image' && previewUrl ? (
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
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setPreviewType(null);
                }}
              >
                {t('common.actions.close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </VaultGuard>
  );
}
