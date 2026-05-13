import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { archiveSchema, type ArchiveFormData } from '@/lib/validations';
import { useAuthStore } from '@/stores/auth-store';
import type { Archive, Member } from '@/types';

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

const FILE_TYPES_ACCEPT = [
  '.txt',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.json',
  '.xml',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.zip',
  '.rar',
  '.7z',
].join(',');

interface ArchiveFormProps {
  archive?: Archive;
  members?: Member[];
  onSubmit: (data: ArchiveFormData & { file?: File }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ArchiveForm({
  archive,
  onSubmit,
  onCancel,
  isLoading = false,
}: ArchiveFormProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArchiveFormData>({
    resolver: zodResolver(archiveSchema),
    defaultValues: archive
      ? {
          title: archive.title,
          category: archive.category as ArchiveFormData['category'],
          archive_type: archive.archive_type as ArchiveFormData['archive_type'],
          text_content: archive.text_content || '',
          notes: archive.notes || '',
          tags: archive.tags?.join(', ') || '',
          owner: archive.owner,
        }
      : {
          title: '',
          category: 'personal' as const,
          archive_type: 'other' as const,
          text_content: '',
          notes: '',
          tags: '',
          owner: user?.id || 0,
        },
  });

  const handleFormSubmit = handleSubmit((data: ArchiveFormData) => {
    const fileInput = document.getElementById('file') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    // Validação: para novos arquivos, deve ter arquivo OU conteúdo de texto
    if (!archive && !file && data.archive_type !== 'text') {
      alert(t('pages.archives.form.alertSelectFile'));
      return;
    }

    if (!archive && data.archive_type === 'text' && !data.text_content) {
      alert(t('pages.archives.form.alertEnterText'));
      return;
    }

    // Use logged-in user as owner for new archives
    const submitData: ArchiveFormData & { file?: File } = {
      ...data,
      owner: archive ? data.owner : user?.id || 0,
      file,
    };

    // Durante update, se text_content estiver vazio e o tipo não for 'text',
    // não enviar o campo para preservar conteúdo existente
    if (archive && !data.text_content && data.archive_type !== 'text') {
      delete submitData.text_content;
    }

    // Durante update de arquivo tipo texto, se text_content estiver vazio,
    // não enviar para preservar o conteúdo existente (exceto se usuário realmente quer limpar)
    if (
      archive &&
      data.archive_type === 'text' &&
      !data.text_content &&
      archive.archive_type === 'text'
    ) {
      // Avisar que não pode deixar vazio
      alert(t('pages.archives.form.alertTextNotEmpty'));
      return;
    }

    onSubmit(submitData);
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-md">
      <div className="grid grid-cols-2 gap-md">
        <div className="col-span-2">
          <Label htmlFor="title">{t('pages.archives.form.titleLabel')}</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder={t('pages.archives.form.titlePlaceholder')}
          />
          {errors.title && (
            <p className="mt-xs text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="category">{t('pages.archives.form.categoryLabel')}</Label>
          <Select
            value={watch('category')}
            onValueChange={(value) =>
              setValue('category', value as ArchiveFormData['category'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARCHIVE_CATEGORY_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`pages.archives.categories.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="mt-xs text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="archive_type">{t('pages.archives.form.typeLabel')}</Label>
          <Select
            value={watch('archive_type')}
            onValueChange={(value) =>
              setValue('archive_type', value as ArchiveFormData['archive_type'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARCHIVE_TYPE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`pages.archives.types.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.archive_type && (
            <p className="mt-xs text-sm text-destructive">
              {errors.archive_type.message}
            </p>
          )}
        </div>

        {watch('archive_type') === 'text' ? (
          <div className="col-span-2">
            <Label htmlFor="text_content">
              {t('pages.archives.form.contentLabel')}
            </Label>
            <Textarea
              id="text_content"
              {...register('text_content')}
              placeholder={t('pages.archives.form.contentPlaceholder')}
              rows={10}
              className="font-mono text-sm"
            />
            {errors.text_content && (
              <p className="mt-xs text-sm text-destructive">
                {errors.text_content.message}
              </p>
            )}
            <p className="mt-xs text-xs">{t('pages.archives.form.textContentHint')}</p>
          </div>
        ) : (
          <div className="col-span-2">
            <Label htmlFor="file">
              {t('pages.archives.form.fileLabel')}
              {!archive && ' *'}
            </Label>
            <FileInput id="file" accept={FILE_TYPES_ACCEPT} onChange={() => {}} />
            {archive ? (
              <p className="mt-xs text-xs text-warning">
                {t('pages.archives.form.fileHintEdit')}
              </p>
            ) : (
              <p className="mt-xs text-xs">{t('pages.archives.form.fileHintNew')}</p>
            )}
          </div>
        )}

        <div className="col-span-2">
          <Label htmlFor="tags">{t('pages.archives.form.tagsLabel')}</Label>
          <Input
            id="tags"
            {...register('tags')}
            placeholder={t('pages.archives.form.tagsPlaceholder')}
          />
          {errors.tags && (
            <p className="mt-xs text-sm text-destructive">{errors.tags.message}</p>
          )}
          <p className="mt-xs text-xs">{t('pages.archives.form.tagsHint')}</p>
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">{t('pages.archives.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.archives.form.notesPlaceholder')}
            rows={3}
          />
          {errors.notes && (
            <p className="mt-xs text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : (
            t('common.actions.save')
          )}
        </Button>
      </div>
    </form>
  );
}
