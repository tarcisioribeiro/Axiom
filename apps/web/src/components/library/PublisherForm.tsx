/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CalendarDays, Globe, Save, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
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
import { COUNTRY_ICON } from '@/config/icons';
import { notifyFormErrors } from '@/lib/form-errors';
import { logger } from '@/lib/logger';
import { makePublisherSchema, type PublisherFormData } from '@/lib/validations';
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
  const publisherSchema = useMemo(() => makePublisherSchema(t), [t]);
  const {
    control,
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
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, notifyFormErrors)}
      className="space-y-lg"
    >
      <FormSection
        title={t('pages.publishers.form.sectionIdentification')}
        icon={Building2}
      >
        <div className="gap-md grid">
          <div className="space-y-sm">
            <Label htmlFor="name" className="gap-xs flex items-center">
              <Building2 className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.publishers.form.nameLabel')}
            </Label>
            <Input
              id="name"
              {...register('name')}
              aria-invalid={!!errors.name}
              placeholder={t('pages.publishers.form.namePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Globe className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.publishers.form.countryLabel')}
            </Label>
            <Select
              value={watch('country')}
              onValueChange={(value) => setValue('country', value)}
              disabled={isLoading}
            >
              <SelectTrigger aria-invalid={!!errors.country}>
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
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.publishers.form.sectionInfo')} icon={Globe}>
        <div className="gap-md grid">
          <div className="space-y-sm">
            <Label htmlFor="website" className="gap-xs flex items-center">
              <Globe className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.publishers.form.websiteLabel')}
            </Label>
            <Input
              id="website"
              type="url"
              {...register('website')}
              aria-invalid={!!errors.website}
              placeholder={t('pages.publishers.form.websitePlaceholder')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label htmlFor="founded_year" className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.publishers.form.foundedYearLabel')}
            </Label>
            <Controller
              control={control}
              name="founded_year"
              render={({ field }) => (
                <NumberStepper
                  id="founded_year"
                  aria-invalid={!!errors.founded_year}
                  disabled={isLoading}
                  min={1000}
                  max={new Date().getFullYear()}
                  optional
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? undefined)}
                />
              )}
            />
          </div>
        </div>
      </FormSection>

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
