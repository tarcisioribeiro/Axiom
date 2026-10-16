/* eslint-disable react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, MessageSquare, Smile, Save, X } from 'lucide-react';
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
import { notifyFormErrors } from '@/lib/form-errors';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { dailyReflectionSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { MOOD_CHOICES, type DailyReflection } from '@/types';

type DailyReflectionFormData = z.infer<typeof dailyReflectionSchema>;

interface DailyReflectionFormProps {
  reflection?: DailyReflection;
  /** Data inicial ao incluir (padrão: hoje). */
  defaultDate?: string;
  onSubmit: (data: DailyReflectionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DailyReflectionForm({
  reflection,
  defaultDate,
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
          date: defaultDate ?? formatLocalDate(new Date()),
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
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, notifyFormErrors)}
      className="space-y-lg"
    >
      <FormSection
        title={t('pages.dailyReflections.form.sectionReflection')}
        icon={MessageSquare}
      >
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.dailyReflections.form.date')}
            </Label>
            <DatePicker
              aria-invalid={!!errors.date}
              value={watch('date')}
              onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Smile className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.dailyReflections.form.mood')}
            </Label>
            <Select
              value={watch('mood') ?? ''}
              onValueChange={(value) => setValue('mood', value === 'none' ? '' : value)}
              disabled={isLoading}
            >
              <SelectTrigger aria-invalid={!!errors.mood}>
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
                      <span className="gap-sm flex items-center">
                        {MoodIcon && <MoodIcon className="h-4 w-4" />}
                        {choice.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-sm md:col-span-2">
            <Label className="gap-xs flex items-center">
              <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.dailyReflections.form.reflection')}
            </Label>
            <Textarea
              aria-invalid={!!errors.reflection}
              id="reflection"
              {...register('reflection')}
              placeholder={t('pages.dailyReflections.form.reflectionPlaceholder')}
              rows={6}
              disabled={isLoading}
            />
          </div>
        </div>
      </FormSection>

      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('pages.dailyReflections.form.cancel')}
        </Button>
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Save className="h-4 w-4" />}
          {isLoading
            ? t('pages.dailyReflections.form.saving')
            : t('pages.dailyReflections.form.save')}
        </Button>
      </div>
    </form>
  );
}
