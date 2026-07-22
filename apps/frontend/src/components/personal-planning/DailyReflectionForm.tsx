/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Loader2, MessageSquare, Smile } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MOOD_ICONS } from '@/config/icons';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { dailyReflectionSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { MOOD_CHOICES, type DailyReflection } from '@/types';

type DailyReflectionFormData = z.infer<typeof dailyReflectionSchema>;

interface DailyReflectionFormProps {
  reflection?: DailyReflection;
  onSubmit: (data: DailyReflectionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DailyReflectionForm({
  reflection,
  onSubmit,
  onCancel,
  isLoading = false,
}: DailyReflectionFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DailyReflectionFormData>({
    resolver: zodResolver(dailyReflectionSchema),
    defaultValues: reflection
      ? {
          date: reflection.date,
          reflection: reflection.reflection,
          mood: reflection.mood ?? '',
          owner: reflection.owner,
        }
      : {
          date: formatLocalDate(new Date()),
          reflection: '',
          mood: '',
          owner: 0,
        },
  });

  useEffect(() => {
    if (!reflection) {
      const loadMember = async () => {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
        }
      };
      void loadMember();
    }
  }, [reflection, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-lg">
      <FormSection
        title={t('pages.dailyReflections.form.sectionReflection')}
        icon={MessageSquare}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.dailyReflections.form.date')}
            </Label>
            <DatePicker
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              placeholder={t('pages.dailyReflections.form.date')}
              disabled={isLoading}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Smile className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.dailyReflections.form.mood')}
            </Label>
            <Select
              value={watch('mood') ?? ''}
              onValueChange={(value) => setValue('mood', value === 'none' ? '' : value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.dailyReflections.form.moodPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('pages.dailyReflections.filters.allMoods')}
                </SelectItem>
                {MOOD_CHOICES.map((choice) => {
                  const MoodIcon = MOOD_ICONS[choice.value];
                  return (
                    <SelectItem key={choice.value} value={choice.value}>
                      <span className="flex items-center gap-2">
                        {MoodIcon && <MoodIcon className="h-4 w-4" />}
                        {choice.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.mood && (
              <p className="text-sm text-destructive">{errors.mood.message}</p>
            )}
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.dailyReflections.form.reflection')}
            </Label>
            <Textarea
              id="reflection"
              {...register('reflection')}
              placeholder={t('pages.dailyReflections.form.reflectionPlaceholder')}
              rows={6}
              disabled={isLoading}
            />
            {errors.reflection && (
              <p className="text-sm text-destructive">{errors.reflection.message}</p>
            )}
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('pages.dailyReflections.form.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              {t('pages.dailyReflections.form.saving')}
            </>
          ) : (
            t('pages.dailyReflections.form.save')
          )}
        </Button>
      </div>
    </form>
  );
}
