/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  FileText,
  Globe,
  Loader2,
  User,
  UserCircle,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import { NATIONALITY_ICON } from '@/config/icons';
import { logger } from '@/lib/logger';
import { authorSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { NATIONALITIES, ERAS } from '@/types';
import type { Author, AuthorFormData } from '@/types';

interface AuthorFormProps {
  author?: Author;
  onSubmit: (data: AuthorFormData) => void;
  onCancel: () => void;
  onPhotoSelect?: (file: File | null) => void;
  isLoading?: boolean;
}

export function AuthorForm({
  author,
  onSubmit,
  onCancel,
  onPhotoSelect,
  isLoading = false,
}: AuthorFormProps) {
  const { t } = useTranslation();
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    author?.photo ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AuthorFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    resolver: zodResolver(authorSchema) as any,
    defaultValues: author
      ? {
          name: author.name,
          birth_year: author.birth_year ?? undefined,
          birth_era: author.birth_era || 'DC',
          death_year: author.death_year ?? undefined,
          death_era: author.death_era ?? undefined,
          nationality: author.nationality || 'BRA',
          biography: author.biography || '',
          owner: author.owner,
        }
      : {
          name: '',
          birth_year: undefined,
          birth_era: 'DC',
          death_year: undefined,
          death_era: undefined,
          nationality: 'BRA',
          biography: '',
          owner: 0,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!author) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [author, setValue]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
      onPhotoSelect?.(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    onPhotoSelect?.(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      {/* Foto do autor */}
      <div className="flex flex-col items-center gap-sm">
        <div className="relative">
          {photoPreview ? (
            <img
              src={photoPreview}
              alt={t('pages.authors.form.photoAlt')}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <UserCircle className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {photoPreview && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              aria-label={t('pages.authors.form.removePhoto')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
            id="author-photo"
          />
          <label
            htmlFor="author-photo"
            className="cursor-pointer text-sm text-primary underline-offset-4 hover:underline"
          >
            {photoPreview
              ? t('pages.authors.form.changePhoto')
              : t('pages.authors.form.addPhoto')}
          </label>
        </div>
      </div>

      <FormSection title={t('pages.authors.form.sectionPersonal')} icon={User}>
        <div className="grid gap-md">
          <div className="space-y-sm">
            <Label htmlFor="name" className="flex items-center gap-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.authors.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.authors.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.authors.form.nationalityLabel')}
            </Label>
            <Select
              value={watch('nationality')}
              onValueChange={(value) => setValue('nationality', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map((nat) => (
                  <SelectItem key={nat.value} value={nat.value}>
                    <span className="flex items-center gap-2">
                      <NATIONALITY_ICON className="h-4 w-4" />
                      {t(`pages.authors.nationalities.${nat.value}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.nationality && (
              <p className="mt-xs text-sm text-destructive">
                {errors.nationality.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.authors.form.sectionLifeDates')} icon={CalendarDays}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="birth_year" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.authors.form.birthYearLabel')}
            </Label>
            <Input
              id="birth_year"
              type="number"
              {...register('birth_year', { valueAsNumber: true })}
              placeholder={t('pages.authors.form.birthYearPlaceholder')}
              disabled={isLoading}
            />
            {errors.birth_year && (
              <p className="mt-xs text-sm text-destructive">
                {errors.birth_year.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.authors.form.birthEraLabel')}
            </Label>
            <Select
              value={watch('birth_era')}
              onValueChange={(value) => setValue('birth_era', value as 'AC' | 'DC')}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.authors.form.birthEraPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {ERAS.map((era) => (
                  <SelectItem key={era.value} value={era.value}>
                    {t(`pages.authors.eras.${era.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.birth_era && (
              <p className="mt-xs text-sm text-destructive">
                {errors.birth_era.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="death_year" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.authors.form.deathYearLabel')}
            </Label>
            <Input
              id="death_year"
              type="number"
              {...register('death_year', { valueAsNumber: true })}
              placeholder={t('pages.authors.form.deathYearPlaceholder')}
              disabled={isLoading}
            />
            {errors.death_year && (
              <p className="mt-xs text-sm text-destructive">
                {errors.death_year.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.authors.form.deathEraLabel')}
            </Label>
            <Select
              value={watch('death_era') || ''}
              onValueChange={(value) =>
                setValue('death_era', (value as 'AC' | 'DC' | undefined) || undefined)
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.authors.form.deathEraPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {ERAS.map((era) => (
                  <SelectItem key={era.value} value={era.value}>
                    {t(`pages.authors.eras.${era.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.death_era && (
              <p className="mt-xs text-sm text-destructive">
                {errors.death_era.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.authors.form.sectionAbout')} icon={FileText}>
        <div className="space-y-sm">
          <Label htmlFor="biography" className="flex items-center gap-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.authors.form.biographyLabel')}
          </Label>
          <Textarea
            id="biography"
            {...register('biography')}
            placeholder={t('pages.authors.form.biographyPlaceholder')}
            rows={4}
            disabled={isLoading}
          />
          {errors.biography && (
            <p className="mt-xs text-sm text-destructive">{errors.biography.message}</p>
          )}
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
