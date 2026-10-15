import {
  ArchiveIcon,
  CalendarDays,
  Download,
  Eye,
  File,
  FileText,
  HardDrive,
  Shapes,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { ACTION_COLOR } from '@/lib/action-colors';
import { formatDate, formatFileSize } from '@/lib/formatters';
import type { Archive } from '@/types';

interface Props {
  archive: Archive | null;
  onOpenContent: (archive: Archive) => void;
  onPreview: (archive: Archive) => void;
  onClose: () => void;
}

/** Detalhe do arquivo (§2.3): somente leitura, Fechar à esquerda. */
export function ArchiveDetailModal({
  archive: selected,
  onOpenContent,
  onPreview,
  onClose,
}: Props) {
  const { t } = useTranslation();
  // Mantém o último arquivo para o modal sair inteiro na animação de fechamento.
  const [archive, setArchive] = useState(selected);
  if (selected && selected !== archive) setArchive(selected);

  if (!archive) return null;

  const isText = archive.archive_type === 'text';
  const canPreview = archive.archive_type === 'image' || archive.archive_type === 'pdf';

  const fields = [
    {
      icon: Tag,
      label: t('common.fields.category'),
      value: t(`pages.archives.categories.${archive.category}`),
    },
    {
      icon: Shapes,
      label: t('common.fields.type'),
      value: t(`pages.archives.types.${archive.archive_type}`),
    },
    {
      icon: CalendarDays,
      label: t('common.fields.createdAt'),
      value: formatDate(archive.created_at),
    },
    {
      icon: HardDrive,
      label: t('pages.archives.fileSize', { defaultValue: 'Tamanho' }),
      value: formatFileSize(archive.file_size),
    },
    ...(archive.file_name
      ? [
          {
            icon: File,
            label: t('pages.archives.form.fileLabel'),
            value: archive.file_name,
          },
        ]
      : []),
  ];

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle icon={ArchiveIcon}>{archive.title}</DialogTitle>
          <DialogDescription>{archive.title}</DialogDescription>
        </DialogHeader>

        <div className="gap-md grid grid-cols-2">
          {fields.map(({ icon: Icon, label, value }) => (
            <div key={label} className="min-w-0">
              <p className="gap-xs text-muted-foreground flex items-center text-xs">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </p>
              <p className="truncate font-semibold" title={value}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {archive.tags && archive.tags.length > 0 && (
          <div className="min-w-0">
            <p className="gap-xs mb-xs text-muted-foreground flex items-center text-xs">
              <Tag className="h-3.5 w-3.5" />
              {t('pages.archives.form.tagsLabel')}
            </p>
            <div className="gap-xs flex flex-wrap">
              {archive.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {archive.notes && (
          <div className="min-w-0">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <FileText className="h-3.5 w-3.5" />
              {t('common.fields.notes')}
            </p>
            <p className="text-sm">{archive.notes}</p>
          </div>
        )}

        <DialogCloseFooter>
          <div className="gap-sm flex flex-wrap justify-end">
            {canPreview && (
              <Button variant="outline" onClick={() => onPreview(archive)}>
                <Eye className={ACTION_COLOR.preview} />
                {t('pages.archives.preview', { defaultValue: 'Pré-visualizar' })}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenContent(archive)}>
              {isText ? (
                <FileText className={ACTION_COLOR.preview} />
              ) : (
                <Download className={ACTION_COLOR.download} />
              )}
              {isText ? t('pages.archives.viewContent') : t('common.actions.download')}
            </Button>
          </div>
        </DialogCloseFooter>
      </DialogContent>
    </Dialog>
  );
}
