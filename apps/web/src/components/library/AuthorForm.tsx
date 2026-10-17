/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  FileText,
  Globe,
  ImagePlus,
  Save,
  User,
  UserCircle,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NATIONALITY_ICON } from '@/config/icons';
import { notifyFormErrors } from '@/lib/form-errors';
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
    control,
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
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, notifyFormErrors)}
      className="space-y-lg"
    >
      {/* Duas colunas: foto, dados e datas à esquerda; biografia à direita */}
      <div className="gap-lg grid grid-cols-1 lg:grid-cols-2">
        <div className="space-y-lg">
          {/* Foto do autor */}
          <div className="gap-sm flex flex-col items-center">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={t('pages.authors.form.photoAlt')}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="bg-muted flex h-24 w-24 items-center justify-center rounded-full">
                  <UserCircle className="text-muted-foreground h-12 w-12" />
                </div>
              )}
              {photoPreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                  aria-label={t('pages.authors.form.removePhoto')}
                >
                  <X className="h-3 w-3" />
                </Button>
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
                className="gap-xs text-primary flex cursor-pointer items-center text-sm underline-offset-4 hover:underline"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {photoPreview
                  ? t('pages.authors.form.changePhoto')
                  : t('pages.authors.form.addPhoto')}
              </label>
            </div>
          </div>

          <FormSection title={t('pages.authors.form.sectionPersonal')} icon={User}>
            <div className="gap-md grid">
              <div className="space-y-sm">
                <Label htmlFor="name" className="gap-xs flex items-center">
                  <User className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.authors.form.nameLabel')}
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                  placeholder={t('pages.authors.form.namePlaceholder')}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Globe className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.authors.form.nationalityLabel')}
                </Label>
                <Select
                  value={watch('nationality')}
                  onValueChange={(value) => setValue('nationality', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger aria-invalid={!!errors.nationality}>
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
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t('pages.authors.form.sectionLifeDates')}
            icon={CalendarDays}
          >
            <div className="gap-md grid grid-cols-1 md:grid-cols-2">
              <div className="space-y-sm">
                <Label htmlFor="birth_year" className="gap-xs flex items-center">
                  <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.authors.form.birthYearLabel')}
                </Label>
                <Controller
                  control={control}
                  name="birth_year"
                  render={({ field }) => (
                    <NumberStepper
                      id="birth_year"
                      aria-invalid={!!errors.birth_year}
                      disabled={isLoading}
                      placeholder={t('pages.authors.form.birthYearPlaceholder')}
                      min={1}
                      max={new Date().getFullYear()}
                      optional
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.authors.form.birthEraLabel')}
                </Label>
                <Select
                  value={watch('birth_era')}
                  onValueChange={(value) => setValue('birth_era', value as 'AC' | 'DC')}
                  disabled={isLoading}
                >
                  <SelectTrigger aria-invalid={!!errors.birth_era}>
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
              </div>

              <div className="space-y-sm">
                <Label htmlFor="death_year" className="gap-xs flex items-center">
                  <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.authors.form.deathYearLabel')}
                </Label>
                <Controller
                  control={control}
                  name="death_year"
                  render={({ field }) => (
                    <NumberStepper
                      id="death_year"
                      aria-invalid={!!errors.death_year}
                      disabled={isLoading}
                      placeholder={t('pages.authors.form.deathYearPlaceholder')}
                      min={1}
                      optional
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.authors.form.deathEraLabel')}
                </Label>
                <Select
                  value={watch('death_era') || ''}
                  onValueChange={(value) =>
                    setValue(
                      'death_era',
                      (value as 'AC' | 'DC' | undefined) || undefined
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger aria-invalid={!!errors.death_era}>
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
              </div>
            </div>
          </FormSection>
        </div>

        <FormSection
          title={t('pages.authors.form.sectionAbout')}
          icon={FileText}
          className="flex flex-col"
          contentClassName="flex flex-1 flex-col"
        >
          <div className="space-y-sm flex flex-1 flex-col">
            <Label htmlFor="biography" className="gap-xs flex items-center">
              <FileText className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.authors.form.biographyLabel')}
            </Label>
            <Textarea
              id="biography"
              {...register('biography')}
              aria-invalid={!!errors.biography}
              placeholder={t('pages.authors.form.biographyPlaceholder')}
              rows={4}
              className="flex-1 resize-none"
              disabled={isLoading}
            />
          </div>
        </FormSection>
      </div>

      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Save className="h-4 w-4" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
