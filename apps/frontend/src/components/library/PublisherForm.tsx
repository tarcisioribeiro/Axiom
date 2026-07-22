/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CalendarDays, Globe, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
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
import { COUNTRY_ICON } from '@/config/icons';
import { logger } from '@/lib/logger';
import { publisherSchema, type PublisherFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { COUNTRIES } from '@/types';
import type { Publisher } from '@/types';

interface PublisherFormProps {
  publisher?: Publisher;
  onSubmit: (data: PublisherFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PublisherForm({
  publisher,
  onSubmit,
  onCancel,
  isLoading = false,
}: PublisherFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PublisherFormData>({
    resolver: zodResolver(publisherSchema),
    defaultValues: publisher
      ? {
          name: publisher.name,
          description: publisher.description || '',
          website: publisher.website || '',
          country: publisher.country || 'Brazil',
          founded_year: publisher.founded_year,
          owner: publisher.owner,
        }
      : {
          name: '',
          description: '',
          website: '',
          country: 'Brazil',
          founded_year: undefined,
          owner: 0,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!publisher) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [publisher, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection
        title={t('pages.publishers.form.sectionIdentification')}
        icon={Building2}
      >
        <div className="grid gap-md">
          <div className="space-y-sm">
            <Label htmlFor="name" className="flex items-center gap-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.publishers.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.publishers.form.namePlaceholder')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-xs text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.publishers.form.countryLabel')}
            </Label>
            <Select
              value={watch('country')}
              onValueChange={(value) => setValue('country', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    <span className="flex items-center gap-2">
                      <COUNTRY_ICON className="h-4 w-4" />
                      {t(`pages.publishers.countries.${country.value}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && (
              <p className="mt-xs text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.publishers.form.sectionInfo')} icon={Globe}>
        <div className="grid gap-md">
          <div className="space-y-sm">
            <Label htmlFor="website" className="flex items-center gap-xs">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.publishers.form.websiteLabel')}
            </Label>
            <Input
              id="website"
              type="url"
              {...register('website')}
              placeholder={t('pages.publishers.form.websitePlaceholder')}
              disabled={isLoading}
            />
            {errors.website && (
              <p className="mt-xs text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="founded_year" className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.publishers.form.foundedYearLabel')}
            </Label>
            <Input
              id="founded_year"
              type="number"
              min="1000"
              max={new Date().getFullYear()}
              {...register('founded_year', {
                setValueAs: (value: string) =>
                  value === '' ? undefined : parseInt(value),
              })}
              disabled={isLoading}
            />
            {errors.founded_year && (
              <p className="mt-xs text-sm text-destructive">
                {errors.founded_year.message}
              </p>
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
