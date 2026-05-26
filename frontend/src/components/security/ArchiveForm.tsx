/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  File,
  FileImage,
  FileText,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Package,
  Tag,
  Upload,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-input';
import { FormSection } from '@/components/ui/form-section';
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
import { ARCHIVE_CATEGORY_ICONS } from '@/config/icons';
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

const ARCHIVE_TYPE_OPTIONS = [
  { value: 'text', icon: FileText, translationKey: 'text' },
  { value: 'pdf', icon: File, translationKey: 'pdf' },
  { value: 'image', icon: FileImage, translationKey: 'image' },
  { value: 'document', icon: FileText, translationKey: 'document' },
  { value: 'other', icon: Package, translationKey: 'other' },
] as const;

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

    if (!archive && !file && data.archive_type !== 'text') {
      alert(t('pages.archives.form.alertSelectFile'));
      return;
    }

    if (!archive && data.archive_type === 'text' && !data.text_content) {
      alert(t('pages.archives.form.alertEnterText'));
      return;
    }

    const submitData: ArchiveFormData & { file?: File } = {
      ...data,
      owner: archive ? data.owner : user?.id || 0,
      file,
    };

    if (archive && !data.text_content && data.archive_type !== 'text') {
      delete submitData.text_content;
    }

    if (
      archive &&
      data.archive_type === 'text' &&
      !data.text_content &&
      archive.archive_type === 'text'
    ) {
      alert(t('pages.archives.form.alertTextNotEmpty'));
      return;
    }

    onSubmit(submitData);
  });

  const watchedArchiveType = watch('archive_type');

  return (
    <form onSubmit={handleFormSubmit} className="space-y-lg">
      <FormSection
        title={t('pages.archives.form.sectionIdentification')}
        icon={FileText}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="title" className="flex items-center gap-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.archives.form.titleLabel')}
            </Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('pages.archives.form.titlePlaceholder')}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-xs text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.archives.form.categoryLabel')}
            </Label>
            <Select
              value={watch('category')}
              onValueChange={(value) =>
                setValue('category', value as ArchiveFormData['category'])
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARCHIVE_CATEGORY_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {(() => {
                        const CatIcon = ARCHIVE_CATEGORY_ICONS[key];
                        return CatIcon ? <CatIcon className="h-4 w-4" /> : null;
                      })()}
                      {t(`pages.archives.categories.${key}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="mt-xs text-sm text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.archives.form.sectionTypeContent')} icon={Upload}>
        <div className="space-y-md">
          {/* Adaptação visual: toggle de tipo com ícones */}
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.archives.form.typeLabel')}
            </Label>
            <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
              {ARCHIVE_TYPE_OPTIONS.map(({ value, icon: Icon, translationKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('archive_type', value)}
                  disabled={isLoading}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                    watchedArchiveType === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {t(`pages.archives.types.${translationKey}`)}
                  </span>
                </button>
              ))}
            </div>
            {errors.archive_type && (
              <p className="mt-xs text-sm text-destructive">
                {errors.archive_type.message}
              </p>
            )}
          </div>

          {watchedArchiveType === 'text' ? (
            <div className="space-y-sm">
              <Label htmlFor="text_content" className="flex items-center gap-xs">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.archives.form.contentLabel')}
              </Label>
              <Textarea
                id="text_content"
                {...register('text_content')}
                placeholder={t('pages.archives.form.contentPlaceholder')}
                rows={10}
                className="font-mono text-sm"
                disabled={isLoading}
              />
              {errors.text_content && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.text_content.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('pages.archives.form.textContentHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-sm">
              <Label htmlFor="file" className="flex items-center gap-xs">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.archives.form.fileLabel')}
                {!archive && ' *'}
              </Label>
              <FileInput id="file" accept={FILE_TYPES_ACCEPT} onChange={() => {}} />
              {archive ? (
                <p className="text-xs text-warning">
                  {t('pages.archives.form.fileHintEdit')}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('pages.archives.form.fileHintNew')}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.archives.form.sectionOrganization')} icon={Tag}>
        <div className="grid gap-md">
          <div className="space-y-sm">
            <Label htmlFor="tags" className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.archives.form.tagsLabel')}
            </Label>
            <Input
              id="tags"
              {...register('tags')}
              placeholder={t('pages.archives.form.tagsPlaceholder')}
              disabled={isLoading}
            />
            {errors.tags && (
              <p className="mt-xs text-sm text-destructive">{errors.tags.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('pages.archives.form.tagsHint')}
            </p>
          </div>

          <div className="space-y-sm">
            <Label htmlFor="notes" className="flex items-center gap-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.archives.form.notesLabel')}
            </Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder={t('pages.archives.form.notesPlaceholder')}
              rows={3}
              disabled={isLoading}
            />
            {errors.notes && (
              <p className="mt-xs text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
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
