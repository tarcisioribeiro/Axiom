import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="date">{t('pages.dailyReflections.form.date')}</Label>
          <DatePicker
            value={watch('date')}
            onChange={(date) => setValue('date', date ? formatLocalDate(date) : '')}
            placeholder={t('pages.dailyReflections.form.date')}
          />
          {errors.date && (
            <p className="mt-1 text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="mood">{t('pages.dailyReflections.form.mood')}</Label>
          <Select
            value={watch('mood') ?? ''}
            onValueChange={(value) => setValue('mood', value === 'none' ? '' : value)}
          >
            <SelectTrigger id="mood">
              <SelectValue
                placeholder={t('pages.dailyReflections.form.moodPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t('pages.dailyReflections.filters.allMoods')}
              </SelectItem>
              {MOOD_CHOICES.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.mood && (
            <p className="mt-1 text-sm text-destructive">{errors.mood.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="reflection">
            {t('pages.dailyReflections.form.reflection')}
          </Label>
          <Textarea
            id="reflection"
            {...register('reflection')}
            placeholder="Escreva sua reflexão do dia..."
            rows={6}
          />
          {errors.reflection && (
            <p className="mt-1 text-sm text-destructive">{errors.reflection.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('pages.dailyReflections.form.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
